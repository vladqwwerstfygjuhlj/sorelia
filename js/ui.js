async function fetchProducts(){
  const r = await fetch("/products.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Cannot load /products.json");
  return await r.json();
}

async function loadProducts(){
  try{
    const data = await fetchProducts();
    
    const list = data.items || data; 
    window.SORELIA_ALL = Array.isArray(list) ? list : [];
  }catch(e){
    console.error(e);
    window.SORELIA_ALL = window.SORELIA_PRODUCTS ?? [];
  }
  return window.SORELIA_ALL;
}

async function initCatalog(){
  const all = await loadProducts();
  const mount = qs("#grid");

function money(uah){
  return new Intl.NumberFormat("uk-UA").format(uah) + " грн";
}
function qs(sel){ return document.querySelector(sel); }


function renderGrid(list, mount){
  if (!mount) return;

  if (!list.length){
    mount.innerHTML = `<div class="small">Нічого не знайдено.</div>`;
    return;
  }

  mount.innerHTML = list.map(p => `
    <div class="product" data-id="${p.id}">
      <a href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="product__img">
          <img src="${p.image}" alt="${p.name}">
        </div>
        <div class="product__body">
          <p class="product__name">${p.name}</p>
          <div class="product__meta">
            <span>${p.category}</span>
            <span class="price">${money(p.price)}</span>
          </div>
        </div>
      </a>

      <div class="product__actions">
        <button class="pill-action" data-qv="1" type="button">Переглянути</button>
        <button class="pill-action pill-action--heart" data-wish="1" type="button" aria-label="Зберегти">♡</button>
      </div>
    </div>
  `).join("");
}
}

function money(uah){
  return new Intl.NumberFormat("uk-UA").format(uah) + " грн";
}
function qs(sel){ return document.querySelector(sel); }

function renderGrid(list, mount){
  if (!mount) return;
  if (!list.length){
    mount.innerHTML = `<div class="small">Нічого не знайдено.</div>`;
    return;
  }

  mount.innerHTML = list.map(p => `
    <div class="product" data-id="${p.id}">
      <a href="product.html?id=${encodeURIComponent(p.id)}">
        <div class="product__img">
          <img src="${p.image}" alt="${p.name}">
        </div>
        <div class="product__body">
          <p class="product__name">${p.name}</p>
          <div class="product__meta">
            <span>${p.category || ""}</span>
            <span class="price">${money(p.price || 0)}</span>
          </div>
        </div>
      </a>
    </div>
  `).join("");
}

