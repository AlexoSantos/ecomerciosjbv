const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  try {
    const conn =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING;

    if (!conn) {
      return res.status(500).json({
        error:
          "Conexão com banco não encontrada. Verifique DATABASE_URL ou POSTGRES_URL nas variáveis do Vercel."
      });
    }

    const sql = neon(conn);

    const products = await sql`
      SELECT
        p.id,
        p.title,
        p.description,
        p.price_cents,
        p.stock,
        s.store_name,
        s.store_slug
      FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
    `;

    return res.status(200).json(products);
  } catch (error) {
    console.error("API /api/produtos error:", error);
    return res.status(500).json({
      error: "Erro ao buscar produtos",
      detail: String(error?.message || error)
    });
  }
};
