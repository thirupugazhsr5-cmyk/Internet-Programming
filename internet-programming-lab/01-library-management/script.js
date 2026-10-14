/* ===== Helpers ===== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }
function showDlg(html) { $('#dlgBody').innerHTML = html; $('#dlg').showModal(); }

/* ===== Data ===== */
const K = { b: 'lib_books', u: 'lib_users', i: 'lib_issues', m: 'lib_mats', me: 'lib_me', msg: 'lib_msgs' };
const RATE = 2; // fine per late day (₹)
if (!get(K.b)) set(K.b, [
  { id: 'b1', title: 'Data Structures Using C', author: 'Reema Thareja', isbn: '9780198099307', copies: 4, avail: 4 },
  { id: 'b2', title: 'Database System Concepts', author: 'Silberschatz', isbn: '9780078022159', copies: 3, avail: 3 },
  { id: 'b3', title: 'Computer Networks', author: 'Andrew Tanenbaum', isbn: '9780132126953', copies: 2, avail: 2 },
  { id: 'b4', title: 'Operating System Concepts', author: 'Galvin', isbn: '9781118063330', copies: 5, avail: 5 },
  { id: 'b5', title: 'Introduction to Algorithms', author: 'Cormen', isbn: '9780262033848', copies: 2, avail: 2 }
]);
if (!get(K.u)) set(K.u, [
  { id: 'u0', name: 'Librarian', email: 'admin@lib.com', pass: 'admin123', role: 'admin' },
  { id: 'u1', name: 'Demo Student', email: 'student@lib.com', pass: 'student123', role: 'user', phone: '9876543210', year: '2', sem: '3' }
]);
if (!get(K.m)) set(K.m, [
  { id: 'm1', title: 'DBMS Unit 1 Notes', year: '2', sem: '3', text: 'DBMS Unit 1\n- Data models\n- ER diagrams\n- Relational algebra' },
  { id: 'm2', title: 'Computer Networks Notes', year: '3', sem: '5', text: 'OSI model\nTCP/IP\nRouting algorithms' }
]);
if (!get(K.i)) set(K.i, []);

let me = get(K.me, null);
const books = () => get(K.b, []), users = () => get(K.u, []), issues = () => get(K.i, []), mats = () => get(K.m, []);
const bookName = id => (books().find(b => b.id === id) || { title: '(deleted book)' }).title;
const userName = id => (users().find(u => u.id === id) || { name: '?' }).name;
const liveFine = i => Math.max(0, daysBetween(i.due, today())) * RATE;
const fineOf = i => i.paid ? 0 : (i.fine != null ? i.fine : (i.returned ? 0 : liveFine(i)));

/* ===== Navigation ===== */
function role() { return me ? me.role : 'guest'; }
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
    v.querySelectorAll('.tab').forEach(p => p.classList.toggle('hidden', p.id !== t.dataset.tab));
  }
  const a = e.target.closest('[data-act]'); if (a && actions[a.dataset.act]) actions[a.dataset.act](a.dataset.id);
});
$('#logout').onclick = () => { me = null; localStorage.removeItem(K.me); toast('Logged out'); go('catalog'); };

/* ===== Auth ===== */
$('#loginForm').onsubmit = e => {
  e.preventDefault();
  const u = users().find(x => x.email.toLowerCase() === $('#lEmail').value.trim().toLowerCase() && x.pass === $('#lPass').value);
  if (!u) return toast('Invalid email or password');
  me = u; set(K.me, u); e.target.reset(); toast('Welcome ' + u.name); go('dash');
};
$('#regForm').onsubmit = e => {
  e.preventDefault();
  const email = $('#rEmail').value.trim().toLowerCase();
  if (users().some(u => u.email.toLowerCase() === email)) return toast('Email already registered');
  const list = users();
  list.push({ id: uid(), name: $('#rName').value.trim(), email, phone: $('#rPhone').value, year: $('#rYear').value, sem: $('#rSem').value, pass: $('#rPass').value, role: 'user' });
  set(K.u, list); e.target.reset(); toast('Registered! Please login.'); go('login');
};
$('#contactForm').onsubmit = e => {
  e.preventDefault();
  const list = get(K.msg, []); list.push({ id: uid(), name: $('#cName').value, email: $('#cEmail').value, msg: $('#cMsg').value, date: today() });
  set(K.msg, list); e.target.reset(); toast('Message sent. Thank you!');
};

/* ===== Catalog ===== */
$('#q').oninput = renderCatalog;
function renderCatalog() {
  const q = $('#q').value.toLowerCase();
  const list = books().filter(b => [b.title, b.author, b.isbn].join(' ').toLowerCase().includes(q));
  $('#bookGrid').innerHTML = list.map(b => `<div class="card"><h3>${esc(b.title)}</h3>
    <p class="mut">${esc(b.author)}<br>ISBN: ${esc(b.isbn)}</p>
    <p><span class="badge ${b.avail ? '' : 'warn'}">${b.avail ? b.avail + ' available' : 'Not available'}</span></p>
    <button class="btn sm" data-act="detail" data-id="${b.id}">Details</button></div>`).join('') || '<p class="mut">No books found.</p>';
}

