const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

module.exports = async (req, res) => {
  try {
    const products = await sql`
      SELECT id, title, description, price_cents, stock, store_name, store_slug
      FROM products
      ORDER BY title
    `;

    res.status(200).json(products.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price_cents / 100,
      stock: p.stock,
      store: p.store_name,
      store_slug: p.store_slug
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
};
