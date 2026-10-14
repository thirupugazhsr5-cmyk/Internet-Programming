/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }

/* ===== Data ===== */
const K = { users: 'fl_users', flights: 'fl_flights', bk: 'fl_bookings', fb: 'fl_feedback', me: 'fl_me' };
const TAX = 0.12;
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'Airline Admin', email: 'admin@sky.com', phone: '9000000000', pass: 'admin123', role: 'admin' },
  { id: 'u1', name: 'Demo Traveller', email: 'user@sky.com', phone: '9876543210', pass: 'user123', role: 'user' }
]);
if (!get(K.flights)) set(K.flights, [
  { id: 'f1', no: 'SW101', airline: 'SkyWings', from: 'Chennai', to: 'Delhi', dep: '06:30', arr: '09:15', seats: { Economy: 30, Business: 8 }, price: { Economy: 5200, Business: 13500 } },
  { id: 'f2', no: 'SW205', airline: 'SkyWings', from: 'Chennai', to: 'Mumbai', dep: '11:45', arr: '13:50', seats: { Economy: 36, Business: 8 }, price: { Economy: 4300, Business: 11000 } },
  { id: 'f3', no: 'AI330', airline: 'AirIndia', from: 'Delhi', to: 'Chennai', dep: '18:00', arr: '20:50', seats: { Economy: 30, Business: 4 }, price: { Economy: 5600, Business: 14000 } },
  { id: 'f4', no: 'IG612', airline: 'IndiGo', from: 'Chennai', to: 'Delhi', dep: '21:10', arr: '23:55', seats: { Economy: 42, Business: 0 }, price: { Economy: 4700, Business: 0 } },
  { id: 'f5', no: 'SW410', airline: 'SkyWings', from: 'Mumbai', to: 'Bangalore', dep: '08:20', arr: '10:05', seats: { Economy: 30, Business: 8 }, price: { Economy: 3900, Business: 9800 } }
]);
if (!get(K.bk)) set(K.bk, []);
if (!get(K.fb)) set(K.fb, []);

let me = get(K.me, null);
const users = () => get(K.users, []), flights = () => get(K.flights, []), bks = () => get(K.bk, []), fbs = () => get(K.fb, []);
const flightOf = id => flights().find(f => f.id === id);
const userName = id => (users().find(u => u.id === id) || { name: '?' }).name;
const takenSeats = (fid, date, cls) => bks().filter(b => b.flightId === fid && b.date === date && b.cls === cls && b.status === 'Confirmed').flatMap(b => b.seats);

/* Seat labels: Business 4 abreast (A C | D F), Economy 6 abreast (A B C | D E F) */
const LAYOUT = { Business: { letters: 'ACDF', per: 4 }, Economy: { letters: 'ABCDEF', per: 6 } };
function seatLabels(f, cls) {
  const { letters, per } = LAYOUT[cls], n = f.seats[cls], off = cls === 'Business' ? 0 : Math.ceil(f.seats.Business / 4);
  return Array.from({ length: n }, (_, i) => (off + Math.floor(i / per) + 1) + letters[i % per]);
}

/* ===== Navigation ===== */
const role = () => me ? me.role : 'guest';
function renderNav() { $$('[data-for]').forEach(b => b.classList.toggle('hidden', !b.dataset.for.split(',').includes(role()))); }
function go(v) {
  if (v === 'dash') v = me ? (me.role === 'admin' ? 'admin' : 'user') : 'login';
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
  const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) actions[a.dataset.act](a.dataset.id);
});
$('#logout').onclick = () => { me = null; localStorage.removeItem(K.me); toast('Logged out'); go('home'); };

/* ===== Auth ===== */
let pending = null, cur = null, sel = [];
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name);
  if (pending) { const p = pending; pending = null; return startBooking(p); }
  go('dash');
};
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const email = $('#rEmail').value.trim().toLowerCase();
  if (users().some(u => u.email.toLowerCase() === email)) return toast('Email already registered');
  const l = users(); l.push({ id: uid(), name: $('#rName').value.trim(), email, phone: $('#rPhone').value, pass: $('#rPass').value, role: 'user' });
  set(K.users, l); e.target.reset(); toast('Registered! Please login.'); go('login');
};
$('#forgotForm').onsubmit = e => {
  e.preventDefault();
  const l = users(), u = l.find(x => x.email.toLowerCase() === $('#fEmail').value.trim().toLowerCase() && x.phone === $('#fPhone').value.trim());
  if (!u) return toast('No account matches that email and phone');
  u.pass = $('#fPass').value; set(K.users, l); e.target.reset(); toast('Password reset. Please login.'); go('login');
};

