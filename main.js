/* ════════════════════════════════════════════════════
   ครัวแม่ปุ้ง — เมนูและราคา
   * ข้อมูลเมนูจริงดึงมาจากชีต "Menu" ใน Google Sheets (ผ่าน Apps Script)
   * ก้อนด้านล่างนี้เป็นเมนูสำรอง ใช้เฉพาะตอนโหลดจากชีตไม่ได้และยังไม่มีแคช
   * ถ้าจะแก้เมนู ให้แก้ในชีต ไม่ต้องแก้ตรงนี้
   ════════════════════════════════════════════════════ */

const FALLBACK_MENUS = [
  { id: "khluk-kapi", num: 1, name: "ข้าวคลุกกะปิ", price: 50, category: "featured", img: "khao-khluk-kapi.jpg", desc: "หอมกะปิ เครื่องแน่นจัดเต็มในกล่องเดียว มะม่วงดิบ แตงกวา ไข่เจียว หมูหวาน กุนเชียง กุ้งแห้ง พริกสด หอมแดง" },
  { id: "kai-yang", num: 2, name: "ข้าวไก่ย่างคลุกฝุ่น + น้ำจิ้มแจ่ว", price: 45, category: "chicken", img: "kai-yang-klukfun.jpg", tag: "🔥 น้ำจิ้มแซ่บ" },
  { id: "kai-krathiam", num: 3, name: "ข้าวไก่กระเทียม", price: 45, category: "chicken", img: "kai-krathiam.jpg" },
  { id: "kai-prikklua", num: 4, name: "ข้าวไก่คั่วพริกเกลือ", price: 45, category: "chicken", img: "kai-khua-prik-klua.jpg" },
  { id: "kai-samunphrai", num: 5, name: "ข้าวไก่นึ่งสมุนไพร + น้ำจิ้มซีฟู้ด", price: 45, category: "chicken", img: "kai-neung-samunphrai.jpg" },
  { id: "kai-samunphrai-kap", num: 6, name: "ไก่นึ่งสมุนไพร เป็นกับข้าว (ปีกไก่ 2 + น่องไก่ 1 ชิ้น)", price: 50, category: "chicken", img: "kai-peek-nong-samunphrai.png", side: true },
  { id: "kai-saphok-samunphrai", num: 11, name: "สะโพกไก่นึ่งสมุนไพร (ชิ้นโตๆ)", price: 40, category: "chicken", img: "kai-saphok-samunphrai.png", side: true, tag: "ชิ้นละ 40.-" },
  { id: "kung-kari", num: 7, name: "ข้าวกุ้งผัดผงกะหรี่", price: 50, category: "shrimp", img: "kung-phad-phong-kari.jpg" },
  { id: "kung-muk-kari", num: 8, name: "ข้าวกุ้ง+หมึกผัดผงกะหรี่", price: 50, category: "shrimp", img: "kung-phad-phong-kari.jpg" },
  { id: "kung-prikklua", num: 9, name: "ข้าวกุ้งคั่วพริกเกลือ", price: 50, category: "shrimp", img: "kung-khua-prik-klua.jpg" },
  { id: "kung-krathiam", num: 10, name: "ข้าวกุ้งกระเทียม", price: 50, category: "shrimp", img: "kung-krathiam.jpg" },
  { id: "muk-krathiam", num: 12, name: "ข้าวหมึกกระเทียม", price: 50, category: "shrimp", img: "muk-krathiam.jpg", tag: "🆕 เมนูใหม่" },
  { id: "muk-kari", num: 13, name: "ข้าวหมึกผัดผงกะหรี่", price: 50, category: "shrimp", img: "muk-phad-phong-kari.jpg", tag: "🆕 เมนูใหม่" },
];

let MENUS = [];          // เมนูที่กำลังแสดงอยู่ (มาจากชีต / แคช / สำรอง)
let IMG = {};
const MENU_CACHE_KEY = "mp_menu_cache_v1";

let cart = [];
let globalSpice = "เผ็ดปกติ";
let globalVeg = "🥬 ใส่ผักสด";

/* ── ลิงก์เพิ่มเพื่อน LINE OA — ใส่ลิงก์ของร้านครัวแม่ปุ้งตรงนี้ ── */
const LINE_OA_LINK = "https://line.me/R/ti/p/@939cbtmd";