async function initCatalog(){
  const mount = qs("#grid");

  // Беремо масив товарів з API або вже завантажений масив
  let all = [];
  try{
    all = await fetchProducts(); // якщо ти вже зробив fetchProducts() під API
  }catch(e){
    all = window.SORELIA_ALL || window.SORELIA_PRODUCTS || [];
  }

  const search = qs("#search");
  const cat = qs("#category");
  const sort = qs("#sort");
  const minPrice = qs("#minPrice");
  const maxPrice = qs("#maxPrice");
  const reset = qs("#reset");
  const sizesWrap = qs("#sizesWrap");
  const meta = qs("#filtersMeta");

  let activeSize = null;

  function apply(){
    const term = (search?.value ?? "").trim().toLowerCase();
    const chosen = cat?.value ?? "all";
    const min = parseInt(minPrice?.value || "", 10);
    const max = parseInt(maxPrice?.value || "", 10);
    const sortBy = sort?.value ?? "reco";

    let list = all.slice();

    // category
    if (chosen !== "all") list = list.filter(p => (p.category || "") === chosen);

    // search
    if (term){
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(term) ||
        (p.sku || "").toLowerCase().includes(term)
      );
    }

    // price
    if (!Number.isNaN(min)) list = list.filter(p => (p.price ?? 0) >= min);
    if (!Number.isNaN(max)) list = list.filter(p => (p.price ?? 0) <= max);

    // size (Pandora) – тільки для каблучок (або all)
    const sizeEnabled = (chosen === "all" || chosen === "Каблучки");
    if (!sizeEnabled){
      activeSize = null;
      if (sizesWrap){
        [...sizesWrap.querySelectorAll("[data-size]")].forEach(x => x.classList.remove("is-active"));
      }
    }

    if (activeSize && sizeEnabled){
      list = list.filter(p => (p.sizes || []).map(String).includes(String(activeSize)));
    }

    // sort
    if (sortBy === "priceAsc") list.sort((a,b) => (a.price ?? 0) - (b.price ?? 0));
    if (sortBy === "priceDesc") list.sort((a,b) => (b.price ?? 0) - (a.price ?? 0));
    if (sortBy === "nameAsc") list.sort((a,b) => (a.name||"").localeCompare(b.name||"", "uk"));

    renderGrid(list, mount);

    if (meta){
      const bits = [];
      bits.push(`${list.length} позицій`);
      if (chosen !== "all") bits.push(chosen);
      if (activeSize) bits.push(`розмір ${activeSize}`);
      meta.textContent = bits.length ? bits.join(" · ") : "—";
    }
  }

  // sizes clicks
  if (sizesWrap){
    sizesWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-size]");
      if (!btn) return;
      const size = btn.dataset.size;
      activeSize = (activeSize === size) ? null : size;

      [...sizesWrap.querySelectorAll("[data-size]")].forEach(x => {
        x.classList.toggle("is-active", x.dataset.size === activeSize);
      });

      apply();
    });
  }

  // inputs
  [search, cat, sort, minPrice, maxPrice].forEach(el => {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  // reset
  if (reset){
    reset.addEventListener("click", () => {
      if (search) search.value = "";
      if (cat) cat.value = "all";
      if (sort) sort.value = "reco";
      if (minPrice) minPrice.value = "";
      if (maxPrice) maxPrice.value = "";
      activeSize = null;

      if (sizesWrap){
        [...sizesWrap.querySelectorAll("[data-size]")].forEach(x => x.classList.remove("is-active"));
      }

      apply();
    });
  }

  apply();
}


// -----------------------------
// Product page init
// -----------------------------
function initProduct(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  const all = SORELIA_ALL;
  const p = all.find(x => x.id === id) ?? all[0];
  if (!p) return;

  const img = qs("#p-img");
  if (img){
    img.src = p.image;
    img.alt = p.name;
  }

  const title = qs("#p-title");
  if (title) title.textContent = p.name;

  const price = qs("#p-price");
  if (price) price.textContent = money(p.price);

  const mood = qs("#p-mood");
  if (mood) mood.textContent = p.mood || "—";

  const specs = p.specs || {};
  const specsEl = qs("#p-specs");
  if (specsEl){
    specsEl.innerHTML = `
      <div><b>Артикул:</b> ${p.sku ?? "—"}</div>
      <div><b>Матеріал:</b> ${specs.metal ?? "—"}</div>
      <div><b>Розміри:</b> ${specs.sizes ?? "—"}</div>
    `;
  }

  const addBtn = qs("#add");
  if (addBtn){
    addBtn.addEventListener("click", () => {
      addToCart(p.id, 1);
      updateCartBadge();
      const note = qs("#note");
      if (note){
        note.textContent = "Додано до кошика.";
        setTimeout(() => (note.textContent = ""), 2200);
      }
    });
  }
}


function initQuickView(){
  const modal = qs("#qvModal");
  if (!modal) return;

  const img = qs("#qvImg");
  const title = qs("#qvTitle");
  const price = qs("#qvPrice");
  const mood = qs("#qvMood");
  const sizes = qs("#qvSizes");
  const open = qs("#qvOpen");
  const add = qs("#qvAdd");
  const wish = qs("#qvWish");
  const note = qs("#qvNote");

  let current = null;

  function openModal(p){
    current = p;

    if (img){
      img.src = p.image;
      img.alt = p.name;
    }
    if (title) title.textContent = p.name;
    if (price) price.textContent = money(p.price);
    if (mood) mood.textContent = p.mood || "—";
    if (open) open.href = `product.html?id=${encodeURIComponent(p.id)}`;

    const list = (p.sizes || []).slice(0, 10);
    if (sizes){
      sizes.innerHTML = list.length
        ? list.map(s => `<span class="size-pill">${s}</span>`).join("")
        : `<span class="small">Розміри: —</span>`;
    }

    if (note) note.textContent = "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(){
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    current = null;
  }

  modal.addEventListener("click", (e) => {
    if (e.target.dataset.close) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  if (add){
    add.addEventListener("click", () => {
      if (!current) return;
      addToCart(current.id, 1);
      updateCartBadge();
      if (note){
        note.textContent = "Додано до кошика.";
        setTimeout(() => (note.textContent = ""), 2200);
      }
    });
  }

  if (wish){
    wish.addEventListener("click", () => {
      const raw = localStorage.getItem("sorelia_wish") || "[]";
      const arr = JSON.parse(raw);
      if (current && !arr.includes(current.id)) arr.push(current.id);
      localStorage.setItem("sorelia_wish", JSON.stringify(arr));

      if (note){
        note.textContent = "Збережено.";
        setTimeout(() => (note.textContent = ""), 1800);
      }
    });
  }

  // delegation: clicks on grid
  const grid = qs("#grid");
  if (grid){
    grid.addEventListener("click", (e) => {
      const qv = e.target.closest("[data-qv]");
      const w = e.target.closest("[data-wish]");
      const card = e.target.closest(".product");
      if (!card) return;

      const id = card.dataset.id;
      const p = SORELIA_ALL.find(x => x.id === id);
      if (!p) return;

      if (qv){
        e.preventDefault();
        openModal(p);
      }

      if (w){
        e.preventDefault();
        const raw = localStorage.getItem("sorelia_wish") || "[]";
        const arr = JSON.parse(raw);
        if (!arr.includes(id)) arr.push(id);
        localStorage.setItem("sorelia_wish", JSON.stringify(arr));
        w.textContent = "♥";
        w.style.color = "var(--ink)";
      }
    });
  }
}

const CART_KEY = "sorelia_cart_v1";

function getCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}
function setCart(items){
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function cartCount(){
  return getCart().reduce((sum, it) => sum + (it.qty || 0), 0);
}
function cartTotal(products){
  const cart = getCart();
  let total = 0;
  for (const it of cart){
    const p = products.find(x => x.id === it.id);
    if (p) total += (p.price || 0) * (it.qty || 0);
  }
  return total;
}

function addToCart(id, qty = 1){
  const cart = getCart();
  const found = cart.find(x => x.id === id);
  if (found) found.qty += qty;
  else cart.push({ id, qty });
  setCart(cart);
}

function updateCartQty(id, delta){
  const cart = getCart();
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0){
    const idx = cart.findIndex(x => x.id === id);
    cart.splice(idx, 1);
  }
  setCart(cart);
}

function removeFromCart(id){
  const cart = getCart().filter(x => x.id !== id);
  setCart(cart);
}

function clearCart(){
  setCart([]);
}

function updateCartBadge(){
  const el = qs("#cartCount");
  if (!el) return;
  el.textContent = String(cartCount());
}

function openCart(){
  const drawer = qs("#cartDrawer");
  if (!drawer) return;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeCart(){
  const drawer = qs("#cartDrawer");
  if (!drawer) return;
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderCart(products){
  const mount = qs("#cartItems");
  const totalEl = qs("#cartTotal");
  const note = qs("#cartNote");
  if (!mount || !totalEl) return;

  const cart = getCart();
  if (!cart.length){
    mount.innerHTML = `<div class="small">Поки порожньо. Можеш просто переглянути колекцію.</div>`;
    totalEl.textContent = "0 грн";
    if (note) note.textContent = "";
    return;
  }

  mount.innerHTML = cart.map(it => {
    const p = products.find(x => x.id === it.id);
    if (!p) return "";
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
              <button type="button" data-dec="1">−</button>
              <span>${it.qty}</span>
              <button type="button" data-inc="1">+</button>
            </span>
          </div>
        </div>
        <button class="remove" type="button" data-rm="1" aria-label="Видалити">×</button>
      </div>
    `;
  }).join("");

  totalEl.textContent = money(cartTotal(products));
}

function initCart(){
  updateCartBadge();

  const btn = qs("#cartBtn");
  const drawer = qs("#cartDrawer");
  const clearBtn = qs("#clearCart");
  const checkoutBtn = qs("#checkoutBtn");
  const note = qs("#cartNote");

  if (btn){
    btn.addEventListener("click", () => {
      renderCart(SORELIA_ALL);
      openCart();
    });
  }

  if (drawer){
    drawer.addEventListener("click", (e) => {
      if (e.target.dataset.close) closeCart();

      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const rm = e.target.closest("[data-rm]");
      const row = e.target.closest(".cart-item");
      if (!row) return;

      const id = row.dataset.id;

      if (inc){ updateCartQty(id, +1); }
      if (dec){ updateCartQty(id, -1); }
      if (rm){ removeFromCart(id); }

      updateCartBadge();
      renderCart(SORELIA_ALL);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) closeCart();
    });
  }

  if (clearBtn){
    clearBtn.addEventListener("click", () => {
      clearCart();
      updateCartBadge();
      renderCart(SORELIA_ALL);
      if (note) {
        note.textContent = "Очищено.";
        setTimeout(() => (note.textContent = ""), 1800);
      }
    });
  }

  if (checkoutBtn){
    checkoutBtn.addEventListener("click", () => {
      if (note){
        note.textContent = "Далі додамо оформлення: доставка і контакти.";
        setTimeout(() => (note.textContent = ""), 2400);
      }
    });
  }
}

// -----------------------------
// Filters Drawer (mobile)
// -----------------------------
function initFiltersDrawer(){
  const drawer = qs("#filtersDrawer");
  const btn = qs("#filtersBtn");
  const apply = qs("#applyFilters");

  if (!drawer || !btn) return;

  function open(){
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close(){
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  btn.addEventListener("click", open);

  drawer.addEventListener("click", (e) => {
    if (e.target.dataset.fclose) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
  });

  if (apply){
    apply.addEventListener("click", close);
  }
}

// -----------------------------
// Boot
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();

  initCart();

  if (qs("#grid")){
    await initCatalog();
    initQuickView();
    if (qs("#filtersDrawer")) initFiltersDrawer();
  }

  if (qs("#p-title")) initProduct();

  updateCartBadge();
});