/* ===== Search ===== */
function fillCities() {
  const c = [...new Set(flights().flatMap(f => [f.from, f.to]))].sort(), f = $('#sFrom').value, t = $('#sTo').value;
  const opt = '<option value="">-- city --</option>' + c.map(x => `<option>${esc(x)}</option>`).join('');
  $('#sFrom').innerHTML = opt; $('#sTo').innerHTML = opt; $('#sFrom').value = f; $('#sTo').value = t;
}
$('#searchForm').onsubmit = e => {
  e.preventDefault();
  const from = $('#sFrom').value, to = $('#sTo').value, date = $('#sDate').value, cls = $('#sCls').value, n = +$('#sPax').value;
  if (from === to) return toast('From and destination must differ');
  const list = flights().filter(f => f.from === from && f.to === to && f.seats[cls] > 0);
  $('#results').innerHTML = list.map(f => {
    const left = f.seats[cls] - takenSeats(f.id, date, cls).length;
    return `<div class="card"><div class="row"><div style="flex:3 1 260px"><h3>${esc(f.airline)} · ${esc(f.no)}</h3><p class="mut">${esc(f.from)} ${f.dep} → ${esc(f.to)} ${f.arr}</p></div>
      <div style="text-align:right"><p class="price">${money(f.price[cls])} <span class="mut">/ person</span></p><p><span class="badge ${left >= n ? '' : 'warn'}">${left} seats left (${cls})</span></p>
      ${left >= n ? `<button class="btn sm green" data-act="book" data-id="${f.id}">Select &amp; book</button>` : ''}</div></div></div>`;
  }).join('') || '<div class="card mut">No flights found for this route and class.</div>';
};

/* ===== Book ticket ===== */
function startBooking(p) {
  if (!me) { pending = p; toast('Please login to book'); return go('login'); }
  if (me.role === 'admin') return toast('Use a user account to book');
  cur = { ...p }; sel = [];
  const f = flightOf(p.fid);
  $('#bookInfo').innerHTML = `<b>${esc(f.airline)} ${esc(f.no)}</b> · ${esc(f.from)} ${f.dep} → ${esc(f.to)} ${f.arr}<br>${p.date} · ${p.cls} · ${money(f.price[p.cls])} per person`;
  $('#seatHint').textContent = `Choose exactly ${p.n} seat(s). ⬜ free  🟦 selected  ⬛ taken`;
  $('#bPhone').value = me.phone || ''; $('#bEmail').value = me.email;
  go('book'); drawSeats();
}
function drawSeats() {
  const f = flightOf(cur.fid), tk = takenSeats(cur.fid, cur.date, cur.cls), all = seatLabels(f, cur.cls), { letters, per } = LAYOUT[cur.cls], half = per / 2;
  $('#seatMap').style.gridTemplateColumns = `repeat(${per + 1},40px)`;
  let html = '';
  for (let i = 0; i < all.length; i += per) for (let c = 0; c < per; c++) {
    if (c === half) html += '<div class="gap"></div>';
    const l = all[i + c];
    html += l ? `<button type="button" class="seat ${tk.includes(l) ? 'taken' : ''} ${sel.includes(l) ? 'sel' : ''}" data-seat="${l}" ${tk.includes(l) ? 'disabled' : ''}>${l}</button>` : '<div class="gap"></div>';
  }
  $('#seatMap').innerHTML = html;
  const keep = $$('#paxList .row').map(r => [r.querySelector('.pn').value, r.querySelector('.pa').value, r.querySelector('.pp').value]);
  $('#paxList').innerHTML = Array.from({ length: cur.n }, (_, i) => `<div class="row"><div><label>Passenger ${i + 1}${sel[i] ? ' (seat ' + sel[i] + ')' : ''} name</label><input class="pn" required></div>
    <div style="flex:0 0 80px"><label>Age</label><input type="number" class="pa" min="0" max="110" required></div><div><label>Passport / ID no.</label><input class="pp" required></div></div>`).join('');
  $$('#paxList .row').forEach((r, i) => { if (keep[i]) { r.querySelector('.pn').value = keep[i][0]; r.querySelector('.pa').value = keep[i][1]; r.querySelector('.pp').value = keep[i][2]; } });
}
$('#seatMap').onclick = e => {
  const s = e.target.closest('[data-seat]'); if (!s) return;
  const l = s.dataset.seat;
  if (sel.includes(l)) sel = sel.filter(x => x !== l); else { if (sel.length >= cur.n) return toast('You selected ' + cur.n + ' passenger(s). Deselect a seat first.'); sel.push(l); }
  drawSeats();
};
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  if (sel.length !== cur.n) return toast('Please select ' + cur.n + ' seat(s)');
  cur.pax = $$('#paxList .row').map((r, i) => ({ name: r.querySelector('.pn').value.trim(), age: r.querySelector('.pa').value, idNo: r.querySelector('.pp').value.trim(), seat: sel[i] }));
  cur.email = $('#bEmail').value; cur.phone = $('#bPhone').value;
  const f = flightOf(cur.fid); cur.base = f.price[cur.cls] * cur.n; cur.tax = Math.round(cur.base * TAX); cur.total = cur.base + cur.tax;
  $('#paySummary').innerHTML = `<b>${esc(f.no)}</b> ${esc(f.from)} → ${esc(f.to)} · ${cur.date} · ${cur.cls}<br>Seats: ${sel.join(', ')}<br>Fare: ${money(cur.base)}<br>Taxes (12%): ${money(cur.tax)}<br><b>Total payable: ${money(cur.total)}</b>`;
  go('pay');
};