function connectLine() {
  if (LINE_OA_LINK === "#") { showToast("⚠️ ยังไม่ได้ตั้งค่าลิงก์ LINE OA ของร้าน"); return; }
  window.open(LINE_OA_LINK, "_blank");
}
document.getElementById("lineFab").addEventListener("click", function (e) {
  if (LINE_OA_LINK === "#") { e.preventDefault(); showToast("⚠️ ยังไม่ได้ตั้งค่าลิงก์ LINE OA ของร้าน"); }
});

/* ── ป้องกันตัวอักษรพิเศษจากชีตทำให้ HTML พัง ── */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ── Price table ── */
function buildPriceRow(m) {
  const sideNote = m.side ? ' <span style="color:var(--muted);font-size:11px;">(ไม่รวมข้าว)</span>' : "";
  const priceCell = m.available ? `${m.price} บาท` : "หมด";
  return `<tr class="${m.available ? "" : "soldout"}"><td class="num-col">${m.num}</td><td>${esc(m.name)}${sideNote}</td><td class="price-col">${priceCell}</td></tr>`;
}

/* ── Feature card (เมนูยอดฮิต) ── */
function buildFeatureCard(m) {
  const soldTag = m.available ? "" : `<div class="soldout-tag">หมด</div>`;
  const action = m.available
    ? `<div class="qty-row">
        <label>จำนวน</label>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="chgQty('qty_${esc(m.id)}',-1)">−</button>
          <span class="qty-num" id="qty_${esc(m.id)}">1</span>
          <button class="qty-btn" onclick="chgQty('qty_${esc(m.id)}',1)">+</button>
        </div>
      </div>
      <button class="btn-add" id="btn_${esc(m.id)}" onclick="addToCart('${esc(m.id)}')">+ เพิ่มลงตะกร้า</button>`
    : `<button class="btn-add" id="btn_${esc(m.id)}" disabled>หมดชั่วคราว</button>`;
  return `<div class="feature-card ${m.available ? "" : "soldout"}">
    <div class="feature-img-wrap">
      <img src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy">
      <div class="feature-ribbon">เมนูยอดฮิต</div>
      <div class="feature-stamp"><b>${m.price}</b><span>บาท</span></div>
      ${soldTag}
    </div>
    <div class="feature-body">
      <h3>${esc(m.name)}</h3>
      <p>${esc(m.desc)}</p>
      ${action}
    </div>
  </div>`;
}

/* ── Build product card ── */
function buildCard(m) {
  const best = m.tag ? `<div class="best-tag">${esc(m.tag)}</div>` : "";
  const side = m.side ? `<div class="side-tag">ไม่รวมข้าว</div>` : "";
  const soldTag = m.available ? "" : `<div class="soldout-tag">หมด</div>`;
  const action = m.available
    ? `<div class="qty-row">
        <label>จำนวน</label>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="chgQty('qty_${esc(m.id)}',-1)">−</button>
          <span class="qty-num" id="qty_${esc(m.id)}">1</span>
          <button class="qty-btn" onclick="chgQty('qty_${esc(m.id)}',1)">+</button>
        </div>
      </div>
      <button class="btn-add" id="btn_${esc(m.id)}" onclick="addToCart('${esc(m.id)}')">+ เพิ่มลงตะกร้า</button>`
    : `<button class="btn-add" id="btn_${esc(m.id)}" disabled style="margin-top:10px;">หมดชั่วคราว</button>`;
  return `<div class="card ${m.available ? "" : "soldout"}">
    <div class="card-img-wrap">
      <img src="${esc(m.img)}" alt="${esc(m.name)}" loading="lazy">
      ${best}${side}${soldTag}
    </div>
    <div class="card-body">
      <h3>${esc(m.name)}</h3>
      <div class="card-price">${m.price} บาท</div>
      ${action}
    </div>
  </div>`;
}

