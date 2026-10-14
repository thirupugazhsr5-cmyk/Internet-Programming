/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => ymd(new Date());
const nowHM = () => pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }

/* ===== Data ===== */
const K = { users: 'bp_users', parlours: 'bp_parlours', svc: 'bp_services', sty: 'bp_stylists', res: 'bp_res', blocks: 'bp_blocks', me: 'bp_me' };
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'Salon Manager', email: 'admin@glam.com', phone: '9000000000', pass: 'admin123', role: 'admin' },
  { id: 'u1', name: 'Demo Customer', email: 'user@glam.com', phone: '9876543210', pass: 'user123', role: 'user' }
]);
if (!get(K.parlours)) {
  const P = [['p1', 'Glow Beauty Studio', 'Anna Nagar', '4.8'], ['p2', 'Royal Looks Salon', 'T. Nagar', '4.6'], ['p3', 'Bridal Bliss Parlour', 'Adyar', '4.9']];
  const SV = [['Haircut & styling', 400], ['Hair spa', 900], ['Facial (gold)', 1200], ['Manicure', 600], ['Bridal makeup', 5000], ['Threading', 80]];
  const ST = [['Meera', 'Hair stylist', 6], ['Priya', 'Makeup artist', 8]];
  set(K.parlours, P.map(p => ({ id: p[0], name: p[1], area: p[2], rating: p[3], policy: p[0] === 'p1' ? 'deposit' : 'none', dep: 30, autoMins: 15 })));
  set(K.svc, P.flatMap(p => SV.map((s, i) => ({ id: p[0] + '_s' + i, parlourId: p[0], name: s[0], price: s[1] }))));
  set(K.sty, P.flatMap(p => ST.map((s, i) => ({ id: p[0] + '_t' + i, parlourId: p[0], name: s[0], role: s[1], exp: s[2] }))));
}
if (!get(K.res)) set(K.res, []);
if (!get(K.blocks)) set(K.blocks, []);

let me = get(K.me, null);
const users = () => get(K.users, []), parlours = () => get(K.parlours, []), services = () => get(K.svc, []), stylists = () => get(K.sty, []), reservations = () => get(K.res, []), blocks = () => get(K.blocks, []);
const parlour = id => parlours().find(p => p.id === id) || { name: '(removed)', policy: 'none' };
const svcName = id => (services().find(s => s.id === id) || { name: '(removed)' }).name;
const styName = id => (stylists().find(s => s.id === id) || { name: '(removed)' }).name;
const dueFor = (p, price) => p.policy === 'deposit' ? Math.ceil(price * p.dep / 100) : price;
const when = r => r.date + ' ' + r.time;

