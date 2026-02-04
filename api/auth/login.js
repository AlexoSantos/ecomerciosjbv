const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    // ⚠️ Se sua coluna de senha tiver outro nome, ajuste "password_hash"
    const rows = await sql`
      SELECT id, name, email, role, password_hash
      FROM public.users
      WHERE lower(email) = ${emailNorm}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, error: "Credenciais inválidas" });
    }

    const u = rows[0];
    const ok = await bcrypt.compare(String(password), String(u.password_hash || ""));
    if (!ok) {
      return res.status(401).json({ success: false, error: "Credenciais inválidas" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, error: "JWT_SECRET não configurado na Vercel" });
    }

    const token = jwt.sign(
      { userId: u.id, role: u.role, email: u.email },
      secret,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token,
      user: { id: u.id, name: u.name, email: u.email, role: u.role },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor",
      detail: String(err.message || err),
    });
  }
};
