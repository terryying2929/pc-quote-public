const state = {
  data: null,
  products: [],
  cart: [],
};

const $ = (id) => document.getElementById(id);

function money(value) {
  return `¥${Number(value || 0).toFixed(0)}`;
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

async function loadData() {
  try {
    const res = await fetch("./public-data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`读取 public-data.json 失败：${res.status}`);
    state.data = await res.json();
    state.products = Array.isArray(state.data.products) ? state.data.products : [];
    renderCategories();
    renderProducts();
    $("quoteUpdated").textContent = `报价更新时间：${formatTime(state.data.quote_updated_at)}`;
    $("notice").textContent = state.data.disclaimer || $("notice").textContent;
  } catch (error) {
    $("status").textContent = error.message;
  }
}

function renderCategories() {
  const select = $("category");
  for (const category of state.data.categories || []) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

function filteredProducts() {
  const q = normalize($("q").value);
  const category = $("category").value;
  const status = $("statusFilter").value;
  return state.products
    .filter((item) => !category || item.category === category)
    .filter((item) => !status || item.price_status === status)
    .filter((item) => {
      if (!q) return true;
      return normalize(`${item.category} ${item.name} ${item.spec || ""} ${item.note || ""}`).includes(q);
    })
    .slice(0, 120);
}

function renderProducts() {
  const wrap = $("products");
  const items = filteredProducts();
  wrap.innerHTML = "";
  $("status").textContent = `共 ${state.products.length} 个公开商品，当前显示 ${items.length} 个`;
  if (!items.length) {
    wrap.innerHTML = '<p class="empty">没有找到匹配商品。</p>';
    return;
  }
  for (const item of items) {
    const div = document.createElement("article");
    div.className = "product";
    div.innerHTML = `
      <div>
        <span>${escapeHtml(item.category)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        ${item.spec ? `<p>${escapeHtml(item.spec)}</p>` : ""}
        ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
      </div>
      <div class="product-side">
        <strong>${item.retail_price == null ? "请咨询" : money(item.retail_price)}</strong>
        <small>${escapeHtml(item.price_status || "可咨询")}</small>
        <button type="button" data-add="${item.id}">加入</button>
      </div>
    `;
    wrap.appendChild(div);
  }
}

function addToCart(id) {
  const item = state.products.find((product) => Number(product.id) === Number(id));
  if (!item) return;
  const existing = state.cart.find((cartItem) => Number(cartItem.id) === Number(id));
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...item, quantity: 1 });
  }
  renderCart();
}

function renderCart() {
  const wrap = $("cartItems");
  wrap.innerHTML = "";
  if (!state.cart.length) {
    wrap.innerHTML = '<p class="empty">还没有加入配件。</p>';
  }
  for (const item of state.cart) {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.category)}</small>
      </div>
      <div class="qty">
        <button type="button" data-dec="${item.id}">-</button>
        <span>${item.quantity}</span>
        <button type="button" data-inc="${item.id}">+</button>
      </div>
    `;
    wrap.appendChild(div);
  }
  const total = state.cart.reduce((sum, item) => sum + Number(item.retail_price || 0) * item.quantity, 0);
  $("quoteTotal").textContent = money(total);
  $("cartTotal").textContent = money(total);
}

function changeQuantity(id, delta) {
  const item = state.cart.find((cartItem) => Number(cartItem.id) === Number(id));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter((cartItem) => Number(cartItem.id) !== Number(id));
  }
  renderCart();
}

async function copyQuote() {
  if (!state.cart.length) return;
  const lines = state.cart.map((item) => `${item.category}：${item.name} x${item.quantity} ${money(Number(item.retail_price || 0) * item.quantity)}`);
  lines.push(`不含税总价：${$("quoteTotal").textContent}`);
  lines.push($("notice").textContent);
  await navigator.clipboard.writeText(lines.join("\n"));
  $("status").textContent = "配置已复制";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("q").addEventListener("input", renderProducts);
$("category").addEventListener("change", renderProducts);
$("statusFilter").addEventListener("change", renderProducts);
$("products").addEventListener("click", (event) => {
  if (event.target.dataset.add) addToCart(event.target.dataset.add);
});
$("cartItems").addEventListener("click", (event) => {
  if (event.target.dataset.inc) changeQuantity(event.target.dataset.inc, 1);
  if (event.target.dataset.dec) changeQuantity(event.target.dataset.dec, -1);
});
$("copyBtn").addEventListener("click", () => copyQuote().catch((error) => {
  $("status").textContent = error.message;
}));

renderCart();
loadData();