/* A slot is free if not past, not locked by the salon, and the stylist has no booking then */
function isFree(pid, sid, date, time, ignoreId) {
  if (!date || date < today() || (date === today() && time <= nowHM())) return false;
  if (blocks().some(b => b.parlourId === pid && b.date === date && b.time === time)) return false;
  return !reservations().some(r => r.id !== ignoreId && r.parlourId === pid && r.stylistId === sid && r.date === date && r.time === time && r.status === 'Booked');
}
function drawSlots(box, pid, sid, date, sel, ignoreId, pick) {
  box.innerHTML = HOURS.map(h => `<button type="button" class="slot ${h === sel ? 'sel' : ''}" data-time="${h}" ${isFree(pid, sid, date, h, ignoreId) || h === sel ? '' : 'disabled'}>${h}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('[data-time]'); if (b && !b.disabled) pick(b.dataset.time); };
}

/* Unpaid reservations are cancelled automatically once the parlour's time limit passes */
function autoCancel() {
  const l = reservations(); let n = 0;
  l.forEach(r => { const p = parlour(r.parlourId); if (r.status === 'Booked' && r.payStatus === 'Unpaid' && p.policy !== 'none' && Date.now() - r.createdAt > (p.autoMins || 15) * 60000) { r.status = 'Cancelled'; r.note = 'Auto-cancelled (unpaid)'; n++; } });
  if (n) { set(K.res, l); if (me) toast(n + ' unpaid reservation(s) auto-cancelled'); }
  return n;
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
  const d = e.target.closest('[data-day]'); if (d) { adm.day = d.dataset.day; renderAll(); }
});
$('#logout').onclick = () => { me = null; localStorage.removeItem(K.me); toast('Logged out'); go('home'); };

/* ===== Auth & profile ===== */
let pendingP = null;
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name);
  if (pendingP && u.role === 'user') { const p = pendingP; pendingP = null; return startBook(p); }
  go('dash');
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
  set(K.users, l); me = u; set(K.me, u); $('#pPass').value = ''; toast('Personal data saved'); renderAll();
};

/* ===== Customer: find parlour & book ===== */
$('#pq').oninput = renderParlours;
function renderParlours() {
  const q = $('#pq').value.toLowerCase();
  $('#parlourGrid').innerHTML = parlours().filter(p => (p.name + ' ' + p.area + ' ' + services().filter(s => s.parlourId === p.id).map(s => s.name).join(' ')).toLowerCase().includes(q)).map(p =>
    `<div class="card"><div class="emoji">💅</div><h3>${esc(p.name)}</h3><p class="mut">📍 ${esc(p.area)} · <span class="stars">★</span> ${p.rating}</p>
    <p class="mut">${services().filter(s => s.parlourId === p.id).length} services · ${stylists().filter(s => s.parlourId === p.id).length} stylists<br>${p.policy === 'none' ? 'Pay at salon or online' : p.policy === 'deposit' ? p.dep + '% deposit required' : 'Full online payment'}</p>
    <button class="btn sm" data-act="book" data-id="${p.id}">Book appointment</button></div>`).join('') || '<p class="mut">No parlours found.</p>';
}
let cur = null, bSel = '';
function startBook(pid) {
  if (!me) { pendingP = pid; toast('Please login to book'); return go('login'); }
  if (me.role === 'admin') return toast('Use a customer account to book');
  cur = pid; bSel = ''; const p = parlour(pid);
  $('#bTitle').textContent = p.name; $('#bSub').textContent = '📍 ' + p.area;
  $('#stylistCards').innerHTML = stylists().filter(s => s.parlourId === pid).map(s => `<div class="card"><div class="emoji">💁</div><h3>${esc(s.name)}</h3><p class="mut">${esc(s.role)}<br>${s.exp} years experience</p></div>`).join('');
  $('#bService').innerHTML = services().filter(s => s.parlourId === pid).map(s => `<option value="${s.id}">${esc(s.name)} - ${money(s.price)}</option>`).join('');
  $('#bStylist').innerHTML = stylists().filter(s => s.parlourId === pid).map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.role)})</option>`).join('');
  $('#bDate').min = today(); $('#bDate').value = today(); $('#bName').value = me.name; $('#bPhone').value = me.phone || '';
  $('#payPolicy').textContent = p.policy === 'none' ? 'Online payment is optional. You may also pay at the salon.' : (p.policy === 'deposit' ? `A ${p.dep}% deposit is required.` : 'Full payment is required.') + ` Unpaid reservations are cancelled automatically after ${p.autoMins} minutes.`;
  go('book'); updateBook();
}
function updateBook() {
  if (!cur) return; const p = parlour(cur), s = services().find(x => x.id === $('#bService').value); if (!s) return;
  $('#bPrice').textContent = money(s.price); $('#bDue').textContent = money(dueFor(p, s.price));
  $('#gwBox').classList.toggle('hidden', document.querySelector('input[name=payOpt]:checked').value === 'later');
  drawSlots($('#bSlots'), cur, $('#bStylist').value, $('#bDate').value, bSel, null, t => { bSel = t; updateBook(); });
}
['bService'].forEach(id => $('#' + id).addEventListener('change', updateBook));
['bStylist', 'bDate'].forEach(id => $('#' + id).addEventListener('change', () => { bSel = ''; updateBook(); }));
$$('input[name=payOpt]').forEach(r => r.addEventListener('change', updateBook));
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  if (!bSel) return toast('Please choose a time slot');
  const p = parlour(cur), s = services().find(x => x.id === $('#bService').value), sid = $('#bStylist').value, date = $('#bDate').value;
  if (!isFree(cur, sid, date, bSel)) { bSel = ''; updateBook(); return toast('Sorry, that slot was just taken'); }
  const now = $('input[name=payOpt]:checked').value === 'now', due = dueFor(p, s.price);
  const r = { id: 'AP' + Math.floor(1000 + Math.random() * 9000), userId: me.id, custName: $('#bName').value.trim(), custPhone: $('#bPhone').value, parlourId: cur, serviceId: s.id, stylistId: sid, date, time: bSel, price: s.price,
    paid: now ? due : 0, payStatus: now ? (p.policy === 'deposit' ? 'Deposit paid' : 'Paid') : (p.policy === 'none' ? 'Pay at salon' : 'Unpaid'), gateway: now ? $('#bGw').value : '', status: 'Booked', createdAt: Date.now(), fb: null };
  const l = reservations(); l.push(r); set(K.res, l);
  showDlg(`<h2>✅ Reservation confirmed</h2><div class="ticket"><b>${r.id}</b><br>${esc(p.name)}<br>${esc(s.name)} with ${esc(styName(sid))}<br>${date} at ${bSel}<br>Payment: ${esc(r.payStatus)}${r.paid ? ' (' + money(r.paid) + ' via ' + r.gateway + ')' : ''}</div><p class="mut">Confirmation email and reminder will be sent (demo).</p>`);
  cur = null; go('dash');
};

