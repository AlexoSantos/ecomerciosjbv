const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  try {
    // Pega a string de conexão das env vars do Vercel
    const conn =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING;

    // Se não tiver conexão, responde com erro claro (não crasha)
    if (!conn) {
      return res.status(500).json({
        error: "Sem string de conexão com o banco.",
        detail:
          "No Vercel (projeto ecomerciosjbv-site), verifique Environment Variables em Production: DATABASE_URL ou POSTGRES_URL."
      });
    }

    // Só cria o cliente DEPOIS de ter a conexão
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
      FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
    `;

    return res.status(200).json(products);
  } catch (err) {
    console.error("API /api/products error:", err);
    return res.status(500).json({
      error: "Erro ao buscar produtos",
      detail: String(err?.message || err)
    });
  }
};