/* ===== Admin: books ===== */
$('#bookForm').onsubmit = e => {
  e.preventDefault();
  const list = books(), id = $('#bId').value, copies = +$('#bCopies').value;
  const data = { title: $('#bTitle').value.trim(), author: $('#bAuthor').value.trim(), isbn: $('#bIsbn').value.trim(), copies };
  if (id) {
    const b = list.find(x => x.id === id);
    b.avail = Math.max(0, b.avail + (copies - b.copies)); Object.assign(b, data); toast('Book updated');
  } else { list.push({ id: uid(), ...data, avail: copies }); toast('Book added'); }
  set(K.b, list); clearBookForm(); renderAll();
};
function clearBookForm() { $('#bookForm').reset(); $('#bId').value = ''; $('#bookFormTitle').textContent = 'Add Book'; }
$('#bCancel').onclick = clearBookForm;

/* ===== Admin: issue ===== */
$('#issueForm').onsubmit = e => {
  e.preventDefault();
  const list = books(), b = list.find(x => x.id === $('#iBook').value);
  if (!b || b.avail < 1) return toast('Book not available');
  if (!$('#iUser').value) return toast('Select a student');
  b.avail--; set(K.b, list);
  const is = issues(); const d = today();
  is.push({ id: uid(), bookId: b.id, userId: $('#iUser').value, issued: d, due: addDays(d, +$('#iDays').value || 14), returned: null, fine: null, paid: false });
  set(K.i, is); toast('Book issued'); renderAll();
};

/* ===== Admin: material ===== */
$('#matForm').onsubmit = e => {
  e.preventDefault();
  const list = mats(); list.push({ id: uid(), title: $('#mTitle').value.trim(), year: $('#mYear').value, sem: $('#mSem').value, text: $('#mText').value });
  set(K.m, list); e.target.reset(); toast('Material added'); renderAll();
};

/* ===== Profile ===== */
$('#profForm').onsubmit = e => {
  e.preventDefault();
  const list = users(), u = list.find(x => x.id === me.id);
  u.name = $('#pName').value.trim(); u.phone = $('#pPhone').value; u.year = $('#pYear').value; u.sem = $('#pSem').value;
  if ($('#pPass').value) u.pass = $('#pPass').value;
  set(K.u, list); me = u; set(K.me, u); $('#pPass').value = ''; toast('Profile saved'); renderAll();
};

