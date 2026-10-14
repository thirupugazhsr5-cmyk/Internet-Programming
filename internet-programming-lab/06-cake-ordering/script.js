/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Storage full - use a smaller image'); return false; } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }

/* ===== Data ===== */
const K = { users: 'ck_users', cakes: 'ck_cakes', orders: 'ck_orders', me: 'ck_me', cart: 'ck_cart_' };
const CATS = ['Birthday', 'Wedding', 'Anniversary', 'Festival'];
const SUBS = ['Chocolate', 'Fruit', 'Vanilla', 'Red Velvet'];
const SIZES = { '500 g': 1, '1 kg': 1.9, '2 kg': 3.6 };
const STEPS = ['Placed', 'Confirmed', 'Baking', 'Out for delivery', 'Delivered'];
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'Bakery Admin', email: 'admin@cake.com', phone: '9000000000', pass: 'admin123', role: 'admin', addresses: [] },
  { id: 'u1', name: 'Demo Customer', email: 'user@cake.com', phone: '9876543210', pass: 'user123', role: 'user', addresses: [{ id: 'ad1', label: 'Home', line: '12, Lake View Road, T. Nagar', city: 'Chennai', pin: '600017', phone: '9876543210' }] }
]);
if (!get(K.cakes)) set(K.cakes, [
  { id: 'c1', name: 'Choco Truffle Delight', cat: 'Birthday', sub: 'Chocolate', price: 450, emoji: '🍫', img: '', desc: 'Rich dark chocolate sponge layered with silky truffle ganache.' },
  { id: 'c2', name: 'Red Velvet Romance', cat: 'Anniversary', sub: 'Red Velvet', price: 550, emoji: '❤️', img: '', desc: 'Classic red velvet with cream cheese frosting and heart toppers.' },
  { id: 'c3', name: 'Fresh Fruit Cake', cat: 'Birthday', sub: 'Fruit', price: 500, emoji: '🍓', img: '', desc: 'Light vanilla sponge topped with seasonal fresh fruits.' },
  { id: 'c4', name: 'Royal Wedding Tier', cat: 'Wedding', sub: 'Vanilla', price: 1500, emoji: '💍', img: '', desc: 'Elegant white fondant cake with floral sugar art. Serves 25+.' },
  { id: 'c5', name: 'Plum Festival Cake', cat: 'Festival', sub: 'Fruit', price: 400, emoji: '🎄', img: '', desc: 'Traditional rum-soaked plum cake, perfect for celebrations.' },
  { id: 'c6', name: 'Vanilla Cloud', cat: 'Anniversary', sub: 'Vanilla', price: 380, emoji: '☁️', img: '', desc: 'Soft vanilla sponge with whipped cream and pearl sprinkles.' }
]);
if (!get(K.orders)) set(K.orders, []);

let me = get(K.me, null);
const users = () => get(K.users, []), cakes = () => get(K.cakes, []), orders = () => get(K.orders, []);
const cart = () => me ? get(K.cart + me.id, []) : [], saveCart = c => set(K.cart + me.id, c);
const cakeOf = id => cakes().find(c => c.id === id);
const userOf = id => users().find(u => u.id === id) || { name: '?', addresses: [] };
const sizePrice = (c, size) => Math.round(c.price * SIZES[size]);
const imgHtml = (c, h = 150) => c.img ? `<img src="${c.img}" alt="${esc(c.name)}" style="width:100%;height:${h}px;object-fit:cover;border-radius:8px">` : `<div class="emoji" style="font-size:${h / 2.5}px;line-height:${h}px;height:${h}px;background:#fdf2f8;border-radius:8px">${c.emoji || '🎂'}</div>`;

/* ===== Navigation ===== */
const role = () => me ? me.role : 'guest';
function renderNav() { $$('[data-for]').forEach(b => b.classList.toggle('hidden', !b.dataset.for.split(',').includes(role()))); $('#cartCount').textContent = cart().reduce((s, i) => s + i.qty, 0); }
function go(v) {
  if (v === 'dash') v = me ? (me.role === 'admin' ? 'admin' : 'user') : 'login';
  if (v === 'cart' && !me) v = 'login';
  $$('.view').forEach(e => e.classList.toggle('hidden', e.id !== 'v-' + v));
  renderNav(); renderAll(); window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
  const t = e.target.closest('[data-tab]');
  if (t) {
    const v = t.closest('.view');
    v.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === t));
    v.querySelectorAll('.tab').forEach(x => x.classList.toggle('hidden', x.id !== t.dataset.tab));
  }
  const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) actions[a.dataset.act](a.dataset.id, a.dataset.arg);
});
$('#logout').onclick = () => { me = null; localStorage.removeItem(K.me); toast('Logged out'); go('shop'); };

