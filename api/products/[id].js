const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL não configurada na Vercel (Production).' });
    }

    const sql = neon(DATABASE_URL);
    const { id } = req.query;

    const rows = await sql`
      SELECT
        id,
        title,
        description,
        price_cents,
        stock
      FROM public.products
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const p = rows[0];

    return res.status(200).json({
      success: true,
      product: {
        id: p.id,
        title: p.title,
        description: p.description,
        price: Number(p.price_cents || 0) / 100,
        stock: Number(p.stock || 0),
        store: 'Loja',
        store_slug: ''
      }
    });
  } catch (err) {
    console.error('ERROR /api/products/[id]:', err);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      detail: String(err?.message || err)
    });
  }
};
