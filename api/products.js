module.exports = async (req, res) => {
    // Simulação de banco de dados
    // Em produção, conecte ao seu DB real aqui
    const products = [
        {
            id: 'p1',
            name: 'Pneu Aro 14 (API)',
            price: 350.00,
            cat: 'acessorios_veiculos',
            img: '🍩',
            store: 'Auto Center SJ',
            stock: 12
        },
        {
            id: 'p2',
            name: 'Som Automotivo (API)',
            price: 180.00,
            cat: 'acessorios_veiculos',
            img: '🔊',
            store: 'Som & Cia',
            stock: 5
        }
    ];

    res.status(200).json({
        success: true,
        products: products
    });
};