/* ── วาดเมนูทั้งหมดจากรายการที่ได้รับ ── */
function renderMenus(list) {
  MENUS = list.map(m => Object.assign({ tag: "", desc: "", side: false, available: true }, m));
  IMG = Object.fromEntries(MENUS.map(m => [m.id, m.img]));

  const byPrice = (a, b) => (a.price - b.price) || (a.num - b.num);
  const featureItem = MENUS.find(m => m.category === "featured");
  const chicken = MENUS.filter(m => m.category === "chicken").sort(byPrice);
  const shrimp = MENUS.filter(m => m.category === "shrimp").sort(byPrice);

  document.getElementById("priceTableBody").innerHTML = [...MENUS].sort(byPrice).map(buildPriceRow).join("");
  document.getElementById("featureWrap").innerHTML = featureItem ? buildFeatureCard(featureItem) : "";
  document.getElementById("grid-chicken").innerHTML = chicken.map(buildCard).join("");
  document.getElementById("grid-shrimp").innerHTML = shrimp.map(buildCard).join("");
}

/* ── ตะกร้าที่ค้างอยู่: ถ้าเมนูหมด/ราคาเปลี่ยน ให้ปรับตาม ── */
function syncCartWithMenus() {
  if (cart.length === 0) return;
  const before = cart.length;
  cart = cart.filter(c => { const m = MENUS.find(x => x.id === c.id); return m && m.available; });
  cart.forEach(c => { const m = MENUS.find(x => x.id === c.id); c.price = m.price; c.name = m.name; });
  updateCartBar();
  if (cart.length < before) showToast("⚠️ มีบางเมนูหมดแล้ว ระบบเอาออกจากตะกร้าให้");
}

/* ── โหลดเมนูจากชีต (แสดงแคช/สำรองทันที แล้วอัปเดตเมื่อได้ข้อมูลใหม่) ── */
let lastMenuJson = "";

function showInitialMenus() {
  try {
    const cached = JSON.parse(localStorage.getItem(MENU_CACHE_KEY) || "null");
    if (Array.isArray(cached) && cached.length) { renderMenus(cached); lastMenuJson = JSON.stringify(cached); return; }
  } catch (e) { /* ไม่มีแคชก็ข้าม */ }
  renderMenus(FALLBACK_MENUS);
}

async function loadMenus() {
  if (APPS_SCRIPT_URL === "PUT_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(APPS_SCRIPT_URL, { signal: ctrl.signal, cache: "no-store" });
    const data = await res.json();
    if (data.status !== "ok" || !Array.isArray(data.menus) || data.menus.length === 0) {
      throw new Error(data.message || "ได้รายการเมนูว่างเปล่า");
    }
    const json = JSON.stringify(data.menus);
    if (json === lastMenuJson) return;     // ไม่มีอะไรเปลี่ยน ไม่ต้องวาดใหม่
    renderMenus(data.menus);
    lastMenuJson = json;
    try { localStorage.setItem(MENU_CACHE_KEY, json); } catch (e) { /* ข้าม */ }
    syncCartWithMenus();
  } catch (err) {
    console.warn("โหลดเมนูจากชีตไม่สำเร็จ ใช้เมนูที่แสดงอยู่ต่อไป:", err);
  } finally {
    clearTimeout(timer);
  }
}


/* ── Quantity controls ── */
function chgQty(id, d) {
  const el = document.getElementById(id);
  el.textContent = Math.max(1, Math.min(99, parseInt(el.textContent) + d));
}

/* ── Spice level handler ── */
function handleSpiceChange(el) {
  globalSpice = el.value;
}

/* ── Add to cart (ดึงชื่อ/ราคาจากรายการเมนู ไม่รับจาก HTML) ── */
function addToCart(id) {
  const m = MENUS.find(x => x.id === id);
  if (!m || !m.available) { showToast("⚠️ เมนูนี้หมดแล้วครับ"); return; }
  const qty = parseInt(document.getElementById("qty_" + id).textContent);
  const ex = cart.find(c => c.id === id);
  if (ex) { ex.qty += qty; }
  else { cart.push({ id, name: m.name, price: m.price, spice: "เผ็ดปกติ", veg: "🥬 ใส่ผักสด", qty, img: m.img }); }
  updateCartBar();
  flashBtn(id);
  showToast("✅ เพิ่ม " + m.name + " x" + qty + " แล้ว!");
}


function flashBtn(id) {
  const b = document.getElementById("btn_" + id);
  b.classList.add("added");
  b.textContent = "✅ เพิ่มแล้ว!";
  setTimeout(() => { b.classList.remove("added"); b.textContent = "+ เพิ่มลงตะกร้า"; }, 1500);
}

