// js/cart.js
(() => {
  "use strict";

  const CART_KEY = "sorelia_cart_v2";
  let PRODUCTS = [];
  let started = false;

  // ---------- helpers ----------
  const qs = (s, r = document) => r.querySelector(s);
  const money = (uah) => new Intl.NumberFormat("uk-UA").format(uah) + " грн";

  function readCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
    catch { return []; }
  }
  function writeCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function countCart(){
    return readCart().reduce((sum, it) => sum + (it.qty || 0), 0);
  }
  function totalCart(){
    const cart = readCart();
    let sum = 0;
    for (const it of cart){
      const p = PRODUCTS.find(x => x.id === it.id);
      if (p) sum += (p.price || 0) * (it.qty || 0);
    }
    return sum;
  }

  function add(id, qty = 1){
    const cart = readCart();
    const row = cart.find(x => x.id === id);
    if (row) row.qty += qty;
    else cart.push({ id, qty });
    // чистимо нулі
    const cleaned = cart.filter(x => x.qty > 0);
    writeCart(cleaned);
  }

  function inc(id){ add(id, 1); }
  function dec(id){
    const cart = readCart();
    const row = cart.find(x => x.id === id);
    if (!row) return;
    row.qty -= 1;
    writeCart(cart.filter(x => x.qty > 0));
  }

  function remove(id){
    writeCart(readCart().filter(x => x.id !== id));
  }

  function clear(){
    writeCart([]);
  }

  function setBadge(){
    const el = qs("#cartCount");
    if (!el) return;
    el.textContent = String(countCart());
  }

  // ---------- drawer UI ----------
  function openDrawer(){
    const drawer = qs("#cartDrawer");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer(){
    const drawer = qs("#cartDrawer");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function render(){
    const itemsMount = qs("#cartItems");
    const totalMount = qs("#cartTotal");
    if (!itemsMount || !totalMount) return;

    const cart = readCart();

    if (!cart.length){
      itemsMount.innerHTML = `<div class="small">Поки порожньо. Можеш просто переглянути колекцію.</div>`;
      totalMount.textContent = money(0);
      return;
    }

    itemsMount.innerHTML = cart.map(it => {
      const p = PRODUCTS.find(x => x.id === it.id);
      if (!p) return "";
      const line = (p.price || 0) * (it.qty || 0);

      return `
        <div class="cart-item" data-id="${p.id}">
          <div class="cart-item__img">
            <img src="${p.image}" alt="${p.name}">
          </div>

          <div>
            <p class="cart-item__name">${p.name}</p>
            <div class="cart-item__meta">
              <span>${money(p.price)}</span>
              <span class="qty">
                <button type="button" data-cart-dec="1">−</button>
                <span>${it.qty}</span>
                <button type="button" data-cart-inc="1">+</button>
              </span>
            </div>
            <div class="small" style="margin-top:6px;">${money(line)}</div>
          </div>

          <button class="remove" type="button" data-cart-rm="1" aria-label="Видалити">×</button>
        </div>
      `;
    }).join("");

    totalMount.textContent = money(totalCart());
  }

  // ---------- public API for your UI ----------
  // You can call window.SoreliaCart.addToCart(id) from product page or quick view.
  function addToCart(id, qty = 1){
    add(id, qty);
    setBadge();
    const btn = document.querySelector("#cartBtn");
btn?.classList.add("bump");
setTimeout(() => btn.classList.remove("bump"), 260);

    // якщо drawer відкритий — оновимо
    const drawer = qs("#cartDrawer");
    if (drawer && drawer.classList.contains("is-open")) render();
  }

  // ---------- boot ----------
  async function loadProducts(){
    // 1) якщо є SORELIA_ALL (з API) — беремо
    if (Array.isArray(window.SORELIA_ALL) && window.SORELIA_ALL.length) return window.SORELIA_ALL;

    // 2) якщо є SORELIA_PRODUCTS (fallback) — беремо
    if (Array.isArray(window.SORELIA_PRODUCTS) && window.SORELIA_PRODUCTS.length) return window.SORELIA_PRODUCTS;

    return [];
  }

  async function start(){
    if (started) return; // захист від подвійного старту
    started = true;

    PRODUCTS = await loadProducts();

    setBadge();

    // відкрити кошик
    const cartBtn = qs("#cartBtn");
    if (cartBtn){
      cartBtn.addEventListener("click", () => {
        render();
        openDrawer();
      }, { once: false });
    }

    // clear
    const clearBtn = qs("#clearCart");
    if (clearBtn){
      clearBtn.addEventListener("click", () => {
        clear();
        setBadge();
        render();
        const note = qs("#cartNote");
        if (note){
          note.textContent = "Очищено.";
          setTimeout(() => note.textContent = "", 1500);
        }
      });
    }

    // close handlers + qty handlers (delegation)
    document.addEventListener("click", (e) => {
      // close by backdrop/close button
      if (e.target && e.target.dataset && e.target.dataset.close){
        closeDrawer();
        return;
      }

      // add to cart from any button with [data-add]
      const addBtn = e.target.closest("[data-add]");
      if (addBtn){
        const id = addBtn.dataset.id;
        if (id) addToCart(id, 1);
        return;
      }

      // cart inc/dec/rm
      const row = e.target.closest(".cart-item");
      if (!row) return;
      const id = row.dataset.id;

      if (e.target.closest("[data-cart-inc]")){
        inc(id); setBadge(); render(); return;
      }
      if (e.target.closest("[data-cart-dec]")){
        dec(id); setBadge(); render(); return;
      }
      if (e.target.closest("[data-cart-rm]")){
        remove(id); setBadge(); render(); return;
      }
    });

    // esc close
    document.addEventListener("keydown", (e) => {
      const drawer = qs("#cartDrawer");
      if (e.key === "Escape" && drawer && drawer.classList.contains("is-open")){
        closeDrawer();
      }
    });

    // expose
    window.SoreliaCart = { addToCart, open: () => { render(); openDrawer(); }, close: closeDrawer, setBadge };
  }

  document.addEventListener("DOMContentLoaded", start);
})();
