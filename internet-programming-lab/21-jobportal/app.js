/* =====================================================================
   21 - JobConnect : online job portal
   Roles: admin  |  director (employer)  |  user (applicant)
   ===================================================================== */
(function () {
  const CATS = ['IT & Software', 'Healthcare', 'Education', 'Finance & Accounting', 'Engineering', 'Sales & Marketing', 'Hospitality', 'Other'];
  const CAT_ICON = { 'IT & Software': '&#128187;', Healthcare: '&#129657;', Education: '&#127891;', 'Finance & Accounting': '&#128200;', Engineering: '&#9881;&#65039;', 'Sales & Marketing': '&#128227;', Hospitality: '&#127976;', Other: '&#128188;' };
  const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];
  const LEVELS = [['public', 'Public - full resume visible'], ['limited', 'Limited - contact details hidden'], ['hidden', 'Hidden - not searchable']];
  const qs = o => Object.entries(o).filter(([, v]) => v).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const user = id => DB.get('users', id) || {};
  const vac = id => DB.get('vacancies', id);
  const isOpen = v => v && v.status !== 'Closed' && (!v.lastDate || v.lastDate >= today());
  const notify = (userId, text, link) => DB.insert('notifications', { userId, text, link: link || '', read: false });
  const level = (uid, company) => { const p = DB.one('privacy', x => x.userId === uid && x.company === company); return p ? p.level : (user(uid).privacyDefault || 'public'); };
  const hasResume = u => !!(u.headline && u.skills);
  const unread = u => u ? DB.find('notifications', n => n.userId === u.id && !n.read).length : 0;
  const ago = iso => { const d = Math.floor((Date.now() - new Date(iso)) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };

  /* ---------- reusable fragments ---------- */
  function jobCard(v, u) {
    const saved = u && DB.one('saved', s => s.userId === u.id && s.vacancyId === v.id);
    const applied = u && DB.one('applications', a => a.userId === u.id && a.vacancyId === v.id);
    return `<div class="card item"><img class="cover" style="height:120px" src="${esc(v.image)}" alt=""><div class="body">
      <h3 style="margin:0"><a href="#/job?id=${v.id}" style="text-decoration:none;color:inherit">${esc(v.title)}</a></h3>
      <span class="muted">${esc(v.company)} &middot; &#128205; ${esc(v.location)}</span>
      <span><span class="tag">${esc(v.category)}</span><span class="tag">${esc(v.type)}</span></span>
      <span><b>${esc(v.salary || 'Salary not disclosed')}</b></span><small class="muted">Posted ${ago(v.created)}${v.lastDate ? ' &middot; apply by ' + fmtDate(v.lastDate) : ''}</small></div>
      <div class="foot2"><a class="btn sm ghost" href="#/job?id=${v.id}">View</a>
      ${u && u.role === 'user' ? (applied ? UI.badge(applied.status) : `<button class="btn sm" data-apply="${v.id}">Apply</button>`) + `<button class="btn sm ghost" data-save="${v.id}" title="Save job">${saved ? '&#9829; Saved' : '&#9825; Save'}</button>` : ''}</div></div>`;
  }
  function jobActions(root, u) {
    UI.click(root, '[data-save]', b => {
      const ex = DB.one('saved', s => s.userId === u.id && s.vacancyId === b.dataset.save);
      if (ex) { DB.remove('saved', ex.id); UI.toast('Removed from saved jobs.', 'warn'); } else { DB.insert('saved', { userId: u.id, vacancyId: b.dataset.save }); UI.toast('Job saved.'); }
      App.render();
    });
    UI.click(root, '[data-apply]', b => applyModal(vac(b.dataset.apply), u));
  }
  function applyModal(v, u) {
    if (!hasResume(u)) { UI.toast('Please complete your resume first.', 'warn'); App.go('/resume'); return; }
    const m = UI.modal('Apply: ' + v.title, `<p class="muted">${esc(v.company)} &middot; ${esc(v.location)}</p><p>Your resume <b>${esc(u.headline)}</b> will be sent with this application.</p>
      <form id="af" class="form">${UI.field({ name: 'note', label: 'Cover note (optional)', type: 'textarea', rows: 4 })}<button class="btn">Submit application</button></form>`);
    UI.form(m.el, '#af', d => {
      if (DB.one('applications', a => a.userId === u.id && a.vacancyId === v.id)) throw new Error('You have already applied for this job.');
      DB.insert('applications', { userId: u.id, vacancyId: v.id, directorId: v.directorId, note: d.note, status: 'Applied' });
      notify(v.directorId, `${u.name} applied for "${v.title}".`, '#/applicants?v=' + v.id);
      m.close(); UI.toast('Application sent to ' + v.company + '!'); App.render();
    });
  }
  /* applicant details shown to a director, respecting privacy */
  function applicantBlock(a, company, withContact = true) {
    const lv = level(a.id, company);
    return `<b>${esc(a.name)}</b> ${lv !== 'public' ? `<span class="badge info" title="Applicant privacy level">${lv} profile</span>` : ''}<br>
      <span class="muted">${esc(a.headline || 'No headline')} &middot; ${esc(a.location || '')} &middot; ${esc(a.experience || 0)} yrs</span><br>
      ${(a.skills || '').split(',').filter(s => s.trim()).map(s => `<span class="chip">${esc(s.trim())}</span>`).join('')}
      ${a.education ? `<br><small>&#127891; ${esc(a.education)}</small>` : ''}${a.summary ? `<br><small class="muted">${esc(a.summary)}</small>` : ''}
      ${withContact ? (lv === 'public' ? `<br><small>&#9993; ${esc(a.email)} &middot; &#128222; ${esc(a.phone || '-')}</small>${a.resumeFile && a.resumeFile.data ? ` &middot; <a href="${esc(a.resumeFile.data)}" download="${esc(a.resumeFile.name)}">&#128196; Resume file</a>` : ''}` : '<br><small class="muted">&#128274; Contact details hidden by the applicant.</small>') : ''}`;
  }
  function dailyDigest(u) {
    if (u.lastDigest === today()) return;
    const since = Date.now() - 86400000 * 2;
    const fresh = DB.find('vacancies', v => isOpen(v) && new Date(v.created) > since);
    const mine = fresh.filter(v => !u.interest || v.category === u.interest);
    DB.update('users', u.id, { lastDigest: today() });
    if (fresh.length) notify(u.id, `Daily update: ${fresh.length} new vacanc${fresh.length > 1 ? 'ies' : 'y'} posted recently${u.interest ? ` (${mine.length} in ${u.interest})` : ''}.`, '#/jobs');
  }

  /* ---------- routes ---------- */
  const routes = {
    '/': {
      view(root, q, u) {
        if (u) { App.go('/dashboard'); return; }
        const jobs = DB.all('vacancies').filter(isOpen).slice(-6).reverse();
        root.innerHTML = `<div class="hero"><span class="big">&#128188;</span><h1>Find the job that fits your life</h1><p>Browse vacancies from verified employers on one screen, apply with a single click and track every application. Save time, effort and cost.</p>
          <form id="hs" class="filters">${UI.field({ name: 'keyword', label: 'Job title or skill', placeholder: 'e.g. nurse, java' })}${UI.field({ name: 'location', label: 'Location', placeholder: 'City' })}${UI.field({ name: 'category', label: 'Category', type: 'select', options: [['', 'All categories'], ...CATS] })}<button class="btn" style="height:40px">Search jobs</button></form></div>
          <div class="grid four" style="margin-bottom:22px">${CATS.slice(0, 4).map(c => `<a class="card" style="text-decoration:none;color:inherit" href="#/jobs?category=${encodeURIComponent(c)}"><h3 style="margin:0">${CAT_ICON[c]} ${esc(c)}</h3><small class="muted">${DB.all('vacancies').filter(v => isOpen(v) && v.category === c).length} open jobs</small></a>`).join('')}</div>
          <div class="row between"><h2>Latest vacancies</h2><a href="#/jobs">See all &rarr;</a></div><div class="grid three">${jobs.map(v => jobCard(v)).join('')}</div>
          <div class="grid two" style="margin-top:22px"><div class="card"><h3>&#128100; Looking for a job?</h3><p class="muted">Create your resume once, then apply anywhere.</p><a class="btn" href="#/register">Register as applicant</a></div><div class="card"><h3>&#127970; Hiring?</h3><p class="muted">Post vacancies and browse resumes. Directors are approved by the admin.</p><a class="btn dark" href="#/director-register">Register as director</a></div></div>`;
        UI.form(root, '#hs', d => App.go('/jobs?' + qs(d)));
      }
    },
    '/login': { guest: true, view: root => App.loginView(root, { title: 'Login', blurb: 'Applicants, directors and the admin log in here.', registerLinks: [['/register', 'Applicant'], ['/director-register', 'Director']], demo: [{ role: 'Applicant', email: 'user@jobs.test', password: 'user123' }, { role: 'Director (approved)', email: 'hr@techcorp.test', password: 'director123' }, { role: 'Director (pending approval)', email: 'hr@brightminds.test', password: 'director123' }, { role: 'Admin', email: 'admin@jobs.test', password: 'admin123' }] }) },
    '/register': {
      guest: true, view: root => App.registerView(root, {
        title: 'Applicant registration', role: 'user', intro: 'After registering, build your resume under "My resume".',
        fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'location', label: 'City', required: true }],
        extra: () => ({ privacyDefault: 'public', experience: 0 })
      })
    },
    '/director-register': {
      guest: true, view: root => App.registerView(root, {
        title: 'Director registration', role: 'director', intro: 'Your account will be reviewed by the admin before you can log in.',
        fields: [{ name: 'name', label: 'Your name', required: true }, { name: 'email', label: 'Work email', type: 'email', required: true }, { name: 'company', label: 'Company / organisation', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'website', label: 'Website' }, { name: 'location', label: 'City', required: true }],
        extra: () => ({ approved: false, rejected: false }),
        done: () => { UI.toast('Registered! The admin must approve your account before you can log in.'); App.go('/login'); }
      })
    },
    '/profile': {
      roles: '*', view(root, q, u) {
        const f = [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', attrs: 'readonly' }, { name: 'phone', label: 'Phone' }];
        if (u.role === 'director') f.push({ name: 'company', label: 'Company' }, { name: 'website', label: 'Website' }, { name: 'location', label: 'City' }); else if (u.role === 'user') f.push({ name: 'location', label: 'City' });
        App.profileView(root, u, f);
      }
    },
    '/dashboard': {
      roles: '*', view(root, q, u) {
        if (u.role === 'admin') return adminDash(root);
        if (u.role === 'director') return directorDash(root, u);
        dailyDigest(u);
        const apps = DB.find('applications', a => a.userId === u.id);
        const rec = DB.all('vacancies').filter(v => isOpen(v) && (!u.interest || v.category === u.interest)).slice(-3).reverse();
        const notes = DB.find('notifications', n => n.userId === u.id).reverse().slice(0, 4);
        root.innerHTML = UI.pageHead('Hello, ' + u.name, hasResume(u) ? u.headline : 'Complete your resume to start applying', '<a class="btn" href="#/jobs">Find jobs</a>') +
          (hasResume(u) ? '' : '<div class="note warn" style="margin-bottom:16px">Your resume is incomplete. <a href="#/resume">Add your headline and skills</a> so employers can find you.</div>') +
          `<div class="grid four">${UI.stat('Applications', apps.length, '&#128221;')}${UI.stat('Shortlisted', apps.filter(a => a.status === 'Shortlisted').length, '&#11088;')}${UI.stat('Saved jobs', DB.find('saved', s => s.userId === u.id).length, '&#128190;')}${UI.stat('Unread alerts', unread(u), '&#128276;')}</div>
          <div class="grid two" style="margin-top:20px"><div><h2>${u.interest ? 'Recommended: ' + esc(u.interest) : 'Latest jobs'}</h2><div class="stack">${rec.length ? rec.map(v => jobCard(v, u)).join('') : UI.empty('No matching vacancies right now.')}</div></div>
          <div><h2>Recent notifications</h2><div class="card">${notes.length ? `<ul class="list">${notes.map(n => `<li>${n.read ? '' : '&#128308; '}${esc(n.text)}<br><small class="muted">${ago(n.created)}</small></li>`).join('')}</ul><a href="#/notifications">View all</a>` : '<p class="muted">No notifications yet.</p>'}</div></div></div>`;
        jobActions(root, u);
      }
    },

    /* ----- applicant ----- */
    '/jobs': {
      view(root, q, u) {
        const kw = (q.keyword || '').toLowerCase(); const loc = (q.location || '').toLowerCase();
        const list = DB.all('vacancies').filter(isOpen).filter(v => (!kw || (v.title + v.company + v.description + v.requirements).toLowerCase().includes(kw)) && (!loc || v.location.toLowerCase().includes(loc)) && (!q.category || v.category === q.category) && (!q.type || v.type === q.type)).reverse();
        const locs = [...new Set(DB.all('vacancies').map(v => v.location))].sort();
        root.innerHTML = UI.pageHead('Find jobs', 'All vacancies on a single screen') + `<div class="card" style="margin-bottom:16px"><form id="jf" class="filters">
          ${UI.field({ name: 'keyword', label: 'Keyword', value: q.keyword || '', placeholder: 'Title, company, skill' })}${UI.field({ name: 'location', label: 'Location', value: q.location || '', attrs: 'list="locs"' })}<datalist id="locs">${locs.map(l => `<option value="${esc(l)}">`).join('')}</datalist>
          ${UI.field({ name: 'category', label: 'Category', type: 'select', value: q.category || '', options: [['', 'All categories'], ...CATS] })}${UI.field({ name: 'type', label: 'Job type', type: 'select', value: q.type || '', options: [['', 'Any type'], ...TYPES] })}
          <button class="btn" style="height:40px">Filter</button><a class="btn ghost" style="height:40px" href="#/jobs">Clear</a></form></div>
          <p class="muted">${list.length} vacanc${list.length === 1 ? 'y' : 'ies'} found</p>${list.length ? `<div class="grid three">${list.map(v => jobCard(v, u)).join('')}</div>` : UI.empty('No vacancies match these filters.')}`;
        UI.form(root, '#jf', d => App.go('/jobs?' + qs(d)));
        if (u && u.role === 'user') jobActions(root, u); else UI.click(root, '[data-apply],[data-save]', () => { UI.toast('Please log in as an applicant first.', 'warn'); App.go('/login'); });
      }
    },
    '/job': {
      view(root, q, u) {
        const v = vac(q.id); if (!v) { root.innerHTML = UI.empty('Vacancy not found.'); return; }
        const applied = u && DB.one('applications', a => a.userId === u.id && a.vacancyId === v.id);
        root.innerHTML = `<p><a href="#/jobs">&larr; All jobs</a></p><div class="grid two"><div class="card"><h1>${esc(v.title)}</h1><p class="muted">${esc(v.company)} &middot; &#128205; ${esc(v.location)}</p><span><span class="tag">${esc(v.category)}</span><span class="tag">${esc(v.type)}</span>${isOpen(v) ? '' : UI.badge('Closed', 'bad')}</span>
          <h3 style="margin-top:16px">Job description</h3><p style="white-space:pre-line">${esc(v.description)}</p>${v.requirements ? `<h3>Requirements</h3><p style="white-space:pre-line">${esc(v.requirements)}</p>` : ''}</div>
          <div><img src="${esc(v.image)}" alt="" style="width:100%;border-radius:14px;height:200px;object-fit:cover"><div class="card" style="margin-top:14px"><dl class="kv"><dt>Salary</dt><dd>${esc(v.salary || 'Not disclosed')}</dd><dt>Openings</dt><dd>${esc(v.openings || 1)}</dd><dt>Apply by</dt><dd>${v.lastDate ? fmtDate(v.lastDate) : '-'}</dd><dt>Contact</dt><dd>${esc(v.contact)}</dd><dt>Posted</dt><dd>${ago(v.created)}</dd></dl>
          <p style="margin-top:14px">${u && u.role === 'user' ? (applied ? 'Your application: ' + UI.badge(applied.status) : isOpen(v) ? `<button class="btn" data-apply="${v.id}">Apply now</button> <button class="btn ghost" data-save="${v.id}">Save job</button>` : '') : (!u ? '<a class="btn" href="#/login">Login to apply</a>' : '')}</p></div></div></div>`;
        if (u && u.role === 'user') jobActions(root, u);
      }
    },
    '/saved': {
      roles: ['user'], view(root, q, u) {
        const list = DB.find('saved', s => s.userId === u.id).map(s => vac(s.vacancyId)).filter(Boolean);
        root.innerHTML = UI.pageHead('Saved jobs') + (list.length ? `<div class="grid three">${list.map(v => jobCard(v, u)).join('')}</div>` : UI.empty('You have not saved any job yet.'));
        jobActions(root, u);
      }
    },
    '/applications': {
      roles: ['user'], view(root, q, u) {
        const list = DB.find('applications', a => a.userId === u.id).reverse();
        root.innerHTML = UI.pageHead('My applications', 'Track the progress of every job you applied for') +
          UI.table([{ h: 'Job', f: a => { const v = vac(a.vacancyId) || {}; return `<b><a href="#/job?id=${v.id}">${esc(v.title || 'Removed')}</a></b><br><span class="muted">${esc(v.company || '')}</span>`; } }, { h: 'Applied', f: a => fmtDate(a.created) }, { h: 'Status', f: a => UI.badge(a.status) }, { h: '', f: a => a.status === 'Applied' ? `<button class="btn sm danger" data-wd="${a.id}">Withdraw</button>` : '' }], list, 'You have not applied for any job yet.');
        UI.click(root, '[data-wd]', b => { if (confirm('Withdraw this application?')) { DB.remove('applications', b.dataset.wd); App.render(); } });
      }
    },
    '/resume': {
      roles: ['user'], view(root, q, u) {
        root.innerHTML = UI.pageHead('My resume', 'Employers browse these details when you apply or when your profile is visible') + `<div class="card narrow"><form id="rf" class="form two">
          ${UI.field({ name: 'headline', label: 'Professional headline', value: u.headline, required: true, placeholder: 'e.g. Junior Java developer', cls: 'full' })}
          ${UI.field({ name: 'skills', label: 'Skills (comma separated)', value: u.skills, required: true, placeholder: 'Java, SQL, Teamwork', cls: 'full' })}
          ${UI.field({ name: 'experience', label: 'Experience (years)', type: 'number', value: u.experience || 0, attrs: 'min="0" max="50"' })}${UI.field({ name: 'interest', label: 'Preferred job category', type: 'select', value: u.interest || '', options: [['', 'Any'], ...CATS] })}
          ${UI.field({ name: 'education', label: 'Education', value: u.education, cls: 'full' })}${UI.field({ name: 'summary', label: 'About me', type: 'textarea', value: u.summary, rows: 3, cls: 'full' })}
          ${UI.field({ name: 'resume', label: 'Resume file (PDF / DOC, optional)', type: 'file', attrs: 'accept=".pdf,.doc,.docx"', cls: 'full', hint: u.resumeFile ? 'Current file: ' + u.resumeFile.name + (u.resumeFile.data ? '' : ' (too large to store in this demo)') : 'Files over 1.5 MB are not stored in this browser-only demo' })}
          <div class="full"><button class="btn">Save resume</button></div></form></div>`;
        UI.form(root, '#rf', async (d, f) => {
          const file = (await UI.readFiles(f.elements.resume))[0];
          const patch = { headline: d.headline, skills: d.skills, experience: Number(d.experience || 0), interest: d.interest, education: d.education, summary: d.summary };
          if (file) patch.resumeFile = file;
          DB.update('users', u.id, patch); UI.toast('Resume saved.'); App.render();
        });
      }
    },
    '/privacy': {
      roles: ['user'], view(root, q, u) {
        const companies = [...new Set(DB.find('users', x => x.role === 'director' && x.approved).map(x => x.company))].sort();
        root.innerHTML = UI.pageHead('Privacy settings', 'Choose who can see your resume details - for every company separately') + `<div class="card narrow" style="margin-bottom:16px"><form id="pd" class="form">${UI.field({ name: 'level', label: 'Default privacy level', type: 'select', value: u.privacyDefault || 'public', options: LEVELS })}<button class="btn">Save default</button></form></div>
          <h3>Per-company settings</h3><div class="card flat"><p class="muted">Overrides the default for one company. Hidden = the company cannot find you in resume search; limited = no phone, email or resume file.</p>${UI.table([{ h: 'Company', f: c => `<b>${esc(c)}</b>` }, { h: 'Privacy level', f: c => `<select data-co="${esc(c)}" style="max-width:300px">${UI.options(LEVELS, level(u.id, c))}</select>` }], companies.map(c => c), 'No companies yet.')}</div>`;
        UI.form(root, '#pd', d => { DB.update('users', u.id, { privacyDefault: d.level }); UI.toast('Default privacy saved.'); App.render(); });
        root.addEventListener('change', e => {
          const c = e.target.dataset && e.target.dataset.co; if (!c) return;
          const ex = DB.one('privacy', x => x.userId === u.id && x.company === c);
          if (ex) DB.update('privacy', ex.id, { level: e.target.value }); else DB.insert('privacy', { userId: u.id, company: c, level: e.target.value });
          UI.toast('Privacy for ' + c + ' set to ' + e.target.value + '.');
        });
      }
    },
    '/notifications': {
      roles: ['user', 'director'], view(root, q, u) {
        const list = DB.find('notifications', n => n.userId === u.id).reverse();
        root.innerHTML = UI.pageHead('Notifications', 'Daily updates and application news', list.length ? '<button class="btn ghost" id="clr">Clear all</button>' : '') +
          (list.length ? `<div class="stack">${list.map(n => `<div class="card flat">${n.read ? '' : '&#128308; '}${esc(n.text)} ${n.link ? `<a href="${esc(n.link)}">Open</a>` : ''}<br><small class="muted">${fmtDateTime(n.created)}</small></div>`).join('')}</div>` : UI.empty('You have no notifications.'));
        list.filter(n => !n.read).forEach(n => DB.update('notifications', n.id, { read: true }));
        const c = $('#clr', root); if (c) c.addEventListener('click', () => { list.forEach(n => DB.remove('notifications', n.id)); App.render(); });
        setTimeout(() => App.renderNav(), 0);
      }
    },

    /* ----- director ----- */
    '/post-vacancy': {
      roles: ['director'], view(root, q, u) {
        const e = q.id ? vac(q.id) : null; const v = e || {};
        root.innerHTML = UI.pageHead(e ? 'Edit vacancy' : 'Post a vacancy') + `<div class="card narrow"><form id="vf" class="form two">
          ${UI.field({ name: 'title', label: 'Job title', value: v.title, required: true, cls: 'full' })}${UI.field({ name: 'category', label: 'Category', type: 'select', value: v.category, options: CATS })}${UI.field({ name: 'type', label: 'Job type', type: 'select', value: v.type, options: TYPES })}
          ${UI.field({ name: 'location', label: 'Location', value: v.location || u.location, required: true })}${UI.field({ name: 'salary', label: 'Salary', value: v.salary, placeholder: 'e.g. 30,000 - 45,000 / month' })}
          ${UI.field({ name: 'openings', label: 'Openings', type: 'number', value: v.openings || 1, attrs: 'min="1"' })}${UI.field({ name: 'lastDate', label: 'Last date to apply', type: 'date', value: v.lastDate || addDays(today(), 30), attrs: `min="${today()}"` })}
          ${UI.field({ name: 'description', label: 'Description', type: 'textarea', value: v.description, required: true, cls: 'full' })}${UI.field({ name: 'requirements', label: 'Requirements', type: 'textarea', value: v.requirements, rows: 3, cls: 'full' })}
          ${UI.field({ name: 'contact', label: 'Contact (email / phone)', value: v.contact || u.email, required: true, cls: 'full' })}
          ${UI.field({ name: 'image', label: 'Image / company banner', type: 'file', attrs: 'accept="image/*"', cls: 'full', hint: e ? 'Leave empty to keep the current image' : 'Optional' })}
          <div class="full"><button class="btn">${e ? 'Save changes' : 'Publish vacancy'}</button> <a class="btn ghost" href="#/my-vacancies">Cancel</a></div></form></div>`;
        UI.form(root, '#vf', async (d, f) => {
          const img = (await UI.readFiles(f.elements.image))[0];
          const rec = { directorId: u.id, company: u.company, title: d.title, category: d.category, type: d.type, location: d.location, salary: d.salary, openings: Number(d.openings), lastDate: d.lastDate, description: d.description, requirements: d.requirements, contact: d.contact };
          if (img && img.data) rec.image = img.data; else if (!e) rec.image = UI.art(CAT_ICON[d.category], '#e0e7ff');
          if (e) DB.update('vacancies', e.id, rec);
          else {
            rec.status = 'Open'; const nv = DB.insert('vacancies', rec);
            DB.find('users', x => x.role === 'user' && x.interest === d.category).forEach(x => notify(x.id, `New ${d.category} vacancy: "${d.title}" at ${u.company}.`, '#/job?id=' + nv.id));
          }
          UI.toast('Vacancy saved.'); App.go('/my-vacancies');
        });
      }
    },
    '/my-vacancies': {
      roles: ['director'], view(root, q, u) {
        const list = DB.find('vacancies', v => v.directorId === u.id).reverse();
        root.innerHTML = UI.pageHead('My vacancies', '', '<a class="btn" href="#/post-vacancy">+ Post vacancy</a>') +
          UI.table([{ h: '', f: v => `<img src="${esc(v.image)}" style="width:70px;height:48px;object-fit:cover;border-radius:8px" alt="">` }, { h: 'Title', f: v => `<b>${esc(v.title)}</b><br><span class="muted">${esc(v.category)} &middot; ${esc(v.location)}</span>` }, { h: 'Status', f: v => isOpen(v) ? UI.badge('Open', 'ok') : UI.badge(v.status === 'Closed' ? 'Closed' : 'Expired', 'bad') }, { h: 'Applicants', f: v => `<a href="#/applicants?v=${v.id}">${DB.find('applications', a => a.vacancyId === v.id).length}</a>` }, { h: 'Apply by', f: v => fmtDate(v.lastDate) },
            { h: '', f: v => `<a class="btn sm ghost" href="#/post-vacancy?id=${v.id}">Edit</a> <button class="btn sm ghost" data-tog="${v.id}">${v.status === 'Closed' ? 'Reopen' : 'Close'}</button> <button class="btn sm danger" data-del="${v.id}">Delete</button>` }], list, 'You have not posted any vacancy yet.');
        UI.click(root, '[data-tog]', b => { const v = vac(b.dataset.tog); DB.update('vacancies', v.id, { status: v.status === 'Closed' ? 'Open' : 'Closed' }); App.render(); });
        UI.click(root, '[data-del]', b => { if (confirm('Delete this vacancy and its applications?')) { DB.find('applications', a => a.vacancyId === b.dataset.del).forEach(a => DB.remove('applications', a.id)); DB.remove('vacancies', b.dataset.del); App.render(); } });
      }
    },
    '/applicants': {
      roles: ['director'], view(root, q, u) {
        const mine = DB.find('vacancies', v => v.directorId === u.id);
        let apps = DB.find('applications', a => a.directorId === u.id).reverse(); if (q.v) apps = apps.filter(a => a.vacancyId === q.v);
        root.innerHTML = UI.pageHead('Applied users', 'Review applicants and shortlist suitable candidates') + `<div class="card" style="margin-bottom:16px"><form id="vf" class="filters">${UI.field({ name: 'v', label: 'Vacancy', type: 'select', value: q.v || '', options: [['', 'All my vacancies'], ...mine.map(v => [v.id, v.title])] })}<button class="btn" style="height:40px">Show</button></form></div>` +
          UI.table([{ h: 'Applicant', f: a => applicantBlock(user(a.userId), u.company) }, { h: 'Applied for', f: a => `${esc((vac(a.vacancyId) || {}).title)}<br><small class="muted">${fmtDate(a.created)}</small>${a.note ? `<br><small>&ldquo;${esc(a.note)}&rdquo;</small>` : ''}` }, { h: 'Status', f: a => UI.badge(a.status) },
            { h: '', f: a => `<button class="btn sm" data-st="Shortlisted" data-id="${a.id}">Shortlist</button> <button class="btn sm danger" data-st="Rejected" data-id="${a.id}">Reject</button>` }], apps, 'No applications yet.');
        UI.form(root, '#vf', d => App.go('/applicants?' + qs(d)));
        UI.click(root, '[data-st]', b => {
          const a = DB.get('applications', b.dataset.id); const v = vac(a.vacancyId);
          DB.update('applications', a.id, { status: b.dataset.st });
          notify(a.userId, b.dataset.st === 'Shortlisted' ? `Good news! ${u.company} shortlisted you for "${v.title}".` : `${u.company} did not select your application for "${v.title}".`, '#/applications');
          UI.toast('Applicant ' + b.dataset.st.toLowerCase() + '.'); App.render();
        });
      }
    },
    '/resumes': {
      roles: ['director'], view(root, q, u) {
        const kw = (q.keyword || '').toLowerCase(); const loc = (q.location || '').toLowerCase(); const min = Number(q.exp || 0);
        const list = DB.find('users', x => x.role === 'user' && hasResume(x) && level(x.id, u.company) !== 'hidden').filter(x => (!kw || (x.headline + ',' + x.skills + ',' + (x.education || '')).toLowerCase().includes(kw)) && (!loc || (x.location || '').toLowerCase().includes(loc)) && (x.experience || 0) >= min);
        root.innerHTML = UI.pageHead('Browse resumes', 'Applicants who chose to hide their profile from your company are not listed') + `<div class="card" style="margin-bottom:16px"><form id="rf" class="filters">${UI.field({ name: 'keyword', label: 'Skill / title', value: q.keyword || '' })}${UI.field({ name: 'location', label: 'Location', value: q.location || '' })}${UI.field({ name: 'exp', label: 'Min. experience (yrs)', type: 'number', value: q.exp || '', attrs: 'min="0"' })}<button class="btn" style="height:40px">Search</button></form></div>
          <p class="muted">${list.length} resume${list.length === 1 ? '' : 's'}</p><div class="grid two">${list.map(x => { const sl = DB.one('shortlist', s => s.directorId === u.id && s.userId === x.id); return `<div class="card"><div>${applicantBlock(x, u.company)}</div><p style="margin:10px 0 0">${sl ? UI.badge('Shortlisted', 'ok') : `<button class="btn sm" data-sl="${x.id}">Shortlist candidate</button>`}</p></div>`; }).join('')}</div>`;
        UI.form(root, '#rf', d => App.go('/resumes?' + qs(d)));
        UI.click(root, '[data-sl]', b => { DB.insert('shortlist', { directorId: u.id, userId: b.dataset.sl }); notify(b.dataset.sl, `${u.company} shortlisted your profile and may contact you.`, '#/notifications'); UI.toast('Candidate shortlisted and notified.'); App.render(); });
      }
    },

    /* ----- admin ----- */
    '/directors': {
      roles: ['admin'], view(root) {
        const list = DB.find('users', x => x.role === 'director').sort((a, b) => Number(a.approved) - Number(b.approved));
        const st = d => d.approved ? ['Approved', 'ok'] : d.rejected ? ['Rejected', 'bad'] : ['Pending', 'warn'];
        root.innerHTML = UI.pageHead('Approve directors', 'Directors can post vacancies only after approval') +
          UI.table([{ h: 'Company', f: d => `<b>${esc(d.company)}</b><br><span class="muted">${esc(d.website || '')}</span>` }, { h: 'Contact', f: d => `${esc(d.name)}<br><small>${esc(d.email)} &middot; ${esc(d.phone)}</small>` }, { h: 'City', f: d => esc(d.location) }, { h: 'Status', f: d => UI.badge(...st(d)) }, { h: 'Vacancies', f: d => DB.find('vacancies', v => v.directorId === d.id).length },
            { h: '', f: d => `${d.approved ? '' : `<button class="btn sm" data-ap="${d.id}">Approve</button> `}${d.approved || d.rejected ? '' : `<button class="btn sm danger" data-rj="${d.id}">Reject</button> `}${d.approved ? `<button class="btn sm ghost" data-rj="${d.id}">Suspend</button>` : ''}` }], list, 'No directors have registered yet.');
        UI.click(root, '[data-ap]', b => { DB.update('users', b.dataset.ap, { approved: true, rejected: false }); notify(b.dataset.ap, 'Your director account has been approved. You can now post vacancies.'); UI.toast('Director approved.'); App.render(); });
        UI.click(root, '[data-rj]', b => { DB.update('users', b.dataset.rj, { approved: false, rejected: true }); UI.toast('Director rejected / suspended.', 'warn'); App.render(); });
      }
    },
    '/users': {
      roles: ['admin'], view(root) {
        const list = DB.find('users', x => x.role === 'user');
        root.innerHTML = UI.pageHead('Applicants', list.length + ' registered users') +
          UI.table([{ h: 'Name', f: x => `<b>${esc(x.name)}</b><br><small class="muted">${esc(x.email)}</small>` }, { h: 'City', f: x => esc(x.location) }, { h: 'Phone', f: x => esc(x.phone) }, { h: 'Headline', f: x => esc(x.headline || '-') }, { h: 'Experience', f: x => (x.experience || 0) + ' yrs' }, { h: 'Applications', f: x => DB.find('applications', a => a.userId === x.id).length }, { h: 'Joined', f: x => fmtDate(x.created) }, { h: '', f: x => `<button class="btn sm danger" data-del="${x.id}">Remove</button>` }], list, 'No applicants yet.');
        UI.click(root, '[data-del]', b => { if (confirm('Remove this user and their applications?')) { DB.find('applications', a => a.userId === b.dataset.del).forEach(a => DB.remove('applications', a.id)); DB.remove('users', b.dataset.del); App.render(); } });
      }
    },
    '/report': {
      roles: ['admin'], view(root) {
        const vs = DB.all('vacancies'), as = DB.all('applications'), us = DB.find('users', x => x.role === 'user');
        const count = (arr, f) => { const m = {}; arr.forEach(x => { const k = f(x) || 'Unknown'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })); };
        const top = vs.map(v => ({ label: v.title, value: as.filter(a => a.vacancyId === v.id).length })).sort((a, b) => b.value - a.value).slice(0, 5);
        root.innerHTML = UI.pageHead('Reports', 'Activity across the portal', '<button class="btn ghost" id="csv">&#11015; Download applications CSV</button>') + `<div class="grid four" style="margin-bottom:18px">${UI.stat('Applicants', us.length, '&#128100;')}${UI.stat('Directors', DB.find('users', x => x.role === 'director').length, '&#127970;')}${UI.stat('Vacancies', vs.length, '&#128188;')}${UI.stat('Applications', as.length, '&#128221;')}</div>
          <div class="grid two"><div class="card"><h3>Vacancies by category</h3>${UI.bars(count(vs, v => v.category))}</div><div class="card"><h3>Applications by status</h3>${UI.bars(count(as, a => a.status))}</div>
          <div class="card"><h3>Most applied vacancies</h3>${UI.bars(top)}</div><div class="card"><h3>Applicants by city</h3>${UI.bars(count(us, x => x.location).slice(0, 6))}</div></div>`;
        $('#csv', root).addEventListener('click', () => {
          const rows = [['Applicant', 'Email', 'Vacancy', 'Company', 'Status', 'Date']].concat(as.map(a => [user(a.userId).name, user(a.userId).email, (vac(a.vacancyId) || {}).title, (vac(a.vacancyId) || {}).company, a.status, a.created.slice(0, 10)]));
          UI.download('applications.csv', rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
        });
      }
    }
  };

  function adminDash(root) {
    const pend = DB.find('users', x => x.role === 'director' && !x.approved && !x.rejected);
    root.innerHTML = UI.pageHead('Admin dashboard') + `<div class="grid four">${UI.stat('Applicants', DB.find('users', x => x.role === 'user').length, '&#128100;')}${UI.stat('Directors', DB.find('users', x => x.role === 'director' && x.approved).length, '&#127970;')}${UI.stat('Open vacancies', DB.all('vacancies').filter(isOpen).length, '&#128188;')}${UI.stat('Awaiting approval', pend.length, '&#9203;')}</div>
      <h2 style="margin:22px 0 8px">Directors waiting for approval</h2>${UI.table([{ h: 'Company', f: d => `<b>${esc(d.company)}</b>` }, { h: 'Contact', f: d => `${esc(d.name)} &middot; ${esc(d.email)}` }, { h: 'City', f: d => esc(d.location) }, { h: '', f: d => `<button class="btn sm" data-ap="${d.id}">Approve</button>` }], pend, 'No pending directors.')}`;
    UI.click(root, '[data-ap]', b => { DB.update('users', b.dataset.ap, { approved: true }); notify(b.dataset.ap, 'Your director account has been approved. You can now post vacancies.'); UI.toast('Director approved.'); App.render(); });
  }
  function directorDash(root, u) {
    const vs = DB.find('vacancies', v => v.directorId === u.id); const as = DB.find('applications', a => a.directorId === u.id).reverse();
    root.innerHTML = UI.pageHead(u.company, 'Director dashboard', '<a class="btn" href="#/post-vacancy">+ Post vacancy</a>') + `<div class="grid four">${UI.stat('Vacancies', vs.length, '&#128188;')}${UI.stat('Open', vs.filter(isOpen).length, '&#9989;')}${UI.stat('Applicants', as.length, '&#128221;')}${UI.stat('Shortlisted', as.filter(a => a.status === 'Shortlisted').length, '&#11088;')}</div>
      <h2 style="margin:22px 0 8px">Latest applicants</h2>${UI.table([{ h: 'Applicant', f: a => applicantBlock(user(a.userId), u.company, false) }, { h: 'Vacancy', f: a => esc((vac(a.vacancyId) || {}).title) }, { h: 'Status', f: a => UI.badge(a.status) }], as.slice(0, 5), 'No applications yet.')}<p><a href="#/applicants">View all applicants &rarr;</a></p>`;
  }

  /* ---------- sample data ---------- */
  function seed() {
    DB.insert('users', { id: 'a1', role: 'admin', name: 'Portal Admin', email: 'admin@jobs.test', password: 'admin123' });
    const D = (id, n, e, c, city, ap) => DB.insert('users', { id, role: 'director', name: n, email: e, password: 'director123', company: c, phone: '555-01' + id.slice(1) + '0', website: 'www.' + c.split(' ')[0].toLowerCase() + '.test', location: city, approved: ap, rejected: false });
    D('d1', 'Priya Nair', 'hr@techcorp.test', 'TechCorp Solutions', 'Bengaluru', true); D('d2', 'Dr. Arun Rao', 'hr@carewell.test', 'CareWell Hospitals', 'Chennai', true); D('d3', 'Meera Iyer', 'hr@brightminds.test', 'BrightMinds Academy', 'Hyderabad', false);
    const U = (id, n, e, city, h, s, x, edu, intr, sum) => DB.insert('users', { id, role: 'user', name: n, email: e, password: 'user123', phone: '555-02' + id.slice(1) + '0', location: city, headline: h, skills: s, experience: x, education: edu, interest: intr, summary: sum, privacyDefault: 'public' });
    U('u1', 'Kavya Reddy', 'user@jobs.test', 'Bengaluru', 'Junior full-stack developer', 'JavaScript, HTML, CSS, Node.js, SQL', 2, 'B.E. Computer Science', 'IT & Software', 'Curious developer who enjoys building clean web apps.');
    U('u2', 'Rahul Verma', 'rahul@jobs.test', 'Chennai', 'Staff nurse', 'Patient care, ICU, First aid', 4, 'B.Sc. Nursing', 'Healthcare', 'Compassionate nurse with ICU experience.');
    U('u3', 'Sneha Pillai', 'sneha@jobs.test', 'Bengaluru', 'Accountant', 'Tally, GST, Excel, Auditing', 3, 'M.Com', 'Finance & Accounting', 'Detail-oriented accountant.');
    DB.insert('privacy', { userId: 'u3', company: 'TechCorp Solutions', level: 'limited' });
    const V = [['v1', 'd1', 'Junior Web Developer', 'IT & Software', 'Full-time', 'Bengaluru', '4,00,000 - 6,00,000 / year', 'Build and maintain responsive web applications with a small agile team.', 'HTML, CSS, JavaScript; knowledge of Node.js is a plus.'],
      ['v2', 'd1', 'QA Automation Engineer', 'IT & Software', 'Full-time', 'Bengaluru', '6,00,000 - 9,00,000 / year', 'Design automated test suites and own release quality.', '2+ years with Selenium or Cypress.'],
      ['v3', 'd1', 'Technical Support Intern', 'IT & Software', 'Internship', 'Remote', '15,000 / month', 'Help customers solve product issues over chat and email.', 'Good communication; basic networking knowledge.'],
      ['v4', 'd2', 'Staff Nurse (ICU)', 'Healthcare', 'Full-time', 'Chennai', '3,00,000 - 4,20,000 / year', 'Provide critical care in our 30-bed ICU, rotating shifts.', 'B.Sc. Nursing and 2 years ICU experience.'],
      ['v5', 'd2', 'Hospital Accountant', 'Finance & Accounting', 'Full-time', 'Chennai', '3,60,000 - 5,00,000 / year', 'Manage billing, GST filing and monthly closing.', 'M.Com or CA-Inter, Tally proficiency.'],
      ['v6', 'd2', 'Front Desk Executive', 'Hospitality', 'Part-time', 'Chennai', '12,000 / month', 'Welcome patients and manage appointments.', 'Fluent in English and Tamil.'],
      ['v7', 'd1', 'Sales Executive', 'Sales & Marketing', 'Full-time', 'Hyderabad', '3,00,000 + incentives', 'Generate leads and close deals for our SaaS products.', 'Strong communication, willingness to travel.']];
    V.forEach(v => DB.insert('vacancies', { id: v[0], directorId: v[1], company: v[1] === 'd1' ? 'TechCorp Solutions' : 'CareWell Hospitals', title: v[2], category: v[3], type: v[4], location: v[5], salary: v[6], openings: 2, lastDate: addDays(today(), 25), description: v[7], requirements: v[8], contact: v[1] === 'd1' ? 'hr@techcorp.test' : 'hr@carewell.test', image: UI.art(CAT_ICON[v[3]], ['#e0e7ff', '#dcfce7', '#fef3c7', '#fce7f3'][V.indexOf(v) % 4]), status: 'Open' }));
    DB.insert('applications', { userId: 'u1', vacancyId: 'v2', directorId: 'd1', status: 'Shortlisted', note: 'I enjoy testing and automation.' });
    DB.insert('applications', { userId: 'u3', vacancyId: 'v5', directorId: 'd2', status: 'Applied', note: '' });
    DB.insert('applications', { userId: 'u2', vacancyId: 'v4', directorId: 'd2', status: 'Applied', note: 'Available to join immediately.' });
    DB.insert('applications', { userId: 'u3', vacancyId: 'v1', directorId: 'd1', status: 'Applied', note: '' });
    DB.insert('notifications', { userId: 'u1', text: 'TechCorp Solutions shortlisted you for "QA Automation Engineer".', link: '#/applications', read: false });
  }

  App.init({
    key: 'jobconnect', name: 'JobConnect', logo: '&#128188;', currency: 'Rs.', routes, seed, home: () => '/dashboard',
    canLogin: u => u.role === 'director' && !u.approved ? (u.rejected ? 'Your director account was rejected by the admin.' : 'Your account is waiting for admin approval.') : '',
    menus: {
      guest: [['/', 'Home'], ['/jobs', 'Browse jobs'], ['/login', 'Login'], ['/register', 'Applicant register'], ['/director-register', 'Director register']],
      user: [['/dashboard', 'Dashboard'], ['/jobs', 'Find jobs'], ['/saved', 'Saved'], ['/applications', 'Applications'], ['/resume', 'My resume'], ['/privacy', 'Privacy'], ['/notifications', u => 'Notifications' + (unread(u) ? ' (' + unread(u) + ')' : '')], ['/profile', 'Profile']],
      director: [['/dashboard', 'Dashboard'], ['/post-vacancy', 'Post vacancy'], ['/my-vacancies', 'View vacancy'], ['/applicants', 'Applied users'], ['/resumes', 'Browse resumes'], ['/notifications', u => 'Notifications' + (unread(u) ? ' (' + unread(u) + ')' : '')], ['/profile', 'Profile']],
      admin: [['/dashboard', 'Dashboard'], ['/directors', 'Approve directors'], ['/users', 'View users'], ['/report', 'Reports'], ['/profile', 'Profile']]
    }
  });
})();
