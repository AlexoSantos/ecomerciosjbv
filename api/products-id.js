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
