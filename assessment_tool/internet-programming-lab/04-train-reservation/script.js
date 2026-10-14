/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }

/* ===== Data ===== */
const CLS = ['SL', '3A', '2A', '1A'];
const CLS_NAME = { SL: 'Sleeper', '3A': 'AC 3 Tier', '2A': 'AC 2 Tier', '1A': 'First AC' };
const K = { users: 'rail_users', trains: 'rail_trains', fares: 'rail_fares', rules: 'rail_rules', bk: 'rail_bookings', me: 'rail_me' };
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'Railway Admin', email: 'admin@rail.com', phone: '9000000000', pass: 'admin123', role: 'admin' },
  { id: 'u1', name: 'Demo Passenger', email: 'user@rail.com', phone: '9876543210', pass: 'user123', role: 'user' }
]);
if (!get(K.trains)) set(K.trains, [
  { id: 't1', no: '12621', name: 'Tamil Nadu Express', zone: 'Southern', route: ['Chennai', 'Vijayawada', 'Nagpur', 'Bhopal', 'New Delhi'], dep: '22:00', arr: '07:05', seats: { SL: 72, '3A': 64, '2A': 46, '1A': 18 }, fare: { SL: 780, '3A': 2050, '2A': 2900, '1A': 4800 } },
  { id: 't2', no: '12007', name: 'Shatabdi Express', zone: 'Southern', route: ['Chennai', 'Katpadi', 'Bangalore', 'Mysuru'], dep: '06:00', arr: '12:30', seats: { SL: 0, '3A': 0, '2A': 40, '1A': 20 }, fare: { SL: 0, '3A': 0, '2A': 1200, '1A': 2300 } },
  { id: 't3', no: '12685', name: 'Chennai - Bangalore Mail', zone: 'Southern', route: ['Chennai', 'Katpadi', 'Bangalore'], dep: '21:15', arr: '04:45', seats: { SL: 4, '3A': 4, '2A': 2, '1A': 0 }, fare: { SL: 320, '3A': 780, '2A': 1100, '1A': 0 } },
  { id: 't4', no: '16032', name: 'Andaman Express', zone: 'Southern', route: ['Chennai', 'Vijayawada', 'Nagpur', 'Jammu Tawi'], dep: '05:45', arr: '16:00', seats: { SL: 72, '3A': 64, '2A': 46, '1A': 0 }, fare: { SL: 760, '3A': 2000, '2A': 2800, '1A': 0 } }
]);
if (!get(K.fares)) set(K.fares, []);
if (!get(K.rules)) set(K.rules, [{ days: 7, pct: 90 }, { days: 3, pct: 75 }, { days: 1, pct: 50 }, { days: 0, pct: 0 }]);
if (!get(K.bk)) set(K.bk, []);

let me = get(K.me, null);
const users = () => get(K.users, []), trains = () => get(K.trains, []), fares = () => get(K.fares, []), rules = () => get(K.rules, []), bks = () => get(K.bk, []);
const trainOf = id => trains().find(t => t.id === id);
const userName = id => (users().find(u => u.id === id) || { name: '?' }).name;
const racCap = cap => Math.ceil(cap * 0.1);