/* ── Price calculations (ราคาต่อรายการ ไม่มีโปรพ่วง) ── */
function itemTotal(c) { return c.price * c.qty; }
function cartGrandTotal() { return cart.reduce((s, c) => s + itemTotal(c), 0); }
function totalCount() { return cart.reduce((s, c) => s + c.qty, 0); }

/* ── Cart bar ── */
function updateCartBar() {
  const total = cartGrandTotal();
  const count = totalCount();
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = "฿" + total;
  document.getElementById("cartSummary").textContent = count > 0 ? cart.map(c => c.name + " x" + c.qty).join(", ") : "ยังไม่มีรายการ";
  const btn = document.getElementById("btnCheckout");
  btn.disabled = count === 0;
  btn.textContent = count > 0 ? "ดูตะกร้า (" + count + ")" : "ดูตะกร้า";
}

/* ── Modal controls ── */
let isOrderSuccess = false;

function openCart() { renderModal(); document.getElementById("modalBg").classList.add("open"); document.body.style.overflow = "hidden"; }

function closeCart() {
  document.getElementById("modalBg").classList.remove("open");
  document.body.style.overflow = "";
  if (isOrderSuccess) {
    isOrderSuccess = false;
    const btnLine = document.getElementById("btnLine");
    cart = []; globalSpice = "เผ็ดปกติ"; globalVeg = "🥬 ใส่ผักสด";
    btnLine.disabled = false;
    btnLine.innerHTML = `<span>💬</span><span>สั่งผ่าน LINE ทันที!<span class="btn-line-sub">กดเพื่อส่งออเดอร์ไปหาร้าน</span></span>`;
    btnLine.style.display = "";
    updateCartBar();
  }
}

function closeCartOutside(e) { if (e.target === document.getElementById("modalBg")) closeCart(); }

