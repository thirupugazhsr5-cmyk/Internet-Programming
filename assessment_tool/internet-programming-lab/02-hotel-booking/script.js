/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }

/* ===== Data ===== */
const K = { rooms: 'ht_rooms', users: 'ht_users', bk: 'ht_bookings', pages: 'ht_pages', me: 'ht_me' };
const CAP = { Single: 1, Double: 2, Deluxe: 3, Suite: 4 };
const ICON = { Single: '🛏️', Double: '🛌', Deluxe: '🌆', Suite: '👑' };
if (!get(K.rooms)) set(K.rooms, [
  { type: 'Single', qty: 6, price: 1800, desc: 'Cosy room with a single bed, work desk, Wi-Fi and AC.' },
  { type: 'Double', qty: 8, price: 2800, desc: 'Queen bed, TV, mini-fridge, Wi-Fi and breakfast.' },
  { type: 'Deluxe', qty: 4, price: 4200, desc: 'City view, king bed, bathtub, lounge corner and breakfast.' },
  { type: 'Suite', qty: 2, price: 7500, desc: 'Separate living area, 2 bedrooms, kitchenette and butler service.' }
]);
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'Hotel Admin', email: 'admin@hotel.com', pass: 'admin123', role: 'admin', phone: '9000000000' },
  { id: 'u1', name: 'Demo Guest', email: 'guest@hotel.com', pass: 'guest123', role: 'user', phone: '9876543210' }
]);
if (!get(K.bk)) set(K.bk, []);
if (!get(K.pages)) set(K.pages, {
  rooms: 'We offer four room types: Single, Double, Deluxe and Suite. All rooms include free Wi-Fi, air conditioning, 24x7 room service and daily housekeeping.',
  about: 'Grand Stay Hotel has been welcoming guests since 1998. Located in the heart of the city, we combine comfort, warm hospitality and great value.',
  contact: 'Address: 12 Marine Road, Chennai\nPhone: +91 98765 43210\nEmail: stay@grandstay.com\nFront desk: open 24 hours',
  qa: 'Q: What is check-in / check-out time?\nA: Check-in is 2 PM, check-out is 11 AM.\n\nQ: Can I cancel my booking?\nA: Yes, up to 3 days before the arrival date.\n\nQ: Is breakfast included?\nA: Breakfast is included for Double, Deluxe and Suite rooms.',
  travel: 'Airport: 18 km (35 min by taxi)\nRailway station: 4 km\nNearby: Marina Beach, Kapaleeshwarar Temple, Government Museum.\nTaxi and local sightseeing tours can be arranged at the front desk.',
  privacy: 'We collect only the details needed to process your booking (name, phone, email). Your data is never sold or shared with third parties and is protected with industry-standard safeguards.'
});
const PAGE_TITLES = { rooms: 'Room types', about: 'About us', contact: 'Contact us', qa: 'Customer service Q&A', travel: 'Local travel & shipping guide', privacy: 'Privacy policy' };

let me = get(K.me, null);
const rooms = () => get(K.rooms, []), users = () => get(K.users, []), bks = () => get(K.bk, []), pages = () => get(K.pages, {});
const roomOf = t => rooms().find(r => r.type === t);
const userName = id => (users().find(u => u.id === id) || { name: '?' }).name;
const money = n => '₹' + Number(n).toLocaleString('en-IN');

/* Rooms already taken for a type between [in,out), optionally ignoring one booking */
function booked(type, cin, cout, ignoreId) {
  return bks().filter(b => b.type === type && b.status === 'Confirmed' && b.id !== ignoreId && b.checkin < cout && cin < b.checkout)
    .reduce((s, b) => s + b.rooms, 0);
}
const available = (type, cin, cout, ignoreId) => Math.max(0, roomOf(type).qty - booked(type, cin, cout, ignoreId));

