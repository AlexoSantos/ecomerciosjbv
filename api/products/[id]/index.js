const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  try {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
      return res.status(500).json({
        error: 'DATABASE_URL não configurada no ambiente da Vercel (Production).'
      });
    }

    const sql = neon(DATABASE_URL);
    const { id } = req.query;

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ✅ Busca produto + loja via JOIN (evita depender de store_name/store_slug dentro de products)
    const rows = await sql`
      SELECT
        p.id,
        p.title,
        p.description,
        p.price_cents,
        p.stock,
        COALESCE(s.name, 'Loja') AS store_name,
        COALESCE(s.slug, '')     AS store_slug
      FROM public.products p
      LEFT JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = ${id}::uuid
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
        store: p.store_name,
        store_slug: p.store_slug
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