/* ===== Payment ===== */
$('#payForm').onsubmit = e => {
  e.preventDefault();
  const tk = takenSeats(cur.fid, cur.date, cur.cls);
  if (sel.some(s => tk.includes(s))) { toast('Sorry, a seat was just taken. Please reselect.'); sel = []; return go('book'); }
  const l = bks(); let ref; do { ref = 'SW' + Math.floor(100000 + Math.random() * 900000); } while (l.some(b => b.ref === ref));
  const bk = { ref, userId: me.id, flightId: cur.fid, date: cur.date, cls: cur.cls, seats: [...sel], pax: cur.pax, email: cur.email, phone: cur.phone, total: cur.total, card: '**** ' + $('#pCard').value.slice(-4), status: 'Confirmed', booked: today() };
  l.push(bk); set(K.bk, l); e.target.reset();
  showDlg(`<h2>✅ Payment successful</h2>${ticketHtml(bk)}<p class="mut">E-ticket emailed to ${esc(bk.email)} (demo).</p><button class="btn sm" onclick="window.print()">Print ticket</button>`);
  cur = null; go('dash');
};
function ticketHtml(b) {
  const f = flightOf(b.flightId) || { no: '?', airline: '(deleted)', from: '', to: '', dep: '', arr: '' };
  return `<div class="ticket"><b>${b.ref}</b> <span class="badge ${b.status === 'Confirmed' ? '' : 'warn'}">${b.status}</span><br>${esc(f.airline)} ${esc(f.no)} · ${esc(f.from)} ${f.dep} → ${esc(f.to)} ${f.arr}<br>
    ${b.date} · ${b.cls}<br>${b.pax.map(p => esc(p.name) + ' · seat ' + p.seat).join('<br>')}<br>Paid: <b>${money(b.total)}</b> (${b.card})${b.refund ? `<br><span class="badge warn">Refunded ${money(b.refund)}</span>` : ''}</div>`;
}

/* ===== Status page ===== */
$('#statusForm').onsubmit = e => {
  e.preventDefault();
  const b = bks().find(x => x.ref.toLowerCase() === $('#refNo').value.trim().toLowerCase());
  $('#statusResult').innerHTML = b ? ticketHtml(b) : '<span class="badge warn">No booking found</span>';
};

/* ===== Feedback ===== */
$('#fbForm').onsubmit = e => { e.preventDefault(); const l = fbs(); l.push({ id: uid(), userId: me.id, rating: +$('#fbRate').value, text: $('#fbText').value.trim(), date: today() }); set(K.fb, l); e.target.reset(); toast('Thanks for your feedback!'); };

/* ===== Actions ===== */
const actions = {
  book(fid) { startBooking({ fid, date: $('#sDate').value, cls: $('#sCls').value, n: +$('#sPax').value }); },
  cancel(ref) {
    const l = bks(), b = l.find(x => x.ref === ref);
    if (b.date < today()) return toast('Flight date has passed');
    const refund = Math.round(b.total * 0.8);
    if (!confirm(`Cancel ${ref}? You will get ${money(refund)} back (80%).`)) return;
    b.status = 'Cancelled'; b.refund = refund; set(K.bk, l); toast('Ticket cancelled. Refund ' + money(refund)); renderAll();
  },
  print(ref) { showDlg(ticketHtml(bks().find(b => b.ref === ref)) + '<button class="btn sm" onclick="window.print()">Print ticket</button>'); },
  editFlight(id) {
    const f = flightOf(id);
    $('#fId').value = id; $('#fNo').value = f.no; $('#fAir').value = f.airline; $('#fFrom').value = f.from; $('#fTo').value = f.to; $('#fDep').value = f.dep; $('#fArr').value = f.arr;
    $('#fEs').value = f.seats.Economy; $('#fBs').value = f.seats.Business; $('#fEp').value = f.price.Economy; $('#fBp').value = f.price.Business; $('#flTitle').textContent = 'Update flight'; window.scrollTo(0, 0);
  },
  delFlight(id) { if (!confirm('Delete this flight?')) return; set(K.flights, flights().filter(f => f.id !== id)); renderAll(); },
  delUser(id) { if (!confirm('Delete this user?')) return; set(K.users, users().filter(u => u.id !== id)); renderAll(); }
};