/* ===== Navigation ===== */
const role = () => me ? me.role : 'guest';
function renderNav() { $$('[data-for]').forEach(b => b.classList.toggle('hidden', !b.dataset.for.split(',').includes(role()))); }
function go(v) {
  if (v === 'dash') v = me ? (me.role === 'admin' ? 'admin' : 'user') : 'login';
  $$('.view').forEach(e => e.classList.toggle('hidden', e.id !== 'v-' + v));
  renderNav(); renderAll(); window.scrollTo(0, 0);
}
function showPage(key) {
  $('#pageTitle').textContent = PAGE_TITLES[key];
  const body = esc(pages()[key] || '').split(/\n\n+/).map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
  $('#pageBody').innerHTML = body;
  go('page');
  if (key === 'rooms') $('#pageBody').innerHTML += '<div class="grid">' + rooms().map(r => `<div class="card"><div class="emoji">${ICON[r.type]}</div><h3>${r.type}</h3><p class="mut">${esc(r.desc)}</p><p>Sleeps ${CAP[r.type]}</p></div>`).join('') + '</div>';
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
  const p = e.target.closest('[data-page]'); if (p) showPage(p.dataset.page);
  const t = e.target.closest('[data-tab]');
  if (t) {
    const v = t.closest('.view');
    v.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b === t));
    v.querySelectorAll('.tab').forEach(x => x.classList.toggle('hidden', x.id !== t.dataset.tab));
  }
  const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) actions[a.dataset.act](a.dataset.id, a.dataset.arg);
});
$('#logout').onclick = () => { me = null; localStorage.removeItem(K.me); toast('Logged out'); go('home'); };

/* ===== Auth ===== */
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name);
  if (pending) { const p = pending; pending = null; startBooking(p.type, p.cin, p.cout, p.guests); } else go('dash');
};
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const email = $('#rEmail').value.trim().toLowerCase();
  if (users().some(u => u.email.toLowerCase() === email)) return toast('Email already registered');
  const l = users(); l.push({ id: uid(), name: $('#rName').value.trim(), email, phone: $('#rPhone').value, pass: $('#rPass').value, role: 'user' });
  set(K.users, l); e.target.reset(); toast('Registered! Please login.'); go('login');
};
$('#profForm').onsubmit = e => {
  e.preventDefault();
  const l = users(), u = l.find(x => x.id === me.id);
  u.name = $('#pName').value.trim(); u.phone = $('#pPhone').value; if ($('#pPass').value) u.pass = $('#pPass').value;
  set(K.users, l); me = u; set(K.me, u); $('#pPass').value = ''; toast('Profile updated'); renderAll();
};

/* ===== Availability ===== */
let pending = null, cur = null; // pending: booking waiting for login; cur: booking in progress
const setMinDates = () => { $('#aIn').min = today(); $('#aOut').min = today(); };
$('#aIn').onchange = () => { $('#aOut').min = $('#aIn').value; if ($('#aOut').value <= $('#aIn').value) $('#aOut').value = ''; };
$('#availForm').onsubmit = e => {
  e.preventDefault();
  const cin = $('#aIn').value, cout = $('#aOut').value, guests = +$('#aGuests').value;
  if (cout <= cin) return toast('Check-out must be after check-in');
  const n = daysBetween(cin, cout);
  $('#availResult').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Room</th><th>Price/night</th><th>Total (' + n + ' night' + (n > 1 ? 's' : '') + ')</th><th>Rooms left</th><th></th></tr></thead><tbody>' +
    rooms().map(r => {
      const left = available(r.type, cin, cout), need = Math.ceil(guests / CAP[r.type]);
      return `<tr><td>${ICON[r.type]} ${r.type} <span class="mut">(sleeps ${CAP[r.type]})</span></td><td>${money(r.price)}</td><td>${money(r.price * n * need)} <span class="mut">(${need} room${need > 1 ? 's' : ''})</span></td>
      <td>${left ? '<span class="badge">' + left + ' available</span>' : '<span class="badge warn">Sold out</span>'}</td>
      <td>${left >= need ? `<button class="btn sm" data-act="book" data-id="${r.type}">Book now</button>` : ''}</td></tr>`;
    }).join('') + '</tbody></table></div>';
};

