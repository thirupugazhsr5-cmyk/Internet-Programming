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
const K = { users: 'bus_users', buses: 'bus_buses', cats: 'bus_cats', bk: 'bus_bookings', cm: 'bus_comments', news: 'bus_news', me: 'bus_me' };
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'Admin', email: 'admin@bus.com', phone: '9000000000', pass: 'admin123', role: 'admin' },
  { id: 'u1', name: 'Demo User', email: 'user@bus.com', phone: '9876543210', pass: 'user123', role: 'user' }
]);
if (!get(K.cats)) set(K.cats, ['Volvo', 'Sleeper coach', 'Coach']);
if (!get(K.buses)) set(K.buses, [
  { id: 'b1', name: 'Volvo Multi-Axle', cat: 'Volvo', from: 'Chennai', to: 'Bangalore', time: '22:00', fare: 850, seats: 40, loc: 'NH48 via Vellore', photo: '', desc: 'AC semi-sleeper, charging point, water bottle.' },
  { id: 'b2', name: 'Night Rider Sleeper', cat: 'Sleeper coach', from: 'Chennai', to: 'Hyderabad', time: '19:30', fare: 1200, seats: 32, loc: 'NH16 via Nellore', photo: '', desc: 'AC sleeper with blankets and reading lights.' },
  { id: 'b3', name: 'City Express Coach', cat: 'Coach', from: 'Bangalore', to: 'Chennai', time: '07:15', fare: 600, seats: 44, loc: 'NH48 via Krishnagiri', photo: '', desc: 'Comfortable non-AC coach, daily service.' },
  { id: 'b4', name: 'Volvo Sunrise', cat: 'Volvo', from: 'Chennai', to: 'Bangalore', time: '06:00', fare: 799, seats: 40, loc: 'NH48 via Vellore', photo: '', desc: 'Early morning AC Volvo.' },
  { id: 'b5', name: 'Hills Coach', cat: 'Coach', from: 'Chennai', to: 'Coimbatore', time: '21:30', fare: 700, seats: 40, loc: 'via Salem', photo: '', desc: 'Overnight coach to Kongu region.' }
]);
if (!get(K.bk)) set(K.bk, []);
if (!get(K.cm)) set(K.cm, []);
if (!get(K.news)) set(K.news, [{ id: 'n1', text: 'Festival offer: book 4 or more seats and travel in comfort this season!', date: today() }]);

let me = get(K.me, null);
const users = () => get(K.users, []), buses = () => get(K.buses, []), cats = () => get(K.cats, []), bks = () => get(K.bk, []), cms = () => get(K.cm, []), news = () => get(K.news, []);
const busOf = id => buses().find(b => b.id === id);
const busName = id => (busOf(id) || { name: '(deleted bus)' }).name;
const userName = id => (users().find(u => u.id === id) || { name: '?' }).name;
const taken = (busId, date) => bks().filter(b => b.busId === busId && b.date === date && b.status === 'Confirmed').flatMap(b => b.seats);
const labels = n => Array.from({ length: n }, (_, i) => (Math.floor(i / 4) + 1) + 'ABCD'[i % 4]);
const slotOf = t => { const h = +t.slice(0, 2); return h >= 5 && h < 12 ? 'm' : h >= 12 && h < 17 ? 'a' : h >= 17 && h < 21 ? 'e' : 'n'; };

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
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name);
  if (pendingBus) { const p = pendingBus; pendingBus = null; return startBooking(p.id, p.date); }
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
$('#pwForm').onsubmit = e => {
  e.preventDefault();
  const l = users(), u = l.find(x => x.id === me.id);
  if (u.pass !== $('#pwOld').value) return toast('Current password is wrong');
  u.pass = $('#pwNew').value; set(K.users, l); me = u; set(K.me, u); e.target.reset(); toast('Password changed');
};

