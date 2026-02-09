/**
 * Usuba Cart System
 * Shared across food menu and drink menu pages.
 * Persists cart in localStorage so it survives page navigation.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'usuba_cart';

    // ── State ──────────────────────────────────────────────
    let cart = loadCart();

    function loadCart() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveCart() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    // ── Cart operations ────────────────────────────────────
    function addItem(name, price, image, price2) {
        const existing = cart.find(i => i.name === name && i.price === price && (i.price2 || null) === (price2 || null));
        if (existing) {
            existing.qty += 1;
        } else {
            const entry = { name, price: parseFloat(price), qty: 1, image: image || '' };
            if (price2) entry.price2 = parseFloat(price2);
            cart.push(entry);
        }
        saveCart();
        renderCart();
        renderBadge();
    }

    function removeItem(index) {
        cart.splice(index, 1);
        saveCart();
        renderCart();
        renderBadge();
    }

    function changeQty(index, delta) {
        cart[index].qty += delta;
        if (cart[index].qty <= 0) {
            cart.splice(index, 1);
        }
        saveCart();
        renderCart();
        renderBadge();
    }

    function clearCart() {
        cart = [];
        saveCart();
        renderCart();
        renderBadge();
        // Remove highlight from all menu/drink items
        document.querySelectorAll('.cart-item-added').forEach(el => {
            el.classList.remove('cart-item-added');
        });
    }

    function totalItems() {
        return cart.reduce((s, i) => s + i.qty, 0);
    }

    function totalPrice() {
        return cart.reduce((s, i) => s + i.price * i.qty, 0);
    }

    function totalPrice2() {
        // Sum using price2 where available, else price
        return cart.reduce((s, i) => s + (i.price2 || i.price) * i.qty, 0);
    }

    function hasAnyPrice2() {
        return cart.some(i => i.price2);
    }

    // ── Inject HTML structure ──────────────────────────────
    function injectCartHTML() {
        // Cart toggle button
        const toggle = document.createElement('button');
        toggle.className = 'cart-toggle';
        toggle.id = 'cartToggle';
        toggle.setAttribute('aria-label', 'Open cart');
        toggle.innerHTML = '🛒 <span class="cart-badge" id="cartBadge"></span>';
        document.body.appendChild(toggle);

        // Cart overlay
        const overlay = document.createElement('div');
        overlay.className = 'cart-overlay';
        overlay.id = 'cartOverlay';
        document.body.appendChild(overlay);

        // Cart panel
        const panel = document.createElement('div');
        panel.className = 'cart-panel';
        panel.id = 'cartPanel';
        panel.innerHTML = `
            <div class="cart-header">
                <div class="cart-title">Your <span>Order</span></div>
                <button class="cart-close" id="cartClose" aria-label="Close cart">✕</button>
            </div>
            <div class="cart-body" id="cartBody"></div>
            <div class="cart-footer" id="cartFooter">
                <div class="cart-total-row">
                    <span class="cart-total-label">Total</span>
                    <span class="cart-total-value" id="cartTotal"></span>
                </div>
                <div class="cart-actions">
                    <button class="cart-btn cart-btn-clear" id="cartClear">Clear All</button>
                    <button class="cart-btn cart-btn-waiter" id="cartWaiter">📋 Show to Waiter</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Waiter view
        const waiterView = document.createElement('div');
        waiterView.className = 'waiter-view';
        waiterView.id = 'waiterView';
        waiterView.innerHTML = `
            <div class="waiter-header">
                <div class="waiter-title">Order <span>Summary</span></div>
                <button class="waiter-close" id="waiterClose" aria-label="Close waiter view">✕</button>
            </div>
            <div class="waiter-count" id="waiterCount"></div>
            <div class="waiter-body" id="waiterBody"></div>
            <div class="waiter-footer">
                <div class="waiter-total">
                    <span class="waiter-total-label">Total</span>
                    <span class="waiter-total-value" id="waiterTotal"></span>
                </div>
                <div class="waiter-note">Usuba Sushi Bar & Izakaya</div>
            </div>
        `;
        document.body.appendChild(waiterView);
    }

    // ── Add "+" buttons to menu items ──────────────────────
    function getSectionName(el) {
        // Walk up to find the closest .category-section, then get its .category-title text
        const section = el.closest('.category-section');
        if (!section) return '';
        const titleEl = section.querySelector('.category-title');
        if (!titleEl) return '';
        return titleEl.textContent.trim();
    }

    function injectAddButtons() {
        // Food menu items (.menu-item with .item-name and .item-price)
        document.querySelectorAll('.menu-item').forEach(item => {
            const nameEl = item.querySelector('.item-name');
            const priceEl = item.querySelector('.item-price');
            if (!nameEl || !priceEl) return;

            const btn = document.createElement('button');
            btn.className = 'add-to-cart-btn';
            btn.setAttribute('aria-label', 'Add to cart');
            btn.textContent = '+';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const section = getSectionName(item);
                const rawName = nameEl.textContent.trim();
                const name = section ? section + ' - ' + rawName : rawName;
                const parsed = parsePriceText(priceEl.textContent.trim());
                const imgEl = item.querySelector('.item-image');
                const image = imgEl ? imgEl.src : '';
                if (parsed.price > 0) {
                    addItem(name, parsed.price, image, parsed.price2);
                    flashButton(btn);
                    flashItem(item);
                }
            });
            item.appendChild(btn);

            // Mark if already in cart
            markIfInCart(item, nameEl, getSectionName(item));
        });

        // Drink menu items (.drink-item with .drink-name and .drink-price)
        document.querySelectorAll('.drink-item').forEach(item => {
            const nameEl = item.querySelector('.drink-name');
            const priceEl = item.querySelector('.drink-price');
            if (!nameEl || !priceEl) return;

            // Make the drink-item a row so the button sits beside the header
            item.style.flexDirection = 'row';
            item.style.alignItems = 'center';
            item.style.flexWrap = 'wrap';

            const btn = document.createElement('button');
            btn.className = 'add-to-cart-btn';
            btn.setAttribute('aria-label', 'Add to cart');
            btn.textContent = '+';

            // Place button after the header, not inside it
            const header = item.querySelector('.drink-header');
            if (header) {
                header.style.flex = '1';
                header.style.minWidth = '0';
                header.after(btn);
            } else {
                item.appendChild(btn);
            }

            // Move description/details to full width below
            const desc = item.querySelector('.drink-description');
            const details = item.querySelector('.drink-details');
            if (desc) desc.style.width = '100%';
            if (details) details.style.width = '100%';

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const section = getSectionName(item);
                const rawName = nameEl.textContent.trim();
                const name = section ? section + ' - ' + rawName : rawName;
                const parsed = parsePriceText(priceEl.textContent.trim());
                const imgEl = item.querySelector('.drink-image, img');
                const image = imgEl ? imgEl.src : '';
                if (parsed.price > 0) {
                    addItem(name, parsed.price, image, parsed.price2);
                    flashButton(btn);
                    flashItem(item);
                }
            });

            // Mark if already in cart
            markIfInCart(item, nameEl, getSectionName(item));
        });
    }

    function parsePrice(text) {
        // Handle prices like "6", "$6", "6.50", etc.
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
    }

    function parsePriceText(text) {
        // Handle slash prices like "17/19", "6 / 7" as well as normal prices
        if (text.includes('/')) {
            const parts = text.split('/');
            const p1 = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
            const p2 = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
            if (!isNaN(p1) && !isNaN(p2)) {
                return { price: p1, price2: p2 };
            }
        }
        return { price: parsePrice(text), price2: null };
    }

    function flashButton(btn) {
        btn.classList.add('added');
        btn.textContent = '✓';
        setTimeout(() => {
            btn.classList.remove('added');
            btn.textContent = '+';
        }, 600);
    }

    function flashItem(itemEl) {
        itemEl.classList.remove('cart-item-flash');
        void itemEl.offsetWidth; // reflow for re-trigger
        itemEl.classList.add('cart-item-flash');
        itemEl.classList.add('cart-item-added');
        setTimeout(() => {
            itemEl.classList.remove('cart-item-flash');
        }, 700);
    }

    function markIfInCart(itemEl, nameEl, section) {
        const rawName = nameEl.textContent.trim();
        const fullName = section ? section + ' - ' + rawName : rawName;
        const inCart = cart.some(i => i.name === fullName);
        if (inCart) {
            itemEl.classList.add('cart-item-added');
        }
    }

    // ── Rendering ──────────────────────────────────────────
    function renderBadge() {
        const badge = document.getElementById('cartBadge');
        const count = totalItems();
        badge.textContent = count > 0 ? count : '';
        badge.setAttribute('data-count', count);

        // Bump animation
        badge.classList.remove('bump');
        void badge.offsetWidth; // reflow
        if (count > 0) badge.classList.add('bump');
    }

    function renderCart() {
        const body = document.getElementById('cartBody');
        const footer = document.getElementById('cartFooter');
        const totalEl = document.getElementById('cartTotal');

        if (cart.length === 0) {
            body.innerHTML = `
                <div class="cart-empty">
                    <div class="cart-empty-icon">🍣</div>
                    <div>Your order is empty</div>
                </div>
            `;
            footer.style.display = 'none';
            return;
        }

        footer.style.display = '';
        let html = '';
        cart.forEach((item, i) => {
            const imgHtml = item.image ? `<img class="cart-item-image" src="${escapeHtml(item.image)}" alt="">` : '';
            html += `
                <div class="cart-item">
                    ${imgHtml}
                    <div class="cart-item-info">
                        <div class="cart-item-name">${escapeHtml(item.name)}</div>
                        <div class="cart-item-price">${formatItemPrice(item)} each</div>
                    </div>
                    <div class="cart-item-controls">
                        <button class="cart-qty-btn" data-action="dec" data-index="${i}" aria-label="Decrease quantity">−</button>
                        <span class="cart-item-qty">${item.qty}</span>
                        <button class="cart-qty-btn" data-action="inc" data-index="${i}" aria-label="Increase quantity">+</button>
                    </div>
                    <div class="cart-item-subtotal">${formatItemSubtotal(item)}</div>
                    <button class="cart-item-delete" data-action="del" data-index="${i}" aria-label="Remove item">🗑</button>
                </div>
            `;
        });
        body.innerHTML = html;
        totalEl.innerHTML = formatTotal();
    }

    function renderWaiterView() {
        const body = document.getElementById('waiterBody');
        const totalEl = document.getElementById('waiterTotal');
        const countEl = document.getElementById('waiterCount');

        countEl.textContent = `${totalItems()} item${totalItems() !== 1 ? 's' : ''}`;

        let html = '';
        cart.forEach(item => {
            const imgHtml = item.image ? `<img class="waiter-item-image" src="${escapeHtml(item.image)}" alt="">` : '';
            html += `
                <div class="waiter-item">
                    ${imgHtml}
                    <div class="waiter-item-left">
                        <div class="waiter-item-name">${escapeHtml(item.name)}</div>
                        <div class="waiter-item-qty">× ${item.qty}  ·  ${formatItemPrice(item)} each</div>
                    </div>
                    <div class="waiter-item-subtotal">${formatItemSubtotal(item)}</div>
                </div>
            `;
        });
        body.innerHTML = html;
        totalEl.textContent = formatTotal();
    }

    function formatPrice(num) {
        return num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);
    }

    function formatItemPrice(item) {
        // Format price, showing slash format if price2 exists
        if (item.price2) {
            return formatPrice(item.price) + '/' + formatPrice(item.price2);
        }
        return formatPrice(item.price);
    }

    function formatItemSubtotal(item) {
        if (item.price2) {
            return formatPrice(item.price * item.qty) + '/' + formatPrice(item.price2 * item.qty);
        }
        return formatPrice(item.price * item.qty);
    }

    function formatTotal() {
        const t1 = totalPrice();
        const t2 = totalPrice2();
        if (hasAnyPrice2() && t1 !== t2) {
            return formatPrice(t1) + '/' + formatPrice(t2);
        }
        return formatPrice(t1);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Panel open / close ─────────────────────────────────
    function openCart() {
        document.getElementById('cartPanel').classList.add('open');
        document.getElementById('cartOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
        renderCart();
    }

    function closeCart() {
        document.getElementById('cartPanel').classList.remove('open');
        document.getElementById('cartOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }

    function openWaiterView() {
        renderWaiterView();
        document.getElementById('waiterView').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeWaiterView() {
        document.getElementById('waiterView').classList.remove('active');
        // Restore to cart panel state
        if (document.getElementById('cartPanel').classList.contains('open')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    // ── Event binding ──────────────────────────────────────
    function bindEvents() {
        // Toggle cart
        document.getElementById('cartToggle').addEventListener('click', () => {
            const panel = document.getElementById('cartPanel');
            if (panel.classList.contains('open')) {
                closeCart();
            } else {
                openCart();
            }
        });

        // Close cart
        document.getElementById('cartClose').addEventListener('click', closeCart);
        document.getElementById('cartOverlay').addEventListener('click', closeCart);

        // Cart body delegation (qty buttons + delete)
        document.getElementById('cartBody').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.index);
            const action = btn.dataset.action;
            if (action === 'inc') changeQty(idx, 1);
            else if (action === 'dec') changeQty(idx, -1);
            else if (action === 'del') removeItem(idx);
        });

        // Clear all
        document.getElementById('cartClear').addEventListener('click', () => {
            if (cart.length === 0) return;
            clearCart();
        });

        // Show to waiter
        document.getElementById('cartWaiter').addEventListener('click', () => {
            if (cart.length === 0) return;
            openWaiterView();
        });

        // Close waiter view
        document.getElementById('waiterClose').addEventListener('click', closeWaiterView);
    }

    // ── Init ───────────────────────────────────────────────
    function init() {
        injectCartHTML();
        injectAddButtons();
        bindEvents();
        renderBadge();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
