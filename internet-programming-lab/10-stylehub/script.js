/* StyleHub - front-end demo. Data is kept in localStorage (no server). */
const $ = s => document.querySelector(s);
const app = $('#app');
const money = n => '₹' + Number(n).toFixed(2);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ---------- seed data ---------- */
const SEED = [
 {id:1,name:'Floral Summer Dress',cat:'Women',sub:'Casual Wear',price:1499,stock:15,icon:'👗',desc:'Cotton dress. Sizes S-XL. Size guide: S=36, M=38, L=40, XL=42 in. Easy 15-day return/exchange.',sold:110,reviews:[]},
 {id:2,name:'Linen Casual Shirt',cat:'Men',sub:'Casual Wear',price:999,stock:25,icon:'👕',desc:'Breathable linen. Sizes S-XXL. Size guide: M=40, L=42, XL=44 in.',sold:130,reviews:[]},
 {id:3,name:'Slim Fit Blazer',cat:'Men',sub:'Formal Attire',price:3999,stock:8,icon:'🧥',desc:'Two-button blazer. FLASH SALE this week. Sizes 38-44.',sold:60,reviews:[]},
 {id:4,name:'Office Trousers',cat:'Women',sub:'Formal Attire',price:1899,stock:12,icon:'👖',desc:'Tailored stretch trousers. Sizes 28-36.',sold:45,reviews:[]},
 {id:5,name:'Winter Parka',cat:'Women',sub:'Seasonal Collection',price:4499,stock:6,icon:'🧥',desc:'Insulated hooded parka for winter.',sold:35,reviews:[]},
 {id:6,name:'Kids Hoodie',cat:'Kids',sub:'Seasonal Collection',price:899,stock:30,icon:'🧒',desc:'Soft fleece hoodie. Ages 4-12.',sold:80,reviews:[]},
 {id:7,name:'Running Shoes',cat:'Footwear',sub:'Sports Shoes',price:2999,stock:20,icon:'👟',desc:'Lightweight shoes. UK sizes 6-11.',sold:150,reviews:[]},
 {id:8,name:'Leather Handbag',cat:'Accessories',sub:'Bags',price:2499,stock:0,icon:'👜',desc:'Genuine leather tote.',sold:70,reviews:[]}
];
const STAGES = ['Placed','Packed','Shipped','Delivered'];
let items = load('sh_items', null) || (save('sh_items', SEED), SEED);
let users = load('sh_users', [{u:'admin',p:'admin123',role:'admin',email:'admin@stylehub.com'}]);
let orders = load('sh_orders', []);
let session = load('sh_session', null);
let wish = load('sh_wish', {});          // {username: [ids]}
let carts = load('sh_carts', {});        // {username|guest: [{id,qty}]}
const who = () => session ? session.u : 'guest';
const cart = () => carts[who()] || (carts[who()] = []);
const persist = () => { save('sh_items', items); save('sh_users', users); save('sh_orders', orders); save('sh_session', session); save('sh_wish', wish); save('sh_carts', carts); };
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); };
const find = id => items.find(i => i.id == id);

/* ---------- navigation ---------- */
function nav() {
  const n = cart().reduce((a, c) => a + c.qty, 0);
  $('#nav').innerHTML = `<a href="#" data-go="home">Home</a><a href="#" data-go="cart">Cart (${n})</a>` +
    (session ? `<a href="#" data-go="wish">Wish list</a><a href="#" data-go="orders">Orders</a>` +
      (session.role === 'admin' ? `<a href="#" data-go="admin">Admin</a>` : '') +
      `<span>Hi, ${esc(session.u)}</span><a href="#" data-go="logout">Logout</a>` : `<a href="#" data-go="login">Login</a>`);
}
function go(view, arg) {
  persist(); nav();
  ({home, cart: cartView, login: loginView, register: regView, orders: ordersView, wish: wishView, admin: adminView,
    detail: () => detail(arg), list: () => list(arg), logout})[view]();
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-go]'); if (!a) return;
  e.preventDefault(); go(a.dataset.go, a.dataset.arg);
});