/* ===== Search ===== */
let pendingBus = null, cur = null, sel = [];
function fillCities() {
  const c = [...new Set(buses().flatMap(b => [b.from, b.to]))].sort();
  const opt = '<option value="">-- select --</option>' + c.map(x => `<option>${esc(x)}</option>`).join('');
  const f = $('#sFrom').value, t = $('#sTo').value; $('#sFrom').innerHTML = opt; $('#sTo').innerHTML = opt; $('#sFrom').value = f; $('#sTo').value = t;
}
$('#searchForm').onsubmit = e => {
  e.preventDefault();
  const from = $('#sFrom').value, to = $('#sTo').value, date = $('#sDate').value, tm = $('#sTime').value;
  if (from === to) return toast('Source and destination must be different');
  const list = buses().filter(b => b.from === from && b.to === to && (!tm || slotOf(b.time) === tm));
  $('#results').innerHTML = list.map(b => {
    const left = b.seats - taken(b.id, date).length;
    return `<div class="card"><div class="row"><div style="flex:3 1 280px">
      ${b.photo ? `<img src="${esc(b.photo)}" alt="" style="float:right;width:90px;height:65px;object-fit:cover;border-radius:8px;margin-left:10px" onerror="this.remove()">` : ''}
      <h3>🚌 ${esc(b.name)} <span class="badge info">${esc(b.cat)}</span></h3>
      <p class="mut">${esc(b.from)} → ${esc(b.to)} · departs ${b.time} · ${esc(b.loc || '')}</p><p>${esc(b.desc || '')}</p></div>
      <div style="text-align:right"><p class="price">${money(b.fare)}</p><p><span class="badge ${left ? '' : 'warn'}">${left} seats left</span></p>
      <button class="btn sm" data-act="comments" data-id="${b.id}">Reviews (${cms().filter(c => c.busId === b.id).length})</button>
      ${left ? `<button class="btn sm green" data-act="book" data-id="${b.id}">Select seats</button>` : ''}</div></div></div>`;
  }).join('') || '<div class="card mut">No buses found for this route/time.</div>';
};

/* ===== Booking ===== */
function startBooking(busId, date) {
  if (!me) { pendingBus = { id: busId, date }; toast('Please login to book'); return go('login'); }
  if (me.role === 'admin') return toast('Use a user account to book tickets');
  cur = { busId, date }; sel = [];
  const b = busOf(busId);
  $('#bookInfo').innerHTML = `<b>${esc(b.name)}</b> (${esc(b.cat)})<br>${esc(b.from)} → ${esc(b.to)} · ${date} · ${b.time}<br>Fare per seat: ${money(b.fare)}`;
  $('#bPhone').value = me.phone || ''; $('#bEmail').value = me.email;
  go('book'); drawSeats();
}
function drawSeats() {
  const b = busOf(cur.busId), tk = taken(cur.busId, cur.date), all = labels(b.seats);
  let html = '';
  for (let r = 0; r < Math.ceil(all.length / 4); r++) {
    [0, 1, 'g', 2, 3].forEach(c => {
      if (c === 'g') return html += '<div class="gap"></div>';
      const l = all[r * 4 + c];
      if (!l) return html += '<div class="gap"></div>';
      html += `<button type="button" class="seat ${tk.includes(l) ? 'taken' : ''} ${sel.includes(l) ? 'sel' : ''}" data-seat="${l}" ${tk.includes(l) ? 'disabled' : ''}>${l}</button>`;
    });
  }
  $('#seatMap').innerHTML = html;
  $('#paxList').innerHTML = sel.map(s => `<div class="row"><div><label>Seat ${s} · Passenger name</label><input class="pn" required></div>
    <div><label>Age</label><input type="number" class="pa" min="1" max="110" required></div>
    <div><label>Gender</label><select class="pg"><option>Male</option><option>Female</option><option>Other</option></select></div></div>`).join('');
  $('#bTotal').textContent = money(b.fare * sel.length);
}
$('#seatMap').onclick = e => {
  const s = e.target.closest('[data-seat]'); if (!s) return;
  const l = s.dataset.seat;
  if (sel.includes(l)) sel = sel.filter(x => x !== l);
  else { if (sel.length >= 6) return toast('Maximum 6 seats per booking'); sel.push(l); }
  // keep typed passenger details when toggling seats
  const keep = $$('#paxList .row').map(r => [r.querySelector('.pn').value, r.querySelector('.pa').value, r.querySelector('.pg').value]);
  drawSeats(); $$('#paxList .row').forEach((r, i) => { if (keep[i]) { r.querySelector('.pn').value = keep[i][0]; r.querySelector('.pa').value = keep[i][1]; r.querySelector('.pg').value = keep[i][2]; } });
};
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  if (!sel.length) return toast('Select at least one seat');
  const tk = taken(cur.busId, cur.date); if (sel.some(s => tk.includes(s))) { sel = sel.filter(s => !tk.includes(s)); drawSeats(); return toast('Some seats were just booked. Please reselect.'); }
  const b = busOf(cur.busId);
  const pax = $$('#paxList .row').map((r, i) => ({ seat: sel[i], name: r.querySelector('.pn').value.trim(), age: r.querySelector('.pa').value, gender: r.querySelector('.pg').value }));
  const bk = { id: 'TK' + Math.floor(100000 + Math.random() * 900000), userId: me.id, busId: b.id, date: cur.date, seats: [...sel], pax, phone: $('#bPhone').value, email: $('#bEmail').value, pay: $('#bPay').value, amount: b.fare * sel.length, status: 'Confirmed', created: today() };
  const l = bks(); l.push(bk); set(K.bk, l);
  showDlg(`<h2>✅ Booking confirmed</h2>${ticketHtml(bk)}<p class="mut">Confirmation email sent to ${esc(bk.email)} (demo).</p>`);
  cur = null; go('dash');
};
function ticketHtml(k) {
  const b = busOf(k.busId) || { name: '(deleted)', from: '', to: '', time: '' };
  return `<div class="ticket"><b>${k.id}</b> <span class="badge ${k.status === 'Confirmed' ? '' : 'warn'}">${k.status}</span><br>${esc(b.name)} · ${esc(b.from)} → ${esc(b.to)}<br>${k.date} at ${b.time}<br>
    Seats: ${k.seats.join(', ')}<br>${k.pax.map(p => esc(p.name) + ' (' + p.age + ', ' + p.gender + ')').join('<br>')}<br><b>${money(k.amount)}</b> paid via ${esc(k.pay)}</div>`;
}

