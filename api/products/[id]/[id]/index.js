import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rows = await sql`
      SELECT 
        id,
        title,
        description,
        price_cents,
        stock,
        store_name,
        store_slug
      FROM products
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const p = rows[0];

    return res.status(200).json({
      success: true,
      product: {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price_cents / 100,
        stock: p.stock,
        store: p.store_name,
        store_slug: p.store_slug
      }
    });
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
