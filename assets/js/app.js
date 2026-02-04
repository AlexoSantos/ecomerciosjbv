const IS_FILE = window.location.protocol === 'file:';
// --- DADOS DA APLICAÇÃO ---
        const categories = [
            {id:'acessorios_veiculos', name:'Acessórios Veículos', icon:'🔧'},
            {id:'agro', name:'Agro', icon:'🚜'},
            {id:'alimentos', name:'Alimentos e Bebidas', icon:'🥦'},
            {id:'animais', name:'Animais', icon:'🐾'},
            {id:'antiguidades', name:'Antiguidades', icon:'🏺'},
            {id:'arte', name:'Arte e Papelaria', icon:'🎨'},
            {id:'bebes', name:'Bebês', icon:'👶'},
            {id:'beleza', name:'Beleza', icon:'💄'},
            {id:'brinquedos', name:'Brinquedos', icon:'🧸'},
            {id:'moda', name:'Moda', icon:'👕'},
            {id:'cameras', name:'Câmeras', icon:'📷'},
            {id:'veiculos', name:'Veículos', icon:'🚗'},
            {id:'casa', name:'Casa e Decoração', icon:'🏡'},
            {id:'celulares', name:'Celulares', icon:'📱'},
            {id:'construcao', name:'Construção', icon:'🏗️'},
            {id:'eletrodomesticos', name:'Eletrodomésticos', icon:'🧊'},
            {id:'eletronicos', name:'Eletrônicos', icon:'📺'},
            {id:'esportes', name:'Esportes', icon:'⚽'},
            {id:'ferramentas', name:'Ferramentas', icon:'🔨'},
            {id:'festas', name:'Festas', icon:'🎉'},
            {id:'games', name:'Games', icon:'🎮'},
            {id:'imoveis', name:'Imóveis', icon:'🏠'},
            {id:'industria', name:'Indústria', icon:'🏭'},
            {id:'informatica', name:'Informática', icon:'💻'},
            {id:'ingressos', name:'Ingressos', icon:'🎟️'},
            {id:'instrumentos', name:'Instrumentos', icon:'🎸'},
            {id:'joias', name:'Joias e Relógios', icon:'💍'},
            {id:'livros', name:'Livros', icon:'📚'},
            {id:'musica', name:'Música e Filmes', icon:'🎬'},
            {id:'saude', name:'Saúde', icon:'🩺'},
            {id:'servicos', name:'Serviços', icon:'🛠️'},
            {id:'outros', name:'Outros', icon:'➕'}
        ];

        // Mock de Lojas para o Admin (Simulação)
        let storesMock = [
            { id: 1, name: "Auto Center SJ", status: "active", plan: "Básico" },
            { id: 2, name: "Som & Cia", status: "active", plan: "Intermediário" },
            { id: 3, name: "Doceria", status: "blocked", plan: "Teste" }
        ];

        // Helper para coordenadas aleatórias em SJBV
        const SJBV_LAT = -21.9708;
        const SJBV_LNG = -46.7977;
        function randCoord(base) { return base + (Math.random() - 0.5) * 0.04; }

        // Banco de dados expandido (160 produtos, 5 por categoria)
        let productsDB = [];

        // Feira foi desativada: agora o site mostra APENAS produtos vindos do backend (/api/products)
        let feiraProducts = [];

        // ====== API (Vercel) ======
const VERCEL_API_BASE = "https://ecomerciosjbv-site.vercel.app/api";

// Converte o formato do banco para o formato que seu front já usa
function mapApiProduct(p) {
  return {
    id: p.id,
    name: p.title || "",
    description: p.description || "",
    price: (p.price_cents || 0) / 100,
    stock: typeof p.stock === "number" ? p.stock : 0,
    store: p.store_name || "Loja",
    img: "/logo.png", // por enquanto usa o logo (depois colocamos imagens reais)
    cat: "outros"
  };
}