/* ===== Table button actions ===== */
const actions = {
  detail(id) {
    const b = books().find(x => x.id === id);
    showDlg(`<h2>${esc(b.title)}</h2><p><b>Author:</b> ${esc(b.author)}</p><p><b>ISBN:</b> ${esc(b.isbn)}</p>
      <p><b>Total copies:</b> ${b.copies}</p><p><b>Available:</b> ${b.avail}</p>`);
  },
  editBook(id) {
    const b = books().find(x => x.id === id);
    $('#bId').value = b.id; $('#bTitle').value = b.title; $('#bAuthor').value = b.author; $('#bIsbn').value = b.isbn; $('#bCopies').value = b.copies;
    $('#bookFormTitle').textContent = 'Update Book'; window.scrollTo(0, 0);
  },
  delBook(id) {
    if (issues().some(i => i.bookId === id && !i.returned)) return toast('Cannot delete: book is currently issued');
    if (!confirm('Delete this book?')) return;
    set(K.b, books().filter(b => b.id !== id)); toast('Book deleted'); renderAll();
  },
  returnBook(id) {
    const is = issues(), i = is.find(x => x.id === id);
    i.returned = today();
    if (i.fine == null) i.fine = Math.max(0, daysBetween(i.due, i.returned)) * RATE;
    set(K.i, is);
    const bs = books(), b = bs.find(x => x.id === i.bookId); if (b) { b.avail = Math.min(b.copies, b.avail + 1); set(K.b, bs); }
    toast(i.fine ? 'Returned. Fine ₹' + i.fine : 'Book returned on time'); renderAll();
  },
  makeFine(id) {
    const is = issues(), i = is.find(x => x.id === id);
    const v = prompt('Enter fine amount (₹):', fineOf(i)); if (v === null) return;
    if (isNaN(+v) || +v < 0) return toast('Invalid amount');
    i.fine = +v; set(K.i, is); toast('Fine set to ₹' + v); renderAll();
  },
  payFine(id) { const is = issues(), i = is.find(x => x.id === id); i.paid = true; set(K.i, is); toast('Fine marked as paid'); renderAll(); },
  delMat(id) { set(K.m, mats().filter(m => m.id !== id)); toast('Material deleted'); renderAll(); },
  viewMat(id) { const m = mats().find(x => x.id === id); showDlg(`<h2>${esc(m.title)}</h2><p class="mut">Year ${m.year} · Semester ${m.sem}</p><pre style="white-space:pre-wrap;margin-top:10px">${esc(m.text)}</pre>`); },
  dlMat(id) {
    const m = mats().find(x => x.id === id);
    const blob = new Blob([m.title + '\nYear ' + m.year + ', Semester ' + m.sem + '\n\n' + m.text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m.title.replace(/\W+/g, '_') + '.txt'; a.click(); URL.revokeObjectURL(a.href);
  }
};

/* ===== Rendering ===== */
function renderAll() {
  renderCatalog();
  if (!me) return;
  if (me.role === 'admin') {
    $('#adminBooks').innerHTML = books().map(b => `<tr><td>${esc(b.title)}</td><td>${esc(b.author)}</td><td>${esc(b.isbn)}</td><td>${b.avail} / ${b.copies}</td>
      <td><button class="btn sm" data-act="editBook" data-id="${b.id}">Edit</button><button class="btn sm red" data-act="delBook" data-id="${b.id}">Delete</button></td></tr>`).join('');
    $('#iUser').innerHTML = '<option value="">-- select --</option>' + users().filter(u => u.role === 'user').map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.email)})</option>`).join('');
    $('#iBook').innerHTML = books().filter(b => b.avail > 0).map(b => `<option value="${b.id}">${esc(b.title)} (${b.avail} left)</option>`).join('');
    $('#adminIssues').innerHTML = issues().slice().reverse().map(i => {
      const f = fineOf(i), overdue = !i.returned && i.due < today();
      return `<tr><td>${esc(userName(i.userId))}</td><td>${esc(bookName(i.bookId))}</td><td>${i.issued}</td><td>${i.due}</td>
      <td>${i.returned || '<span class="badge info">Issued</span>'}</td><td>${f ? '<span class="badge warn">₹' + f + '</span>' : (i.paid ? '<span class="badge">Paid</span>' : '₹0')}</td>
      <td>${!i.returned ? `<button class="btn sm green" data-act="returnBook" data-id="${i.id}">Return</button>` : ''}
      ${overdue ? `<button class="btn sm red" data-act="makeFine" data-id="${i.id}">Make Fine</button>` : ''}
      ${f ? `<button class="btn sm sec" data-act="payFine" data-id="${i.id}">Mark paid</button>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="mut">No books issued yet.</td></tr>';
    $('#adminMats').innerHTML = mats().map(m => `<tr><td>${esc(m.title)}</td><td>${m.year}</td><td>${m.sem}</td>
      <td><button class="btn sm" data-act="viewMat" data-id="${m.id}">View</button><button class="btn sm red" data-act="delMat" data-id="${m.id}">Delete</button></td></tr>`).join('');
  } else {
    $('#uName').textContent = me.name;
    const mine = issues().filter(i => i.userId === me.id).reverse();
    $('#userHist').innerHTML = mine.map(i => `<tr><td>${esc(bookName(i.bookId))}</td><td>${i.issued}</td><td>${i.due}</td><td>${i.returned || '-'}</td>
      <td>${i.returned ? '<span class="badge">Returned</span>' : (i.due < today() ? '<span class="badge warn">Overdue</span>' : '<span class="badge info">Issued</span>')}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">No borrow history yet.</td></tr>';
    const fines = mine.filter(i => fineOf(i) > 0);
    $('#fineList').innerHTML = fines.map(i => `<tr><td>${esc(bookName(i.bookId))}</td><td>${i.due}</td><td>₹${fineOf(i)}</td></tr>`).join('') || '<tr><td colspan="3" class="mut">No pending fines 🎉</td></tr>';
    $('#totalFine').textContent = '₹' + fines.reduce((s, i) => s + fineOf(i), 0);
    const y = $('#fYear').value, s = $('#fSem').value, q = $('#fQ').value.toLowerCase();
    $('#userMats').innerHTML = mats().filter(m => (!y || m.year === y) && (!s || m.sem === s) && m.title.toLowerCase().includes(q)).map(m => `<tr><td>${esc(m.title)}</td><td>${m.year}</td><td>${m.sem}</td>
      <td><button class="btn sm" data-act="viewMat" data-id="${m.id}">View</button><button class="btn sm green" data-act="dlMat" data-id="${m.id}">Download</button></td></tr>`).join('') || '<tr><td colspan="4" class="mut">No material found.</td></tr>';
    if (document.activeElement.closest('#profForm') === null) {
      $('#pName').value = me.name; $('#pEmail').value = me.email; $('#pPhone').value = me.phone || ''; $('#pYear').value = me.year || '1'; $('#pSem').value = me.sem || '1';
    }
  }
}
['fYear', 'fSem', 'fQ'].forEach(id => $('#' + id).addEventListener('input', renderAll));

go('catalog');
