window.qs = window.qs || ((selector) => document.querySelector(selector));
function money(uah) {
  return `${new Intl.NumberFormat("uk-UA").format(uah || 0)} грн`;
}

function normalizeProducts(data) {
  const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  return list.map((item, idx) => ({
    ...item,
    _numId: idx + 1,
  }));
}

async function fetchProducts() {
  const response = await fetch("products.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Cannot load products.json");
  return response.json();
}

async function loadProducts() {
  try {
    const data = await fetchProducts();
    window.SORELIA_ALL = normalizeProducts(data);
  } catch (error) {
    console.error("Помилка завантаження:", error);
    window.SORELIA_ALL = [];
  }
  return window.SORELIA_ALL;
}

function resolveProductByParam(products, idParam) {
  if (!products || !Array.isArray(products)) return null;
  const asNumber = Number(idParam);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    const foundByNum = products.find((p) => p._numId === asNumber);
    if (foundByNum) return foundByNum;
  }

  return products.find((p) => String(p.id) === String(idParam)) || null;
}

function renderGrid(list, mount) {
  if (!mount) return;
  if (!list.length) {
    mount.innerHTML = `<div class="small">Нічого не знайдено.</div>`;
    return;
  }

  mount.innerHTML = list
    .map(
      (p) => `
      <article class="product" data-id="${p.id}">
        <a href="product.html?id=${p._numId}">
          <div class="product__img"><img src="${p.image}" alt="${p.name}"></div>
          <div class="product__body">
            <p class="product__name">${p.name}</p>
            <div class="product__meta">
              <span>${p.category || ""}</span>
              <span class="price">${money(p.price)}</span>
            </div>
          </div>
        </a>
        <div class="product__actions">
          <button class="pill-action" type="button" data-qv="1">Переглянути</button>
        </div>
      </article>
    `
    )
    .join("");
}

function initCatalog(products) {
  const mount = qs("#grid");
  if (!mount) return;

  const search = document.querySelector("#search");
  const category = document.querySelector("#cat") || document.querySelector("#category");
  const sort = document.querySelector("#sort");
  const minPrice = document.querySelector("#minPrice");
  const maxPrice = document.querySelector("#maxPrice");
  const meta = document.querySelector("#filtersMeta");
  const reset = document.querySelector("#reset");
  const sizesWrap = document.querySelector("#sizesWrap");

  let activeSize = null;

  function apply() {
    const term = (search?.value || "").trim().toLowerCase();
    const chosenCategory = category?.value || "all";
    const sortMode = sort?.value || "reco";
    
    // Виправлені рядки:
    const min = minPrice?.value ? Number(minPrice.value) : 0;
    const max = maxPrice?.value ? Number(maxPrice.value) : Infinity;

    let list = [...products];

    if (chosenCategory !== "all") list = list.filter((p) => p.category === chosenCategory);
    if (term) {
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        return name.includes(term) || String(p.id).toLowerCase().includes(term) || String(p._numId).includes(term);
      });
    }
    if (Number.isFinite(min)) list = list.filter((p) => (p.price || 0) >= min);
    if (Number.isFinite(max)) list = list.filter((p) => (p.price || 0) <= max);
    if (activeSize) list = list.filter((p) => Array.isArray(p.sizes) && p.sizes.includes(activeSize));

    if (sortMode === "priceAsc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sortMode === "priceDesc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortMode === "nameAsc") list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "uk"));

    renderGrid(list, mount);
    if (meta) meta.textContent = `${list.length} позицій`;
  }

  [search, category, sort, minPrice, maxPrice].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });

  if (sizesWrap) {
    sizesWrap.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-size]");
      if (!btn) return;
      const size = btn.dataset.size;
      activeSize = activeSize === size ? null : size;
      [...sizesWrap.querySelectorAll("[data-size]")].forEach((node) => {
        node.classList.toggle("is-active", node.dataset.size === activeSize);
      });
      apply();
    });
  }

  if (reset) {
    reset.addEventListener("click", () => {
      if (search) search.value = "";
      if (category) category.value = "all";
      if (sort) sort.value = "reco";
      if (minPrice) minPrice.value = "";
      if (maxPrice) maxPrice.value = "";
      activeSize = null;
      if (sizesWrap) {
        [...sizesWrap.querySelectorAll("[data-size]")].forEach((node) => node.classList.remove("is-active"));
      }
      apply();
    });
  }

  apply();
}