/* ---------- 1. visit site / home: categories + subcategories ---------- */
function home() {
  const cats = {};
  items.forEach(i => { const c = cats[i.cat] ||= {sold: 0, subs: new Set()}; c.sold += i.sold; c.subs.add(i.sub); });
  const sorted = Object.entries(cats).sort((a, b) => b[1].sold - a[1].sold); // most popular first
  app.innerHTML = `<h1>Shop by category</h1><div class="cats">` + sorted.map(([c, d]) =>
    `<div class="cat"><h3><a data-go="list" data-arg='${JSON.stringify({cat: c})}'>${esc(c)}</a></h3>` +
    [...d.subs].map(s => `<a data-go="list" data-arg='${JSON.stringify({cat: c, sub: s})}'>${esc(s)}</a>`).join('') + `</div>`).join('') +
    `</div><h2>Popular right now</h2>` + grid([...items].sort((a, b) => b.sold - a.sold).slice(0, 4)) +
    `<h2>Recommended for you</h2>` + grid(recommend());
}
function recommend() {
  const seen = new Set();
  orders.filter(o => o.user === who()).forEach(o => o.lines.forEach(l => seen.add(find(l.id)?.cat)));
  (load('sh_viewed', [])).forEach(id => seen.add(find(id)?.cat));
  const r = items.filter(i => seen.has(i.cat)); return (r.length ? r : items).slice(0, 4);
}
function grid(list) {
  if (!list.length) return '<p>No items found. Try another search.</p>';
  return `<div class="grid">` + list.map(i => `<div class="card"><div class="img">${i.icon}</div>
   <span class="tag">${esc(i.cat)} / ${esc(i.sub)}</span><strong>${esc(i.name)}</strong><div class="price">${money(i.price)}</div>
   <div class="${i.stock ? 'in' : 'out'}">${i.stock ? `In stock (${i.stock})` : 'Out of stock'}</div>
   <div class="row"><button class="alt" data-go="detail" data-arg="${i.id}">Details</button>
   <button ${i.stock ? '' : 'disabled'} onclick="addToCart(${i.id})">Add to cart</button></div></div>`).join('') + `</div>`;
}

/* ---------- 3. search & filter ---------- */
function list(f = {}) {
  if (typeof f === 'string') f = JSON.parse(f);
  let r = items.filter(i => (!f.cat || i.cat === f.cat) && (!f.sub || i.sub === f.sub) &&
    (!f.q || (i.name + i.desc + i.cat + i.sub).toLowerCase().includes(f.q.toLowerCase())));
  if (f.sort) r.sort((a, b) => f.sort === 'asc' ? a.price - b.price : b.price - a.price);
  app.innerHTML = `<h1>${esc(f.q ? 'Results for "' + f.q + '"' : [f.cat, f.sub].filter(Boolean).join(' / ') || 'All products')}</h1>` + grid(r);
}
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); go('list', JSON.stringify({q: $('#q').value.trim(), sort: $('#sort').value})); });

/* ---------- 11. item details + 4. availability ---------- */
function detail(id) {
  const i = find(id); if (!i) return home();
  const v = load('sh_viewed', []); save('sh_viewed', [i.id, ...v.filter(x => x != i.id)].slice(0, 10));
  app.innerHTML = `<div class="detail"><div class="img">${i.icon}</div><div>
   <h1>${esc(i.name)}</h1><span class="tag">${esc(i.cat)} / ${esc(i.sub)}</span><p>${esc(i.desc)}</p>
   <div class="price">${money(i.price)}</div>
   <p class="${i.stock ? 'in' : 'out'}"><b>Availability:</b> ${i.stock ? i.stock + ' units in stock' : 'Out of stock'}</p>
   <div class="row"><button ${i.stock ? '' : 'disabled'} onclick="addToCart(${i.id})">Add to cart</button>
   <button class="alt" onclick="addWish(${i.id})">♡ Wish list</button></div>
   <h2>Reviews</h2>${i.reviews.map(r => `<div class="review"><b>${esc(r.u)}</b>: ${esc(r.t)}</div>`).join('') || '<p>No reviews yet.</p>'}
   ${session ? `<div class="row"><input id="rv" placeholder="Write a review"><button onclick="addReview(${i.id})">Post</button></div>` : '<p>Login to write a review.</p>'}
  </div></div>`;
}
function addReview(id) { const t = $('#rv').value.trim(); if (!t) return; find(id).reviews.push({u: session.u, t}); persist(); detail(id); }
function addWish(id) {
  if (!session) return toast('Login to use the wish list'), go('login');
  const w = wish[session.u] ||= []; if (!w.includes(id)) w.push(id); persist(); toast('Added to wish list');
}
function wishView() {
  const w = (wish[session?.u] || []).map(find).filter(Boolean);
  app.innerHTML = `<h1>Wish list</h1>` + grid(w);
}

