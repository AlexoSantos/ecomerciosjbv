const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);

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
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
}
