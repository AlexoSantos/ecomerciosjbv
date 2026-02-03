module.exports = async (req, res) => {
  const { id } = req.query;

  res.status(200).json({
    success: true,
    productId: id,
    reviews: [],
    ratingAvg: 0,
    ratingCount: 0
  });
};