// Carrega produtos do banco e substitui o productsDB
async function loadProductsFromApi() {
  try {
    const resp = await fetch(VERCEL_API_BASE + "/products");
    const data = await resp.json();

    if (!Array.isArray(data)) {
      console.warn("API não retornou lista:", data);
      return false;
    }
    // Substitui o array local pelos produtos do banco
    productsDB = data.map(mapApiProduct);

    console.log("✅ Produtos carregados da API:", productsDB.length);
    return true;
  } catch (e) {
    console.warn("⚠️ Falha ao carregar produtos da API, usando produtos locais.", e);
    return false;
  }
}

        // Adiciona IDs (sem sobrescrever IDs do banco) + coordenadas
        function ensureProductIdsAndGeo() {
            try {
                productsDB = (productsDB || []).map((p, i) => ({
                    ...p,
                    id: p && p.id ? p.id : ('p' + i),
                    lat: (p && typeof p.lat === 'number') ? p.lat : randCoord(SJBV_LAT),
                    lng: (p && typeof p.lng === 'number') ? p.lng : randCoord(SJBV_LNG)
                }));
            } catch (e) { /* noop */ }

            try {
                feiraProducts = (feiraProducts || []).map((p, i) => ({
                    ...p,
                    id: p && p.id ? p.id : ('f' + i),
                    lat: (p && typeof p.lat === 'number') ? p.lat : randCoord(SJBV_LAT),
                    lng: (p && typeof p.lng === 'number') ? p.lng : randCoord(SJBV_LNG)
                }));
            } catch (e) { /* noop */ }
        }

        let cart = [];
        let user = null;
        let pendingCheckout = false; // when true, after login/register we should continue finishing the order
        let _pendingPrefillEmail = null;
        let userLat = null, userLng = null;
        let currentPaymentMethod = 'pix'; // 'pix', 'new-card', 'saved-card'

        // Variáveis globais faltantes
        let wishlist = [];
        let activeContext = 'home';
        let currentSort = 'all';
        let socket = null;
        let navigationStack = []; // Histórico de navegação para o botão voltar
        
        // Paginação (Scroll Infinito)
        let homeDisplayList = [];
        let homeDisplayIndex = 0;
        const HOME_PAGE_SIZE = 12;
        let activeHomeFilter = 'all';
        
        // Variáveis para filtro de preço
        let activePriceMin = null;
        let activePriceMax = null;

        // --- INICIALIZAÇÃO ---
        async function init() {
            loadUser();
            await detectBackend();
            await loadWishlist();

            // 1) Tenta carregar do banco (Vercel/Neon). Se falhar, usa dados locais.
            const apiOk = await loadProductsFromApi();
            if (!apiOk) {
                loadProducts();
            }

            // 2) Garante IDs e coordenadas (sem quebrar os UUIDs do banco)
            ensureProductIdsAndGeo();

            loadCart();
            renderHome('all');
            // Lazy-load images present after initial render
            try { lazyLoadImages(); } catch(e){}
            renderCategories();
            initBannerCarousel(); // Inicia o carrossel
            initBottomBanner(); // Inicia banner de propagandas inferior
            initFeiraBanners(); // Inicia banners da feira
            initSocket(); // Inicia o chat
            // Defer rendering Feira (non-critical) to idle to speed initial load
            if (window.requestIdleCallback) requestIdleCallback(() => { renderFeira(); try { lazyLoadImages(); } catch(e){} }); else { setTimeout(()=>{ renderFeira(); try { lazyLoadImages(); } catch(e){} }, 300); }
            populateDropdowns();
            requestLocation();
            // Attach registration masks/validators
            attachRegistrationMasks();
            initFlashOffers();

            // Verifica se é fluxo de redefinição de senha
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('token')) {
                closeWelcomeScreen();
                navigateTo('reset-password-screen');
            }
            
            // Verifica se há link direto para produto (?product=ID)
            if (urlParams.has('product')) {
                closeWelcomeScreen();
                setTimeout(() => openProduct(urlParams.get('product')), 500); // Pequeno delay para garantir carregamento
            }
        }

        // detect backend availability and set apiBase
        let backendAvailable = false;
        let apiBase = VERCEL_API_BASE; // Base da API na Vercel (hoje usamos só /products)
        async function detectBackend() {
            // Neste projeto, por enquanto só temos a rota /api/products no Vercel.
            // As outras rotas (login, pedidos, checkout etc.) ainda não existem.
            // Então mantemos backendAvailable = false para não tentar chamar endpoints que não foram criados.
            backendAvailable = false;
            // Ainda assim mantemos o loop de sync (não faz nada enquanto backendAvailable=false)
            startPeriodicSync();
        }

        let _syncInterval = null;
        function startPeriodicSync() {
            if (_syncInterval) return;
            _syncInterval = setInterval(async () => {
                // re-detect backend availability if false
                if (!backendAvailable) {
                    try {
                        const r = await fetch(apiBase + '/products'); backendAvailable = r && r.ok;
                    } catch (e) { backendAvailable = false; }
                }
                if (backendAvailable) {
                    const needs = localStorage.getItem('needsMigration');
                    if (needs === 'true') {
                        console.log('Periodic sync: migrating local changes to server...');
                        try { await migrateToServer(); localStorage.setItem('needsMigration','false'); } catch(e) { console.warn('Periodic migrate failed', e); }
                    }
                }
            }, 30 * 1000); // every 30s
        }

        // --- NAVEGAÇÃO ---
        function navigateTo(screenId, pushToHistory = true) {
            // Se for para home, limpa o histórico (reset)
            if (screenId === 'home' && pushToHistory) {
                navigationStack = []; // Reset stack on home click
                pushToHistory = false; // Don't push home to stack if we are resetting
            }

            const current = document.querySelector('.container.active');
            const target = document.getElementById(screenId);
            if (!target) return;
            if (current === target) return;

            // Adiciona ao histórico se não for uma ação de "voltar" e se tivermos uma tela atual
            if (pushToHistory && current) {
                navigationStack.push({ id: current.id, scroll: window.scrollY });
            }
            
            // Atualiza o contexto apenas se for uma das abas principais
            if (['home', 'feira', 'categories'].includes(screenId)) {
                activeContext = screenId;
            }

            // update nav tabs active state (immediate)
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            // Mantém a aba ativa baseada no contexto, mesmo se estivermos em sub-telas (produto/loja)
            const tab = document.querySelector(`.nav-tab[data-target="${activeContext}"]`);
            if (tab) tab.classList.add('active');

            // Fade-out current then show target with fade-in
            const showTarget = () => {
                target.classList.add('active', 'fade-in');
                target.addEventListener('animationend', function onIn() {
                    target.classList.remove('fade-in');
                    target.removeEventListener('animationend', onIn);
                });
            };

            if (current) {
                current.classList.add('fade-out');
                current.addEventListener('animationend', function onOut() {
                    current.classList.remove('fade-out', 'active');
                    current.removeEventListener('animationend', onOut);
                    showTarget();
                });
            } else {
                showTarget();
            }

            // Se não for uma ação de voltar (pushToHistory=true), rola para o topo.
            // Se for voltar (pushToHistory=false), o caller (btn-back) deve lidar com o scroll ou passamos como param.
            if (pushToHistory) window.scrollTo(0,0);

            // When opening the cart, ensure it's rendered/updated
            if (screenId === 'cart') {
                renderCart();
            }
            // Update floating back button visibility after navigation
            try { if (typeof updateBackBtnState === 'function') updateBackBtnState(); } catch(e) { /* noop */ }
        }

        // Função global de voltar (simula back button)
        window.goBack = function() {
    try { const cur=(document.querySelector('.container.active')||{}).id; if(['home','categories','feira'].includes(cur)){ window.scrollTo({top:0,behavior:'smooth'}); return; } } catch(e) {}

            // Se houver modal aberto, fecha
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                closeModal(activeModal.id);
                return;
            }

            // Tenta voltar usando o histórico da pilha
            const previousScreen = navigationStack.pop();
            if (previousScreen) {
                navigateTo(previousScreen.id, false); // false = não adicionar ao histórico novamente
                setTimeout(() => window.scrollTo(0, previousScreen.scroll || 0), 50);
            } else {
                navigateTo('home');
            }
        };

        // --- CARRINHO ---
        async function addToCart(a, b, c, d) {
            // supports addToCart(name, price, [btn]) or addToCart(id, name, price, [btn])
            let id=null, name=null, price=null, btn=null;
            if (typeof c === 'number') { id = a; name = b; price = c; btn = d; }
            else { name = a; price = b; btn = c; }
            
            // Indicador visual de carregamento
            let originalContent = '';
            if (btn) {
                btn.disabled = true;
                originalContent = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            try {
                // change cart shape: keep quantities per item
                // check stock if id provided
                if (id) {
                // Validação de estoque em tempo real
                if (backendAvailable) {
                    try {
                        const resp = await fetch(apiBase + '/products/' + id);
                        const json = await resp.json();
                        if (json && json.success && json.product) {
                            // Atualiza estoque local com o do servidor antes de validar
                            const localP = productsDB.find(p=>p.id===id);
                            if (localP) localP.stock = json.product.stock;
                        }
                    } catch(e) { console.warn('Erro ao validar estoque online', e); }
                }

                const prod = productsDB.find(p=>p.id===id);
                if (prod && typeof prod.stock !== 'undefined') {
                    const existing = cart.find(it => it.id === id);
                    const existingQty = existing ? existing.qty : 0;
                    if (existingQty + 1 > prod.stock) {
                        showToast('Não há estoque suficiente para adicionar mais unidades deste produto');
                        return;
                    }
                }
            }

            const existing = id ? cart.find(it => it.id === id) : null;
            if (existing) {
                existing.qty = (existing.qty || 1) + 1;
            } else {
                cart.push({ id, name, price, qty: 1 });
            }
            updateCartCount();
            showToast(`${name} adicionado ao carrinho!`);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
        }

        function updateCartCount() {
            const el = document.getElementById('cart-count');
            const totalQty = cart.reduce((s,i)=>s+(i.qty||0),0);
            el.innerText = totalQty;
            if(totalQty > 0) el.classList.add('visible'); else el.classList.remove('visible');
            el.classList.add('bump');
            setTimeout(()=>el.classList.remove('bump'), 200);
            if(document.getElementById('cart').classList.contains('active')) renderCart();
            // persist cart state
            saveCart();
        }

        function saveCart() {
            try {
                localStorage.setItem('ecommerceCart', JSON.stringify(cart));
            } catch (err) {
                console.warn('Falha ao salvar carrinho', err);
            }
            // Sincroniza com o servidor para recuperação de carrinho
            syncCartWithServer();
        }

        function loadCart() {
            try {
                const s = localStorage.getItem('ecommerceCart');
                if (s) {
                    const parsed = JSON.parse(s);
                    if (Array.isArray(parsed)) {
                        // normalize to {id,name,price,qty}
                        cart = parsed.map(it => ({ id: it.id || null, name: it.name || it, price: it.price || 0, qty: (typeof it.qty === 'number') ? it.qty : 1 }));
                    }
                }
            } catch (err) {
                console.warn('Erro ao ler carrinho salvo', err);
                cart = [];
            }
            // update UI with loaded cart
            updateCartCount();
        }

        async function syncCartWithServer() {
            if (!backendAvailable || !user) return; // Permite sincronizar carrinho vazio para limpar no servidor
            const token = localStorage.getItem('ecom_token');
            if (!token) return;
            try {
                await fetch(apiBase + '/cart/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ cart })
                });
            } catch(e) { console.warn('Erro ao sincronizar carrinho', e); }
        }

        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerText = msg;
            t.classList.add('show');
            setTimeout(()=>t.classList.remove('show'), 2500);
        }

        function renderCart() {
            const list = document.getElementById('cart-list');
            const checkoutArea = document.getElementById('cart-checkout-area');
            
            if(cart.length === 0) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #999;">
                        <i class="fas fa-shopping-cart" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                        <h3 style="margin-bottom: 10px;">Seu carrinho está vazio</h3>
                        <p>Adicione produtos para vê-los aqui</p>
                    </div>`;
                checkoutArea.style.display = 'none';
                return;
            }
            
            list.innerHTML = "";
            let sub = 0;
            cart.forEach((item, i) => {
                const qty = item.qty || 1;
                const lineTotal = (item.price || 0) * qty;
                sub += lineTotal;
                list.innerHTML += `
                    <div class="cart-item">
                        <div style="flex: 1;">
                            <b>${item.name} <small style="color:#666">× ${qty}</small></b><br>
                            <small style="color: #666;">R$ ${(item.price || 0).toFixed(2)} • total R$ ${lineTotal.toFixed(2)}</small>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button class="btn-primary" style="padding:6px 8px; font-size:0.95rem;" onclick="changeQty(${i}, -1)">−</button>
                            <button class="btn-primary" style="padding:6px 8px; font-size:0.95rem;" onclick="changeQty(${i}, 1)">+</button>
                            <button style="color: #dc3545; background: none; border: none; font-size: 1.2rem; padding: 5px 10px; border-radius: 5px; transition: all 0.2s;" 
                                    onmouseover="this.style.background='#f8d7da'" 
                                    onmouseout="this.style.background='transparent'"
                                    onclick="cart.splice(${i},1); updateCartCount()">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>`;
            });
            
            // Renderiza área de checkout integrada
            checkoutArea.style.display = 'block';
            
            // Auto-preencher e calcular CEP se usuário logado
            const cepInput = document.getElementById('shipping-cep');
            if (cepInput && user && user.address && user.address.zip && !cepInput.value) {
                cepInput.value = user.address.zip;
                calculateShipping(user.address.zip);
            }
            
            // Atualiza totais
            updateTotals();
            
            // Renderiza opções de pagamento
            renderPaymentOptions();
            selectPayment(currentPaymentMethod);
        }

        function changeQty(index, delta) {
            if (!cart[index]) return;
            cart[index].qty = (cart[index].qty || 1) + delta;
            if (cart[index].qty <= 0) {
                cart.splice(index, 1);
            }
            updateCartCount();
        }

        // --- CHECKOUT INTEGRADO ---
        let shippingCost = 15.00;
        let totalOrder = 0;
        let couponDiscount = 0; // valor em R$ a ser subtraído do total (ex.: PRIMEIRACOMPRA)

        async function calculateShipping(cepValue) {
            const cep = (cepValue || '').replace(/\D/g, '');
            const resEl = document.getElementById('shipping-result');
            const btn = document.getElementById('btn-calc-ship');
            
            if (cep.length !== 8) { 
                if(resEl) { resEl.innerText = 'Digite um CEP válido'; resEl.style.color = '#dc3545'; }
                return; 
            }

            if(btn) { btn.disabled = true; btn.innerHTML = '...'; }
            if(resEl) { resEl.innerText = 'Calculando...'; resEl.style.color = '#666'; }

            try {
                const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await resp.json();
                
                if (data.erro) {
                    if(resEl) { resEl.innerText = 'CEP não encontrado'; resEl.style.color = '#dc3545'; }
                    shippingCost = 15.00; // fallback
                } else {
                    // Lógica de simulação de frete baseada na API externa
                    if (data.localidade === 'São João da Boa Vista') {
                        shippingCost = 5.00;
                        if(resEl) { resEl.innerText = `Frete Local (SJBV): R$ 5,00 • 1 dia útil`; resEl.style.color = '#00a650'; }
                    } else if (data.uf === 'SP') {
                        shippingCost = 18.90;
                        if(resEl) { resEl.innerText = `Sedex SP (${data.localidade}): R$ 18,90 • 2 dias úteis`; resEl.style.color = '#00a650'; }
                    } else {
                        shippingCost = 35.50;
                        if(resEl) { resEl.innerText = `PAC (${data.uf}): R$ 35,50 • 7 dias úteis`; resEl.style.color = '#00a650'; }
                    }
                }
            } catch (e) { console.warn(e); if(resEl) resEl.innerText = 'Erro ao calcular'; } 
            finally { if(btn) { btn.disabled = false; btn.innerHTML = 'OK'; } updateTotals(); }
        }

        function updateTotals() {
            const sub = cart.reduce((a,b)=>a + ((b.price||0) * (b.qty||1)),0);
            const totalBeforeDiscount = sub + shippingCost;
            const discount = couponDiscount || 0;
            totalOrder = Math.max(0, totalBeforeDiscount - discount);
            document.getElementById('cart-subtotal').innerText = `R$ ${sub.toFixed(2)}`;
            document.getElementById('cart-shipping').innerText = shippingCost === 0 ? 'GRÁTIS' : `R$ ${shippingCost.toFixed(2)}`;
            document.getElementById('cart-total').innerText = `R$ ${totalOrder.toFixed(2)}`;
            
            // Opções de parcela (protegido caso o elemento não esteja presente)
            const sel = document.getElementById('installments');
            if (sel) {
                sel.innerHTML = "";
                for(let i=1; i<=12; i++) {
                    let val = totalOrder/i;
                    sel.innerHTML += `<option value="${i}">${i}x de R$ ${val.toFixed(2)} sem juros</option>`;
                }
            }
        }

        // Save / load products to persist reviews/stock changes
        function saveProducts() {
            try { localStorage.setItem('productsDB', JSON.stringify(productsDB)); } catch(e){ console.warn('saveProducts err',e); }
            try { localStorage.setItem('feiraProducts', JSON.stringify(feiraProducts)); } catch(e){}
            // mark that local data changed and should be migrated when backend available
            try { localStorage.setItem('needsMigration', 'true'); } catch(e){}
        }

        function loadProducts() {
            // Modo API-ONLY: não carrega catálogo local nem cache antigo do navegador
            productsDB = [];
            feiraProducts = [];
            try {
                localStorage.removeItem('productsDB');
                localStorage.removeItem('feiraProducts');
            } catch (e) {}
        }

        function applyCoupon() {
            const couponEl = document.getElementById('coupon-code');
            const couponCode = couponEl ? (couponEl.value || '').toUpperCase() : '';
            if (!couponCode) { showToast('Digite um cupom'); return; }

            if(couponCode === 'FRETEGRATIS') {
                shippingCost = 0;
                couponDiscount = 0;
                const row = document.getElementById('cart-coupon-row'); if (row) { row.style.display = 'flex'; row.innerHTML = `<span>Cupom FRETEGRATIS</span><span>Frete Grátis</span>`; }
                updateTotals();
                showToast("Cupom FRETEGRATIS aplicado com sucesso!");
            } else if(couponCode === 'PRIMEIRACOMPRA') {
                // 10% sobre o subtotal
                const sub = cart.reduce((a,b)=>a + ((b.price||0) * (b.qty||1)),0);
                couponDiscount = +(sub * 0.1).toFixed(2);
                const row = document.getElementById('cart-coupon-row'); if (row) { row.style.display = 'flex'; row.innerHTML = `<span>Cupom PRIMEIRACOMPRA</span><span>-R$ ${couponDiscount.toFixed(2)}</span>`; }
                updateTotals();
                showToast("Cupom PRIMEIRACOMPRA aplicado com sucesso!");
            } else {
                showToast("Cupom inválido ou expirado");
            }
        }

        function renderPaymentOptions() {
            const container = document.getElementById('payment-options-container');
            let html = `
                <div class="pay-opt selected" id="opt-pix" onclick="selectPayment('pix')">
                    <i class="fas fa-qrcode" style="font-size: 1.8rem; color: #00a650;"></i>
                    <span>PIX (À vista)</span>
                </div>`;
            
            // Se usuário tem cartão salvo (token) — exibimos somente último 4
            if (user && user.creditCard && user.creditCard.token) {
                const last4 = user.creditCard.last4 || '----';
                html += `
                <div class="pay-opt" id="opt-saved-card" onclick="selectPayment('saved-card')">
                    <i class="fas fa-credit-card" style="font-size: 1.8rem; color: #3483fa;"></i>
                    <span>Cartão Final ${last4}</span>
                </div>`;
            }

            html += `
                <div class="pay-opt" id="opt-new-card" onclick="selectPayment('new-card')">
                    <i class="fas fa-plus-circle" style="font-size: 1.8rem; color: #666;"></i>
                    <span>Novo Cartão</span>
                </div>`;
            
            container.innerHTML = html;
        }

        function selectPayment(type) {
            currentPaymentMethod = type;
            document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
            const selectedOpt = document.getElementById('opt-'+type);
            if(selectedOpt) selectedOpt.classList.add('selected');
            
            const pixArea = document.getElementById('area-pix');
            const cardArea = document.getElementById('area-card');
            const savedInfo = document.getElementById('saved-card-info');
            const newCardForm = document.getElementById('new-card-form');

            pixArea.style.display = 'none';
            cardArea.style.display = 'none';
            savedInfo.style.display = 'none';
            newCardForm.style.display = 'none';

            if (type === 'pix') {
                pixArea.style.display = 'block';
            } else if (type === 'saved-card') {
                // segurança: só exibe se o usuário tiver um cartão salvo
                if (user && user.creditCard && user.creditCard.last4) {
                    cardArea.style.display = 'block';
                    savedInfo.style.display = 'block';
                    savedInfo.innerText = `Usando cartão final ${user.creditCard.last4}`;
                } else {
                    // fallback: não temos cartão salvo — solicite novo cartão
                    selectPayment('new-card');
                    showToast('Nenhum cartão salvo disponível. Use um novo cartão.');
                    return;
                }
            } else if (type === 'new-card') {
                cardArea.style.display = 'block';
                newCardForm.style.display = 'block';
            }
        }

        // --- CHECKOUT GATEKEEPER & FINISH ---
        function handleCheckoutAttempt() {
            if(!user) {
                // mark that user attempted to finish checkout so after login/registration we can proceed
                pendingCheckout = true;
                openModal('modal-login');
            } else {
                if(isProfileComplete(user)) {
                    finishOrder();
                } else {
                    showToast("Por favor, complete seus dados de entrega.");
                    openClientRegister('complete');
                }
            }
        }

        function isProfileComplete(u) {
            return u.address && u.address.street && u.address.number && u.phone;
        }

        async function finishOrder() {
            showToast("Processando seu pagamento...");

            // ensure stock availability before charging
            const check = canFulfillCart();
            if (!check.ok) {
                showToast(check.msg || 'Estoque insuficiente para alguns itens do seu pedido.');
                return;
            }

            try {
                // If backend is available, prefer server-side checkout (requires auth)
                if (backendAvailable) {
                    const token = localStorage.getItem('ecom_token');
                    if (!token) { showToast('Faça login para finalizar a compra no servidor.'); openModal('modal-login'); return; }
                    // prepare cart payload: [{id,qty}]
                    const payloadCart = cart.map(i => ({ id: i.id, qty: i.qty }));
                    // 6️⃣ PAGAMENTOS: Envia para o backend processar o Split e criar o pedido real
                    const resp = await fetch(apiBase + '/checkout', { method:'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ cart: payloadCart, paymentMethod: currentPaymentMethod, totalAmount: totalOrder }) });
                    const json = await resp.json();
                    if (json && json.success) {
                        if (currentPaymentMethod === 'pix' && json.pix) {
                            // Show Real PIX Modal
                            document.getElementById('pix-qr-img').src = `data:image/png;base64,${json.pix.qr_code_base64}`;
                            document.getElementById('pix-copy-paste').value = json.pix.qr_code;
                            openModal('modal-pix-real');
                        } else {
                            alert(`✅ Pedido realizado com sucesso!\n\nPedido: ${json.id}\n\nObrigado pela compra, ${user ? user.name : 'cliente'}!`);
                            navigateTo('home');
                        }
                        // reflect stock change by fetching updated products
                        try { await loadProductsFromServer(); } catch(e) { console.warn('failed reload products', e); }
                        cart = [];
                        updateCartCount();
                        navigateTo('home');
                        return;
                    } else {
                        showToast('Falha no processamento do pedido: ' + (json && json.error ? json.error : 'erro'));
                        return;
                    }
                }

                if (currentPaymentMethod === 'pix') {
                    // Simulate pix success
                    await new Promise(r => setTimeout(r, 700));
                    alert(`✅ Pedido realizado com sucesso!\n\nPagamento via PIX.\n\nObrigado pela compra, ${user ? user.name : 'cliente'}!`);
                    // decrement stock for products in the cart
                    try { decrementStockForCart(); } catch(e) { console.warn('decrement stock err', e); }
                    cart = [];
                    updateCartCount();
                    navigateTo('home');
                    return;
                }

                // Card flows (saved-card or new-card)
                if (currentPaymentMethod === 'saved-card') {
                    if (!user || !user.creditCard || !user.creditCard.token) {
                        showToast('Nenhum cartão salvo disponível. Use um novo cartão.');
                        return;
                    }

                    const token = user.creditCard.token;
                    const chargeResp = await fetch('http://localhost:3000/charge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, amount: totalOrder, description: `Compra - ${cart.length} itens` })
                    }).then(r => r.json());

                    if (chargeResp && chargeResp.success) {
                        alert(`✅ Pedido realizado com sucesso!\n\nPagamento processado.\n\nObrigado pela compra, ${user.name}!`);
                        try { decrementStockForCart(); } catch(e) { console.warn('decrement stock err', e); }
                        cart = [];
                        updateCartCount();
                        navigateTo('home');
                        return;
                    } else {
                        showToast('Não foi possível processar o pagamento com o cartão salvo.');
                        return;
                    }
                }

                if (currentPaymentMethod === 'new-card') {
                    // Collect transient card data from inputs (safely)
                    const numEl = document.getElementById('new-card-num');
                    const expEl = document.getElementById('new-card-exp');
                    const cvvEl = document.getElementById('new-card-cvv');
                    const number = (numEl ? (numEl.value || '') : '').replace(/\s+/g, '');
                    const expiry = expEl ? (expEl.value || '') : '';
                    const cvv = cvvEl ? (cvvEl.value || '') : '';

                    if (!number || !expiry || !cvv) { showToast('Preencha todos os dados do cartão.'); return; }

                    // Tokenize via backend
                    const tokResp = await fetch('http://localhost:3000/tokenize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ number, expiry, cvv })
                    }).then(r => r.json());

                    if (!tokResp || !tokResp.success) {
                        showToast('Falha ao tokenizar o cartão. Tente novamente.');
                        return;
                    }

                    const token = tokResp.token;
                    const last4 = tokResp.last4;

                    // Optionally persist token (safe) if user asked to save card
                    const saveEl = document.getElementById('save-new-card');
                    const wantSave = saveEl && saveEl.checked;
                    if (wantSave && user) {
                        user.creditCard = { last4, expiry, token };
                        // Save sanitized copy
                        saveUser(user);
                    }

                    // Proceed to charge
                    const chargeResp = await fetch('http://localhost:3000/charge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, amount: totalOrder, description: `Compra - ${cart.length} itens` })
                    }).then(r => r.json());

                    // Clear sensitive fields immediately (if present)
                    if (numEl) numEl.value = '';
                    if (expEl) expEl.value = '';
                    if (cvvEl) cvvEl.value = '';
                    if (saveEl) saveEl.checked = false;

                    if (chargeResp && chargeResp.success) {
                        alert(`✅ Pedido realizado com sucesso!\n\nPagamento processado.\n\nObrigado pela compra, ${user ? user.name : 'cliente'}!`);
                        try { decrementStockForCart(); } catch(e) { console.warn('decrement stock err', e); }
                        cart = [];
                        updateCartCount();
                        navigateTo('home');
                        return;
                    } else {
                        showToast('Falha no processamento do pagamento.');
                        return;
                    }
                }

            } catch (err) {
                console.error(err);
                showToast('Erro inesperado ao processar pagamento.');
            }
        }

        // check whether cart items are available in stock
        function canFulfillCart() {
            const needed = {};
            for (const it of cart) {
                if (!it.id) continue; // skip items without id
                needed[it.id] = (needed[it.id] || 0) + (it.qty || 1);
            }
            for (const id in needed) {
                const prod = productsDB.find(p=>p.id===id);
                if (prod && typeof prod.stock !== 'undefined') {
                    if (prod.stock < needed[id]) {
                        return { ok:false, msg: `Sem estoque suficiente para ${prod.name}. Disponível: ${prod.stock}, solicitado: ${needed[id]}` };
                    }
                }
            }
            return { ok:true };
        }

        // decrement stock counts for items in cart and persist
        function decrementStockForCart() {
            const needed = {};
            for (const it of cart) {
                if (!it.id) continue;
                needed[it.id] = (needed[it.id] || 0) + (it.qty || 1);
            }
            for (const id in needed) {
                const idx = productsDB.findIndex(p=>p.id===id);
                if (idx >= 0) {
                    const p = productsDB[idx];
                    if (typeof p.stock !== 'undefined') {
                        p.stock = Math.max(0, (p.stock || 0) - needed[id]);
                        productsDB[idx] = p;
                    }
                } else {
                    // Feira desativada (API-ONLY)
                }
                saveProducts();
            }

            // render review immediately at top
            const reviewsContainer = document.getElementById('product-reviews');
            if (reviewsContainer) {
                renderReviewItem(newReview, reviewsContainer);
            }

            // clear form
            document.getElementById('review-text').value = '';
            if (!user || !user.name) document.getElementById('review-name').value = '';
            document.getElementById('review-feedback').innerText = 'Avaliação enviada — obrigado!';

            // refresh related visual indicators
            try { renderHome('all'); renderFeira(); } catch(e){}
        }

        // helper to make comment text safe
        function escapeHtml(s) {
            return String(s).replace(/[&<>\"']/g, function (m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
        }

        function buyCurrentProduct() {
            if (!currentProduct) return;
            // add and attempt checkout
            addToCart(currentProduct.id, currentProduct.name, currentProduct.price);
            // start checkout flow
            navigateTo('cart');
            handleCheckoutAttempt();
        }

        function renderCategories() {
            const grid = document.getElementById('cat-grid');
            grid.innerHTML = "";
            categories.forEach(c => {
                grid.innerHTML += `
                    <div class="cat-card" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ') { navigateTo('home'); filterHome('${c.id}'); }" onclick="navigateTo('home'); filterHome('${c.id}');">
                        <div class="cat-icon">${c.icon}</div>
                        <div class="cat-name">${c.name}</div>
                    </div>`;
            });
        }

        function populateDropdowns() {
            const sel = document.getElementById('s-category');
            const pSel = document.getElementById('prod-cat');
            categories.forEach(c => {
                if(sel) sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                if(pSel) pSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }

        // LOJISTA
        function openProductModal() { 
            openModal('product-modal'); 
            switchProdTab('manual'); 
        }
        
        function switchProdTab(mode) {
            document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-manual').style.display = mode === 'manual' ? 'block' : 'none';
            document.getElementById('tab-barcode').style.display = mode === 'barcode' ? 'block' : 'none';
            if(mode === 'barcode') {
                document.querySelectorAll('.m-tab')[1].classList.add('active');
            } else {
                document.querySelectorAll('.m-tab')[0].classList.add('active');
            }
        }
        
        function simulateScan() { 
            document.getElementById('prod-name').value = "Produto Exemplo EAN"; 
            document.getElementById('prod-price').value = "99.90"; 
            showToast("Produto escaneado com sucesso!"); 
        }
        
        function saveProduct() {
            if (!user || user.type !== 'seller') { showToast('Apenas lojistas podem cadastrar produtos'); return; }
            const name = (document.getElementById('prod-name') || {}).value;
            const price = parseFloat((document.getElementById('prod-price') || {}).value);
            const cat = (document.getElementById('prod-cat') || {}).value;
            const img = (document.getElementById('prod-img') || {}).value;
            if (name && !isNaN(price)) {
                const stock = parseInt(document.getElementById('prod-stock').value || '0', 10);
                const storeName = user.storeName || user.store || 'Loja local';
                productsDB.unshift({
                    id: 'p' + Math.random().toString(36).slice(2,9),
                    name,
                    price,
                    cat,
                    img,
                    store: storeName,
                    lat: randCoord(SJBV_LAT),
                    lng: randCoord(SJBV_LNG),
                    stock: isNaN(stock) ? 0 : stock,
                    reviews: []
                });
                saveProducts();
                renderHome('all'); 
                closeModal('product-modal'); 
                showToast("Produto cadastrado com sucesso!"); 
                navigateTo('home');
            } else {
                showToast("Preencha todos os campos obrigatórios");
            }
        }

        // --- SEARCH CLEAR & MERCHANT ---
        function toggleSearchClear(input) {
            const btn = document.getElementById('search-clear-btn');
            if (btn) btn.style.display = input.value.length > 0 ? 'block' : 'none';
        }

        function clearSearch() {
            const input = document.getElementById('main-search-input');
            if (input) {
                input.value = '';
                toggleSearchClear(input);
                input.focus();
            }
        }

        function openMerchantInfo() { openModal('modal-merchant-info'); }

        function handleSearch(e) { 
            // If called from keypress, only act on Enter; if called without event (icon click), proceed
            if (e && e.key && e.key !== 'Enter') return;
            const term = (document.querySelector('.search-input') || {}).value || '';
            if(term.trim() !== '') {
                showToast(`Buscando por: "${term}"`);
                const q = term.toLowerCase();
                // Simulação de busca - em uma aplicação real, isso faria uma busca no backend
                const results = productsDB.filter(p => 
                    (p.name && p.name.toLowerCase().includes(q)) || 
                    (p.store && p.store.toLowerCase().includes(q))
                ).slice(0, 8);
                
                if(results.length > 0) {
                    const grid = document.getElementById('home-grid');
                    grid.innerHTML = "";
                    results.forEach(p => { grid.innerHTML += productCardHtml(p); });
                    navigateTo('home');
                } else {
                    showToast("Nenhum produto encontrado");
                }
            }
        }

        // --- CARROSSEL DE BANNERS ---
        function initBannerCarousel() {
            const track = document.getElementById('banner-track');
            const dotsContainer = document.getElementById('banner-dots');
            if (!track) return;

            // Banners de exemplo (você pode carregar do backend se quiser)
            const banners = [
                { img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1000&q=80', title: 'Ofertas da Semana', action: "filterHome('promocoes')" },
                { img: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1000&q=80', title: 'Novidades em Eletrônicos', action: "filterHome('eletronicos')" },
                { img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80', title: 'Moda com até 50% OFF', action: "filterHome('moda')" }
            ];

            track.innerHTML = banners.map(b => `
                <div class="banner-slide" style="background-image: url('${b.img}'); cursor: pointer;" onclick="${b.action}">
                    <div class="banner-content"><h3>${b.title}</h3></div>
                </div>
            `).join('');

            dotsContainer.innerHTML = banners.map((_, i) => `<div class="banner-dot ${i===0?'active':''}" onclick="goToBanner(${i})"></div>`).join('');

            let current = 0;
            window.goToBanner = (i) => {
                current = i;
                track.style.transform = `translateX(-${current * 100}%)`;
                document.querySelectorAll('.banner-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
            };
            setInterval(() => goToBanner((current + 1) % banners.length), 5000);
        }

        // --- BANNER INFERIOR (PROPAGANDAS) ---
        function initBottomBanner() {
            const track = document.getElementById('bottom-banner-track');
            const dotsContainer = document.getElementById('bottom-banner-dots');
            if (!track) return;
            // Banners de propaganda (exemplo)
            const ads = [
                { img: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80', title: 'Espaço Publicitário' },
                { img: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?auto=format&fit=crop&w=1000&q=80', title: 'Sua Marca Aqui' }
            ];
            track.innerHTML = ads.map(b => `<div class="banner-slide" style="background-image: url('${b.img}')"><div class="banner-content"><h3>${b.title}</h3></div></div>`).join('');
            dotsContainer.innerHTML = ads.map((_, i) => `<div class="banner-dot ${i===0?'active':''}" onclick="goToBottomBanner(${i})"></div>`).join('');
            let current = 0;
            window.goToBottomBanner = (i) => {
                current = i;
                track.style.transform = `translateX(-${current * 100}%)`;
                dotsContainer.querySelectorAll('.banner-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
            };
            setInterval(() => goToBottomBanner((current + 1) % ads.length), 6000);
        }

        // --- BANNERS FEIRA ---
        function initFeiraBanners() {
            // Top Banner Feira
            const trackTop = document.getElementById('feira-top-track');
            const dotsTop = document.getElementById('feira-top-dots');
            if (trackTop && dotsTop) {
                // Lógica baseada no dia da semana
                const day = new Date().getDay(); // 0=Dom, 6=Sab
                let banners = [];
                if (day === 0 || day === 6) {
                    banners = [
                        { img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1000&q=80', title: 'Feira de Fim de Semana' },
                        { img: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=1000&q=80', title: 'Ofertas Especiais de Hoje' }
                    ];
                } else {
                    banners = [
                        { img: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=1000&q=80', title: 'Frescor da Terra (Dia de Semana)' },
                        { img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=80', title: 'Direto do Produtor' }
                    ];
                }
                trackTop.innerHTML = banners.map(b => `<div class="banner-slide" style="background-image: url('${b.img}')"><div class="banner-content"><h3>${b.title}</h3></div></div>`).join('');
                dotsTop.innerHTML = banners.map((_, i) => `<div class="banner-dot ${i===0?'active':''}" onclick="goToFeiraTop(${i})"></div>`).join('');
                let current = 0;
                window.goToFeiraTop = (i) => {
                    current = i;
                    trackTop.style.transform = `translateX(-${current * 100}%)`;
                    dotsTop.querySelectorAll('.banner-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
                };
                setInterval(() => goToFeiraTop((current + 1) % banners.length), 5000);
            }

            // Bottom Banner Feira
            const trackBot = document.getElementById('feira-bottom-track');
            const dotsBot = document.getElementById('feira-bottom-dots');
            if (trackBot && dotsBot) {
                const ads = [
                    { img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80', title: 'Anuncie na Feira' },
                    { img: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=80', title: 'Apoie o Local' }
                ];
                trackBot.innerHTML = ads.map(b => `<div class="banner-slide" style="background-image: url('${b.img}')"><div class="banner-content"><h3>${b.title}</h3></div></div>`).join('');
                dotsBot.innerHTML = ads.map((_, i) => `<div class="banner-dot ${i===0?'active':''}" onclick="goToFeiraBottom(${i})"></div>`).join('');
                let current = 0;
                window.goToFeiraBottom = (i) => {
                    current = i;
                    trackBot.style.transform = `translateX(-${current * 100}%)`;
                    dotsBot.querySelectorAll('.banner-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
                };
                setInterval(() => goToFeiraBottom((current + 1) % ads.length), 6000);
            }
        }

        // --- CHAT SOCKET.IO ---
        function initSocket() {
    if (IS_FILE) return;
    if (typeof io === 'undefined') { console.warn('Socket.io não carregou (chat desativado).'); return; }

            if (typeof io !== 'undefined') {
                socket = io(); // Conecta ao mesmo host/porta
                
                // Entra em uma sala (ex: sala global de suporte ou ID do usuário)
                const room = 'support_global'; 
                socket.emit('join_room', room);

                socket.on('chat_message', (data) => {
                    // Se a mensagem não for minha, exibe
                    const isMe = data.sender === (user ? user.email : 'anon_' + socket.id);
                    // Na verdade, o servidor devolve pra todos na sala, então precisamos filtrar visualmente
                    // Mas para simplificar, vamos assumir que o front sabe quem enviou pelo ID ou email
                    // Aqui, vamos apenas adicionar se não for "eu" (mas o servidor manda pra mim tb)
                    // Melhor: adicionar direto no DOM ao enviar e ignorar o retorno se for meu ID
                    if (data.socketId !== socket.id) {
                        appendChatMsg(data.text, 'other');
                    }
                });

                socket.on('new_order', (order) => {
                    if (document.getElementById('kds-screen').style.display !== 'none') { renderKDS(); showToast('🔔 Novo pedido na cozinha!'); }
                    
                    // Notificação Admin em Tempo Real
                    if (user && user.role === 'admin') {
                        showToast(`🔔 Novo pedido #${order.id} (R$ ${order.total})`);
                        // Atualiza dashboard se estiver aberto
                        if (document.getElementById('admin-dashboard').classList.contains('active')) loadAdminStats();
                    }
                });
            }
        }

        function toggleChat() {
            const win = document.getElementById('chat-window');
            win.classList.toggle('active');
            if (win.classList.contains('active')) {
                document.getElementById('chat-input').focus();
            }
        }

        function sendChatMsg() {
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (!text || !socket) return;

            const msgData = {
                room: 'support_global',
                text: text,
                sender: user ? user.email : 'Visitante',
                socketId: socket.id,
                timestamp: Date.now()
            };

            socket.emit('chat_message', msgData);
            appendChatMsg(text, 'me');
            input.value = '';
        }

        function appendChatMsg(text, type) {
            const body = document.getElementById('chat-body');
            const div = document.createElement('div');
            div.className = `chat-msg ${type}`;
            div.innerHTML = `${escapeHtml(text)} <span class="chat-time">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>`;
            body.appendChild(div);
            body.scrollTop = body.scrollHeight;
        }

        // --- MAPA LOJAS PRÓXIMAS ---
        let nearbyMap = null;
        let routingControl = null;
        let storeMarkers = [];

        function initNearbyMap(stores, lat, lng) {
            if (!document.getElementById('map-container')) return;
            if (typeof L === 'undefined') return;

            if (nearbyMap) { nearbyMap.remove(); nearbyMap = null; }
            nearbyMap = L.map('map-container').setView([lat, lng], 14);
            storeMarkers = [];
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(nearbyMap);

            // Ícone Azul (Cliente)
            const blueIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });
            L.marker([lat, lng], {icon: blueIcon}).addTo(nearbyMap).bindPopup("<b>Você está aqui</b>").openPopup();

            // Ícone Vermelho (Lojas)
            const redIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });

            stores.forEach(s => {
                const m = L.marker([s.lat, s.lng], {icon: redIcon}).addTo(nearbyMap)
                    .bindPopup(`<b>${s.name}</b><br>${s._distKm.toFixed(1)} km<br><button class="btn-primary" style="font-size:0.8rem; padding:4px 8px; margin-top:6px; width:100%;" onclick="calculateRoute(${s.lat}, ${s.lng})">Traçar Rota</button>`);
                m.storeData = s;
                storeMarkers.push(m);
            });

            // Adiciona controles personalizados (Filtro e Limpar Rota)
            const CustomControl = L.Control.extend({
                onAdd: function(map) {
                    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    div.style.backgroundColor = 'white';
                    div.style.padding = '8px';
                    div.style.cursor = 'default';
                    div.innerHTML = `
                        <div style="margin-bottom:5px; font-weight:600; color:#2d3277; font-size:0.85rem;">Opções</div>
                        <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; cursor:pointer; color:#333;">
                            <input type="checkbox" id="filter-2km" onchange="toggle2kmFilter(this.checked)"> Raio 2km
                        </label>
                        <button id="btn-clear-route" style="display:none; margin-top:8px; width:100%; font-size:0.75rem; padding:4px;" class="btn-primary" onclick="clearRoute()">Limpar Rota</button>
                    `;
                    L.DomEvent.disableClickPropagation(div);
                    return div;
                }
            });
            new CustomControl({ position: 'topright' }).addTo(nearbyMap);
        }

        function calculateRoute(destLat, destLng) {
            if (!nearbyMap || typeof L.Routing === 'undefined') return;
            
            // Remove rota anterior se existir
            if (routingControl) { nearbyMap.removeControl(routingControl); }

            routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(userLat || SJBV_LAT, userLng || SJBV_LNG),
                    L.latLng(destLat, destLng)
                ],
                routeWhileDragging: false,
                show: false, // Oculta o painel de instruções de texto para economizar espaço
                createMarker: function() { return null; }, // Não cria novos marcadores, usa os existentes
                lineOptions: { styles: [{color: '#3483fa', opacity: 0.8, weight: 6}] },
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true
            }).addTo(nearbyMap);

            // Mostra botão de limpar
            const btn = document.getElementById('btn-clear-route');
            if(btn) btn.style.display = 'block';
        }

        function clearRoute() {
            if (routingControl && nearbyMap) {
                nearbyMap.removeControl(routingControl);
                routingControl = null;
            }
            const btn = document.getElementById('btn-clear-route');
            if(btn) btn.style.display = 'none';
            if(nearbyMap && userLat && userLng) nearbyMap.setView([userLat, userLng], 14);
            if(nearbyMap) nearbyMap.closePopup();
        }

        function toggle2kmFilter(active) {
            if (!nearbyMap) return;
            storeMarkers.forEach(m => {
                if (active) {
                    if (m.storeData._distKm <= 2.0) { if(!nearbyMap.hasLayer(m)) m.addTo(nearbyMap); }
                    else { m.remove(); }
                } else {
                    if(!nearbyMap.hasLayer(m)) m.addTo(nearbyMap);
                }
            });
        }

        // --- PUSH NOTIFICATIONS ---
        async function subscribePush() {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                showToast('Seu navegador não suporta notificações Push.');
                return;
            }

            // Registra SW
            const register = await navigator.serviceWorker.register('/sw.js');
            
            // Pega chave pública do servidor
            const resp = await fetch(apiBase + '/push/key');
            const { key } = await resp.json();

            // Converte chave
            const convertedVapidKey = urlBase64ToUint8Array(key);

            // Inscreve
            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // Envia para o backend
            await fetch(apiBase + '/push/subscribe', {
                method: 'POST',
                body: JSON.stringify({ subscription, email: user ? user.email : null }),
                headers: { 'Content-Type': 'application/json' }
            });

            showToast('Notificações ativadas com sucesso!');
        }

        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
            return outputArray;
        }

        async function sendPushToAll() {
            const msg = prompt("Digite a mensagem da promoção:");
            if(msg) {
                await fetch(apiBase + '/push/send', {
                    method: 'POST',
                    body: JSON.stringify({ title: '& Comércio Ofertas', message: msg }),
                    headers: { 'Content-Type': 'application/json' }
                });
                showToast('Push enviado para todos!');
            }
        }

        // --- KDS (KITCHEN DISPLAY SYSTEM) ---
        function openKDS() {
            document.getElementById('kds-screen').style.display = 'flex';
            renderKDS();
        }

        function closeKDS() {
            document.getElementById('kds-screen').style.display = 'none';
        }

        async function renderKDS() {
            const board = document.getElementById('kds-board');
            board.innerHTML = '<div style="padding:20px;">Carregando pedidos...</div>';
            
            if (!backendAvailable) { board.innerHTML = 'KDS requer conexão com o servidor.'; return; }

            try {
                const resp = await fetch(apiBase + '/orders/active');
                const json = await resp.json();
                if (!json.success) throw new Error(json.error);

                const orders = json.orders;
                const cols = {
                    pending: { title: '⏳ Pendente', items: [], color: '#ffc107' },
                    preparing: { title: '🔥 Preparando', items: [], color: '#3483fa' },
                    ready: { title: '✅ Pronto', items: [], color: '#00a650' }
                };

                orders.forEach(o => {
                    if (cols[o.status]) cols[o.status].items.push(o);
                });

                board.innerHTML = '';
                Object.keys(cols).forEach(key => {
                    const col = cols[key];
                    let cardsHtml = col.items.map(o => {
                        const itemsList = o.data.items.map(i => `<li>${i.qty}x ${i.name}</li>`).join('');
                        let actionBtn = '';
                        if (key === 'pending') actionBtn = `<button class="btn-primary" style="padding:8px; margin-top:10px;" onclick="updateOrderStatus(${o.id}, 'preparing')">Iniciar Preparo</button>`;
                        else if (key === 'preparing') actionBtn = `<button class="btn-primary" style="padding:8px; margin-top:10px; background:#00a650;" onclick="updateOrderStatus(${o.id}, 'ready')">Marcar Pronto</button>`;
                        else if (key === 'ready') actionBtn = `<button class="btn-primary" style="padding:8px; margin-top:10px; background:#666;" onclick="updateOrderStatus(${o.id}, 'delivered')">Entregar</button>`;

                        return `
                            <div class="kds-card ${key}">
                                <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:8px;"><span>#${o.id}</span> <span>${new Date(o.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                                <ul style="padding-left:20px; margin-bottom:10px; font-size:0.95rem;">${itemsList}</ul>
                                ${actionBtn}
                            </div>`;
                    }).join('');

                    board.innerHTML += `<div class="kds-col"><div class="kds-header" style="color:${col.color}">${col.title} (${col.items.length})</div><div style="overflow-y:auto; flex:1;">${cardsHtml}</div></div>`;
                });

            } catch (e) { board.innerHTML = 'Erro ao carregar KDS: ' + e.message; }
        }

        async function updateOrderStatus(id, status) {
            await fetch(apiBase + '/orders/' + id + '/status', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
            renderKDS();
        }

        // Inicialização da aplicação
        // Lazy-load helper
        function lazyLoadImages() {
            const imgs = Array.from(document.querySelectorAll('img[data-src]'));
            if (!imgs.length) return;
            if ('IntersectionObserver' in window) {
                const obs = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.getAttribute('data-src');
                            img.removeAttribute('data-src');
                            img.classList.remove('lazy');
                            observer.unobserve(img);
                        }
                    });
                }, { rootMargin: '200px' });
                imgs.forEach(i => obs.observe(i));
            } else {
                imgs.forEach(img => { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); img.classList.remove('lazy'); });
            }
        }

        // Floating back button (SPA) with visibility toggle at page-bottom and hidden on home
        (function(){
            const btn = document.createElement('button');
            btn.id = 'btn-back'; btn.className = 'btn-back'; btn.setAttribute('aria-label','Voltar'); btn.innerText = '← Voltar';
            document.body.appendChild(btn);
            
            // Lógica de Voltar Inteligente
            btn.addEventListener('click', window.goBack);

            // Helper: are we scrolled to (near) the bottom?
            function isAtBottom(threshold = 48) {
                return (window.innerHeight + window.pageYOffset) >= (document.documentElement.scrollHeight - threshold);
            }

            // Update visibility: special-case store (always show bottom back + minimal view), otherwise show when not on home and scrolled to bottom
            window.updateBackBtnState = function updateBackBtnState() {
                try {
                    const current = document.querySelector('.container.active');
                    if (!current) return;
                    const activeModal = document.querySelector('.modal.active');
                    
                    // Sempre mostrar botão voltar se NÃO estiver nas abas principais OU se tiver modal aberto
                    if (!['home', 'categories', 'feira'].includes(current.id) || activeModal) {
                        document.body.classList.add('store-view');
                        btn.classList.add('visible');
                    } else {
                        document.body.classList.remove('store-view');
                        // Na home/feira/cats, mostra apenas se rolar até o fim
                        if (isAtBottom()) btn.classList.add('visible'); else btn.classList.remove('visible');
                    }
                } catch(e) { /* noop */ }
            };

            // Throttled scroll handler using requestAnimationFrame
            let scheduled = false;
            window.addEventListener('scroll', ()=>{
                if (scheduled) return; scheduled = true;
                requestAnimationFrame(()=>{ 
                    scheduled = false; 
                    window.updateBackBtnState();
                    // Scroll Infinito: Carrega mais se estiver perto do fim e na home
                    if (isAtBottom(300) && activeContext === 'home' && activeHomeFilter !== 'proximos') { renderHome(); }
                });
            }, { passive: true });

            // Also update on resize and after initial load
            window.addEventListener('resize', window.updateBackBtnState);
            document.addEventListener('DOMContentLoaded', window.updateBackBtnState);
            // run once to initialize
            window.updateBackBtnState();
        })();

        function toggleAudioDescription() {
            if ('speechSynthesis' in window) {
                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    showToast('Audiodescrição parada.');
                    return;
                }

                // Garante limpeza antes de começar
                window.speechSynthesis.cancel();

                    const activeContainer = document.querySelector('.container.active');
                    let textToRead = "Página " + (activeContainer ? (activeContainer.id === 'home' ? 'Destaques' : activeContainer.id) : 'inicial') + ". ";
                    
                    if (activeContainer) {
                        // Prioriza leitura de produtos em grade (Home, Feira, Loja)
                        const products = activeContainer.querySelectorAll('.product-card');
                        if (products.length > 0) {
                            textToRead += `Listando ${products.length} produtos. `;
                            products.forEach((p, i) => {
                                const name = p.querySelector('.p-name')?.innerText || '';
                                const price = p.querySelector('.p-price')?.innerText || '';
                                // Lê de forma limpa: "Nome, Preço"
                                textToRead += `${name}, ${price}. `;
                            });
                        } 
                        // Leitura específica para Carrinho
                        else if (activeContainer.id === 'cart') {
                            const total = document.getElementById('cart-total')?.innerText || '';
                            textToRead += `Total a pagar: ${total}. Resumo dos itens: `;
                            const items = activeContainer.querySelectorAll('.cart-item');
                            if (items.length === 0) textToRead += "O carrinho está vazio.";
                            items.forEach(item => {
                                // Pega apenas a primeira linha (Nome x Qty)
                                const lines = item.innerText.split('\n');
                                textToRead += (lines[0] || '') + ". ";
                            });
                        }
                        // Leitura específica para Produto Detalhe
                        else if (activeContainer.id === 'product') {
                            const name = document.getElementById('product-name')?.innerText;
                            const price = document.getElementById('product-price')?.innerText;
                            const desc = document.getElementById('product-desc')?.innerText;
                            textToRead += `${name}. Preço atual: ${price}. ${desc}`;
                        }
                        // Fallback: lê cabeçalhos e parágrafos (ignora botões/menus repetitivos)
                        else {
                            const texts = activeContainer.querySelectorAll('h1, h2, h3, p, .cat-name');
                            if (texts.length > 0) {
                                texts.forEach(t => textToRead += t.innerText + ". ");
                            } else {
                                textToRead += activeContainer.innerText;
                            }
                        }
                    }
                    
                    const utterance = new SpeechSynthesisUtterance(textToRead);
                    utterance.lang = 'pt-BR';
                    utterance.rate = 1.0;
                    
                    // Tenta forçar voz PT-BR se disponível
                    const voices = window.speechSynthesis.getVoices();
                    const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
                    if (ptVoice) utterance.voice = ptVoice;

                    window.speechSynthesis.speak(utterance);
                    showToast('Lendo conteúdo...');
            } else {
                showToast('Seu navegador não suporta áudio.');
            }
        }

        // --- MEUS PEDIDOS ---
        async function loadMyOrders() {
            if (!user) { showToast('Faça login para ver seus pedidos'); openLoginModal(); return; }
            
            navigateTo('my-orders');
            const list = document.getElementById('orders-list');
            list.innerHTML = '<div style="padding:40px; text-align:center; color:#666;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>Carregando histórico...</div>';

            if (backendAvailable) {
                try {
                    const token = localStorage.getItem('ecom_token');
                    const resp = await fetch(apiBase + '/orders/history', { headers: { 'Authorization': 'Bearer ' + token } });
                    const json = await resp.json();
                    if (json.success) {
                        renderOrdersList(json.orders);
                    } else {
                        list.innerHTML = `<div style="padding:20px; text-align:center; color:#dc3545;">Erro: ${json.error}</div>`;
                    }
                } catch (e) {
                    list.innerHTML = `<div style="padding:20px; text-align:center; color:#dc3545;">Erro de conexão com o servidor.</div>`;
                }
            } else {
                list.innerHTML = `<div style="padding:40px; text-align:center; color:#666;">O histórico de pedidos está disponível apenas no modo online.</div>`;
            }
        }

        function renderOrdersList(orders) {
            const list = document.getElementById('orders-list');
            if (!orders || orders.length === 0) {
                list.innerHTML = `<div style="padding:60px 20px; text-align:center; color:#999;"><i class="fas fa-box-open fa-3x" style="margin-bottom:15px; opacity:0.5;"></i><p>Você ainda não fez nenhum pedido.</p></div>`;
                return;
            }

            const statusMap = { 'pending': 'Pendente', 'paid': 'Pago', 'shipped': 'Enviado', 'delivered': 'Entregue', 'canceled': 'Cancelado' };

            list.innerHTML = orders.map(o => {
                const date = new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const statusClass = 'status-' + (o.status || 'pending');
                const itemsHtml = o.items ? o.items.map(i => `<div>${i.qty}x ${i.name}</div>`).join('') : 'Detalhes indisponíveis';
                
                return `
                    <div class="order-card">
                        <div class="order-header">
                            <div>
                                <strong style="color:#333;">Pedido #${o.id}</strong>
                                <div style="font-size:0.8rem; color:#888; margin-top:2px;">${date}</div>
                            </div>
                            <div class="order-status ${statusClass}">${statusMap[o.status] || o.status}</div>
                        </div>
                        <div class="order-items">
                            ${itemsHtml}
                        </div>
                        <div class="order-total">
                            Total: R$ ${parseFloat(o.total_amount).toFixed(2)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // --- ADMIN DASHBOARD ---
        async function loadAdminStats() {
            if (!user) return;
            navigateTo('admin-dashboard');
            
            if (backendAvailable) {
                try {
                    const token = localStorage.getItem('ecom_token');
                    const resp = await fetch(apiBase + '/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
                    const json = await resp.json();
                    if (json.success) {
                        document.getElementById('adm-sales').innerText = `R$ ${json.stats.totalSales.toFixed(2)}`;
                        document.getElementById('adm-comm').innerText = `R$ ${json.stats.commission.toFixed(2)}`;
                        document.getElementById('adm-users').innerText = json.stats.totalUsers;
                        document.getElementById('adm-new-users').innerText = json.stats.newUsers;
                        renderSalesChart(json.stats.dailySales);
                    } else {
                        showToast('Erro ao carregar métricas: ' + json.error);
                    }
                } catch (e) { showToast('Erro de conexão.'); }
            } else {
                // Simulação Local para Admin
                document.getElementById('adm-users').innerText = storesMock.length + 50; // Mock total users
                
                // Renderiza lista de lojas para gerenciamento
                const container = document.querySelector('.admin-stats-grid');
                // Remove tabela antiga se existir para não duplicar
                const oldTable = document.getElementById('adm-stores-table');
                if(oldTable) oldTable.remove();

                const tableHtml = `
                <div id="adm-stores-table" style="grid-column: 1 / -1; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-top: 10px; border: 1px solid #eee;">
                    <h3 style="color: #2d3277; margin-bottom: 15px; font-size: 1.1rem;">Gerenciar Lojas (${storesMock.length})</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8f9fa; text-align:left;">
                                    <th style="padding:10px;">Loja</th>
                                    <th style="padding:10px;">Plano</th>
                                    <th style="padding:10px;">Status</th>
                                    <th style="padding:10px;">Ação</th>
                                </tr>
                            </thead>
                            <tbody id="adm-stores-list">
                                ${storesMock.map(s => `
                                    <tr style="border-bottom:1px solid #eee;">
                                        <td style="padding:10px;">${s.name}</td>
                                        <td style="padding:10px;">${s.plan}</td>
                                        <td style="padding:10px;"><span style="padding:4px 8px; border-radius:12px; font-size:0.8rem; background:${s.status==='active'?'#d4edda':'#f8d7da'}; color:${s.status==='active'?'#155724':'#721c24'}">${s.status==='active'?'Ativo':'Bloqueado'}</span></td>
                                        <td style="padding:10px;">
                                            <button class="btn-primary" style="padding:4px 8px; font-size:0.8rem; width:auto; background:${s.status==='active'?'#dc3545':'#28a745'}" onclick="toggleStoreStatus(${s.id})">
                                                ${s.status==='active'?'Bloquear':'Desbloquear'}
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
                container.insertAdjacentHTML('beforeend', tableHtml);
            }
        }

        function toggleStoreStatus(id) {
            const store = storesMock.find(s => s.id === id);
            if (store) {
                store.status = store.status === 'active' ? 'blocked' : 'active';
                loadAdminStats(); // Re-renderiza
                showToast(`Loja ${store.name} ${store.status === 'active' ? 'desbloqueada' : 'bloqueada'}.`);
            }
        }

        let salesChartInstance = null;
        function renderSalesChart(data) {
            const ctx = document.getElementById('salesChart').getContext('2d');
            
            // Prepara dados (se vazio, mostra array vazio)
            const labels = data ? data.map(d => d.date) : [];
            const values = data ? data.map(d => parseFloat(d.total)) : [];

            if (salesChartInstance) salesChartInstance.destroy();

            salesChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Vendas (R$)',
                        data: values,
                        borderColor: '#3483fa',
                        backgroundColor: 'rgba(52, 131, 250, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#3483fa',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        async function exportSalesCSV() {
            if (!user || user.role !== 'admin') return;
            const token = localStorage.getItem('ecom_token');
            
            try {
                const resp = await fetch(apiBase + '/admin/export-sales', { headers: { 'Authorization': 'Bearer ' + token } });
                if (resp.ok) {
                    const blob = await resp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'vendas.csv';
                    document.body.appendChild(a); a.click(); a.remove();
                    showToast('Download iniciado!');
                } else { showToast('Erro ao exportar CSV'); }
            } catch (e) { showToast('Erro de conexão'); }
        }

        // --- FLASH OFFERS ---
        function initFlashOffers() {
            const container = document.getElementById('flash-offers');
            const list = document.getElementById('flash-list');
            if(!container || !list) return;

            // Select random products for flash sale
            const all = (productsDB || []);
            if(all.length === 0) return;
            
            const flashItems = all.sort(() => 0.5 - Math.random()).slice(0, 6);
            
            if(flashItems.length > 0) {
                container.style.display = 'block';
                list.innerHTML = flashItems.map(p => {
                    const price = p.price || 0;
                    const oldPrice = (price * 1.3).toFixed(2); // Fake old price
                    const imgHtml = (typeof p.img === 'string' && (p.img.startsWith('http') || p.img.startsWith('/') || p.img.startsWith('data:'))) ? `<img src="${p.img}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : `<div style="font-size:3rem;text-align:center;">${p.img}</div>`;
                    
                    return `<div class="flash-card" onclick="openProduct('${p.id}')"><div class="flash-img">${imgHtml}</div><div style="font-weight:600; font-size:0.9rem; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div><div class="flash-old">R$ ${oldPrice}</div><div class="flash-price">R$ ${price.toFixed(2)}</div></div>`;
                }).join('');
                
                startFlashTimer();
            }
        }

        function startFlashTimer() {
            const timerEl = document.getElementById('flash-timer');
            const endTime = new Date();
            endTime.setHours(endTime.getHours() + 4);
            
            setInterval(() => {
                const now = new Date();
                const diff = endTime - now;
                if(diff <= 0) { timerEl.innerHTML = "EXPIRADO"; return; }
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                timerEl.innerHTML = `<span>${h.toString().padStart(2,'0')}h</span>:<span>${m.toString().padStart(2,'0')}m</span>:<span>${s.toString().padStart(2,'0')}s</span>`;
            }, 1000);
        }
        document.addEventListener('DOMContentLoaded', () => {
            init();
        });