/* ===== Booking ===== */
function startBooking(type, cin, cout, guests) {
  if (!me) { pending = { type, cin, cout, guests }; toast('Please login to continue'); return go('login'); }
  if (me.role === 'admin') return toast('Please use a guest account to book');
  cur = { type, cin, cout, guests };
  const n = daysBetween(cin, cout);
  $('#bkRooms').value = Math.ceil(guests / CAP[type]);
  $('#bkName').value = me.name; $('#bkPhone').value = me.phone || '';
  $('#bookSummary').innerHTML = `<b>${ICON[type]} ${type} room</b><br>Check-in: ${cin}<br>Check-out: ${cout}<br>${n} night(s) · ${guests} guest(s)`;
  go('book'); updateTotal();
}
function updateTotal() { if (cur) $('#bkTotal').textContent = money(roomOf(cur.type).price * daysBetween(cur.cin, cur.cout) * (+$('#bkRooms').value || 1)); }
$('#bkRooms').oninput = updateTotal;
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  const n = +$('#bkRooms').value;
  if (n * CAP[cur.type] < cur.guests) return toast('Not enough capacity: need at least ' + Math.ceil(cur.guests / CAP[cur.type]) + ' room(s)');
  if (available(cur.type, cur.cin, cur.cout) < n) return toast('Only ' + available(cur.type, cur.cin, cur.cout) + ' room(s) left for these dates');
  const b = { id: 'BK' + Math.floor(1000 + Math.random() * 9000), userId: me.id, name: $('#bkName').value, phone: $('#bkPhone').value, type: cur.type, rooms: n, guests: cur.guests,
    checkin: cur.cin, checkout: cur.cout, total: roomOf(cur.type).price * daysBetween(cur.cin, cur.cout) * n, note: $('#bkNote').value, status: 'Confirmed', created: today() };
  const l = bks(); l.push(b); set(K.bk, l); e.target.reset();
  showDlg(`<h2>✅ Booking confirmed</h2><div class="ticket"><b>${b.id}</b><br>${b.type} × ${b.rooms}<br>${b.checkin} → ${b.checkout}<br>Paid: ${money(b.total)}</div><p class="mut">A confirmation email has been sent to ${esc(me.email)} (demo).</p>`);
  cur = null; go('dash');
};

/* ===== Modify / cancel ===== */
const canChange = b => b.status === 'Confirmed' && daysBetween(today(), b.checkin) >= 3;
const actions = {
  book(type) { startBooking(type, $('#aIn').value, $('#aOut').value, +$('#aGuests').value); },
  cancel(id, adminMode) {
    const l = bks(), b = l.find(x => x.id === id);
    if (!adminMode && !canChange(b)) return toast('Cancellation allowed only 3 days before arrival');
    if (!confirm('Cancel booking ' + id + '?')) return;
    b.status = 'Cancelled'; set(K.bk, l); toast('Booking cancelled'); renderAll();
  },
  modify(id, adminMode) {
    const b = bks().find(x => x.id === id);
    if (!adminMode && !canChange(b)) return toast('Changes allowed only 3 days before arrival');
    showDlg(`<h2>Change booking ${id}</h2><form id="modForm">
      <div class="row"><div><label>Check-in</label><input type="date" id="mIn" value="${b.checkin}" min="${adminMode ? '' : today()}" required></div>
      <div><label>Check-out</label><input type="date" id="mOut" value="${b.checkout}" required></div></div>
      <div class="row"><div><label>Room type</label><select id="mType" ${adminMode ? '' : 'disabled'}>${rooms().map(r => `<option ${r.type === b.type ? 'selected' : ''}>${r.type}</option>`).join('')}</select></div>
      <div><label>Rooms</label><input type="number" id="mRooms" min="1" value="${b.rooms}" required></div></div>
      <button class="btn">Save changes</button></form>`);
    $('#modForm').onsubmit = e => {
      e.preventDefault();
      const cin = $('#mIn').value, cout = $('#mOut').value, type = $('#mType').value, n = +$('#mRooms').value;
      if (cout <= cin) return toast('Check-out must be after check-in');
      if (!adminMode && daysBetween(today(), cin) < 3) return toast('New arrival date must be at least 3 days from today');
      if (available(type, cin, cout, id) < n) return toast('Not enough rooms available for those dates');
      const l = bks(), x = l.find(y => y.id === id);
      Object.assign(x, { checkin: cin, checkout: cout, type, rooms: n, total: roomOf(type).price * daysBetween(cin, cout) * n });
      set(K.bk, l); $('#dlg').close(); toast('Booking updated'); renderAll();
    };
  },
  saveRoom(type) {
    const q = +$('#q-' + type).value, p = +$('#p-' + type).value;
    if (q < 0 || p < 1 || isNaN(q) || isNaN(p)) return toast('Enter valid numbers');
    const l = rooms(); const r = l.find(x => x.type === type); r.qty = q; r.price = p; set(K.rooms, l); toast(type + ' updated'); renderAll();
  }
};
const statusBadge = s => `<span class="badge ${s === 'Confirmed' ? '' : 'warn'}">${s}</span>`;