/* ===== Reservation dialog (add / edit / reschedule) ===== */
function resDialog(r, pid, mode, defDate) {
  let sel = r ? r.time : '';
  showDlg(`<h2>${mode === 'add' ? 'Add reservation' : mode === 'resched' ? 'Reschedule appointment' : 'Edit reservation'}</h2><form id="edForm">
    ${mode === 'add' ? '<div class="row"><div><label>Customer name</label><input id="eName" required></div><div><label>Phone</label><input id="ePhone" pattern="[0-9]{10}" required></div></div>' : ''}
    <div class="row"><div><label>Service</label><select id="eSvc" ${mode === 'resched' ? 'disabled' : ''}>${services().filter(s => s.parlourId === pid).map(s => `<option value="${s.id}" ${r && r.serviceId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div><label>Stylist</label><select id="eSty" ${mode === 'resched' ? 'disabled' : ''}>${stylists().filter(s => s.parlourId === pid).map(s => `<option value="${s.id}" ${r && r.stylistId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div><label>Date</label><input type="date" id="eDate" min="${today()}" value="${r ? r.date : (defDate || today())}" required></div></div>
    <label>Time</label><div class="slots" id="eSlots"></div><br><button class="btn">Save</button></form>`);
  const redraw = () => drawSlots($('#eSlots'), pid, $('#eSty').value, $('#eDate').value, sel, r && r.id, t => { sel = t; redraw(); });
  $('#eSty').onchange = $('#eDate').onchange = () => { sel = ''; redraw(); }; redraw();
  $('#edForm').onsubmit = ev => {
    ev.preventDefault();
    const sid = $('#eSty').value, date = $('#eDate').value, svc = services().find(x => x.id === $('#eSvc').value);
    if (!sel) return toast('Pick a time');
    if (!isFree(pid, sid, date, sel, r && r.id)) return toast('That slot is not available');
    const l = reservations();
    if (r) Object.assign(l.find(x => x.id === r.id), { serviceId: svc.id, stylistId: sid, date, time: sel, price: svc.price });
    else l.push({ id: 'AP' + Math.floor(1000 + Math.random() * 9000), userId: null, custName: $('#eName').value.trim(), custPhone: $('#ePhone').value, parlourId: pid, serviceId: svc.id, stylistId: sid, date, time: sel, price: svc.price, paid: 0, payStatus: 'Pay at salon', gateway: '', status: 'Booked', createdAt: Date.now(), fb: null });
    set(K.res, l); $('#dlg').close(); toast(r ? 'Reservation updated' : 'Reservation added'); renderAll();
  };
}

/* ===== Admin forms ===== */
$('#svcForm').onsubmit = e => { e.preventDefault(); const l = services(); l.push({ id: uid(), parlourId: adm.p, name: $('#svName').value.trim(), price: +$('#svPrice').value }); set(K.svc, l); e.target.reset(); renderAll(); };
$('#styForm').onsubmit = e => { e.preventDefault(); const l = stylists(); l.push({ id: uid(), parlourId: adm.p, name: $('#syName').value.trim(), role: $('#syRole').value.trim(), exp: +$('#syExp').value || 0 }); set(K.sty, l); e.target.reset(); renderAll(); };
$('#setForm').onsubmit = e => { e.preventDefault(); const l = parlours(), p = l.find(x => x.id === adm.p); p.policy = $('#stPolicy').value; p.dep = +$('#stDep').value; p.autoMins = +$('#stAuto').value; set(K.parlours, l); toast('Settings saved'); renderAll(); };
$('#admP').onchange = () => { adm.p = $('#admP').value; renderAll(); };
$('#calPrev').onclick = () => { adm.m--; if (adm.m < 0) { adm.m = 11; adm.y--; } renderAll(); };
$('#calNext').onclick = () => { adm.m++; if (adm.m > 11) { adm.m = 0; adm.y++; } renderAll(); };

/* ===== Actions ===== */
const actions = {
  book(pid) { startBook(pid); },
  resched(id) { const r = reservations().find(x => x.id === id); resDialog(r, r.parlourId, 'resched'); },
  editRes(id) { const r = reservations().find(x => x.id === id); resDialog(r, r.parlourId, 'edit'); },
  addRes(date) { resDialog(null, adm.p, 'add', date); },
  cancel(id) { if (!confirm('Cancel this reservation?')) return; const l = reservations(); l.find(x => x.id === id).status = 'Cancelled'; set(K.res, l); toast('Reservation cancelled'); renderAll(); },
  complete(id) { const l = reservations(); l.find(x => x.id === id).status = 'Completed'; set(K.res, l); renderAll(); },
  markPaid(id) { const l = reservations(); const r = l.find(x => x.id === id); r.payStatus = 'Paid'; r.paid = r.price; set(K.res, l); toast('Marked as paid'); renderAll(); },
  payNow(id) {
    const r = reservations().find(x => x.id === id), p = parlour(r.parlourId), due = dueFor(p, r.price) - r.paid;
    showDlg(`<h2>Pay ${money(due)}</h2><form id="pnForm"><div><label>Gateway</label><select id="pnGw"><option>Stripe</option><option>PayPal</option></select></div><div><label>Card / PayPal email</label><input id="pnRef" required></div><br><button class="btn green">Pay now</button></form>`);
    $('#pnForm').onsubmit = ev => { ev.preventDefault(); const l = reservations(), x = l.find(y => y.id === id); x.paid += due; x.gateway = $('#pnGw').value; x.payStatus = p.policy === 'deposit' ? 'Deposit paid' : 'Paid'; set(K.res, l); $('#dlg').close(); toast('Payment received'); renderAll(); };
  },
  feedback(id) {
    showDlg(`<h2>Leave feedback</h2><form id="fbForm"><div><label>Rating</label><select id="fbRate"><option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></div><div><label>Your experience</label><textarea id="fbText" required></textarea></div><br><button class="btn">Submit</button></form>`);
    $('#fbForm').onsubmit = ev => { ev.preventDefault(); const l = reservations(); l.find(x => x.id === id).fb = { rating: +$('#fbRate').value, text: $('#fbText').value.trim() }; set(K.res, l); $('#dlg').close(); toast('Thank you for your feedback!'); renderAll(); };
  },
  sms(id) {
    const r = reservations().find(x => x.id === id);
    showDlg(`<h2>Send SMS to ${esc(r.custName)}</h2><p class="mut">📱 ${esc(r.custPhone)}</p><textarea id="smsText">Hi ${esc(r.custName)}, this is a reminder of your ${esc(svcName(r.serviceId))} appointment on ${r.date} at ${r.time}.</textarea><br><br><button class="btn" id="smsGo">Send SMS</button>`);
    $('#smsGo').onclick = () => { $('#dlg').close(); toast('SMS sent to ' + r.custPhone + ' (demo)'); };
  },
  call(id) { const r = reservations().find(x => x.id === id); showDlg(`<h2>Call ${esc(r.custName)}</h2><p>📞 <a href="tel:${esc(r.custPhone)}">${esc(r.custPhone)}</a></p><p class="mut">On a phone this link starts the call.</p>`); },
  toggleBlock(time) {
    const l = blocks(), i = l.findIndex(b => b.parlourId === adm.p && b.date === adm.day && b.time === time);
    if (i >= 0) l.splice(i, 1); else l.push({ id: uid(), parlourId: adm.p, date: adm.day, time }); set(K.blocks, l); renderAll();
  },
  delSvc(id) { set(K.svc, services().filter(s => s.id !== id)); renderAll(); },
  delSty(id) { set(K.sty, stylists().filter(s => s.id !== id)); renderAll(); }
};

/* ===== Render ===== */
const adm = { p: 'p1', day: today(), y: new Date().getFullYear(), m: new Date().getMonth() };
const payBadge = r => `<span class="badge ${r.payStatus === 'Paid' || r.payStatus === 'Deposit paid' ? '' : r.payStatus === 'Unpaid' ? 'warn' : 'wait'}">${esc(r.payStatus)}</span>`;
function adminButtons(r) {
  if (r.status !== 'Booked') return '';
  return `<button class="btn sm" data-act="editRes" data-id="${r.id}">Edit</button><button class="btn sm green" data-act="complete" data-id="${r.id}">Done</button><button class="btn sm red" data-act="cancel" data-id="${r.id}">Cancel</button>
    <button class="btn sm sec" data-act="sms" data-id="${r.id}">SMS</button><button class="btn sm sec" data-act="call" data-id="${r.id}">Call</button>${r.payStatus !== 'Paid' ? `<button class="btn sm sec" data-act="markPaid" data-id="${r.id}">Mark paid</button>` : ''}`;
}
function renderAll() {
  autoCancel(); renderParlours();
  if (!me) return;
  if (me.role === 'admin') renderAdmin(); else renderUser();
}
function renderUser() {
  $('#uName').textContent = me.name;
  const mine = reservations().filter(r => r.userId === me.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const up = mine.filter(r => r.status === 'Booked' && r.date >= today()), hist = mine.filter(r => !up.includes(r)).reverse();
  $('#upList').innerHTML = up.map(r => `<tr><td>${esc(parlour(r.parlourId).name)}</td><td>${esc(svcName(r.serviceId))}<br><span class="mut">${money(r.price)}</span></td><td>${esc(styName(r.stylistId))}</td><td>${when(r)}</td><td>${payBadge(r)}</td>
    <td><button class="btn sm" data-act="resched" data-id="${r.id}">Reschedule</button><button class="btn sm red" data-act="cancel" data-id="${r.id}">Cancel</button>${r.payStatus === 'Unpaid' || (r.payStatus === 'Pay at salon') ? `<button class="btn sm green" data-act="payNow" data-id="${r.id}">Pay now</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">No upcoming reservations.</td></tr>';
  $('#histList').innerHTML = hist.map(r => { const st = r.status === 'Booked' ? 'Visited' : r.status; return `<tr><td>${esc(parlour(r.parlourId).name)}</td><td>${esc(svcName(r.serviceId))}</td><td>${when(r)}</td><td><span class="badge ${st === 'Cancelled' ? 'warn' : ''}">${st}</span>${r.note ? '<br><span class="mut">' + esc(r.note) + '</span>' : ''}</td>
    <td>${r.fb ? '<span class="stars">' + '★'.repeat(r.fb.rating) + '</span> ' + esc(r.fb.text) : (st !== 'Cancelled' ? `<button class="btn sm" data-act="feedback" data-id="${r.id}">Leave feedback</button>` : '')}</td></tr>`; }).join('') || '<tr><td colspan="5" class="mut">No history yet.</td></tr>';
  if (!document.activeElement.closest('#profForm')) { $('#pName').value = me.name; $('#pEmail').value = me.email; $('#pPhone').value = me.phone || ''; }
}
function renderAdmin() {
  $('#admP').innerHTML = parlours().map(p => `<option value="${p.id}" ${p.id === adm.p ? 'selected' : ''}>${esc(p.name)} - ${esc(p.area)}</option>`).join('');
  const p = parlour(adm.p), all = reservations().filter(r => r.parlourId === adm.p);
  // calendar
  const first = new Date(adm.y, adm.m, 1), days = new Date(adm.y, adm.m + 1, 0).getDate();
  $('#calTitle').textContent = first.toLocaleString('en', { month: 'long', year: 'numeric' });
  let cells = '', row = '<tr>' + '<td class="off"></td>'.repeat(first.getDay());
  for (let d = 1; d <= days; d++) {
    const ds = adm.y + '-' + pad(adm.m + 1) + '-' + pad(d), n = all.filter(r => r.date === ds && r.status === 'Booked').length, locked = blocks().filter(b => b.parlourId === adm.p && b.date === ds).length;
    row += `<td data-day="${ds}" class="${ds === today() ? 'today' : ''} ${ds === adm.day ? 'sel' : ''}">${d}<br>${n ? `<span class="badge info">${n} appt</span>` : ''}${locked ? '<br><span class="badge wait">🔒' + locked + '</span>' : ''}</td>`;
    if ((first.getDay() + d) % 7 === 0) { cells += row + '</tr>'; row = '<tr>'; }
  }
  if (row !== '<tr>') cells += row + '</tr>';
  $('#calBody').innerHTML = cells;
  // day panel
  const dayRes = all.filter(r => r.date === adm.day).sort((a, b) => a.time.localeCompare(b.time));
  $('#dayPanel').innerHTML = `<h3>${adm.day}</h3><button class="btn sm" data-act="addRes" data-id="${adm.day}">+ Add reservation</button>
    <div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Time</th><th>Customer</th><th>Service / stylist</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>${dayRes.map(r => `<tr><td>${r.time}</td><td>${esc(r.custName)}<br><span class="mut">${esc(r.custPhone)}</span></td><td>${esc(svcName(r.serviceId))}<br><span class="mut">${esc(styName(r.stylistId))}</span></td><td>${payBadge(r)}</td><td><span class="badge ${r.status === 'Cancelled' ? 'warn' : ''}">${r.status}</span></td><td>${adminButtons(r)}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">No reservations on this date.</td></tr>'}</tbody></table></div>
    <h3 style="margin-top:14px">Lock unavailable hours</h3><p class="mut">Click an hour to lock / unlock it for all stylists (filled = locked).</p>
    <div class="slots">${HOURS.map(h => `<button class="slot ${blocks().some(b => b.parlourId === adm.p && b.date === adm.day && b.time === h) ? 'sel' : ''}" data-act="toggleBlock" data-id="${h}">${h}</button>`).join('')}</div>`;
  // upcoming
  const up = all.filter(r => r.status === 'Booked' && r.date >= today()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  $('#upAdmin').innerHTML = up.map(r => `<tr><td>${esc(r.custName)}<br><span class="mut">${esc(r.custPhone)}</span></td><td>${esc(svcName(r.serviceId))}<br><span class="mut">${esc(styName(r.stylistId))}</span></td><td>${when(r)}</td><td>${payBadge(r)}</td><td>${adminButtons(r)}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No upcoming reservations.</td></tr>';
  $('#svcList').innerHTML = services().filter(s => s.parlourId === adm.p).map(s => `<tr><td>${esc(s.name)}</td><td>${money(s.price)}</td><td><button class="btn sm red" data-act="delSvc" data-id="${s.id}">Delete</button></td></tr>`).join('');
  $('#styList').innerHTML = stylists().filter(s => s.parlourId === adm.p).map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.role)}</td><td>${s.exp} yrs</td><td><button class="btn sm red" data-act="delSty" data-id="${s.id}">Delete</button></td></tr>`).join('');
  if (!document.activeElement.closest('#setForm')) { $('#stPolicy').value = p.policy; $('#stDep').value = p.dep; $('#stAuto').value = p.autoMins; }
  $('#fbList').innerHTML = all.filter(r => r.fb).map(r => `<tr><td>${esc(r.custName)}</td><td>${esc(svcName(r.serviceId))}</td><td class="stars">${'★'.repeat(r.fb.rating)}</td><td>${esc(r.fb.text)}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">No feedback yet.</td></tr>';
}

setInterval(() => { if (autoCancel()) renderAll(); }, 30000);
go('home');