/* Fare for the section i..j of the train's route, date-wise */
function fareFor(t, cls, date, i, j) {
  const special = fares().filter(f => f.trainId === t.id && f.cls === cls && f.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const full = special ? special.fare : t.fare[cls];
  return Math.round(full * (j - i) / (t.route.length - 1));
}

/* Re-assign CNF / RAC / WL for every active booking of a train+class+date (first come first served) */
function reallocate(trainId, cls, date) {
  const t = trainOf(trainId), cap = t ? t.seats[cls] : 0;
  const all = bks();
  const act = all.filter(b => b.trainId === trainId && b.cls === cls && b.date === date && !b.cancel).sort((a, b) => a.created.localeCompare(b.created));
  let cnf = 0, rac = 0, wl = 0;
  act.forEach(b => {
    const n = b.pax.length;
    if (cnf + n <= cap) { b.status = 'CNF'; b.seatNos = b.pax.map((_, k) => cls + '/' + (cnf + k + 1)); b.pos = 0; cnf += n; }
    else if (rac + n <= racCap(cap)) { b.status = 'RAC'; b.seatNos = []; b.pos = rac + 1; rac += n; }
    else { b.status = 'WL'; b.seatNos = []; b.pos = wl + 1; wl += n; }
  });
  set(K.bk, all);
}
function availability(t, cls, date) {
  const cap = t.seats[cls]; if (!cap) return null;
  const act = bks().filter(b => b.trainId === t.id && b.cls === cls && b.date === date && !b.cancel);
  const used = s => act.filter(b => b.status === s).reduce((n, b) => n + b.pax.length, 0);
  const c = used('CNF'), r = used('RAC'), w = used('WL');
  if (c < cap) return { txt: 'AVL ' + (cap - c), cls: '' };
  if (r < racCap(cap)) return { txt: 'RAC ' + (r + 1), cls: 'wait' };
  return { txt: 'WL ' + (w + 1), cls: 'warn' };
}
const statusTxt = b => b.cancel ? 'Cancelled' : b.status === 'CNF' ? 'CNF' : b.status === 'RAC' ? 'RAC ' + b.pos : 'WL ' + b.pos;
const statusBadge = b => `<span class="badge ${b.cancel ? 'warn' : b.status === 'CNF' ? '' : b.status === 'RAC' ? 'wait' : 'warn'}">${statusTxt(b)}</span>`;

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
  const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) actions[a.dataset.act](a.dataset.id, a.dataset.arg);
});
$('#logout').onclick = () => { me = null; localStorage.removeItem(K.me); toast('Logged out'); go('home'); };

/* ===== Auth ===== */
let pendingBook = null, cur = null;
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name);
  if (pendingBook) { const p = pendingBook; pendingBook = null; return startBooking(p.tid, p.cls); }
  go('dash');
};
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const email = $('#rEmail').value.trim().toLowerCase();
  if (users().some(u => u.email.toLowerCase() === email)) return toast('Email already registered');
  const l = users(); l.push({ id: uid(), name: $('#rName').value.trim(), email, phone: $('#rPhone').value, pass: $('#rPass').value, role: 'user' });
  set(K.users, l); e.target.reset(); toast('Registered! Please login.'); go('login');
};

/* ===== Search ===== */
function stations() { return [...new Set(trains().flatMap(t => t.route))].sort(); }
function fillStations() {
  const f = $('#sFrom').value, t = $('#sTo').value, opt = '<option value="">-- station --</option>' + stations().map(s => `<option>${esc(s)}</option>`).join('');
  $('#sFrom').innerHTML = opt; $('#sTo').innerHTML = opt; $('#sFrom').value = f; $('#sTo').value = t;
}
$('#searchForm').onsubmit = e => {
  e.preventDefault();
  const from = $('#sFrom').value, to = $('#sTo').value, date = $('#sDate').value, cl = $('#sCls').value;
  if (from === to) return toast('Origin and destination must differ');
  const list = trains().filter(t => { const i = t.route.indexOf(from), j = t.route.indexOf(to); return i >= 0 && j > i; });
  $('#results').innerHTML = list.map(t => {
    const i = t.route.indexOf(from), j = t.route.indexOf(to);
    const cells = CLS.filter(c => (!cl || c === cl) && t.seats[c] > 0).map(c => {
      const av = availability(t, c, date);
      return `<div class="card" style="min-width:150px;margin:0"><b>${c}</b> <span class="mut">${CLS_NAME[c]}</span><br><span class="price">${money(fareFor(t, c, date, i, j))}</span><br><span class="badge ${av.cls}">${av.txt}</span><br>
        <button class="btn sm" style="margin-top:6px" data-act="book" data-id="${t.id}" data-arg="${c}">Book</button></div>`;
    }).join('') || '<span class="mut">Selected class not available on this train.</span>';
    return `<div class="card"><h3>${esc(t.no)} · ${esc(t.name)}</h3><p class="mut">${esc(from)} → ${esc(to)} · Departs ${t.dep} · Arrives ${t.arr} · Zone: ${esc(t.zone)}<br>Via: ${esc(t.route.slice(i + 1, j).join(', ') || 'direct')}</p>
      <div class="row">${cells}</div></div>`;
  }).join('') || '<div class="card mut">No trains found for this route.</div>';
};

