const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const { name, email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const nameNorm = String(name || "").trim();

    // verifica se já existe
    const exists = await sql`SELECT id FROM public.users WHERE lower(email) = ${emailNorm} LIMIT 1`;
    if (exists && exists.length > 0) {
      return res.status(409).json({ success: false, error: "Email já cadastrado" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    // ⚠️ IMPORTANTE:
    // A maioria dos schemas usa: users(id, name, email, password_hash, role, created_at)
    // Se no seu users a coluna tiver outro nome, ajuste aqui (ex: "password" ao invés de "password_hash").
    const rows = await sql`
      INSERT INTO public.users (name, email, password_hash, role)
      VALUES (${nameNorm || null}, ${emailNorm}, ${passwordHash}, 'customer')
      RETURNING id, name, email, role
    `;

    const user = rows[0];

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, error: "JWT_SECRET não configurado na Vercel" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      secret,
      { expiresIn: "7d" }
    );

    return res.status(200).json({ success: true, token, user });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor",
      detail: String(err.message || err),
    });
  }
};