/* ===== Actions ===== */
const actions = {
  book(id) { startBooking(id, $('#sDate').value); },
  comments(id) {
    const b = busOf(id), list = cms().filter(c => c.busId === id);
    showDlg(`<h2>Reviews: ${esc(b.name)}</h2>${list.map(c => `<p><b>${esc(userName(c.userId))}</b> <span class="mut">${c.date}</span><br>${esc(c.text)}</p><hr>`).join('') || '<p class="mut">No comments yet.</p>'}
      ${me && me.role === 'user' ? `<form id="cmForm"><textarea id="cmText" placeholder="Write a comment..." required></textarea><button class="btn sm">Post comment</button></form>` : '<p class="mut">Login as a user to post a comment.</p>'}`);
    const f = $('#cmForm'); if (f) f.onsubmit = ev => { ev.preventDefault(); const l = cms(); l.push({ id: uid(), busId: id, userId: me.id, text: $('#cmText').value.trim(), date: today() }); set(K.cm, l); toast('Comment posted'); actions.comments(id); renderAll(); };
  },
  cancel(id) {
    const l = bks(), k = l.find(x => x.id === id);
    if (!confirm('Cancel ticket ' + id + '? 80% of the fare will be refunded.')) return;
    k.status = 'Cancelled'; k.refund = Math.round(k.amount * 0.8); set(K.bk, l); toast('Ticket cancelled. Refund ' + money(k.refund)); renderAll();
  },
  print(id) { showDlg(ticketHtml(bks().find(x => x.id === id)) + '<button class="btn sm" onclick="window.print()">Print</button>'); },
  editBus(id) {
    const b = busOf(id);
    $('#bId').value = b.id; $('#bName').value = b.name; $('#bCat').value = b.cat; $('#bFrom').value = b.from; $('#bTo').value = b.to; $('#bTime').value = b.time;
    $('#bFare').value = b.fare; $('#bSeats').value = b.seats; $('#bLoc').value = b.loc || ''; $('#bPhoto').value = b.photo || ''; $('#bDesc').value = b.desc || '';
    $('#busFormTitle').textContent = 'Update bus'; window.scrollTo(0, 0);
  },
  delBus(id) { if (!confirm('Delete this bus?')) return; set(K.buses, buses().filter(b => b.id !== id)); toast('Bus deleted'); renderAll(); },
  delCat(id) { if (buses().some(b => b.cat === id)) return toast('Category is in use by a bus'); set(K.cats, cats().filter(c => c !== id)); renderAll(); },
  delUser(id) { if (!confirm('Delete this user?')) return; set(K.users, users().filter(u => u.id !== id)); renderAll(); },
  delCm(id) { set(K.cm, cms().filter(c => c.id !== id)); renderAll(); },
  delNews(id) { set(K.news, news().filter(n => n.id !== id)); renderAll(); }
};

/* ===== Admin forms ===== */
function clearBus() { $('#busForm').reset(); $('#bId').value = ''; $('#busFormTitle').textContent = 'Add bus'; }
$('#busClear').onclick = clearBus;
$('#busForm').onsubmit = e => {
  e.preventDefault();
  const data = { name: $('#bName').value.trim(), cat: $('#bCat').value, from: $('#bFrom').value.trim(), to: $('#bTo').value.trim(), time: $('#bTime').value, fare: +$('#bFare').value, seats: +$('#bSeats').value, loc: $('#bLoc').value.trim(), photo: $('#bPhoto').value.trim(), desc: $('#bDesc').value.trim() };
  const l = buses(), id = $('#bId').value;
  if (id) Object.assign(l.find(b => b.id === id), data); else l.push({ id: uid(), ...data });
  set(K.buses, l); toast(id ? 'Bus updated' : 'Bus added'); clearBus(); renderAll();
};
$('#catForm').onsubmit = e => { e.preventDefault(); const n = $('#catName').value.trim(), l = cats(); if (l.some(c => c.toLowerCase() === n.toLowerCase())) return toast('Category exists'); l.push(n); set(K.cats, l); e.target.reset(); renderAll(); };
$('#newsForm').onsubmit = e => { e.preventDefault(); const l = news(); l.unshift({ id: uid(), text: $('#newsText').value.trim(), date: today() }); set(K.news, l); e.target.reset(); toast('News posted'); renderAll(); };