/* ===== Booking ===== */
function paxRow(n) {
  return `<div class="row"><div><label>Passenger ${n} name</label><input class="pn" required></div><div style="flex:0 0 80px"><label>Age</label><input type="number" class="pa" min="1" max="110" required></div>
    <div style="flex:0 0 110px"><label>Gender</label><select class="pg"><option>Male</option><option>Female</option><option>Other</option></select></div></div>`;
}
function startBooking(tid, cls) {
  if (!me) { pendingBook = { tid, cls }; toast('Please login to reserve'); return go('login'); }
  if (me.role === 'admin') return toast('Use a passenger account to reserve');
  const t = trainOf(tid), from = $('#sFrom').value, to = $('#sTo').value, date = $('#sDate').value;
  const i = t.route.indexOf(from), j = t.route.indexOf(to);
  cur = { tid, cls, from, to, date, unit: fareFor(t, cls, date, i, j) };
  $('#bookInfo').innerHTML = `<b>${esc(t.no)} ${esc(t.name)}</b><br>${esc(from)} → ${esc(to)}<br>Date: ${date} · Class: ${cls} (${CLS_NAME[cls]})<br>Fare per passenger: ${money(cur.unit)}`;
  $('#paxList').innerHTML = paxRow(1); updateTotal(); toggleRef(); go('book');
}
const updateTotal = () => { $('#bTotal').textContent = money(cur.unit * $$('#paxList .row').length); };
$('#addPax').onclick = () => { const n = $$('#paxList .row').length; if (n >= 6) return toast('Maximum 6 passengers per PNR'); $('#paxList').insertAdjacentHTML('beforeend', paxRow(n + 1)); updateTotal(); };
const toggleRef = () => { const off = $('#bMode').value === 'Offline'; $('#refBox').classList.toggle('hidden', off); $('#bRef').required = !off; };
$('#bMode').onchange = toggleRef;
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  const t = trainOf(cur.tid), pax = $$('#paxList .row').map(r => ({ name: r.querySelector('.pn').value.trim(), age: r.querySelector('.pa').value, gender: r.querySelector('.pg').value }));
  const l = bks(); let pnr; do { pnr = String(Math.floor(1e9 + Math.random() * 9e9)); } while (l.some(b => b.pnr === pnr));
  const online = $('#bMode').value !== 'Offline';
  l.push({ pnr, userId: me.id, trainId: t.id, cls: cur.cls, date: cur.date, from: cur.from, to: cur.to, pax, fare: cur.unit * pax.length, status: 'CNF', seatNos: [], pos: 0,
    payMode: $('#bMode').value, payRef: online ? $('#bRef').value : '', payStatus: online ? 'Paid' : 'Pending (pay at counter)', booked: today(), created: new Date().toISOString(), cancel: null });
  set(K.bk, l); reallocate(t.id, cur.cls, cur.date);
  const b = bks().find(x => x.pnr === pnr);
  e.target.reset(); showDlg(`<h2>🎫 Ticket generated</h2>${ticketHtml(b)}<p class="mut">Payment details have been sent to the system admin.</p>`);
  cur = null; go('dash');
};
function ticketHtml(b) {
  const t = trainOf(b.trainId) || { no: '', name: '(deleted train)', dep: '', arr: '' };
  return `<div class="ticket"><b>PNR: ${b.pnr}</b> ${statusBadge(b)}<br>${esc(t.no)} ${esc(t.name)}<br>${esc(b.from)} → ${esc(b.to)} · ${b.date} · ${b.cls} · Dep ${t.dep}<br>
    ${b.pax.map((p, i) => `${esc(p.name)} (${p.age}/${p.gender[0]}) ${b.status === 'CNF' && !b.cancel ? '— ' + (b.seatNos[i] || '') : ''}`).join('<br>')}<br>
    Fare: <b>${money(b.fare)}</b> · ${b.payMode} · ${esc(b.payStatus)}<br><span class="mut">Booked on ${b.booked}</span>
    ${b.cancel ? `<br><span class="badge warn">Refund ${money(b.cancel.refund)} (${b.cancel.pct}%) – ${b.cancel.state}</span>` : ''}</div>`;
}

/* ===== PNR status ===== */
$('#pnrForm').onsubmit = e => {
  e.preventDefault();
  const b = bks().find(x => x.pnr === $('#pnrNo').value);
  $('#pnrResult').innerHTML = b ? ticketHtml(b) : '<p class="badge warn">PNR not found</p>';
};