/* ===== Auth ===== */
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name); go(u.role === 'admin' ? 'dash' : 'shop');
};
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const email = $('#rEmail').value.trim().toLowerCase();
  if (users().some(u => u.email.toLowerCase() === email)) return toast('Email already registered');
  const l = users(); l.push({ id: uid(), name: $('#rName').value.trim(), email, phone: $('#rPhone').value, pass: $('#rPass').value, role: 'user', addresses: [] });
  set(K.users, l); e.target.reset(); toast('Registered! Please login.'); go('login');
};

/* ===== Shop ===== */
function fillFilters() {
  const fill = (el, arr, all) => { const v = el.value; el.innerHTML = `<option value="">${all}</option>` + arr.map(x => `<option>${x}</option>`).join(''); el.value = v; };
  if (!$('#fCat').options.length) { fill($('#fCat'), CATS, 'All categories'); fill($('#fSub'), SUBS, 'All sub categories'); }
  if (!$('#pCat').options.length) { $('#pCat').innerHTML = CATS.map(x => `<option>${x}</option>`).join(''); $('#pSub').innerHTML = SUBS.map(x => `<option>${x}</option>`).join(''); }
}
function renderShop() {
  const q = $('#fQ').value.toLowerCase(), cat = $('#fCat').value, sub = $('#fSub').value, mn = +$('#fMin').value || 0, mx = +$('#fMax').value || Infinity;
  const list = cakes().filter(c => (!q || (c.name + ' ' + c.sub + ' ' + c.desc).toLowerCase().includes(q)) && (!cat || c.cat === cat) && (!sub || c.sub === sub) && c.price >= mn && c.price <= mx);
  $('#cakeGrid').innerHTML = list.map(c => `<div class="card">${imgHtml(c)}<h3 style="margin-top:8px">${esc(c.name)}</h3><p class="mut">${esc(c.cat)} · ${esc(c.sub)}</p><p class="price">From ${money(c.price)}</p>
    <button class="btn sm" data-act="view" data-id="${c.id}">View &amp; order</button></div>`).join('') || '<p class="mut">No cakes match your filters.</p>';
}
['fQ', 'fCat', 'fSub', 'fMin', 'fMax'].forEach(id => $('#' + id).addEventListener('input', renderShop));
$('#fReset').onclick = () => { ['fQ', 'fCat', 'fSub', 'fMin', 'fMax'].forEach(id => $('#' + id).value = ''); renderShop(); };