function initQuickView(products) {
  const modal = qs("#qvModal");
  const grid = qs("#grid");
  if (!modal || !grid) return;

  const img = qs("#qvImg");
  const title = qs("#qvTitle");
  const price = qs("#qvPrice");
  const mood = qs("#qvMood");
  const sizes = qs("#qvSizes");
  const open = qs("#qvOpen");
  const add = qs("#qvAdd");
  const note = qs("#qvNote");
  let current = null;

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    current = null;
  }

  function openModal(product) {
    current = product;
    if (img) {
      img.src = product.image;
      img.alt = product.name;
    }
    if (title) title.textContent = product.name;
    if (price) price.textContent = money(product.price);
    if (mood) mood.textContent = product.mood || "—";
    if (open) open.href = `product.html?id=${product._numId}`;
    if (sizes) {
      sizes.innerHTML = (product.sizes || []).length
        ? product.sizes.map((s) => `<span class="size-pill">${s}</span>`).join("")
        : `<span class="small">Розміри: —</span>`;
    }
    if (note) note.textContent = "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  modal.addEventListener("click", (event) => {
    if (event.target.dataset.close) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  if (add) {
    add.addEventListener("click", () => {
      if (!current || typeof window.addToCart !== "function") return;
      window.addToCart(current.id, 1, null);
      if (typeof window.updateCartBadge === "function") window.updateCartBadge();
      if (note) {
        note.textContent = "Додано до кошика.";
        setTimeout(() => (note.textContent = ""), 2000);
      }
    });
  }

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-qv]");
    if (!button) return;
    const card = event.target.closest(".product");
    if (!card) return;
    const product = products.find((p) => p.id === card.dataset.id);
    if (!product) return;
    event.preventDefault();
    openModal(product);
  });
}

function renderProductDetails(product) {
  const title = qs("#p-title");
  const price = qs("#p-price");
  const image = qs("#p-img");
  const mood = qs("#p-mood");
  const specsEl = qs("#p-specs");
  const sizesEl = qs("#p-sizes");
  const addBtn = qs("#add");
  const note = qs("#note");

  if (title) title.textContent = product.name;
  if (price) price.textContent = money(product.price);
  if (image) {
    image.src = product.image;
    image.alt = product.name;
  }
  if (mood) mood.textContent = product.mood || "—";

  if (specsEl) {
    const specs = product.specs || {};
    specsEl.innerHTML = `
      <div><b>Артикул:</b> ${product.sku || "—"}</div>
      <div><b>Матеріал:</b> ${specs.metal || "—"}</div>
      <div><b>Розміри:</b> ${(product.sizes || []).join(", ") || "—"}</div>
    `;
  }

  let selectedSize = null;
  window.selectedSize = null;

  if (sizesEl) {
    const sizeList = Array.isArray(product.sizes) ? product.sizes : [];
    if (!sizeList.length) {
      sizesEl.innerHTML = `<span class="small">Розмір не потрібен</span>`;
    } else {
      sizesEl.innerHTML = sizeList
        .map((size) => `<button class="chip" type="button" data-size="${size}">${size}</button>`)
        .join("");
      sizesEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-size]");
        if (!button) return;
        selectedSize = selectedSize === button.dataset.size ? null : button.dataset.size;
        window.selectedSize = selectedSize;
        [...sizesEl.querySelectorAll("[data-size]")].forEach((node) =>
          node.classList.toggle("is-active", node.dataset.size === selectedSize)
        );
      });
    }
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (typeof window.addToCart !== "function") return;
      window.addToCart(product, 1, selectedSize);
      if (typeof window.updateCartBadge === "function") window.updateCartBadge();
      if (note) {
        note.textContent = selectedSize ? `Додано (р. ${selectedSize}).` : "Додано до кошика.";
        setTimeout(() => (note.textContent = ""), 2200);
      }
    });
  }
}

function initProductPage(products) {
  const title = qs("#p-title");
  if (!title) return;
  const params = new URLSearchParams(window.location.search);
  const product = resolveProductByParam(products, params.get("id"));

  if (!product) {
    title.textContent = "Товар не знайдено";
    return;
  }

  renderProductDetails(product);
}

document.addEventListener("DOMContentLoaded", async () => {
  const products = await loadProducts();
  initCatalog(products);
  initQuickView(products);
  initProductPage(products);
  if (typeof window.updateCartBadge === "function") window.updateCartBadge();
});  