/* ===== Cancel / refund ===== */
function refundInfo(b) {
  const d = daysBetween(today(), b.date), rs = rules().slice().sort((a, c) => c.days - a.days);
  const r = rs.find(x => d >= x.days) || { pct: 0 };
  return { pct: r.pct, refund: Math.round(b.fare * r.pct / 100), days: d };
}
function requestCancel(pnr) {
  const b = bks().find(x => x.pnr === pnr && x.userId === me.id);
  if (!b) return toast('PNR not found in your bookings');
  if (b.cancel) return toast('This ticket is already cancelled');
  if (b.date < today()) return toast('Journey date has passed');
  const r = refundInfo(b);
  showDlg(`<h2>Cancel PNR ${pnr}?</h2><p>Fare paid: ${money(b.fare)}<br>Journey in ${r.days} day(s) → refundable ${r.pct}%<br><b>Refund amount: ${money(r.refund)}</b></p>
    <button class="btn red" id="okCancel">Confirm cancellation</button>`);
  $('#okCancel').onclick = () => {
    const l = bks(), x = l.find(y => y.pnr === pnr); x.cancel = { date: today(), pct: r.pct, refund: r.refund, state: r.refund ? 'Refund pending admin approval' : 'No refund' };
    set(K.bk, l); reallocate(x.trainId, x.cls, x.date); $('#dlg').close(); toast('Cancellation requested'); renderAll();
  };
}
$('#cancelForm').onsubmit = e => { e.preventDefault(); requestCancel($('#cPnr').value); e.target.reset(); };

/* ===== Actions ===== */
const actions = {
  book(tid, cls) { startBooking(tid, cls); },
  cancel(pnr) { requestCancel(pnr); },
  print(pnr) { showDlg(ticketHtml(bks().find(b => b.pnr === pnr)) + '<button class="btn sm" onclick="window.print()">Print ticket</button>'); },
  markPaid(pnr) { const l = bks(); l.find(b => b.pnr === pnr).payStatus = 'Paid'; set(K.bk, l); renderAll(); },
  refund(pnr) { const l = bks(), b = l.find(x => x.pnr === pnr); b.cancel.state = 'Refunded'; set(K.bk, l); toast('Refund of ' + money(b.cancel.refund) + ' passed to passenger'); renderAll(); },
  editTrain(id) {
    const t = trainOf(id); $('#tId').value = id; $('#tNo').value = t.no; $('#tName').value = t.name; $('#tZone').value = t.zone; $('#tFrom').value = t.route[0]; $('#tTo').value = t.route[t.route.length - 1];
    $('#tVia').value = t.route.slice(1, -1).join(', '); $('#tDep').value = t.dep; $('#tArr').value = t.arr;
    CLS.forEach(c => { $('#s' + c).value = t.seats[c]; $('#f' + c).value = t.fare[c]; }); $('#trTitle').textContent = 'Update train'; window.scrollTo(0, 0);
  },
  delTrain(id) { if (!confirm('Delete this train?')) return; set(K.trains, trains().filter(t => t.id !== id)); renderAll(); },
  delFare(id) { set(K.fares, fares().filter(f => f.id !== id)); renderAll(); }
};

/* ===== Admin forms ===== */
function clearTr() { $('#trForm').reset(); $('#tId').value = ''; $('#trTitle').textContent = 'Add train'; }
$('#trClear').onclick = clearTr;
$('#trForm').onsubmit = e => {
  e.preventDefault();
  const via = $('#tVia').value.split(',').map(s => s.trim()).filter(Boolean);
  const data = { no: $('#tNo').value.trim(), name: $('#tName').value.trim(), zone: $('#tZone').value.trim(), route: [$('#tFrom').value.trim(), ...via, $('#tTo').value.trim()], dep: $('#tDep').value, arr: $('#tArr').value, seats: {}, fare: {} };
  CLS.forEach(c => { data.seats[c] = +$('#s' + c).value || 0; data.fare[c] = +$('#f' + c).value || 0; });
  const l = trains(), id = $('#tId').value;
  if (id) Object.assign(l.find(t => t.id === id), data); else l.push({ id: uid(), ...data });
  set(K.trains, l); toast(id ? 'Train updated' : 'Train added'); clearTr(); renderAll();
};
$('#fareForm').onsubmit = e => { e.preventDefault(); const l = fares(); l.push({ id: uid(), trainId: $('#fTrain').value, cls: $('#fCls').value, date: $('#fDate').value, fare: +$('#fAmt').value }); set(K.fares, l); e.target.reset(); toast('Fare added'); renderAll(); };
$('#ruleSave').onclick = () => { const l = rules().map((r, i) => ({ days: r.days, pct: Math.min(100, Math.max(0, +$('#rp' + i).value || 0)) })); set(K.rules, l); toast('Refund rules saved'); renderAll(); };