/* ── Render modal ── */
function renderModal() {
  const count = totalCount();
  const total = cartGrandTotal();
  const sub = document.getElementById("modalHeadSub");
  sub.textContent = count > 0 ? count + " รายการ • ยอดรวม ฿" + total : "ยังไม่มีสินค้าในตะกร้า";
  const body = document.getElementById("modalBody");
  const hasItems = cart.length > 0;
  const btnLine = document.getElementById("btnLine");
  btnLine.style.display = hasItems ? "flex" : "none";

  if (!hasItems) {
    body.innerHTML = `<div class="cart-empty">
      <div class="cart-empty-icon">🛒</div>
      <div class="cart-empty-text">ตะกร้าว่างอยู่ครับ</div>
      <div class="cart-empty-sub">กดเพิ่มสินค้าก่อนนะครับ</div>
    </div>`;
    return;
  }

  const itemsHTML = `<div class="cart-items-section">${cart.map((c, i) => `
    <div class="cart-item">
      <img class="ci-img" src="${c.img}" alt="${c.name}">
      <div class="ci-info">
        <div class="ci-name">${c.name}</div>
        <div class="ci-controls">
          <button class="ci-qbtn" onclick="cartChg(${i},-1)">−</button>
          <span class="ci-qnum">${c.qty}</span>
          <button class="ci-qbtn" onclick="cartChg(${i},1)">+</button>
        </div>
      </div>
      <div class="ci-right">
        <div class="ci-price">฿${itemTotal(c)}</div>
        <button class="ci-del" onclick="cartDel(${i})" title="ลบ">🗑</button>
      </div>
    </div>`).join("")}</div>`;

  const summaryHTML = `
  <div class="section-divider"><span>สรุปยอด</span></div>
  <div class="order-summary" style="text-align:center;padding:14px;">
    <div class="os-total-row" style="background:none;border:none;padding:0;">
      <div>
        <div class="os-total-label">ยอดรวมทั้งหมด</div>
      </div>
      <div class="os-total-amount">฿${total}</div>
    </div>
  </div>`;

  const spiceVals = ["เผ็ดน้อย", "เผ็ดปกติ", "เผ็ดมาก"];
  const spiceIcons = { "เผ็ดน้อย": "🌶️", "เผ็ดปกติ": "🌶️🌶️", "เผ็ดมาก": "🌶️🌶️🌶️" };
  const spiceBoxes = spiceVals.map(sv => {
    const chk = globalSpice === sv ? "checked" : "";
    return `<label class="spice-chk"><input type="radio" name="gspice" value="${sv}" ${chk} onchange="handleSpiceChange(this)"><span>${spiceIcons[sv]} ${sv}</span></label>`;
  }).join("");

  const spiceVegSectionHTML = `
  <div class="section-divider"><span>ระดับความเผ็ด & ผัก</span></div>
  <div class="modal-spice-section">
    <div class="modal-spice-item">
      <div class="msi-row">
        <div class="msi-label">เผ็ด</div>
        <div class="spice-grid modal-spice-grid">${spiceBoxes}</div>
      </div>
      <div class="msi-row" style="margin-top:10px">
        <div class="msi-label">ผัก</div>
        <div class="veg-options">
          <label class="veg-opt"><input type="radio" name="gveg" value="🥬 ใส่ผักสด" ${globalVeg === "🥬 ใส่ผักสด" ? "checked" : ""} onchange="globalVeg=this.value"><span>🥬 ใส่ผักสด</span></label>
          <label class="veg-opt"><input type="radio" name="gveg" value="🚫 ไม่ใส่ผักสด" ${globalVeg === "🚫 ไม่ใส่ผักสด" ? "checked" : ""} onchange="globalVeg=this.value"><span>🚫 ไม่ใส่ผักสด</span></label>
        </div>
      </div>
      <div class="msi-note">✅ ใช้กับทุกเมนูในออเดอร์นี้</div>
    </div>
  </div>`;

  const formHTML = `
  <div class="section-divider"><span>ที่อยู่จัดส่ง</span></div>
  <div class="delivery-section">
    <div class="ds-header">📍 ระบุที่อยู่จัดส่ง</div>
    <div class="ds-body">
      <div class="field-row">
        <div class="field-wrap">
          <label class="field-label">บ้านเลขที่<span class="field-required">*</span></label>
          <input class="field-input" id="fldHouseNo" type="text" placeholder="เช่น 159" maxlength="30">
          <span class="field-err">กรุณากรอกบ้านเลขที่</span>
        </div>
        <div class="field-wrap">
          <label class="field-label">ซอย</label>
          <input class="field-input" id="fldSoi" type="text" placeholder="เช่น 3" maxlength="60">
        </div>
      </div>
      <div class="field-row full">
        <div class="field-wrap">
          <label class="field-label">หมายเหตุ</label>
          <textarea class="field-input field-textarea" id="fldNote" rows="2" placeholder="เช่น สแกนคนละครึ่ง" maxlength="200"></textarea>
        </div>
      </div>
    </div>
  </div>`;

  body.innerHTML = itemsHTML + summaryHTML + spiceVegSectionHTML + formHTML;
  document.getElementById("fldHouseNo").addEventListener("input", function () {
    if (this.value.trim()) this.classList.remove("err");
  });
}

/* ── Cart item controls ── */
function cartChg(i, d) { cart[i].qty = Math.max(1, cart[i].qty + d); updateCartBar(); renderModal(); }
function cartDel(i) { cart.splice(i, 1); updateCartBar(); renderModal(); }

/* ── Form validation ── */
function validateForm() {
  const el = document.getElementById("fldHouseNo");
  if (!el || !el.value.trim()) { if (el) el.classList.add("err"); return false; }
  el.classList.remove("err");
  return true;
}

/* ── Thai date/time ── */
function getThaiDateTime() {
  const now = new Date();
  const thDate = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const thTime = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { date: thDate, time: thTime };
}

/* ── Generate Order ID ── */
function genOrderId() {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return "MP-" + ts + rnd;
}

/* ── ตั้งค่า Apps Script Web App URL ──
   ยังไม่ได้ตั้งค่า! ให้ deploy Google Apps Script ของร้านครัวแม่ปุ้งเอง (ดูวิธีใน AppsScript_Code.gs)
   แล้วนำ URL ที่ได้มาแทนที่ค่าด้านล่างนี้ ── */
const APPS_SCRIPT_URL = "PUT_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

