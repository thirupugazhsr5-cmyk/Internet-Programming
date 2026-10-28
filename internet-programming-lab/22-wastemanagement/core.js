/* =====================================================================
   core.js  -  tiny front-end framework shared by all four projects
   ---------------------------------------------------------------------
   DB    : a mini "database" on top of localStorage (tables = arrays)
   Auth  : register / login / logout / current user (role based)
   UI    : helpers (forms, tables, toasts, modals, charts, file upload)
   App   : hash router + page shell (navbar, footer) + login/register/profile pages
   ===================================================================== */
(function (g) {
  'use strict';

  /* ---------- small utilities ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const fmtDateTime = d => d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const money = n => (App.cfg && App.cfg.currency || '$') + ' ' + Number(n || 0).toLocaleString();

  /* ---------- DB : localStorage tables ---------- */
  const DB = {
    ns: 'app',
    _k(t) { return this.ns + ':' + t; },
    all(t) { try { return JSON.parse(localStorage.getItem(this._k(t)) || '[]'); } catch (e) { return []; } },
    save(t, rows) {
      try { localStorage.setItem(this._k(t), JSON.stringify(rows)); }
      catch (e) { throw new Error('Browser storage is full. Use smaller uploads or click "Reset demo data" in the footer.'); }
    },
    insert(t, o) {
      const rows = this.all(t);
      const r = Object.assign({ id: uid(), created: new Date().toISOString() }, o);
      rows.push(r); this.save(t, rows); return r;
    },
    get(t, id) { return this.all(t).find(r => r.id === id) || null; },
    find(t, fn) { return this.all(t).filter(fn); },
    one(t, fn) { return this.all(t).find(fn) || null; },
    update(t, id, patch) {
      const rows = this.all(t); const i = rows.findIndex(r => r.id === id);
      if (i < 0) return null;
      rows[i] = Object.assign({}, rows[i], patch); this.save(t, rows); return rows[i];
    },
    remove(t, id) { this.save(t, this.all(t).filter(r => r.id !== id)); },
    kv(k, v) {            // tiny key/value store (session, flags)
      const key = this._k('kv:' + k);
      if (v === undefined) { const s = localStorage.getItem(key); return s === null ? null : JSON.parse(s); }
      if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v));
    },
    reset() { Object.keys(localStorage).filter(k => k.startsWith(this.ns + ':')).forEach(k => localStorage.removeItem(k)); }
  };

  /* ---------- Auth ---------- */
  const Auth = {
    user() { const id = DB.kv('session'); return id ? DB.get('users', id) : null; },
    register(data) {
      const email = String(data.email || '').trim().toLowerCase();
      if (DB.one('users', u => u.email.toLowerCase() === email)) throw new Error('This email is already registered.');
      return DB.insert('users', Object.assign({}, data, { email }));
    },
    login(email, password) {
      email = String(email || '').trim().toLowerCase();
      const u = DB.one('users', x => x.email.toLowerCase() === email && x.password === password);
      if (u) DB.kv('session', u.id);
      return u;
    },
    logout() { DB.kv('session', null); }
  };

  /* ---------- UI helpers ---------- */
  const UI = {
    toast(msg, type = 'ok') {
      let box = $('#toasts');
      if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
      const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
      setTimeout(() => t.classList.add('hide'), 3200); setTimeout(() => t.remove(), 3700);
    },
    modal(title, html) {
      const o = document.createElement('div'); o.className = 'modal-bg';
      o.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-h"><h3>${esc(title)}</h3><button class="x" type="button" aria-label="Close">&times;</button></div><div class="modal-b">${html}</div></div>`;
      const close = () => o.remove();
      o.addEventListener('click', e => { if (e.target === o || e.target.closest('.x') || e.target.closest('[data-close]')) close(); });
      document.body.appendChild(o);
      return { el: o, close };
    },
    /* submit handler wrapper: collects text fields, prevents reload, shows errors as toasts */
    form(root, sel, fn) {
      const f = $(sel, root); if (!f) return;
      f.addEventListener('submit', async e => {
        e.preventDefault();
        try { await fn(UI.formData(f), f, e); } catch (err) { UI.toast(err.message || String(err), 'error'); }
      });
    },
    formData(f) {
      const d = {};
      new FormData(f).forEach((v, k) => {
        if (typeof File !== 'undefined' && v instanceof File) return;
        if (typeof v === 'string' && !/password/i.test(k)) v = v.trim();
        if (k in d) d[k] = [].concat(d[k], v); else d[k] = v;
      });
      return d;
    },
    click(root, sel, fn) {
      root.addEventListener('click', e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(t, e); });
    },
    options(list, sel) {
      return (list || []).map(o => {
        const v = Array.isArray(o) ? o[0] : (o && typeof o === 'object' ? o.v : o);
        const l = Array.isArray(o) ? o[1] : (o && typeof o === 'object' ? o.l : o);
        return `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('');
    },
    field(o) {
      const { name, label, type = 'text', value = '', required = false, options, placeholder = '', rows = 4, hint = '', attrs = '', cls = '' } = o;
      const req = required ? ' required' : '';
      let ctl;
      if (type === 'select') ctl = `<select name="${name}" id="f-${name}"${req} ${attrs}>${UI.options(options, value)}</select>`;
      else if (type === 'textarea') ctl = `<textarea name="${name}" id="f-${name}" rows="${rows}" placeholder="${esc(placeholder)}"${req} ${attrs}>${esc(value)}</textarea>`;
      else ctl = `<input type="${type}" name="${name}" id="f-${name}" value="${esc(value)}" placeholder="${esc(placeholder)}"${req} ${attrs}>`;
      return `<div class="field ${cls}"><label for="f-${name}">${esc(label)}${required ? ' <b class="req">*</b>' : ''}</label>${ctl}${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
    },
    pageHead(title, sub, actions) {
      return `<div class="page-h"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
    },
    empty(msg) { return `<div class="empty">${esc(msg)}</div>`; },
    stat(label, value, icon) { return `<div class="stat"><span class="ico">${icon || ''}</span><div><b>${esc(value)}</b><small>${esc(label)}</small></div></div>`; },
    badge(t, kind) {
      const map = { pending: 'warn', 'pending payment': 'warn', open: 'warn', approved: 'ok', solved: 'ok', paid: 'ok', active: 'ok', collected: 'ok', confirmed: 'ok', completed: 'ok', shortlisted: 'ok', resolved: 'ok', rejected: 'bad', cancelled: 'bad', declined: 'bad', 'in progress': 'info', assigned: 'info', reviewed: 'info', applied: 'info', 'not selected': 'bad' };
      return `<span class="badge ${kind || map[String(t).toLowerCase()] || 'info'}">${esc(t)}</span>`;
    },
    table(cols, rows, emptyMsg = 'Nothing to show yet.') {
      if (!rows.length) return UI.empty(emptyMsg);
      return `<div class="table-wrap"><table><thead><tr>${cols.map(c => `<th>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td data-label="${esc(c.h)}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },
    bars(items, { unit = '', max } = {}) {
      if (!items.length) return UI.empty('No data yet.');
      const m = max || Math.max(...items.map(i => i.value), 1);
      return '<div class="bars">' + items.map(i => `<div class="bar-row"><span class="bar-l">${esc(i.label)}</span><div class="bar-t"><div class="bar-f" style="width:${i.value > 0 ? Math.max(2, i.value / m * 100) : 0}%;${i.color ? 'background:' + i.color : ''}"></div></div><span class="bar-v">${esc(i.value)}${esc(unit)}</span></div>`).join('') + '</div>';
    },
    stars(n) { n = Math.round(n || 0); return '<span class="stars" aria-label="' + n + ' out of 5">' + '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i></span>'; },
    /* a generated picture (emoji on a coloured background) used as placeholder image */
    art(emoji, bg = '#e0f2f1') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="${bg}"/><text x="50%" y="54%" font-size="120" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },
    /* read <input type=file> -> [{name,type,size,data}] ; images are down-scaled so they fit in localStorage */
    async readFiles(input, opt = {}) {
      const out = [];
      for (const f of Array.from((input && input.files) || [])) out.push(await UI.readFile(f, opt.maxDim || 640));
      return out;
    },
    readFile(f, maxDim = 640) {
      return new Promise(res => {
        const meta = { name: f.name, type: f.type || '', size: f.size, data: null };
        const fr = new FileReader(); fr.onerror = () => res(meta);
        if (meta.type.startsWith('image/')) {
          fr.onload = () => {
            const img = new Image();
            img.onload = () => {
              const s = Math.min(1, maxDim / Math.max(img.width, img.height));
              const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
              c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
              meta.data = c.toDataURL('image/jpeg', 0.72); res(meta);
            };
            img.onerror = () => res(meta); img.src = fr.result;
          };
          fr.readAsDataURL(f);
        } else if (f.size <= 1500000) { fr.onload = () => { meta.data = fr.result; res(meta); }; fr.readAsDataURL(f); }
        else res(meta);   // too big for localStorage: keep only the name
      });
    },
    media(m) {
      if (!m) return '';
      if (m.data && m.type.startsWith('image/')) return `<a href="${esc(m.data)}" target="_blank" rel="noopener"><img class="thumb" src="${esc(m.data)}" alt="${esc(m.name)}"></a>`;
      if (m.data && m.type.startsWith('video/')) return `<video class="thumb" controls preload="metadata" src="${esc(m.data)}"></video>`;
      if (m.data && m.type.startsWith('audio/')) return `<audio controls preload="metadata" src="${esc(m.data)}"></audio>`;
      return `<span class="chip">&#128206; ${esc(m.name)}${m.data ? '' : ' (file too large to store in this demo)'}</span>`;
    },
    download(name, text, type = 'text/plain') {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 500);
    }
  };

  /* ---------- App : router + shell ---------- */
  const App = {
    cfg: null,
    init(cfg) {
      this.cfg = cfg; DB.ns = cfg.key; document.title = cfg.name;
      if (!DB.kv('seeded')) { try { cfg.seed && cfg.seed(); } catch (e) { console.error('seed failed', e); } DB.kv('seeded', 1); }
      this.shell();
      window.addEventListener('hashchange', () => this.render());
      this.render();
    },
    shell() {
      const c = this.cfg;
      document.body.innerHTML = `<header class="topbar"><div class="wrap bar"><a class="brand" href="#/"><span class="logo">${c.logo || '&#9679;'}</span><span>${esc(c.name)}</span></a><button class="burger" type="button" aria-label="Menu">&#9776;</button><nav id="nav"></nav></div></header><main id="main" class="wrap"></main><footer class="foot"><div class="wrap">${esc(c.name)} &middot; Internet Programming Lab &middot; front-end demo (data is kept in your browser's localStorage) &middot; <a href="#/" id="reset">Reset demo data</a></div></footer>`;
      $('.burger').addEventListener('click', () => $('#nav').classList.toggle('open'));
      $('#nav').addEventListener('click', e => { if (e.target.closest('a')) $('#nav').classList.remove('open'); });
      $('#reset').addEventListener('click', e => { e.preventDefault(); if (confirm('Delete all data stored by this demo and restore the sample data?')) { DB.reset(); location.hash = '#/'; location.reload(); } });
    },
    parse() {
      const h = location.hash.replace(/^#/, '') || '/'; const [p, qs] = h.split('?');
      return { path: p || '/', q: Object.fromEntries(new URLSearchParams(qs || '')) };
    },
    go(p) { if (location.hash === '#' + p) this.render(); else location.hash = '#' + p; },
    renderNav() {
      const u = Auth.user(); const items = this.cfg.menus[u ? u.role : 'guest'] || []; const cur = this.parse().path;
      $('#nav').innerHTML = items.map(([p, l]) => `<a href="#${p}" class="${cur === p ? 'on' : ''}">${esc(typeof l === 'function' ? l(u) : l)}</a>`).join('') +
        (u ? `<span class="who">${esc(u.name)} <em>${esc(u.role)}</em></span><a href="#/logout" class="logout">Logout</a>` : '');
    },
    render() {
      const { path, q } = this.parse(); const user = Auth.user();
      if (path === '/logout') { Auth.logout(); UI.toast('You have been logged out.'); location.hash = '#/'; return; }
      const r = this.cfg.routes[path];
      $$('.modal-bg').forEach(m => m.remove());          // close any modal left open from the previous page
      const main = $('#main'); main.innerHTML = '';
      const root = document.createElement('section'); root.className = 'view'; main.appendChild(root);
      if (!r) { this.renderNav(); root.innerHTML = UI.empty('Page not found.') + '<p class="center"><a class="btn" href="#/">Go to home page</a></p>'; return; }
      if (r.guest && user) { location.hash = '#' + this.cfg.home(user); return; }
      if (r.roles) {
        if (!user) { UI.toast('Please log in first.', 'warn'); DB.kv('next', location.hash); location.hash = '#/login'; return; }
        if (r.roles !== '*' && !r.roles.includes(user.role)) { UI.toast('You do not have access to that page.', 'error'); location.hash = '#' + this.cfg.home(user); return; }
      }
      this.renderNav();
      try { r.view(root, q, user); }
      catch (e) { console.error(e); root.innerHTML = `<div class="card">Something went wrong: ${esc(e.message)}</div>`; }
      window.scrollTo(0, 0);
    },

    /* ----- ready-made pages used by every project ----- */
    loginView(root, { title = 'Login', blurb = '', demo = [], registerLinks = [] } = {}) {
      root.innerHTML = `<div class="auth"><div class="card"><h1>${esc(title)}</h1>${blurb ? `<p class="muted">${esc(blurb)}</p>` : ''}
        <form id="lf" class="form">${UI.field({ name: 'email', label: 'Email', type: 'email', required: true })}${UI.field({ name: 'password', label: 'Password', type: 'password', required: true })}<button class="btn block">Login</button></form>
        ${registerLinks.length ? `<p class="center muted">New here? ${registerLinks.map(([h, l]) => `<a href="#${h}">${esc(l)}</a>`).join(' &middot; ')}</p>` : ''}</div>
        ${demo.length ? `<div class="card demo"><h3>Demo accounts</h3>${demo.map(d => `<p><b>${esc(d.role)}</b><br><code>${esc(d.email)}</code> / <code>${esc(d.password)}</code> <button type="button" class="btn sm ghost" data-fill="${esc(d.email)}|${esc(d.password)}">Fill</button></p>`).join('')}</div>` : ''}</div>`;
      UI.click(root, '[data-fill]', b => { const [a, p] = b.dataset.fill.split('|'); $('#f-email', root).value = a; $('#f-password', root).value = p; });
      UI.form(root, '#lf', d => {
        const u = Auth.login(d.email, d.password);
        if (!u) throw new Error('Invalid email or password.');
        const msg = App.cfg.canLogin && App.cfg.canLogin(u);
        if (msg) { Auth.logout(); throw new Error(msg); }
        UI.toast('Welcome, ' + u.name + '!');
        const next = DB.kv('next'); DB.kv('next', null);          // go back to the page the visitor wanted
        if (next && /^#\//.test(next) && !/^#\/(login|register)/.test(next)) location.hash = next; else App.go(App.cfg.home(u));
      });
    },
    registerView(root, { title, role, fields, intro = '', extra, done } = {}) {
      root.innerHTML = `<div class="auth wide"><div class="card"><h1>${esc(title)}</h1>${intro ? `<p class="muted">${esc(intro)}</p>` : ''}
        <form id="rf" class="form two">${fields.map(f => UI.field(f)).join('')}
        ${UI.field({ name: 'password', label: 'Password', type: 'password', required: true, attrs: 'minlength="6"', hint: 'At least 6 characters' })}
        ${UI.field({ name: 'password2', label: 'Confirm password', type: 'password', required: true })}
        <div class="full"><button class="btn">Create account</button> <a class="btn ghost" href="#/login">I already have an account</a></div></form></div></div>`;
      UI.form(root, '#rf', async (d, f) => {
        if (d.password !== d.password2) throw new Error('Passwords do not match.');
        delete d.password2;
        let rec = Object.assign({}, d, { role });
        if (extra) rec = Object.assign(rec, await extra(d, f));
        const u = Auth.register(rec);
        if (done) done(u); else { UI.toast('Registration successful. Please log in.'); App.go('/login'); }
      });
    },
    profileView(root, user, fields, title = 'My Profile') {
      root.innerHTML = UI.pageHead(title, 'Update your personal details or change your password.') + `
        <div class="grid two"><div class="card"><h3>Details</h3><form id="pf" class="form">${fields.map(f => UI.field(Object.assign({ value: user[f.name] }, f))).join('')}<button class="btn">Save changes</button></form></div>
        <div class="card"><h3>Change password</h3><form id="pw" class="form">${UI.field({ name: 'old', label: 'Current password', type: 'password', required: true })}${UI.field({ name: 'nw', label: 'New password', type: 'password', required: true, attrs: 'minlength="6"' })}<button class="btn dark">Update password</button></form></div></div>`;
      UI.form(root, '#pf', d => { DB.update('users', user.id, d); UI.toast('Profile updated.'); App.render(); });
      UI.form(root, '#pw', d => {
        if (d.old !== user.password) throw new Error('Current password is incorrect.');
        DB.update('users', user.id, { password: d.nw }); UI.toast('Password changed.'); App.render();
      });
    }
  };

  Object.assign(g, { DB, Auth, UI, App, $, $$, esc, uid, fmtDate, fmtDateTime, today, addDays, daysBetween, money });
})(window);