/* ===== Render ===== */
function renderAll() {
  fillStations();
  const rs = rules().slice().sort((a, b) => b.days - a.days);
  $('#rulesText').textContent = rs.map(r => `${r.days}+ days before: ${r.pct}%`).join(' | ');
  if (!me) return;
  if (me.role === 'admin') {
    $('#adminTrains').innerHTML = trains().map(t => `<tr><td>${esc(t.no)}</td><td>${esc(t.name)}</td><td>${esc(t.route.join(' → '))}</td><td>${esc(t.zone)}</td><td>${t.dep} - ${t.arr}</td><td>${CLS.map(c => t.seats[c]).join(' / ')}</td>
      <td><button class="btn sm" data-act="editTrain" data-id="${t.id}">Edit</button><button class="btn sm red" data-act="delTrain" data-id="${t.id}">Delete</button></td></tr>`).join('');
    const sel = $('#fTrain').value; $('#fTrain').innerHTML = trains().map(t => `<option value="${t.id}">${esc(t.no)} ${esc(t.name)}</option>`).join(''); if (sel) $('#fTrain').value = sel;
    $('#fareList').innerHTML = fares().map(f => { const t = trainOf(f.trainId) || { no: '?', name: '', zone: '' }; return `<tr><td>${esc(t.no)} ${esc(t.name)}</td><td>${esc(t.zone)}</td><td>${f.cls}</td><td>${f.date}</td><td>${money(f.fare)}</td><td><button class="btn sm red" data-act="delFare" data-id="${f.id}">Delete</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="mut">No special fares. Base fares apply.</td></tr>';
    if (!document.activeElement.closest('#ruleList')) $('#ruleList').innerHTML = rules().map((r, i) => `<tr><td>${r.days}+ days</td><td><input type="number" id="rp${i}" min="0" max="100" value="${r.pct}" style="max-width:100px"></td></tr>`).join('');
    $('#adminBookings').innerHTML = bks().slice().reverse().map(b => { const t = trainOf(b.trainId) || { no: '?', name: '' }; return `<tr><td>${b.pnr}</td><td>${esc(b.pax.map(p => p.name).join(', '))}<br><span class="mut">${esc(userName(b.userId))}</span></td><td>${esc(t.no)}</td><td>${b.date}<br><span class="mut">${b.cls}</span></td><td>${money(b.fare)}</td>
      <td>${b.payMode}<br><span class="badge ${b.payStatus === 'Paid' ? '' : 'wait'}">${esc(b.payStatus)}</span>${b.payRef ? '<br><span class="mut">' + esc(b.payRef) + '</span>' : ''}</td><td>${statusBadge(b)}${b.cancel ? '<br><span class="mut">' + esc(b.cancel.state) + '</span>' : ''}</td>
      <td>${b.payStatus !== 'Paid' && !b.cancel ? `<button class="btn sm" data-act="markPaid" data-id="${b.pnr}">Mark paid</button>` : ''}${b.cancel && b.cancel.refund && b.cancel.state !== 'Refunded' ? `<button class="btn sm green" data-act="refund" data-id="${b.pnr}">Pass refund ${money(b.cancel.refund)}</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="mut">No bookings yet.</td></tr>';
  } else {
    $('#uName').textContent = me.name;
    $('#userTickets').innerHTML = bks().filter(b => b.userId === me.id).reverse().map(b => ticketHtml(b) +
      `<p><button class="btn sm sec" data-act="print" data-id="${b.pnr}">Print ticket</button> ${!b.cancel ? `<button class="btn sm red" data-act="cancel" data-id="${b.pnr}">Cancel</button>` : ''}</p>`).join('') || '<div class="card mut">No reservations yet.</div>';
  }
}

$('#sDate').min = today(); $('#sDate').value = today();
go('home');
