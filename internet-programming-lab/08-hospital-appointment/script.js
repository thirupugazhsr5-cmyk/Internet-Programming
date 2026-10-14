/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => ymd(new Date());
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
const nowHM = () => pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
const money = n => '₹' + Number(n).toLocaleString('en-IN');
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }
const km = (a, b, c, d) => { const t = x => x * Math.PI / 180, dl = t(c - a), dn = t(d - b), h = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

/* ===== Data ===== */
const K = { users: 'hp_users', hosp: 'hp_hospitals', docs: 'hp_doctors', ap: 'hp_appts', rv: 'hp_reviews', me: 'hp_me' };
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
if (!get(K.users)) set(K.users, [
  { id: 'u0', name: 'System Admin', email: 'admin@med.com', phone: '9000000000', pass: 'admin123', role: 'admin' },
  { id: 'u1', name: 'Demo Patient', email: 'patient@med.com', phone: '9876543210', pass: 'patient123', role: 'user', age: 28, blood: 'B+' },
  { id: 'u2', name: 'MedCare Hospital Staff', email: 'hospital@med.com', phone: '9111111111', pass: 'hosp123', role: 'hospital', hospitalId: 'h1' }
]);
if (!get(K.hosp)) set(K.hosp, [
  { id: 'h1', name: 'MedCare Hospital', city: 'Chennai', area: 'T. Nagar', address: '45 Usman Road, T. Nagar, Chennai', phone: '044-24340001', lat: 13.0418, lng: 80.2341, about: '24x7 emergency, ICU, pharmacy and diagnostic lab.' },
  { id: 'h2', name: 'Sunrise Multispeciality Hospital', city: 'Chennai', area: 'Adyar', address: '12 Lattice Bridge Road, Adyar, Chennai', phone: '044-24410022', lat: 13.0067, lng: 80.2570, about: 'Advanced cardiac and orthopedic care.' },
  { id: 'h3', name: 'City Care Hospital', city: 'Bangalore', area: 'Indiranagar', address: '100 Feet Road, Indiranagar, Bangalore', phone: '080-25201234', lat: 12.9784, lng: 77.6408, about: 'Family care, maternity and paediatrics.' },
  { id: 'h4', name: 'Green Valley Clinic', city: 'Coimbatore', area: 'RS Puram', address: 'DB Road, RS Puram, Coimbatore', phone: '0422-2540099', lat: 11.0070, lng: 76.9500, about: 'Outpatient clinic with specialist doctors.' }
]);
if (!get(K.docs)) set(K.docs, [
  { id: 'd1', hospitalId: 'h1', name: 'Dr. Anitha Raman', spec: 'General Medicine', exp: 12, fee: 400 },
  { id: 'd2', hospitalId: 'h1', name: 'Dr. Karthik Subramanian', spec: 'Cardiology', exp: 15, fee: 900 },
  { id: 'd3', hospitalId: 'h1', name: 'Dr. Meena Iyer', spec: 'Dermatology', exp: 8, fee: 600 },
  { id: 'd4', hospitalId: 'h2', name: 'Dr. Rajesh Kumar', spec: 'Orthopedics', exp: 18, fee: 850 },
  { id: 'd5', hospitalId: 'h2', name: 'Dr. Lakshmi Narayanan', spec: 'Cardiology', exp: 10, fee: 800 },
  { id: 'd6', hospitalId: 'h3', name: 'Dr. Sneha Reddy', spec: 'Pediatrics', exp: 9, fee: 500 },
  { id: 'd7', hospitalId: 'h3', name: 'Dr. Arjun Menon', spec: 'ENT', exp: 11, fee: 550 },
  { id: 'd8', hospitalId: 'h4', name: 'Dr. Vimala Devi', spec: 'Gynecology', exp: 14, fee: 650 },
  { id: 'd9', hospitalId: 'h4', name: 'Dr. Suresh Babu', spec: 'General Medicine', exp: 6, fee: 300 }
]);
if (!get(K.ap)) set(K.ap, []);
if (!get(K.rv)) set(K.rv, []);

let me = get(K.me, null), userPos = null;
const users = () => get(K.users, []), hospitals = () => get(K.hosp, []), doctors = () => get(K.docs, []), appts = () => get(K.ap, []), reviews = () => get(K.rv, []);
const hospOf = id => hospitals().find(h => h.id === id) || { name: '(removed)', city: '', area: '', address: '' };
const docOf = id => doctors().find(d => d.id === id) || { name: '(removed)', spec: '', fee: 0 };
const userName = id => (users().find(u => u.id === id) || { name: '?' }).name;
const rating = did => { const r = reviews().filter(x => x.doctorId === did); return { n: r.length, avg: r.length ? r.reduce((s, x) => s + x.rating, 0) / r.length : 0 }; };
const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const mapQ = h => h.lat !== '' && h.lat != null && h.lng !== '' && h.lng != null ? h.lat + ',' + h.lng : h.address + ' ' + h.city;

function slotFree(did, date, time, ignoreId) {
  if (!date || date < today() || (date === today() && time <= nowHM())) return false;
  return !appts().some(a => a.id !== ignoreId && a.doctorId === did && a.date === date && a.time === time && a.status !== 'Cancelled');
}
function drawSlots(box, did, date, sel, ignoreId, pick) {
  box.innerHTML = SLOTS.map(t => `<button type="button" class="slot ${t === sel ? 'sel' : ''}" data-time="${t}" ${slotFree(did, date, t, ignoreId) || t === sel ? '' : 'disabled'}>${t}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('[data-time]'); if (b && !b.disabled) pick(b.dataset.time); };
}

/* ===== Navigation ===== */
const role = () => me ? me.role : 'guest';
function renderNav() { $$('[data-for]').forEach(b => b.classList.toggle('hidden', !b.dataset.for.split(',').includes(role()))); }
function go(v) {
  if (v === 'dash') v = me ? (me.role === 'user' ? 'user' : 'admin') : 'login';
  $$('.view').forEach(e => e.classList.toggle('hidden', e.id !== 'v-' + v));
  renderNav(); renderAll();
  if (v === 'admin') { const first = $$('#admTabs button').find(b => !b.classList.contains('hidden')); if (first) first.click(); }
  window.scrollTo(0, 0);
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
let pendingBook = null;
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name);
  if (pendingBook && u.role === 'user') { const p = pendingBook; pendingBook = null; return startBook(p.hid, p.did); }
  go('dash');
};
$('#rRole').onchange = () => { const h = $('#rRole').value === 'hospital'; $('#hospFields').classList.toggle('hidden', !h); ['rHName', 'rHCity', 'rHArea', 'rHAddr'].forEach(id => $('#' + id).required = h); $('#rNameLbl').textContent = h ? 'Contact person name' : 'Full name'; };
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const email = $('#rEmail').value.trim().toLowerCase();
  if (users().some(u => u.email.toLowerCase() === email)) return toast('Email already registered');
  const l = users(), u = { id: uid(), name: $('#rName').value.trim(), email, phone: $('#rPhone').value, pass: $('#rPass').value, role: $('#rRole').value };
  if (u.role === 'hospital') {
    const hs = hospitals(), h = { id: uid(), name: $('#rHName').value.trim(), city: $('#rHCity').value.trim(), area: $('#rHArea').value.trim(), address: $('#rHAddr').value.trim(), phone: $('#rPhone').value, lat: '', lng: '', about: '' };
    hs.push(h); set(K.hosp, hs); u.hospitalId = h.id;
  }
  l.push(u); set(K.users, l); e.target.reset(); $('#rRole').onchange(); toast('Registered! Please login.'); go('login');
};
$('#profForm').onsubmit = e => {
  e.preventDefault();
  const l = users(), u = l.find(x => x.id === me.id);
  Object.assign(u, { name: $('#pName').value.trim(), phone: $('#pPhone').value, age: $('#pAge').value, blood: $('#pBlood').value }); if ($('#pPass').value) u.pass = $('#pPass').value;
  set(K.users, l); me = u; set(K.me, u); $('#pPass').value = ''; toast('Details updated'); renderAll();
};

/* ===== Search (location wise) ===== */
['qLoc', 'qSpec', 'qName'].forEach(id => $('#' + id).addEventListener('input', renderHome));
$('#nearMe').onclick = () => {
  if (!navigator.geolocation) return toast('Location not supported in this browser');
  navigator.geolocation.getCurrentPosition(p => { userPos = { lat: p.coords.latitude, lng: p.coords.longitude }; toast('Showing hospitals nearest to you'); renderHome(); }, () => toast('Could not get your location'));
};
function renderHome() {
  const specs = [...new Set(doctors().map(d => d.spec))].sort(), cur = $('#qSpec').value;
  $('#qSpec').innerHTML = '<option value="">All specialties</option>' + specs.map(s => `<option>${esc(s)}</option>`).join(''); $('#qSpec').value = cur;
  const loc = $('#qLoc').value.toLowerCase().trim(), spec = $('#qSpec').value, name = $('#qName').value.toLowerCase().trim();
  const inLoc = h => !loc || (h.city + ' ' + h.area + ' ' + h.address).toLowerCase().includes(loc);
  let hs = hospitals().filter(h => inLoc(h) && (!spec || doctors().some(d => d.hospitalId === h.id && d.spec === spec)) && (!name || (h.name + ' ' + doctors().filter(d => d.hospitalId === h.id).map(d => d.name).join(' ')).toLowerCase().includes(name)));
  const dist = h => userPos && h.lat !== '' ? km(userPos.lat, userPos.lng, +h.lat, +h.lng) : null;
  if (userPos) hs = hs.sort((a, b) => (dist(a) ?? 1e9) - (dist(b) ?? 1e9));
  $('#hospGrid').innerHTML = hs.map(h => `<div class="card"><div class="emoji">🏥</div><h3>${esc(h.name)}</h3><p class="mut">📍 ${esc(h.area)}, ${esc(h.city)}${dist(h) != null ? ' · ' + dist(h).toFixed(1) + ' km away' : ''}<br>📞 ${esc(h.phone)}</p>
    <p class="mut">${[...new Set(doctors().filter(d => d.hospitalId === h.id).map(d => d.spec))].map(esc).join(' · ') || 'No doctors listed yet'}</p>
    <button class="btn sm sec" data-act="hospInfo" data-id="${h.id}">Details &amp; map</button><button class="btn sm" data-act="bookHosp" data-id="${h.id}">Book</button></div>`).join('') || '<p class="mut">No hospitals found for that search.</p>';
  const ds = doctors().filter(d => { const h = hospOf(d.hospitalId); return inLoc(h) && (!spec || d.spec === spec) && (!name || (d.name + ' ' + h.name).toLowerCase().includes(name)); }).sort((a, b) => rating(b.id).avg - rating(a.id).avg);
  $('#docGrid').innerHTML = ds.map(d => { const r = rating(d.id), h = hospOf(d.hospitalId); return `<div class="card"><div class="emoji">👨‍⚕️</div><h3>${esc(d.name)}</h3><p class="mut">${esc(d.spec)} · ${d.exp} yrs<br>${esc(h.name)}, ${esc(h.area)}</p>
    <p><span class="stars">${r.n ? stars(r.avg) : '☆☆☆☆☆'}</span> <span class="mut">${r.n ? r.avg.toFixed(1) + ' (' + r.n + ')' : 'No reviews'}</span><br><span class="price">${money(d.fee)}</span></p>
    <button class="btn sm sec" data-act="reviews" data-id="${d.id}">Reviews</button><button class="btn sm" data-act="bookDoc" data-id="${d.id}">Book</button></div>`; }).join('') || '<p class="mut">No doctors found.</p>';
}

/* ===== Book ===== */
let sel = '';
function startBook(hid, did) {
  if (!me) { pendingBook = { hid, did }; toast('Please login to book'); return go('login'); }
  if (me.role !== 'user') return toast('Only patients can book appointments');
  sel = '';
  $('#bHosp').innerHTML = hospitals().map(h => `<option value="${h.id}">${esc(h.name)} - ${esc(h.area)}, ${esc(h.city)}</option>`).join('');
  $('#bHosp').value = hid || hospOf(docOf(did).hospitalId).id || hospitals()[0].id; fillDocs(did);
  $('#bDate').min = today(); $('#bDate').value = today(); $('#bName').value = me.name; $('#bPhone').value = me.phone || ''; $('#bReason').value = '';
  go('book'); updateSlots();
}
function fillDocs(pick) {
  const ds = doctors().filter(d => d.hospitalId === $('#bHosp').value);
  $('#bDoc').innerHTML = ds.map(d => `<option value="${d.id}">${esc(d.name)} - ${esc(d.spec)}</option>`).join('') || '<option value="">No doctors available</option>';
  if (pick && ds.some(d => d.id === pick)) $('#bDoc').value = pick;
}
function updateSlots() {
  const d = doctors().find(x => x.id === $('#bDoc').value);
  $('#bDocInfo').textContent = d ? `${d.spec} · ${d.exp} yrs experience · Fee ${money(d.fee)}` : '';
  drawSlots($('#bSlots'), $('#bDoc').value, $('#bDate').value, sel, null, t => { sel = t; updateSlots(); });
}
$('#bHosp').onchange = () => { fillDocs(); sel = ''; updateSlots(); };
$('#bDoc').onchange = $('#bDate').onchange = () => { sel = ''; updateSlots(); };
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  if (!$('#bDoc').value) return toast('This hospital has no doctors yet');
  if (!sel) return toast('Please choose a time slot');
  if (!slotFree($('#bDoc').value, $('#bDate').value, sel)) { sel = ''; updateSlots(); return toast('Slot just got booked, pick another'); }
  const a = { id: 'AP' + Math.floor(10000 + Math.random() * 90000), userId: me.id, patientName: $('#bName').value.trim(), phone: $('#bPhone').value, hospitalId: $('#bHosp').value, doctorId: $('#bDoc').value, date: $('#bDate').value, time: sel, reason: $('#bReason').value.trim(), status: 'Pending', checkin: null, created: today() };
  const l = appts(); l.push(a); set(K.ap, l);
  showDlg(`<h2>✅ Appointment requested</h2><div class="ticket"><b>${a.id}</b><br>${esc(docOf(a.doctorId).name)} · ${esc(hospOf(a.hospitalId).name)}<br>${a.date} at ${a.time}<br>Status: <b>Pending confirmation</b></div><p class="mut">Reminder will be sent by email/SMS before your visit (demo). Track the status in your dashboard.</p>`);
  go('dash');
};

/* ===== Actions ===== */
const actions = {
  bookHosp(id) { startBook(id); },
  bookDoc(id) { startBook(docOf(id).hospitalId, id); },
  hospInfo(id) {
    const h = hospOf(id), q = encodeURIComponent(mapQ(h));
    showDlg(`<h2>${esc(h.name)}</h2><p>📍 ${esc(h.address)}<br>📞 ${esc(h.phone)}</p><p>${esc(h.about || '')}</p>
      <h3>Doctors</h3>${doctors().filter(d => d.hospitalId === id).map(d => `<p>${esc(d.name)} <span class="mut">${esc(d.spec)} · ${money(d.fee)}</span></p>`).join('') || '<p class="mut">No doctors listed.</p>'}
      <iframe title="map" src="https://maps.google.com/maps?q=${q}&z=15&output=embed" style="width:100%;height:240px;border:0;border-radius:8px;margin-top:8px" loading="lazy"></iframe>
      <p><a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Open in Google Maps ↗</a></p>`);
  },
  reviews(id) {
    const d = docOf(id), list = reviews().filter(r => r.doctorId === id).reverse();
    showDlg(`<h2>${esc(d.name)}</h2>${list.map(r => `<p><span class="stars">${stars(r.rating)}</span> <b>${esc(userName(r.userId))}</b> <span class="mut">${r.date}</span><br>${esc(r.text)}</p><hr>`).join('') || '<p class="mut">No reviews yet.</p>'}`);
  },
  cancel(id) { if (!confirm('Cancel this appointment?')) return; setStatus(id, 'Cancelled'); toast('Appointment cancelled'); },
  confirm(id) { setStatus(id, 'Confirmed'); toast('Appointment confirmed'); },
  complete(id) { setStatus(id, 'Completed'); toast('Marked completed'); },
  map(id) { actions.hospInfo(appts().find(a => a.id === id).hospitalId); },
  resched(id) {
    const a = appts().find(x => x.id === id); let s = a.time;
    showDlg(`<h2>Reschedule ${id}</h2><form id="rsForm"><div><label>Date</label><input type="date" id="rsDate" min="${today()}" value="${a.date}" required></div><label>Time</label><div class="slots" id="rsSlots"></div><br><button class="btn">Save</button></form>`);
    const redraw = () => drawSlots($('#rsSlots'), a.doctorId, $('#rsDate').value, s, id, t => { s = t; redraw(); });
    $('#rsDate').onchange = () => { s = ''; redraw(); }; redraw();
    $('#rsForm').onsubmit = ev => { ev.preventDefault(); if (!s || !slotFree(a.doctorId, $('#rsDate').value, s, id)) return toast('Choose an available slot'); const l = appts(), x = l.find(y => y.id === id); x.date = $('#rsDate').value; x.time = s; x.status = 'Pending'; set(K.ap, l); $('#dlg').close(); toast('Rescheduled - awaiting confirmation'); renderAll(); };
  },
  checkin(id) {
    const a = appts().find(x => x.id === id), c = a.checkin || {};
    showDlg(`<h2>Check-in form · ${id}</h2><form id="ciForm"><div><label>Symptoms</label><textarea id="ciSym" required>${esc(c.symptoms || a.reason)}</textarea></div><div><label>Current medications</label><input id="ciMed" value="${esc(c.meds || '')}"></div>
      <div><label>Known allergies</label><input id="ciAll" value="${esc(c.allergies || '')}"></div><div><label>Insurance / ID number (optional)</label><input id="ciIns" value="${esc(c.insurance || '')}"></div><br><button class="btn">Submit check-in</button></form>`);
    $('#ciForm').onsubmit = ev => { ev.preventDefault(); const l = appts(); l.find(x => x.id === id).checkin = { symptoms: $('#ciSym').value.trim(), meds: $('#ciMed').value.trim(), allergies: $('#ciAll').value.trim(), insurance: $('#ciIns').value.trim(), at: new Date().toLocaleString() }; set(K.ap, l); $('#dlg').close(); toast('Check-in submitted'); renderAll(); };
  },
  review(id) {
    const a = appts().find(x => x.id === id);
    showDlg(`<h2>Review ${esc(docOf(a.doctorId).name)}</h2><form id="rvForm"><div><label>Rating</label><select id="rvRate"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select></div><div><label>Your review</label><textarea id="rvText" required></textarea></div><br><button class="btn">Submit review</button></form>`);
    $('#rvForm').onsubmit = ev => { ev.preventDefault(); const l = reviews(); l.push({ id: uid(), apptId: id, doctorId: a.doctorId, userId: me.id, rating: +$('#rvRate').value, text: $('#rvText').value.trim(), date: today() }); set(K.rv, l); $('#dlg').close(); toast('Thanks for your review!'); renderAll(); };
  },
  editDoc(id) { const d = docOf(id); $('#dId').value = id; $('#dName').value = d.name; $('#dSpec').value = d.spec; $('#dExp').value = d.exp; $('#dFee').value = d.fee; $('#docTitle').textContent = 'Update doctor'; window.scrollTo(0, 0); },
  delDoc(id) { if (!confirm('Delete this doctor?')) return; set(K.docs, doctors().filter(d => d.id !== id)); renderAll(); }
};
function setStatus(id, s) { const l = appts(); l.find(a => a.id === id).status = s; set(K.ap, l); renderAll(); }

/* ===== Hospital / admin forms ===== */
const adm = { h: '' };
const scopeHid = () => me.role === 'hospital' ? me.hospitalId : adm.h;
$('#admH').onchange = () => { adm.h = $('#admH').value; renderAll(); };
$('#hGeo').onclick = () => {
  if (!navigator.geolocation) return toast('Location not supported');
  navigator.geolocation.getCurrentPosition(p => { $('#hLat').value = p.coords.latitude.toFixed(6); $('#hLng').value = p.coords.longitude.toFixed(6); toast('Location filled - click Save'); }, () => toast('Could not get location'));
};
$('#hospForm').onsubmit = e => {
  e.preventDefault();
  const l = hospitals(), h = l.find(x => x.id === me.hospitalId);
  Object.assign(h, { name: $('#hName').value.trim(), phone: $('#hPhone').value.trim(), city: $('#hCity').value.trim(), area: $('#hArea').value.trim(), address: $('#hAddr').value.trim(), about: $('#hAbout').value.trim(), lat: $('#hLat').value === '' ? '' : +$('#hLat').value, lng: $('#hLng').value === '' ? '' : +$('#hLng').value });
  set(K.hosp, l); toast('Hospital details & location saved'); renderAll();
};
function clearDoc() { $('#docForm').reset(); $('#dId').value = ''; $('#docTitle').textContent = 'Add doctor'; }
$('#docClear').onclick = clearDoc;
$('#docForm').onsubmit = e => {
  e.preventDefault();
  const hid = scopeHid(); if (!hid) return toast('Select a hospital first (top of page)');
  const l = doctors(), id = $('#dId').value, d = { name: $('#dName').value.trim(), spec: $('#dSpec').value.trim(), exp: +$('#dExp').value || 0, fee: +$('#dFee').value || 0 };
  if (id) Object.assign(l.find(x => x.id === id), d); else l.push({ id: uid(), hospitalId: hid, ...d });
  set(K.docs, l); toast(id ? 'Doctor updated' : 'Doctor added'); clearDoc(); renderAll();
};

/* ===== Render ===== */
const statusBadge = s => `<span class="badge ${s === 'Confirmed' || s === 'Completed' ? '' : s === 'Cancelled' ? 'warn' : 'wait'}">${s}</span>`;
function renderAll() {
  renderHome();
  if (!me) return;
  if (me.role === 'user') renderUser(); else renderPanel();
}
function renderUser() {
  $('#uName').textContent = me.name;
  const mine = appts().filter(a => a.userId === me.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const up = mine.filter(a => (a.status === 'Pending' || a.status === 'Confirmed') && a.date >= today()), hist = mine.filter(a => !up.includes(a)).reverse();
  const soon = up.filter(a => a.date === today() || a.date === tomorrow());
  $('#reminder').innerHTML = soon.map(a => `<div class="card" style="background:#ecfdf5">⏰ <b>Reminder:</b> ${esc(docOf(a.doctorId).name)} at ${esc(hospOf(a.hospitalId).name)} — ${a.date === today() ? 'today' : 'tomorrow'} at ${a.time}</div>`).join('');
  $('#upList').innerHTML = up.map(a => `<tr><td>${a.id}</td><td>${esc(hospOf(a.hospitalId).name)}<br><span class="mut">${esc(docOf(a.doctorId).name)} · ${esc(docOf(a.doctorId).spec)}</span></td><td>${a.date}<br>${a.time}</td><td>${statusBadge(a.status)}${a.checkin ? '<br><span class="mut">✔ checked-in</span>' : ''}</td>
    <td><button class="btn sm sec" data-act="map" data-id="${a.id}">Map</button><button class="btn sm" data-act="checkin" data-id="${a.id}">Check-in</button><button class="btn sm sec" data-act="resched" data-id="${a.id}">Reschedule</button><button class="btn sm red" data-act="cancel" data-id="${a.id}">Cancel</button></td></tr>`).join('') || '<tr><td colspan="5" class="mut">No upcoming appointments. Search a hospital to book one.</td></tr>';
  $('#histList').innerHTML = hist.map(a => `<tr><td>${a.id}</td><td>${esc(hospOf(a.hospitalId).name)}<br><span class="mut">${esc(docOf(a.doctorId).name)}</span></td><td>${a.date} ${a.time}</td><td>${statusBadge(a.status)}</td>
    <td>${a.checkin ? esc(a.checkin.symptoms) : '-'}</td><td>${reviews().some(r => r.apptId === a.id) ? '<span class="stars">★</span> reviewed' : (a.status === 'Completed' ? `<button class="btn sm" data-act="review" data-id="${a.id}">Write review</button>` : '')}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">No past appointments.</td></tr>';
  if (!document.activeElement.closest('#profForm')) { $('#pName').value = me.name; $('#pEmail').value = me.email; $('#pPhone').value = me.phone || ''; $('#pAge').value = me.age || ''; $('#pBlood').value = me.blood || ''; }
}
function renderPanel() {
  const isH = me.role === 'hospital';
  $('#admTitle').textContent = isH ? hospOf(me.hospitalId).name + ' - Hospital panel' : 'Admin panel';
  $('#admScope').classList.toggle('hidden', isH);
  $('#admH').innerHTML = '<option value="">All hospitals</option>' + hospitals().map(h => `<option value="${h.id}" ${h.id === adm.h ? 'selected' : ''}>${esc(h.name)}</option>`).join('');
  $$('#admTabs [data-only]').forEach(b => b.classList.toggle('hidden', !!b.dataset.only && b.dataset.only !== me.role));
  const hid = scopeHid(), inScope = x => !hid || x.hospitalId === hid;
  if (isH && !document.activeElement.closest('#hospForm')) { const h = hospOf(me.hospitalId); $('#hName').value = h.name; $('#hPhone').value = h.phone || ''; $('#hCity').value = h.city; $('#hArea').value = h.area; $('#hAddr').value = h.address; $('#hAbout').value = h.about || ''; $('#hLat').value = h.lat ?? ''; $('#hLng').value = h.lng ?? ''; }
  // appointments
  $('#apAdmin').innerHTML = appts().filter(inScope).slice().reverse().map(a => `<tr><td>${a.id}</td><td>${esc(a.patientName)}<br><span class="mut">${esc(a.phone)}</span></td><td>${esc(docOf(a.doctorId).name)}<br><span class="mut">${esc(hospOf(a.hospitalId).name)}</span></td><td>${a.date}<br>${a.time}</td>
    <td>${esc(a.reason)}${a.checkin ? `<br><span class="mut">Check-in: ${esc(a.checkin.symptoms)}; meds: ${esc(a.checkin.meds || '-')}; allergies: ${esc(a.checkin.allergies || '-')}</span>` : ''}</td><td>${statusBadge(a.status)}</td>
    <td>${a.status === 'Pending' ? `<button class="btn sm green" data-act="confirm" data-id="${a.id}">Confirm</button>` : ''}${a.status === 'Confirmed' ? `<button class="btn sm" data-act="complete" data-id="${a.id}">Complete</button>` : ''}${a.status === 'Pending' || a.status === 'Confirmed' ? `<button class="btn sm red" data-act="cancel" data-id="${a.id}">Cancel</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">No appointments.</td></tr>';
  // doctors
  $('#docAdmin').innerHTML = doctors().filter(inScope).map(d => `<tr><td>${esc(d.name)}</td><td>${esc(d.spec)}</td><td>${esc(hospOf(d.hospitalId).name)}</td><td>${d.exp} yrs</td><td>${money(d.fee)}</td><td><button class="btn sm" data-act="editDoc" data-id="${d.id}">Edit</button><button class="btn sm red" data-act="delDoc" data-id="${d.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="mut">No doctors.</td></tr>';
  // statistics (admin)
  const all = appts(), by = s => all.filter(a => a.status === s).length;
  $('#statCards').innerHTML = [['Patients', users().filter(u => u.role === 'user').length], ['Hospitals', hospitals().length], ['Doctors', doctors().length], ['Appointments', all.length], ['Pending', by('Pending')], ['Confirmed', by('Confirmed')], ['Completed', by('Completed')], ['Cancelled', by('Cancelled')]].map(([a, b]) => `<div class="card stat"><span class="mut">${a}</span><b>${b}</b></div>`).join('');
  const max = Math.max(1, ...hospitals().map(h => all.filter(a => a.hospitalId === h.id).length));
  $('#statBars').innerHTML = hospitals().map(h => { const n = all.filter(a => a.hospitalId === h.id).length; return `<p>${esc(h.name)} <b>${n}</b></p><div style="background:#e5e7eb;border-radius:4px;margin-bottom:8px"><div style="background:var(--a);height:14px;border-radius:4px;width:${n / max * 100}%"></div></div>`; }).join('');
  // ratings
  $('#rateList').innerHTML = doctors().filter(inScope).map(d => { const r = rating(d.id); return `<tr><td>${esc(d.name)}<br><span class="mut">${esc(d.spec)}</span></td><td>${esc(hospOf(d.hospitalId).name)}</td><td><span class="stars">${r.n ? stars(r.avg) : '-'}</span> ${r.n ? r.avg.toFixed(1) : ''}</td><td>${r.n}</td></tr>`; }).join('');
  $('#reviewList').innerHTML = '<h3>Latest reviews</h3>' + (reviews().filter(r => inScope(docOf(r.doctorId))).slice().reverse().map(r => `<p><span class="stars">${stars(r.rating)}</span> <b>${esc(docOf(r.doctorId).name)}</b> · ${esc(userName(r.userId))} <span class="mut">${r.date}</span><br>${esc(r.text)}</p><hr>`).join('') || '<p class="mut">No reviews yet.</p>');
}

go('home');
