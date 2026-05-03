// js/cart.js
(() => {
  "use strict";

  const CART_KEY = "sorelia_cart_v2";
  let PRODUCTS = [];
  let started = false;

  // ---------- Helpers ----------
  const qs = (s, r = document) => r.querySelector(s);
  const money = (uah) => new Intl.NumberFormat("uk-UA").format(uah || 0) + " грн";

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function countCart() {
    return readCart().reduce((sum, it) => sum + (it.qty || 0), 0);
  }

  async function loadProducts() {
    if (Array.isArray(window.SORELIA_ALL) && window.SORELIA_ALL.length) {
      PRODUCTS = window.SORELIA_ALL;
      return PRODUCTS;
    }

    try {
      const response = await fetch("products.json", { cache: "no-store" });
      const data = await response.json();
      PRODUCTS = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      window.SORELIA_ALL = PRODUCTS;
    } catch (error) {
      console.error("Не вдалося завантажити products.json:", error);
      PRODUCTS = [];
    }
    return PRODUCTS;
  }

  // ---------- Core Logic ----------

  // Оновлена функція додавання з підтримкою розміру
  function add(id, qty = 1, size = null) {
    const cart = readCart();
    // Шукаємо товар за ID та РОЗМІРОМ
    const row = cart.find(x => x.id === id && x.size === size);
    if (row) {
      row.qty += qty;
    } else {
      cart.push({ id, qty, size, addedAt: Date.now() });
    }
    writeCart(cart);
  }

  function inc(id, size = null) {
    const cart = readCart();
    const row = cart.find(x => x.id === id && x.size === size);
    if (row) row.qty++;
    writeCart(cart);
  }

  function dec(id, size = null) {
    const cart = readCart();
    const row = cart.find(x => x.id === id && x.size === size);
    if (row && row.qty > 1) row.qty--;
    else if (row) return remove(id, size);
    writeCart(cart);
  }

  function remove(id, size = null) {
    let cart = readCart();
    cart = cart.filter(x => !(x.id === id && x.size === size));
    writeCart(cart);
  }

  // ---------- UI & Rendering ----------

  function setBadge() {
    const b = qs("#cartCount");
    if (!b) return;
    const c = countCart();
    b.textContent = c;
    b.style.display = c > 0 ? "flex" : "none";
  }

  function render() {
    const container = qs("#cartItems");
    if (!container) return;

    const cart = readCart();
    if (!cart.length) {
      container.innerHTML = `<div style="padding:40px 20px; text-align:center; opacity:0.5;">Кошик порожній</div>`;
      if (qs("#cartTotal")) qs("#cartTotal").textContent = "0 грн";
      return;
    }

    const items = PRODUCTS.length ? PRODUCTS : window.SORELIA_ALL || [];
    let total = 0;

    container.innerHTML = cart.map(it => {
      const p = items.find(x => x.id === it.id) || {};
      const price = p.price || 0;
      total += price * it.qty;

      return `
        <div class="cart-item" data-id="${it.id}" data-size="${it.size || ''}">
          <img src="${p.image || ''}" alt="" class="cart-item__img">
          <div class="cart-item__info">
            <div class="cart-item__name">${p.name || 'Прикраса'}</div>
            ${it.size ? `<div class="small" style="color:var(--muted)">Розмір: ${it.size}</div>` : ''}
            <div class="cart-item__price">${money(price)}</div>
          </div>
          <div class="cart-item__ctrl">
            <button class="btn-qty" data-cart-dec="1">-</button>
            <span>${it.qty}</span>
            <button class="btn-qty" data-cart-inc="1">+</button>
            <button class="btn-rm" data-cart-rm="1">×</button>
          </div>
        </div>
      `;
    }).join("");

    if (qs("#cartTotal")) qs("#cartTotal").textContent = money(total);
  }

  function ensureCheckoutForm() {
    const drawerFoot = qs("#cartDrawer .drawer__foot");
    if (!drawerFoot || qs("#checkoutForm", drawerFoot)) return;

    const form = document.createElement("form");
    form.id = "checkoutForm";
    form.name = "sorelia-checkout";
    form.method = "POST";
    form.setAttribute("data-netlify", "true");
    form.setAttribute("netlify-honeypot", "bot-field");
    form.innerHTML = `
      <input type="hidden" name="form-name" value="sorelia-checkout">
      <input type="hidden" name="cart_items" id="checkoutCartItems">
      <p style="display:none;">
        <label>Don't fill this out: <input name="bot-field"></label>
      </p>
      <div class="small" style="margin-top:10px;">Оформлення замовлення</div>
      <input class="input input--full" type="text" name="full_name" placeholder="Повне ім'я" required style="margin-top:8px;">
      <input class="input input--full" type="text" name="nova_poshta_address" placeholder="Адреса Нової Пошти" required style="margin-top:8px;">
      <select class="pill pill--full" name="payment_method" required style="margin-top:8px;">
        <option value="">Спосіб оплати</option>
        <option value="Післяплата">Післяплата</option>
        <option value="Оплата карткою">Оплата карткою</option>
      </select>
    `;
    drawerFoot.appendChild(form);
  }

  function buildCheckoutPayload() {
    const cart = readCart();
    const items = PRODUCTS.length ? PRODUCTS : window.SORELIA_ALL || [];
    return cart
      .map((entry) => {
        const product = items.find((p) => p.id === entry.id) || {};
        return {
          id: entry.id,
          name: product.name || "Невідомий товар",
          price: product.price || 0,
          qty: entry.qty || 0,
          size: entry.size || null,
          image: product.image || "",
        };
      })
      .filter((row) => row.qty > 0);
  }

  // ---------- Drawer Management ----------

  function openDrawer() {
    const d = qs("#cartDrawer");
    if (!d) return;
    render();
    d.classList.add("is-open");
    d.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    const d = qs("#cartDrawer");
    if (!d) return;
    d.classList.remove("is-open");
    d.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ---------- Global Events ----------

  async function init() {
    if (started) return;
    started = true;

    await loadProducts();
    ensureCheckoutForm();
    setBadge();

    document.addEventListener("click", (e) => {
      // 1. Відкрити кошик
      if (e.target.closest("#cartBtn")) {
        openDrawer();
        return;
      }

      // 2. Закрити кошик (через фон або кнопку X)
      if (e.target.dataset.close) {
        closeDrawer();
        return;
      }

      // 3. Кнопка "Додати" на сторінці товару
      const productAddBtn = e.target.closest("#add");
      if (productAddBtn) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const size = window.selectedSize || null;
        if (id) {
          add(id, 1, size);
          setBadge();
          const note = qs("#note");
          if (note) {
            note.textContent = size ? `Додано (р. ${size})` : "Додано!";
            setTimeout(() => note.textContent = "", 2000);
          }
        }
        return;
      }

      // 4. Кнопки в кошику (делегування)
      const row = e.target.closest(".cart-item");
      if (row) {
        const id = row.dataset.id;
        const size = row.dataset.size || null;

        if (e.target.closest("[data-cart-inc]")) inc(id, size);
        if (e.target.closest("[data-cart-dec]")) dec(id, size);
        if (e.target.closest("[data-cart-rm]")) remove(id, size);
        
        setBadge();
        render();
        return;
      }

      // 5. Очистити кошик
      if (e.target.id === "clearCart") {
        writeCart([]);
        setBadge();
        render();
      }

      // 6. Оформити замовлення
      if (e.target.id === "checkoutBtn") {
        const form = qs("#checkoutForm");
        if (!form) return;
        const payload = buildCheckoutPayload();
        if (!payload.length) return alert("Кошик порожній");
        const hidden = qs("#checkoutCartItems");
        if (hidden) hidden.value = JSON.stringify(payload, null, 2);
        form.requestSubmit();
        return;
      }
    });

    const checkoutForm = qs("#checkoutForm");
    if (checkoutForm) {
      checkoutForm.addEventListener("submit", (event) => {
        const payload = buildCheckoutPayload();
        if (!payload.length) {
          event.preventDefault();
          alert("Кошик порожній");
          return;
        }
        const hidden = qs("#checkoutCartItems");
        if (hidden) hidden.value = JSON.stringify(payload, null, 2);
      });
    }

    // ESC close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });
  }

  // Запуск
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Експорт функцій для каталогу та QuickView
  window.addToCart = add;
  window.openCart = openDrawer;
  window.updateCartBadge = setBadge;

})();