/* ===== Admin pages editor ===== */
$('#pgSelect').onchange = () => { $('#pgText').value = pages()[$('#pgSelect').value] || ''; };
$('#pgSave').onclick = () => { const p = pages(); p[$('#pgSelect').value] = $('#pgText').value; set(K.pages, p); toast('Page saved'); };

/* ===== Render ===== */
function renderAll() {
  $('#roomCards').innerHTML = rooms().map(r => `<div class="card"><div class="emoji">${ICON[r.type]}</div><h3>${r.type}</h3><p class="mut">${esc(r.desc)}</p><p class="price">${money(r.price)} <span class="mut">/ night</span></p></div>`).join('');
  if (!me) return;
  if (me.role === 'admin') {
    $('#adminRooms').innerHTML = rooms().map(r => `<tr><td>${ICON[r.type]} ${r.type}</td><td><input type="number" id="q-${r.type}" value="${r.qty}" min="0"></td><td><input type="number" id="p-${r.type}" value="${r.price}" min="1"></td>
      <td><button class="btn sm" data-act="saveRoom" data-id="${r.type}">Save</button></td></tr>`).join('');
    $('#adminBookings').innerHTML = bks().slice().reverse().map(b => `<tr><td>${b.id}</td><td>${esc(b.name)}<br><span class="mut">${esc(b.phone)}</span></td><td>${b.type}</td><td>${b.checkin} → ${b.checkout}</td><td>${b.rooms}</td><td>${money(b.total)}</td><td>${statusBadge(b.status)}</td>
      <td>${b.status === 'Confirmed' ? `<button class="btn sm" data-act="modify" data-id="${b.id}" data-arg="1">Edit</button><button class="btn sm red" data-act="cancel" data-id="${b.id}" data-arg="1">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="mut">No bookings yet.</td></tr>';
    if (!$('#pgSelect').options.length) { $('#pgSelect').innerHTML = Object.keys(PAGE_TITLES).map(k => `<option value="${k}">${PAGE_TITLES[k]}</option>`).join(''); $('#pgText').value = pages()[$('#pgSelect').value] || ''; }
  } else {
    $('#uName').textContent = me.name;
    $('#userBookings').innerHTML = bks().filter(b => b.userId === me.id).reverse().map(b => `<tr><td>${b.id}</td><td>${b.type}</td><td>${b.checkin} → ${b.checkout}</td><td>${b.rooms}</td><td>${money(b.total)}</td><td>${statusBadge(b.status)}</td>
      <td>${canChange(b) ? `<button class="btn sm" data-act="modify" data-id="${b.id}">Change</button><button class="btn sm red" data-act="cancel" data-id="${b.id}">Cancel</button>` : (b.status === 'Confirmed' ? '<span class="mut">Locked (&lt;3 days)</span>' : '')}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">No bookings yet.</td></tr>';
    if (!document.activeElement.closest('#profForm')) { $('#pName').value = me.name; $('#pEmail').value = me.email; $('#pPhone').value = me.phone || ''; }
  }
}

setMinDates();
$('#aIn').value = today();
go('home');
