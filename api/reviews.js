module.exports = async (req, res) => {
  try {
    const { id } = req.query;

    // Retorna lista de avaliações (Mock)
    return res.status(200).json({
      success: true,
      productId: id,
      reviews: [
          { name: 'Cliente Teste', rating: 5, text: 'Produto muito bom!' }
      ],
      ratingAvg: 5,
      ratingCount: 1
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Erro ao buscar reviews" });
  }
};