/* ===== Admin flight form ===== */
function clearFl() { $('#flForm').reset(); $('#fId').value = ''; $('#flTitle').textContent = 'Add flight'; }
$('#flClear').onclick = clearFl;
$('#flForm').onsubmit = e => {
  e.preventDefault();
  const d = { no: $('#fNo').value.trim(), airline: $('#fAir').value.trim(), from: $('#fFrom').value.trim(), to: $('#fTo').value.trim(), dep: $('#fDep').value, arr: $('#fArr').value,
    seats: { Economy: +$('#fEs').value, Business: +$('#fBs').value }, price: { Economy: +$('#fEp').value, Business: +$('#fBp').value } };
  const l = flights(), id = $('#fId').value;
  if (id) Object.assign(l.find(f => f.id === id), d); else l.push({ id: uid(), ...d });
  set(K.flights, l); toast(id ? 'Flight updated' : 'Flight added'); clearFl(); renderAll();
};

/* ===== Render ===== */
function renderAll() {
  fillCities();
  if (!me) return;
  if (me.role === 'admin') {
    $('#adminFlights').innerHTML = flights().map(f => `<tr><td>${esc(f.airline)} ${esc(f.no)}</td><td>${esc(f.from)} → ${esc(f.to)}</td><td>${f.dep} - ${f.arr}</td><td>${f.seats.Economy} / ${f.seats.Business}</td><td>${money(f.price.Economy)} / ${money(f.price.Business)}</td>
      <td><button class="btn sm" data-act="editFlight" data-id="${f.id}">Edit</button><button class="btn sm red" data-act="delFlight" data-id="${f.id}">Delete</button></td></tr>`).join('');
    $('#adminBookings').innerHTML = bks().slice().reverse().map(b => { const f = flightOf(b.flightId) || { no: '?' }; return `<tr><td>${b.ref}</td><td>${esc(userName(b.userId))}</td><td>${esc(f.no)}</td><td>${b.date}</td><td>${b.cls}: ${b.seats.join(', ')}</td><td>${money(b.total)}</td><td><span class="badge ${b.status === 'Confirmed' ? '' : 'warn'}">${b.status}</span></td></tr>`; }).join('') || '<tr><td colspan="7" class="mut">No bookings.</td></tr>';
    $('#adminUsers').innerHTML = users().filter(u => u.role === 'user').map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td><button class="btn sm red" data-act="delUser" data-id="${u.id}">Delete</button></td></tr>`).join('');
    $('#adminFb').innerHTML = fbs().slice().reverse().map(f => `<tr><td>${esc(userName(f.userId))}</td><td class="stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</td><td>${esc(f.text)}</td><td>${f.date}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">No feedback yet.</td></tr>';
    const ok = bks().filter(b => b.status === 'Confirmed'), avg = fbs().length ? (fbs().reduce((s, f) => s + f.rating, 0) / fbs().length).toFixed(1) : '-';
    $('#repStats').innerHTML = [['Flights', flights().length], ['Confirmed bookings', ok.length], ['Cancelled', bks().length - ok.length], ['Revenue', money(ok.reduce((s, b) => s + b.total, 0))], ['Avg. rating', avg]].map(([a, b]) => `<div class="card stat"><span class="mut">${a}</span><b>${b}</b></div>`).join('');
    $('#repTable').innerHTML = flights().map(f => { const x = ok.filter(b => b.flightId === f.id); return `<tr><td>${esc(f.no)} ${esc(f.from)}→${esc(f.to)}</td><td>${x.length}</td><td>${x.reduce((s, b) => s + b.seats.length, 0)}</td><td>${money(x.reduce((s, b) => s + b.total, 0))}</td></tr>`; }).join('');
  } else {
    $('#uName').textContent = me.name;
    $('#userTickets').innerHTML = bks().filter(b => b.userId === me.id).reverse().map(b => ticketHtml(b) +
      `<p><button class="btn sm sec" data-act="print" data-id="${b.ref}">Print ticket</button> ${b.status === 'Confirmed' ? `<button class="btn sm red" data-act="cancel" data-id="${b.ref}">Cancel ticket</button>` : ''}</p>`).join('') || '<div class="card mut">No tickets yet.</div>';
  }
}

$('#sDate').min = today(); $('#sDate').value = today();
go('home');