/* ===== Render ===== */
function renderAll() {
  fillCities();
  $('#newsBox').innerHTML = '<b>📰 News</b>' + (news().map(n => `<p>• ${esc(n.text)} <span class="mut">(${n.date})</span></p>`).join('') || '<p class="mut">No news.</p>');
  if (!me) return;
  if (me.role === 'admin') {
    const cur = $('#bCat').value; $('#bCat').innerHTML = cats().map(c => `<option>${esc(c)}</option>`).join(''); if (cur) $('#bCat').value = cur;
    $('#adminBuses').innerHTML = buses().map(b => `<tr><td>${esc(b.name)}</td><td>${esc(b.cat)}</td><td>${esc(b.from)} → ${esc(b.to)}</td><td>${b.time}</td><td>${money(b.fare)}</td><td>${b.seats}</td>
      <td><button class="btn sm" data-act="editBus" data-id="${b.id}">Edit</button><button class="btn sm red" data-act="delBus" data-id="${b.id}">Delete</button></td></tr>`).join('');
    $('#catList').innerHTML = cats().map(c => `<span class="badge info" style="margin:3px;font-size:.9rem">${esc(c)} <a href="#" data-act="delCat" data-id="${esc(c)}" style="color:#991b1b;text-decoration:none">✕</a></span>`).join('');
    $('#adminBookings').innerHTML = bks().slice().reverse().map(k => `<tr><td>${k.id}</td><td>${esc(userName(k.userId))}</td><td>${esc(busName(k.busId))}</td><td>${k.date}</td><td>${k.seats.join(', ')}</td><td>${money(k.amount)}</td><td><span class="badge ${k.status === 'Confirmed' ? '' : 'warn'}">${k.status}</span></td></tr>`).join('') || '<tr><td colspan="7" class="mut">No bookings.</td></tr>';
    $('#adminUsers').innerHTML = users().filter(u => u.role === 'user').map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td><button class="btn sm red" data-act="delUser" data-id="${u.id}">Delete</button></td></tr>`).join('');
    $('#adminComments').innerHTML = cms().map(c => `<tr><td>${esc(busName(c.busId))}</td><td>${esc(userName(c.userId))}</td><td>${esc(c.text)}</td><td><button class="btn sm red" data-act="delCm" data-id="${c.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="mut">No comments.</td></tr>';
    $('#newsList').innerHTML = news().map(n => `<p>${esc(n.text)} <span class="mut">${n.date}</span> <button class="btn sm red" data-act="delNews" data-id="${n.id}">Delete</button></p>`).join('');
    const ok = bks().filter(k => k.status === 'Confirmed');
    $('#repStats').innerHTML = [['Buses', buses().length], ['Users', users().filter(u => u.role === 'user').length], ['Confirmed bookings', ok.length], ['Cancelled', bks().length - ok.length], ['Revenue', money(ok.reduce((s, k) => s + k.amount, 0))]]
      .map(([a, b]) => `<div class="card stat"><span class="mut">${a}</span><b>${b}</b></div>`).join('');
    $('#repTable').innerHTML = buses().map(b => { const x = ok.filter(k => k.busId === b.id); return `<tr><td>${esc(b.name)}</td><td>${x.length}</td><td>${x.reduce((s, k) => s + k.seats.length, 0)}</td><td>${money(x.reduce((s, k) => s + k.amount, 0))}</td></tr>`; }).join('');
  } else {
    $('#uName').textContent = me.name;
    $('#userTickets').innerHTML = bks().filter(k => k.userId === me.id).reverse().map(k => `${ticketHtml(k)}
      ${k.status === 'Confirmed' ? `<button class="btn sm red" data-act="cancel" data-id="${k.id}">Cancel ticket</button> <button class="btn sm sec" data-act="print" data-id="${k.id}">Print</button>` : (k.refund ? `<span class="mut">Refund: ${money(k.refund)}</span>` : '')}<br><br>`).join('') || '<div class="card mut">No bookings yet.</div>';
  }
}

$('#sDate').min = today(); $('#sDate').value = today();
go('home');
