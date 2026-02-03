const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL não configurada na Vercel.' });
    }

    const sql = neon(DATABASE_URL);

    // Pega produtos + dados da loja (como JSON), sem depender do nome das colunas da tabela stores
    const rows = await sql`
      SELECT
        p.id,
        p.store_id,
        p.title,
        p.description,
        p.price_cents,
        p.sku,
        p.stock,
        p.is_active,
        p.created_at,
        p.updated_at,
        to_jsonb(s) AS store
      FROM public.products p
      LEFT JOIN public.stores s ON s.id = p.store_id
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
      LIMIT 200
    `;

    const pickStoreName = (storeObj) => {
      if (!storeObj || typeof storeObj !== 'object') return 'Loja';
      return (
        storeObj.name ||
        storeObj.title ||
        storeObj.store_name ||
        storeObj.nome ||
        storeObj.razao_social ||
        storeObj.fantasy_name ||
        'Loja'
      );
    };

    const pickStoreSlug = (storeObj) => {
      if (!storeObj || typeof storeObj !== 'object') return '';
      return (
        storeObj.slug ||
        storeObj.store_slug ||
        storeObj.handle ||
        storeObj.username ||
        ''
      );
    };

    const out = (rows || []).map(p => ({
      id: p.id,
      store_id: p.store_id,
      title: p.title,
      description: p.description,
      price_cents: Number(p.price_cents || 0),
      stock: Number(p.stock || 0),
      store_name: pickStoreName(p.store),
      store_slug: pickStoreSlug(p.store),
    }));

    return res.status(200).json(out);
  } catch (err) {
    console.error('ERROR /api/products:', err);
    return res.status(500).json({ error: 'Erro ao buscar produtos', detail: String(err?.message || err) });
  }
};
