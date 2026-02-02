// api/products/[id]/reviews.js
module.exports = async (req, res) => {
  try {
    const { id } = req.query;

    // Por enquanto, devolve lista vazia para não dar 404
    // (Depois a gente liga no banco e traz as avaliações reais)
    return res.status(200).json({
      success: true,
      productId: id,
      reviews: [],
      ratingAvg: 0,
      ratingCount: 0
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Erro ao buscar reviews" });
  }
};