/* ── ส่งออเดอร์ ── */
async function sendToLine() {
  if (cart.length === 0) return;
  if (!validateForm()) { showToast("⚠️ กรุณากรอกบ้านเลขที่"); return; }
  if (APPS_SCRIPT_URL === "PUT_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showToast("⚠️ ร้านยังไม่ได้ตั้งค่าระบบรับออเดอร์ กรุณาติดต่อร้านโดยตรง");
    return;
  }

  const houseNo = document.getElementById("fldHouseNo").value.trim();
  const soi = document.getElementById("fldSoi").value.trim();
  const note = document.getElementById("fldNote").value.trim();
  const total = cartGrandTotal();
  const count = totalCount();
  const addrLine = soi ? `บ้านเลขที่ ${houseNo}  ซ.${soi}` : `บ้านเลขที่ ${houseNo}`;
  const { date, time } = getThaiDateTime();
  const orderId = genOrderId();

  const orderPayload = {
    orderId,
    date,
    time,
    address: addrLine,
    items: cart.map(c => ({ name: c.name, qty: c.qty, price: itemTotal(c) })),
    sauce: globalSpice,
    veg: globalVeg,
    note,
    total,
    count
  };

  const btnLine = document.getElementById("btnLine");
  btnLine.disabled = true;
  const originalHTML = btnLine.innerHTML;
  btnLine.innerHTML = "<span>⏳</span><span>กำลังส่งออเดอร์...</span>";

  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(orderPayload)
    });
    showSuccess(orderPayload);
  } catch (err) {
    console.error("ส่งออเดอร์ไม่สำเร็จ:", err);
    showToast("⚠️ ส่งออเดอร์ไม่สำเร็จ กรุณาลองใหม่ หรือโทรสั่งโดยตรง");
    btnLine.disabled = false;
    btnLine.innerHTML = originalHTML;
  }
}

/* ── Success screen ── */
function showSuccess(order) {
  const body = document.getElementById("modalBody");
  const btnLine = document.getElementById("btnLine");
  btnLine.style.display = "none";
  isOrderSuccess = true;
  const sub = document.getElementById("modalHeadSub");
  sub.textContent = "ส่งออเดอร์เสร็จแล้ว 🎉";

  const itemsHTML = order.items.map(it => `
    <div class="os-item">
      <div class="os-item-left">
        <div class="os-item-name">${it.name}</div>
        <div class="os-item-detail">จำนวน ${it.qty} กล่อง</div>
      </div>
      <div class="os-item-price">฿${it.price}</div>
    </div>`).join("");

  body.innerHTML = `<div class="success-screen">
    <div class="success-glow">✅</div>
    <div class="success-title">ส่งออเดอร์เรียบร้อยแล้ว!</div>
    <div class="success-sub">ร้านได้รับรายการสั่งซื้อแล้วครับ<br>สามารถกดปิดได้เลย</div>
  </div>

  <div class="section-divider"><span>เลขที่ออเดอร์</span></div>
  <div class="order-summary" style="text-align:center;padding:14px;">
    <div style="font-size:18px;font-weight:900;letter-spacing:0.5px;color:var(--turmeric);">${order.orderId}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px;">${order.date} • ${order.time}</div>
  </div>

  <div class="section-divider"><span>ทวนรายการสั่งซื้อ</span></div>
  <div class="order-summary">
    <div class="os-header">🧾 รายการสินค้า <span class="count-chip">${order.count} กล่อง</span></div>
    ${itemsHTML}
    <div class="os-total-row">
      <div>
        <div class="os-total-label">ยอดรวมทั้งหมด</div>
        <div class="os-total-note">🌶️ ${order.sauce} • ${order.veg}</div>
      </div>
      <div class="os-total-amount">฿${order.total}</div>
    </div>
  </div>

  <div class="section-divider"><span>จัดส่งไปที่</span></div>
  <div class="order-summary" style="padding:12px 14px;">
    <div style="font-size:14px;">📍 ${order.address}</div>
    ${order.note ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">📝 ${order.note}</div>` : ""}
  </div>

  <div class="success-screen" style="padding-top:20px;padding-bottom:8px;min-height:auto;">
    <div class="success-countdown">กดปุ่ม ✕ ด้านบนเพื่อปิดหน้าต่างนี้ได้เลยครับ</div>
  </div>`;
}

/* ── Toast notification ── */
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ── เริ่มทำงาน: แสดงเมนูทันที แล้วดึงข้อมูลล่าสุดจากชีต ── */
showInitialMenus();
loadMenus();