/* ---------- 5/6/7. cart ---------- */
function addToCart(id) {
  const i = find(id), line = cart().find(c => c.id == id);
  if ((line ? line.qty : 0) + 1 > i.stock) return toast('Only ' + i.stock + ' in stock');
  line ? line.qty++ : cart().push({id, qty: 1}); persist(); nav(); toast('Added to cart');
}
function cartView() {
  const c = cart();
  if (!c.length) return app.innerHTML = `<h1>Your cart</h1><p>Your cart is empty. <a href="#" data-go="home">Browse products</a></p>`;
  const total = c.reduce((a, l) => a + find(l.id).price * l.qty, 0);
  app.innerHTML = `<h1>Your cart</h1><div class="wrap"><table><tr><th>Item</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>` +
   c.map(l => { const i = find(l.id); return `<tr><td>${esc(i.name)}</td><td>${money(i.price)}</td>
    <td><input type="number" min="1" max="${i.stock}" value="${l.qty}" style="width:70px" onchange="setQty(${l.id},this.value)"></td>
    <td>${money(i.price * l.qty)}</td><td><button class="del" onclick="removeLine(${l.id})">Remove</button></td></tr>`; }).join('') +
   `</table></div><p class="price">Total: ${money(total)}</p><button onclick="checkout()">Check out</button>`;
}
function setQty(id, q) {
  q = parseInt(q); const i = find(id);
  if (!q || q < 1) return removeLine(id);
  if (q > i.stock) { toast('Only ' + i.stock + ' in stock'); q = i.stock; }
  cart().find(l => l.id == id).qty = q; persist(); cartView(); nav();
}
function removeLine(id) { carts[who()] = cart().filter(l => l.id != id); persist(); cartView(); nav(); }

/* ---------- 8. checkout ---------- */
function checkout() {
  if (!session) { toast('Please login to check out'); return go('login'); }
  app.innerHTML = `<form class="panel" id="payForm"><h1>Checkout</h1>
   <input id="name" placeholder="Full name" required><input id="addr" placeholder="Shipping address" required>
   <input id="phone" placeholder="Phone" required pattern="[0-9]{10}" title="10 digit number">
   <select id="pay"><option>Credit / Debit card</option><option>UPI</option><option>Cash on delivery</option></select>
   <button>Place order</button></form>`;
  $('#payForm').onsubmit = e => {
    e.preventDefault();
    const lines = cart().map(l => ({id: l.id, name: find(l.id).name, price: find(l.id).price, qty: l.qty}));
    if (lines.some(l => find(l.id).stock < l.qty)) return toast('Stock changed. Review your cart.'), cartView();
    lines.forEach(l => find(l.id).stock -= l.qty);
    lines.forEach(l => find(l.id).sold += l.qty);
    const o = {no: 'SH' + Date.now().toString().slice(-6), user: session.u, email: session.email, name: $('#name').value,
      addr: $('#addr').value, phone: $('#phone').value, pay: $('#pay').value, lines, status: 0,
      total: lines.reduce((a, l) => a + l.price * l.qty, 0), date: new Date().toLocaleString()};
    orders.push(o); carts[session.u] = []; persist(); nav();
    app.innerHTML = `<h1>Thank you!</h1><p>Order <b>${o.no}</b> placed. Total ${money(o.total)}.</p><button data-go="orders">Track order</button>`;
  };
}

/* ---------- 9/10. order status + history ---------- */
function ordersView() {
  if (!session) return go('login');
  const mine = orders.filter(o => o.user === session.u).reverse();
  app.innerHTML = `<h1>Order history</h1>` + (mine.map(o => `<div class="card"><b>${o.no}</b> &middot; ${o.date} &middot; ${money(o.total)}
   <div class="steps">${STAGES.map((s, k) => `<span class="${k <= o.status ? 'on' : ''}">${s}</span>`).join('')}</div>
   <small>${o.lines.map(l => esc(l.name) + ' x' + l.qty).join(', ')}</small></div><br>`).join('') || '<p>No orders yet.</p>');
}