/* ===== Cart & order ===== */
function renderCart() {
  const c = cart();
  $('#cartRows').innerHTML = c.map((i, n) => { const k = cakeOf(i.cakeId); if (!k) return ''; return `<tr><td>${esc(k.name)}</td><td>${i.size}</td><td>${esc(i.msg) || '-'}</td><td>${i.qty}</td><td>${money(sizePrice(k, i.size) * i.qty)}</td><td><button class="btn sm red" data-act="rmCart" data-id="${n}">Remove</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="mut">Your cart is empty.</td></tr>';
  $('#cartTotal').textContent = money(cartTotal());
  $('#checkoutBox').classList.toggle('hidden', !c.length);
  const addrs = me ? userOf(me.id).addresses : [];
  $('#oAddr').innerHTML = addrs.map(a => `<option value="${a.id}">${esc(a.label)}: ${esc(a.line)}, ${esc(a.city)} - ${esc(a.pin)}</option>`).join('');
  $('#addrHint').textContent = addrs.length ? '' : 'Please add a shipping address first (Dashboard → Shipping Addresses).';
  const d = new Date(); d.setDate(d.getDate() + 1); $('#oDate').min = d.toISOString().slice(0, 10); if (!$('#oDate').value) $('#oDate').value = $('#oDate').min;
}
const cartTotal = () => cart().reduce((s, i) => { const k = cakeOf(i.cakeId); return s + (k ? sizePrice(k, i.size) * i.qty : 0); }, 0);
$('#orderForm').onsubmit = e => {
  e.preventDefault();
  const a = userOf(me.id).addresses.find(x => x.id === $('#oAddr').value);
  if (!a) return toast('Please add a shipping address first');
  const items = cart().map(i => { const k = cakeOf(i.cakeId); return k && { cakeId: k.id, name: k.name, size: i.size, msg: i.msg, qty: i.qty, price: sizePrice(k, i.size) }; }).filter(Boolean);
  if (!items.length) return toast('Cart is empty');
  const l = orders(), o = { id: 'CK' + Math.floor(10000 + Math.random() * 90000), userId: me.id, items, total: cartTotal(), address: a, delivery: $('#oDate').value, pay: $('#oPay').value, status: 'Placed', location: 'Bakery – order received', placed: today(), timeline: [{ s: 'Placed', loc: 'Bakery – order received', t: new Date().toLocaleString() }] };
  l.push(o); set(K.orders, l); saveCart([]); $('#oDate').value = '';
  showDlg(`<h2>🎉 Order placed</h2><p>Order <b>${o.id}</b> · ${money(o.total)} · ${esc(o.pay)}<br>Delivery on ${o.delivery}</p><p class="mut">Confirmation email sent to ${esc(me.email)} (demo).</p>`); go('dash');
};

/* ===== Addresses ===== */
function clearAddr() { $('#addrForm').reset(); $('#aId').value = ''; $('#addrTitle').textContent = 'Add shipping address'; }
$('#aClear').onclick = clearAddr;
$('#addrForm').onsubmit = e => {
  e.preventDefault();
  const l = users(), u = l.find(x => x.id === me.id), id = $('#aId').value;
  const d = { label: $('#aLabel').value.trim(), line: $('#aLine').value.trim(), city: $('#aCity').value.trim(), pin: $('#aPin').value, phone: $('#aPhone').value };
  if (id) Object.assign(u.addresses.find(a => a.id === id), d); else u.addresses.push({ id: uid(), ...d });
  set(K.users, l); me = u; set(K.me, u); toast(id ? 'Address updated' : 'Address added'); clearAddr(); renderAll();
};

/* ===== Admin products ===== */
let imgData = '';
$('#pFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 420 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); imgData = c.toDataURL('image/jpeg', .8); $('#pPrev').innerHTML = `<img src="${imgData}" style="height:60px;margin-top:6px;border-radius:6px">`; }; im.src = r.result; };
  r.readAsDataURL(f);
};
function clearProd() { $('#prodForm').reset(); $('#pId').value = ''; $('#pTitle').textContent = 'Post cake details'; imgData = ''; $('#pPrev').innerHTML = ''; }
$('#pClear').onclick = clearProd;
$('#prodForm').onsubmit = e => {
  e.preventDefault();
  const l = cakes(), id = $('#pId').value, d = { name: $('#pName').value.trim(), cat: $('#pCat').value, sub: $('#pSub').value, price: +$('#pPrice').value, desc: $('#pDesc').value.trim() };
  if (id) { const c = l.find(x => x.id === id); Object.assign(c, d); if (imgData) c.img = imgData; } else l.push({ id: uid(), ...d, img: imgData, emoji: '🎂' });
  if (set(K.cakes, l)) { toast(id ? 'Product updated' : 'Product posted'); clearProd(); renderAll(); }
};

/* ===== Actions ===== */
const actions = {
  view(id) {
    const c = cakeOf(id);
    showDlg(`${imgHtml(c, 200)}<h2 style="margin-top:8px">${esc(c.name)}</h2><p class="mut">${esc(c.cat)} · ${esc(c.sub)}</p><p>${esc(c.desc)}</p>
      <div class="row"><div><label>Size</label><select id="dSize">${Object.keys(SIZES).map(s => `<option value="${s}">${s} - ${money(sizePrice(c, s))}</option>`).join('')}</select></div><div style="flex:0 0 90px"><label>Qty</label><input type="number" id="dQty" min="1" max="10" value="1"></div></div>
      <div><label>Message on cake (optional)</label><input id="dMsg" maxlength="30" placeholder="Happy Birthday Riya!"></div><br>
      <button class="btn" id="dAdd">Add to cart</button>`);
    $('#dAdd').onclick = () => {
      if (!me) { $('#dlg').close(); toast('Please login to add to cart'); return go('login'); }
      if (me.role === 'admin') return toast('Admins cannot place orders');
      const c2 = cart(); c2.push({ cakeId: id, size: $('#dSize').value, msg: $('#dMsg').value.trim(), qty: Math.max(1, +$('#dQty').value || 1) });
      saveCart(c2); $('#dlg').close(); toast('Added to cart'); renderNav();
    };
  },
  rmCart(n) { const c = cart(); c.splice(+n, 1); saveCart(c); renderAll(); renderNav(); },
  editAddr(id) { const a = userOf(me.id).addresses.find(x => x.id === id); $('#aId').value = id; $('#aLabel').value = a.label; $('#aLine').value = a.line; $('#aCity').value = a.city; $('#aPin').value = a.pin; $('#aPhone').value = a.phone; $('#addrTitle').textContent = 'Update shipping address'; },
  delAddr(id) { const l = users(), u = l.find(x => x.id === me.id); u.addresses = u.addresses.filter(a => a.id !== id); set(K.users, l); me = u; set(K.me, u); renderAll(); },
  editCake(id) {
    const c = cakeOf(id); $('#pId').value = id; $('#pName').value = c.name; $('#pCat').value = c.cat; $('#pSub').value = c.sub; $('#pPrice').value = c.price; $('#pDesc').value = c.desc; imgData = '';
    $('#pPrev').innerHTML = c.img ? `<img src="${c.img}" style="height:60px;margin-top:6px;border-radius:6px">` : ''; $('#pTitle').textContent = 'Update product'; window.scrollTo(0, 0);
  },
  delCake(id) { if (!confirm('Delete this cake?')) return; set(K.cakes, cakes().filter(c => c.id !== id)); renderAll(); },
  setStatus(id) {
    const l = orders(), o = l.find(x => x.id === id), s = $('#st-' + id).value, loc = $('#lc-' + id).value.trim() || o.location;
    o.status = s; o.location = loc; o.timeline.push({ s, loc, t: new Date().toLocaleString() }); set(K.orders, l); toast('Order ' + id + ' → ' + s); renderAll();
  },
  cancelOrder(id) { if (!confirm('Cancel order ' + id + '?')) return; const l = orders(), o = l.find(x => x.id === id); o.status = 'Cancelled'; o.timeline.push({ s: 'Cancelled', loc: '-', t: new Date().toLocaleString() }); set(K.orders, l); renderAll(); }
};

/* ===== Render ===== */
function trackHtml(o) {
  const idx = STEPS.indexOf(o.status);
  const bar = o.status === 'Cancelled' ? '<span class="badge warn">Cancelled</span>' : STEPS.map((s, i) => `<span class="badge ${i <= idx ? '' : 'wait'}">${i <= idx ? '✔ ' : ''}${s}</span>`).join(' → ');
  return `<div class="ticket"><b>${o.id}</b> · placed ${o.placed} · deliver on ${o.delivery}<br>${o.items.map(i => `${esc(i.name)} (${i.size}) × ${i.qty}${i.msg ? ' – "' + esc(i.msg) + '"' : ''}`).join('<br>')}<br>
    <b>${money(o.total)}</b> · ${esc(o.pay)}<br>Ship to: ${esc(o.address.line)}, ${esc(o.address.city)} - ${esc(o.address.pin)}<br><div style="margin:8px 0">${bar}</div>
    <span class="mut">Shipping location: ${esc(o.location)}</span></div>`;
}
function renderAll() {
  fillFilters(); renderShop(); renderNav();
  if (!me) return;
  if ($('#v-cart').classList.contains('hidden') === false) renderCart();
  if (me.role === 'admin') {
    $('#adminCakes').innerHTML = cakes().map(c => `<tr><td style="width:90px">${imgHtml(c, 50)}</td><td>${esc(c.name)}</td><td>${esc(c.cat)}</td><td>${esc(c.sub)}</td><td>${money(c.price)}</td>
      <td><button class="btn sm" data-act="editCake" data-id="${c.id}">Edit</button><button class="btn sm red" data-act="delCake" data-id="${c.id}">Delete</button></td></tr>`).join('');
    $('#adminOrders').innerHTML = orders().slice().reverse().map(o => `<tr><td>${o.id}<br><span class="mut">${o.placed}</span></td><td>${esc(userOf(o.userId).name)}<br><span class="mut">${esc(o.address.line)}, ${esc(o.address.city)}<br>📞 ${esc(o.address.phone)}</span></td>
        <td>${o.items.map(i => esc(i.name) + ' (' + i.size + ')×' + i.qty + (i.msg ? ' "' + esc(i.msg) + '"' : '')).join('<br>')}</td><td>${money(o.total)}<br><span class="mut">${esc(o.pay)}</span></td>
        <td>${o.status === 'Cancelled' ? '<span class="badge warn">Cancelled</span>' : `<select id="st-${o.id}">${STEPS.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <input id="lc-${o.id}" placeholder="Shipping location" value="${esc(o.location)}" style="margin-top:4px"><button class="btn sm" style="margin-top:4px" data-act="setStatus" data-id="${o.id}">Update</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No orders yet.</td></tr>';
  } else {
    $('#uName').textContent = me.name;
    $('#userOrders').innerHTML = orders().filter(o => o.userId === me.id).reverse().map(o => trackHtml(o) + (o.status === 'Placed' ? `<p><button class="btn sm red" data-act="cancelOrder" data-id="${o.id}">Cancel order</button></p>` : '')).join('') || '<div class="card mut">No orders yet. Browse our cakes!</div>';
    $('#addrList').innerHTML = userOf(me.id).addresses.map(a => `<tr><td>${esc(a.label)}</td><td>${esc(a.line)}, ${esc(a.city)} - ${esc(a.pin)}</td><td>${esc(a.phone)}</td>
      <td><button class="btn sm" data-act="editAddr" data-id="${a.id}">Update</button><button class="btn sm red" data-act="delAddr" data-id="${a.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="mut">No addresses yet.</td></tr>';
  }
}

go('shop');