/* ---------- 2. login / 12. logout / registration ---------- */
function loginView() {
  app.innerHTML = `<form class="panel" id="lf"><h1>Login</h1><input id="lu" placeholder="Username" required>
   <input id="lp" type="password" placeholder="Password" required><button>Login</button>
   <a href="#" data-go="register">New here? Create an account</a><small>Admin demo: admin / admin123</small></form>`;
  $('#lf').onsubmit = e => {
    e.preventDefault();
    const u = users.find(x => x.u === $('#lu').value && x.p === $('#lp').value);
    if (!u) return toast('Wrong username or password');
    carts[u.u] = [...(carts[u.u] || []), ...cart().filter(l => !(carts[u.u] || []).some(x => x.id === l.id))];
    carts.guest = []; session = {u: u.u, role: u.role, email: u.email}; persist(); toast('Welcome, ' + u.u);
    go(u.role === 'admin' ? 'admin' : 'home');
  };
}
function regView() {
  app.innerHTML = `<form class="panel" id="rf"><h1>Register</h1><input id="ru" placeholder="Username" required>
   <input id="re" type="email" placeholder="Email" required><input id="rp" type="password" minlength="6" placeholder="Password (6+ chars)" required>
   <button>Create account</button></form>`;
  $('#rf').onsubmit = e => {
    e.preventDefault();
    if (users.some(x => x.u === $('#ru').value)) return toast('Username already taken');
    users.push({u: $('#ru').value, p: $('#rp').value, email: $('#re').value, role: 'customer'}); persist();
    toast('Account created. Please login.'); go('login');
  };
}
function logout() { session = null; persist(); toast('Logged out'); go('home'); }
$('#leave').onclick = e => { e.preventDefault(); if (confirm('Leave StyleHub?')) { document.body.innerHTML = '<h1 style="text-align:center;margin-top:20vh">Thanks for visiting StyleHub. Come back soon!</h1>'; } };

/* ---------- admin ---------- */
function adminView() {
  if (session?.role !== 'admin') return go('login');
  app.innerHTML = `<h1>Admin panel</h1>
   <h2>Add item</h2><form id="af" class="row"><input id="an" placeholder="Name" required><input id="ac" placeholder="Category" required>
   <input id="as" placeholder="Subcategory" required><input id="ap" type="number" min="0" step="0.01" placeholder="Price" required>
   <input id="ak" type="number" min="0" placeholder="Stock" required><input id="ad" placeholder="Description" required><button>Add item</button></form>
   <h2>Manage items</h2><div class="wrap"><table><tr><th>Name</th><th>Price</th><th>Description</th><th>Stock</th><th></th></tr>` +
   items.map(i => `<tr><td>${esc(i.name)}</td>
    <td><input type="number" step="0.01" value="${i.price}" style="width:90px" id="p${i.id}"></td>
    <td><input value="${esc(i.desc)}" id="d${i.id}" style="width:100%"></td>
    <td><input type="number" value="${i.stock}" style="width:70px" id="k${i.id}"></td>
    <td class="row"><button onclick="saveItem(${i.id})">Save</button><button class="del" onclick="delItem(${i.id})">Delete</button></td></tr>`).join('') +
   `</table></div><h2>Orders &amp; customers</h2><div class="wrap"><table><tr><th>Order</th><th>Customer</th><th>Contact</th><th>Address</th><th>Total</th><th>Status</th></tr>` +
   orders.map((o, k) => `<tr><td>${o.no}</td><td>${esc(o.name)} (${esc(o.user)})</td><td>${esc(o.email)}<br>${esc(o.phone)}</td><td>${esc(o.addr)}</td>
    <td>${money(o.total)}</td><td><select onchange="setStatus(${k},this.value)">${STAGES.map((s, n) => `<option value="${n}" ${n == o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('') +
   `</table></div>`;
  $('#af').onsubmit = e => {
    e.preventDefault();
    items.push({id: Date.now(), name: $('#an').value, cat: $('#ac').value, sub: $('#as').value, price: +$('#ap').value,
      stock: +$('#ak').value, desc: $('#ad').value, icon: '📦', sold: 0, reviews: []});
    persist(); toast('Item added'); adminView();
  };
}
function saveItem(id) { const i = find(id); i.price = +$('#p' + id).value; i.desc = $('#d' + id).value; i.stock = +$('#k' + id).value; persist(); toast('Item updated'); }
function delItem(id) { if (!confirm('Remove this item?')) return; items = items.filter(i => i.id != id); persist(); adminView(); }
function setStatus(k, v) { orders[k].status = +v; persist(); toast('Status updated'); }

go('home');
