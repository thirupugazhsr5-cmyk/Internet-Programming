/* =====================================================================
   19 - VetCure : online veterinary consultation for farmers
   Roles: user (farmer)  |  doctor (government CVH or private clinic)
   ===================================================================== */
(function () {
  const ANIMALS = ['Cow', 'Buffalo', 'Goat', 'Sheep', 'Horse', 'Poultry', 'Dog', 'Cat', 'Other'];
  const DISEASES = ['Foot and Mouth Disease', 'Mastitis', 'Bloat', 'Lumpy Skin Disease', 'Brucellosis', 'Newcastle Disease', 'Parasitic Infestation', 'Diarrhoea', 'Mange', 'Fever (Tick-borne)', 'Rabies', 'Milk Fever'];
  const name = id => (DB.get('users', id) || {}).name || 'Unknown';
  const doctors = () => DB.find('users', u => u.role === 'doctor');
  const isGovt = d => d.type === 'govt';
  const typeTag = d => `<span class="tag">${isGovt(d) ? 'Govt. CVH' : 'Private clinic'}</span>`;
  const activeSubs = fid => DB.find('subscriptions', s => s.farmerId === fid && s.status === 'Active');
  const datalist = (id, list) => `<datalist id="${id}">${list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;

  /* ---------- disease analysis (used by farmers + doctors) ---------- */
  function mountReport(el) {
    const st = { area: 'All', animal: 'All' };
    const draw = () => {
      const solved = DB.find('complaints', c => c.status === 'Solved' && c.diagnosis);
      const areas = [...new Set(DB.all('complaints').map(c => c.area).filter(Boolean))].sort();
      const animals = [...new Set(solved.map(c => c.animal))].sort();
      const rows = solved.filter(c => (st.area === 'All' || c.area === st.area) && (st.animal === 'All' || c.animal === st.animal));
      const count = {}; rows.forEach(c => count[c.diagnosis] = (count[c.diagnosis] || 0) + 1);
      const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]);
      const byArea = {};
      solved.forEach(c => { const a = byArea[c.area] = byArea[c.area] || {}; a[c.diagnosis] = (a[c.diagnosis] || 0) + 1; });
      const areaRows = Object.entries(byArea).map(([a, m]) => { const t = Object.entries(m).sort((x, y) => y[1] - x[1]); return { area: a, total: t.reduce((s, x) => s + x[1], 0), top: t[0][0], n: t[0][1] }; }).sort((a, b) => b.total - a.total);
      el.innerHTML = `
        <div class="card"><div class="filters">
          <div class="field"><label>Area</label><select id="r-area">${UI.options(['All', ...areas], st.area)}</select></div>
          <div class="field"><label>Animal</label><select id="r-animal">${UI.options(['All', ...animals], st.animal)}</select></div></div>
          <h3 style="margin-top:16px">${ranked.length ? `Most common disease${st.area !== 'All' ? ' in ' + esc(st.area) : ''}: <span class="tag">${esc(ranked[0][0])}</span> (${ranked[0][1]} case${ranked[0][1] > 1 ? 's' : ''})` : 'No solved cases for this selection yet'}</h3>
          ${UI.bars(ranked.map(([l, v]) => ({ label: l, value: v })))}</div>
        <h3 style="margin:18px 0 8px">Area-wise summary</h3>
        ${UI.table([{ h: 'Area', f: r => `<b>${esc(r.area)}</b>` }, { h: 'Solved cases', f: r => r.total }, { h: 'Most common disease', f: r => `${esc(r.top)} (${r.n})` }], areaRows, 'No analysed cases yet.')}`;
    };
    el.addEventListener('change', e => {
      if (e.target.id === 'r-area') { st.area = e.target.value; draw(); }
      if (e.target.id === 'r-animal') { st.animal = e.target.value; draw(); }
    });
    draw();
  }

  /* ---------- complaint card ---------- */
  function complaintCard(c, doctorView) {
    const farmer = DB.get('users', c.farmerId) || {};
    const doc = DB.get('users', c.doctorId) || {};
    return `<div class="card"><div class="row between"><div><h3 style="margin:0">${esc(c.title)}</h3>
      <span class="muted">${esc(c.animal)} &middot; ${esc(c.area)} &middot; ${fmtDateTime(c.created)}</span></div>${UI.badge(c.status)}</div>
      <p class="muted" style="margin:8px 0">${doctorView ? `Farmer: <b>${esc(farmer.name)}</b> (${esc(farmer.phone || 'no phone')})` : `Sent to: <b>${esc(doc.name)}</b>`}</p>
      ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      <div>${(c.media || []).map(UI.media).join('')}</div>
      ${c.status === 'Solved' ? `<div class="note" style="margin-top:10px"><b>Diagnosis:</b> ${esc(c.diagnosis)}<br><b>Prescription:</b> ${esc(c.prescription)}${c.advice ? `<br><b>Advice:</b> ${esc(c.advice)}` : ''}<br><small>Answered ${fmtDateTime(c.solvedAt)}${doctorView ? '' : ' by ' + esc(doc.name)}</small></div>` : ''}
      <div class="row" style="margin-top:10px">${doctorView ? `<button class="btn sm" data-solve="${c.id}">${c.status === 'Solved' ? 'Edit solution' : 'Post solution'}</button>` : (c.status === 'Pending' ? `<button class="btn sm danger" data-withdraw="${c.id}">Withdraw</button>` : '')}</div></div>`;
  }

  /* ---------- routes ---------- */
  const routes = {
    '/': {
      view(root, q, user) {
        if (user) { App.go('/dashboard'); return; }
        const news = DB.all('news').slice(-3).reverse();
        root.innerHTML = `<div class="hero"><span class="big">&#128004;</span><h1>A veterinary doctor in every village</h1>
          <p>Send your sick animal's signs and symptoms as a video, audio note, photo or plain text. A government or private veterinary doctor will study it and reply with a diagnosis and prescription.</p>
          <a class="btn accent" href="#/register">I am a farmer</a><a class="btn ghost" href="#/doctor-register">I am a doctor</a><a class="btn ghost" href="#/login">Login</a></div>
          <div class="grid three"><div class="card"><h3>&#127909; Any format</h3><p class="muted">Upload video, audio, images or write the symptoms. Everything is saved to your account automatically.</p></div>
          <div class="card"><h3>&#127973; Govt. CVH is free</h3><p class="muted">Subscribe free to Government Central Veterinary Hospitals. Private clinic doctors charge a fee payable by bank transfer or EasyPaisa.</p></div>
          <div class="card"><h3>&#128202; Disease analysis</h3><p class="muted">The system studies recorded cases to show which disease is attacking animals most in your area.</p></div></div>
          <h2 style="margin-top:26px">Latest news</h2>${news.length ? `<div class="grid three">${news.map(n => `<div class="card"><h3>${esc(n.title)}</h3><p class="muted">${esc(n.body.slice(0, 140))}${n.body.length > 140 ? '…' : ''}</p><small class="muted">${fmtDate(n.created)}</small></div>`).join('')}</div>` : UI.empty('No news yet.')}`;
      }
    },
    '/login': { guest: true, view: root => App.loginView(root, { title: 'Login', blurb: 'Farmers and doctors log in here.', registerLinks: [['/register', 'Farmer registration'], ['/doctor-register', 'Doctor registration']], demo: [{ role: 'Farmer', email: 'farmer@vetcure.test', password: 'farmer123' }, { role: 'Govt. doctor', email: 'govt@vetcure.test', password: 'doctor123' }, { role: 'Private doctor', email: 'private@vetcure.test', password: 'doctor123' }] }) },
    '/register': {
      guest: true, view: root => App.registerView(root, {
        title: 'Farmer registration', role: 'user', intro: 'Register first, then subscribe to a doctor.',
        fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Mobile number', required: true }, { name: 'area', label: 'Village / area', required: true, hint: 'Used for the area-wise disease report' }]
      })
    },
    '/doctor-register': {
      guest: true, view: root => App.registerView(root, {
        title: 'Doctor registration', role: 'doctor', intro: 'Private doctors must give payment details so farmers can pay the subscription fee.',
        fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Mobile number', required: true },
          { name: 'type', label: 'Doctor type', type: 'select', options: [['govt', 'Government CVH (free for farmers)'], ['private', 'Private clinic (paid)']] },
          { name: 'clinic', label: 'Hospital / clinic name', required: true }, { name: 'specialization', label: 'Specialization', placeholder: 'e.g. Large animals' }, { name: 'area', label: 'Area served', required: true },
          { name: 'fee', label: 'Subscription fee (private only)', type: 'number', attrs: 'min="0"', value: 0 },
          { name: 'bankName', label: 'Bank name' }, { name: 'bankTitle', label: 'Account title' }, { name: 'bankAccount', label: 'Bank account / IBAN' }, { name: 'easypaisa', label: 'EasyPaisa account number' }],
        extra: d => {
          if (d.type === 'private' && !d.bankAccount && !d.easypaisa) throw new Error('Private doctors must provide bank details or an EasyPaisa account.');
          return { fee: d.type === 'govt' ? 0 : Number(d.fee || 0) };
        }
      })
    },

    /* ---------------- shared ---------------- */
    '/news': {
      view(root) {
        const news = DB.all('news').slice().reverse();
        root.innerHTML = UI.pageHead('News & health alerts', 'Posted by veterinary doctors') + (news.length ? `<div class="grid two">${news.map(n => `<div class="card"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><small class="muted">By ${esc(name(n.doctorId))} &middot; ${fmtDate(n.created)}</small></div>`).join('')}</div>` : UI.empty('No news yet.'));
      }
    },
    '/profile': {
      roles: '*', view(root, q, u) {
        const f = [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', attrs: 'readonly' }, { name: 'phone', label: 'Mobile number' }];
        if (u.role === 'user') f.push({ name: 'area', label: 'Village / area' });
        else f.push({ name: 'clinic', label: 'Hospital / clinic' }, { name: 'specialization', label: 'Specialization' }, { name: 'area', label: 'Area served' },
          ...(isGovt(u) ? [] : [{ name: 'fee', label: 'Subscription fee', type: 'number' }]), { name: 'bankName', label: 'Bank name' }, { name: 'bankTitle', label: 'Account title' }, { name: 'bankAccount', label: 'Bank account / IBAN' }, { name: 'easypaisa', label: 'EasyPaisa number' });
        App.profileView(root, u, f);
      }
    },

    /* ---------------- farmer ---------------- */
    '/dashboard': {
      roles: ['user', 'doctor'], view(root, q, u) {
        if (u.role === 'doctor') return doctorDashboard(root, u);
        const mine = DB.find('complaints', c => c.farmerId === u.id);
        const recent = mine.slice().reverse().slice(0, 3);
        root.innerHTML = UI.pageHead('Welcome, ' + u.name, u.area + ' area', '<a class="btn" href="#/complaint">+ Post complaint</a>') + `
          <div class="grid four">${UI.stat('Active doctors', activeSubs(u.id).length, '&#129658;')}${UI.stat('Complaints sent', mine.length, '&#128231;')}${UI.stat('Pending', mine.filter(c => c.status === 'Pending').length, '&#9203;')}${UI.stat('Solved', mine.filter(c => c.status === 'Solved').length, '&#9989;')}</div>
          <h2 style="margin-top:22px">Recent complaints</h2>${recent.length ? `<div class="stack">${recent.map(c => complaintCard(c)).join('')}</div>` : UI.empty('You have not posted any complaint yet.')}`;
        UI.click(root, '[data-withdraw]', withdraw);
      }
    },
    '/doctors': {
      roles: ['user'], view(root, q, u) {
        const draw = () => {
          root.innerHTML = UI.pageHead('Veterinary doctors', 'Subscribe to a doctor to send complaints. Government CVH doctors are free.') + `<div class="grid three">${doctors().map(d => {
            const sub = DB.one('subscriptions', s => s.farmerId === u.id && s.doctorId === d.id);
            const btn = sub && sub.status === 'Active' ? '<span class="badge ok">Subscribed &#10003;</span>'
              : sub ? `<a class="btn sm accent" href="#/payment?doctor=${d.id}">Complete payment</a>`
                : `<button class="btn sm" data-sub="${d.id}">${isGovt(d) ? 'Subscribe (free)' : 'Subscribe &amp; pay'}</button>`;
            return `<div class="card"><div class="row between"><h3 style="margin:0">${esc(d.name)}</h3>${typeTag(d)}</div>
              <p class="muted" style="margin:6px 0">${esc(d.clinic)}<br>${esc(d.specialization || 'General practice')} &middot; ${esc(d.area)}</p>
              <p class="price">${isGovt(d) ? 'Free' : money(d.fee) + ' <small>/ month</small>'}</p>
              ${!isGovt(d) ? `<p class="muted"><small>Pays via: ${[d.bankAccount ? 'Bank transfer' : '', d.easypaisa ? 'EasyPaisa' : ''].filter(Boolean).join(', ')}</small></p>` : ''}${btn}</div>`;
          }).join('')}</div>`;
        };
        draw();
        UI.click(root, '[data-sub]', b => {
          const d = DB.get('users', b.dataset.sub);
          if (isGovt(d)) { DB.insert('subscriptions', { farmerId: u.id, doctorId: d.id, status: 'Active', amount: 0 }); UI.toast('Subscribed to ' + d.name + '.'); draw(); }
          else { DB.insert('subscriptions', { farmerId: u.id, doctorId: d.id, status: 'Pending Payment', amount: d.fee }); App.go('/payment?doctor=' + d.id); }
        });
      }
    },
    '/payment': {
      roles: ['user'], view(root, q, u) {
        const pend = DB.find('subscriptions', s => s.farmerId === u.id && s.status === 'Pending Payment');
        const history = DB.find('payments', p => p.farmerId === u.id).reverse();
        const hist = `<h3 style="margin:22px 0 8px">My payments</h3>${UI.table([{ h: 'Date', f: p => fmtDate(p.created) }, { h: 'Doctor', f: p => esc(name(p.doctorId)) }, { h: 'Amount', f: p => money(p.amount) }, { h: 'Method', f: p => esc(p.method) }, { h: 'Reference', f: p => esc(p.ref) }, { h: 'Status', f: p => UI.badge(p.status) }], history, 'No payments yet.')}`;
        if (!pend.length) { root.innerHTML = UI.pageHead('Make payment') + `<div class="note">You have no subscription waiting for payment. Government CVH doctors are free; to subscribe to a private doctor, open <a href="#/doctors">Doctors</a>.</div>` + hist; return; }
        const sel = q.doctor && pend.some(s => s.doctorId === q.doctor) ? q.doctor : pend[0].doctorId;
        root.innerHTML = UI.pageHead('Make payment', 'Pay the private doctor directly using the account details shown below.') + `
          <div class="card narrow"><form id="pay" class="form">
            ${UI.field({ name: 'doctor', label: 'Doctor', type: 'select', value: sel, options: pend.map(s => [s.doctorId, name(s.doctorId) + ' - ' + money(s.amount)]) })}
            <div class="field"><label>Payment method</label><div class="row"><label class="check"><input type="radio" name="method" value="Bank Transfer" checked> Bank transfer</label><label class="check"><input type="radio" name="method" value="EasyPaisa"> EasyPaisa</label></div></div>
            <div id="payinfo" class="note"></div>
            ${UI.field({ name: 'ref', label: 'Transaction / reference number', required: true, hint: 'Enter the reference you received after sending the money' })}
            <button class="btn">Confirm payment</button></form></div>${hist}`;
        const info = () => {
          const d = DB.get('users', $('#f-doctor', root).value); const m = $('input[name=method]:checked', root).value;
          $('#payinfo', root).innerHTML = m === 'Bank Transfer'
            ? (d.bankAccount ? `<b>Bank:</b> ${esc(d.bankName || '-')}<br><b>Account title:</b> ${esc(d.bankTitle || d.name)}<br><b>Account no.:</b> ${esc(d.bankAccount)}` : 'This doctor has not provided bank details. Choose EasyPaisa.')
            : (d.easypaisa ? `<b>EasyPaisa number:</b> ${esc(d.easypaisa)}<br><b>Account name:</b> ${esc(d.bankTitle || d.name)}` : 'This doctor has not provided an EasyPaisa account. Choose bank transfer.');
        };
        root.addEventListener('change', e => { if (e.target.id === 'f-doctor' || e.target.name === 'method') info(); });
        info();
        UI.form(root, '#pay', d => {
          const doc = DB.get('users', d.doctor);
          if (d.method === 'Bank Transfer' && !doc.bankAccount) throw new Error('This doctor does not accept bank transfers.');
          if (d.method === 'EasyPaisa' && !doc.easypaisa) throw new Error('This doctor does not accept EasyPaisa.');
          const sub = pend.find(s => s.doctorId === d.doctor);
          const p = DB.insert('payments', { farmerId: u.id, doctorId: d.doctor, amount: sub.amount, method: d.method, ref: d.ref, status: 'Paid' });
          DB.update('subscriptions', sub.id, { status: 'Active', paymentId: p.id });
          UI.toast('Payment recorded. You can now send complaints to ' + doc.name + '.'); App.go('/doctors');
        });
      }
    },
    '/complaint': {
      roles: ['user'], view(root, q, u) {
        const act = activeSubs(u.id);
        if (!act.length) { root.innerHTML = UI.pageHead('Post complaint') + `<div class="note warn">You are not subscribed to any doctor yet. Please <a href="#/doctors">subscribe to a doctor</a> first (government CVH doctors are free).</div>`; return; }
        root.innerHTML = UI.pageHead('Post complaint', 'Describe the signs and symptoms. You can attach video, audio and images.') + `<div class="card narrow"><form id="cf" class="form">
          ${UI.field({ name: 'doctorId', label: 'Send to doctor', type: 'select', required: true, options: act.map(s => [s.doctorId, name(s.doctorId)]) })}
          ${UI.field({ name: 'animal', label: 'Animal', type: 'select', options: ANIMALS })}
          ${UI.field({ name: 'area', label: 'Area / village', value: u.area, required: true })}
          ${UI.field({ name: 'title', label: 'Short summary', required: true, placeholder: 'e.g. Cow not eating, swollen udder' })}
          ${UI.field({ name: 'description', label: 'Signs and symptoms (text)', type: 'textarea', hint: 'Optional if you attach a video, audio or photo' })}
          ${UI.field({ name: 'media', label: 'Video / audio / images', type: 'file', attrs: 'multiple accept="image/*,video/*,audio/*"', hint: 'Photos are compressed. Video/audio larger than 1.5 MB are not stored in this browser-only demo.' })}
          <button class="btn">Send to doctor</button></form></div>`;
        UI.form(root, '#cf', async (d, f) => {
          const media = await UI.readFiles(f.elements.media);
          if (!d.description && !media.length) throw new Error('Please write the symptoms or attach a video, audio or image.');
          DB.insert('complaints', { farmerId: u.id, doctorId: d.doctorId, animal: d.animal, area: d.area, title: d.title, description: d.description, media, status: 'Pending' });
          UI.toast('Complaint sent to the doctor.'); App.go('/my-complaints');
        });
      }
    },
    '/my-complaints': {
      roles: ['user'], view(root, q, u) {
        const list = DB.find('complaints', c => c.farmerId === u.id).reverse();
        root.innerHTML = UI.pageHead('My complaint status', '', '<a class="btn" href="#/complaint">+ Post complaint</a>') + (list.length ? `<div class="stack">${list.map(c => complaintCard(c)).join('')}</div>` : UI.empty('No complaints yet.'));
        UI.click(root, '[data-withdraw]', withdraw);
      }
    },
    '/vetcure': {
      roles: ['user'], view(root) {
        const draw = (term = '') => {
          const t = term.toLowerCase();
          const cures = DB.all('cures').filter(c => !t || (c.disease + c.animal + c.symptoms).toLowerCase().includes(t));
          $('#cures', root).innerHTML = cures.length ? cures.map(c => `<div class="card item"><img class="cover" src="${esc(c.image)}" alt="${esc(c.disease)}"><div class="body"><h3 style="margin:0">${esc(c.disease)}</h3><span><span class="tag">${esc(c.animal)}</span></span><p style="margin:0"><b>Symptoms:</b> ${esc(c.symptoms)}</p><p style="margin:0"><b>Prescription:</b> ${esc(c.prescription)}</p><small class="muted">By ${esc(name(c.doctorId))}</small></div></div>`).join('') : UI.empty('No matching disease found.');
        };
        root.innerHTML = UI.pageHead('VetCure details', 'About the service and a gallery of common animal diseases with their prescriptions') + `
          <div class="card"><p>VetCure connects farmers with veterinary doctors. Send a complaint with symptoms, receive a diagnosis and prescription, and follow the disease gallery below to recognise common illnesses early. <b>This information is a guide only - always follow your doctor's prescription.</b></p></div>
          <div class="filters" style="margin:16px 0"><div class="field"><label>Search disease / animal</label><input id="q" placeholder="e.g. mastitis, cow"></div></div><div class="grid three" id="cures"></div>`;
        draw(); $('#q', root).addEventListener('input', e => draw(e.target.value));
      }
    },
    '/report': { roles: ['user'], view(root) { root.innerHTML = UI.pageHead('Disease report', 'Which disease attacks animals most in a specific area (from solved cases)') + '<div id="rep"></div>'; mountReport($('#rep', root)); } },
    '/feedback': {
      roles: ['user'], view(root, q, u) {
        const mine = DB.find('feedback', f => f.farmerId === u.id).reverse();
        root.innerHTML = UI.pageHead('Feedback', 'Tell us about your experience') + `<div class="grid two"><div class="card"><form id="ff" class="form">
          ${UI.field({ name: 'doctorId', label: 'About', type: 'select', options: [['', 'VetCure service (general)'], ...doctors().map(d => [d.id, d.name])] })}
          ${UI.field({ name: 'rating', label: 'Rating', type: 'select', value: '5', options: [['5', '5 - Excellent'], ['4', '4 - Good'], ['3', '3 - Average'], ['2', '2 - Poor'], ['1', '1 - Very poor']] })}
          ${UI.field({ name: 'message', label: 'Your message', type: 'textarea', required: true })}<button class="btn">Submit feedback</button></form></div>
          <div class="card"><h3>My earlier feedback</h3>${mine.length ? `<ul class="list">${mine.map(f => `<li>${UI.stars(f.rating)} <b>${f.doctorId ? esc(name(f.doctorId)) : 'General'}</b><br>${esc(f.message)}<br><small class="muted">${fmtDate(f.created)}</small></li>`).join('')}</ul>` : '<p class="muted">Nothing yet.</p>'}</div></div>`;
        UI.form(root, '#ff', d => { DB.insert('feedback', { farmerId: u.id, doctorId: d.doctorId, rating: Number(d.rating), message: d.message }); UI.toast('Thank you for your feedback!'); App.render(); });
      }
    },

    /* ---------------- doctor ---------------- */
    '/complaints': {
      roles: ['doctor'], view(root, q, u) {
        const s = q.s || 'Pending';
        const all = DB.find('complaints', c => c.doctorId === u.id).reverse();
        const list = all.filter(c => s === 'All' || c.status === s);
        root.innerHTML = UI.pageHead('Farmer complaints', 'View complaints and post your solution') +
          `<div class="tabs">${['Pending', 'Solved', 'All'].map(t => `<a class="${s === t ? 'on' : ''}" href="#/complaints?s=${t}">${t}${t === 'All' ? '' : ' (' + all.filter(c => c.status === t).length + ')'}</a>`).join('')}</div>` +
          (list.length ? `<div class="stack">${list.map(c => complaintCard(c, true)).join('')}</div>` : UI.empty('No complaints here.'));
        UI.click(root, '[data-solve]', b => solveModal(DB.get('complaints', b.dataset.solve)));
      }
    },
    '/cures': {
      roles: ['doctor'], view(root, q, u) {
        const edit = q.id ? DB.get('cures', q.id) : null;
        const mine = DB.find('cures', c => c.doctorId === u.id);
        root.innerHTML = UI.pageHead('Manage cure', 'Add diseases with image and prescription for the VetCure gallery') + `
          <div class="card" style="margin-bottom:18px"><h3>${edit ? 'Edit' : 'Add'} disease</h3><form id="cf" class="form two">
            ${UI.field({ name: 'disease', label: 'Disease', required: true, value: edit && edit.disease, attrs: 'list="dl"' })}${datalist('dl', DISEASES)}
            ${UI.field({ name: 'animal', label: 'Animal', type: 'select', options: ANIMALS, value: edit && edit.animal })}
            ${UI.field({ name: 'symptoms', label: 'Signs and symptoms', type: 'textarea', required: true, value: edit && edit.symptoms, cls: 'full', rows: 3 })}
            ${UI.field({ name: 'prescription', label: 'Prescription / treatment', type: 'textarea', required: true, value: edit && edit.prescription, cls: 'full', rows: 3 })}
            ${UI.field({ name: 'image', label: 'Image of affected animal', type: 'file', attrs: 'accept="image/*"', cls: 'full', hint: edit ? 'Leave empty to keep the current image' : '' })}
            <div class="full"><button class="btn">${edit ? 'Update' : 'Add'} disease</button> ${edit ? '<a class="btn ghost" href="#/cures">Cancel</a>' : ''}</div></form></div>
          ${UI.table([{ h: 'Image', f: c => `<img class="thumb" style="width:80px;height:56px" src="${esc(c.image)}" alt="">` }, { h: 'Disease', f: c => `<b>${esc(c.disease)}</b>` }, { h: 'Animal', f: c => esc(c.animal) }, { h: 'Prescription', f: c => esc(c.prescription) }, { h: '', f: c => `<a class="btn sm ghost" href="#/cures?id=${c.id}">Edit</a> <button class="btn sm danger" data-del="${c.id}">Delete</button>` }], mine, 'You have not added any disease yet.')}`;
        UI.form(root, '#cf', async (d, f) => {
          const img = (await UI.readFiles(f.elements.image))[0];
          const rec = { doctorId: u.id, disease: d.disease, animal: d.animal, symptoms: d.symptoms, prescription: d.prescription };
          if (img && img.data) rec.image = img.data; else if (!edit) rec.image = UI.art('&#128004;', '#e0f2f1');
          if (edit) DB.update('cures', edit.id, rec); else DB.insert('cures', rec);
          UI.toast('Saved.'); App.go('/cures');
        });
        UI.click(root, '[data-del]', b => { if (confirm('Delete this disease entry?')) { DB.remove('cures', b.dataset.del); App.render(); } });
      }
    },
    '/manage-news': {
      roles: ['doctor'], view(root, q, u) {
        const edit = q.id ? DB.get('news', q.id) : null;
        const mine = DB.find('news', n => n.doctorId === u.id).reverse();
        root.innerHTML = UI.pageHead('Manage news') + `<div class="card" style="margin-bottom:18px"><form id="nf" class="form">
          ${UI.field({ name: 'title', label: 'Headline', required: true, value: edit && edit.title })}${UI.field({ name: 'body', label: 'Details', type: 'textarea', required: true, value: edit && edit.body })}
          <div><button class="btn">${edit ? 'Update' : 'Publish'} news</button> ${edit ? '<a class="btn ghost" href="#/manage-news">Cancel</a>' : ''}</div></form></div>
          ${UI.table([{ h: 'Date', f: n => fmtDate(n.created) }, { h: 'Headline', f: n => `<b>${esc(n.title)}</b><br><span class="muted">${esc(n.body.slice(0, 90))}</span>` }, { h: '', f: n => `<a class="btn sm ghost" href="#/manage-news?id=${n.id}">Edit</a> <button class="btn sm danger" data-del="${n.id}">Delete</button>` }], mine, 'You have not published any news.')}`;
        UI.form(root, '#nf', d => { if (edit) DB.update('news', edit.id, d); else DB.insert('news', { doctorId: u.id, title: d.title, body: d.body }); UI.toast('News saved.'); App.go('/manage-news'); });
        UI.click(root, '[data-del]', b => { if (confirm('Delete this news item?')) { DB.remove('news', b.dataset.del); App.render(); } });
      }
    },
    '/farmers': {
      roles: ['doctor'], view(root, q, u) {
        const subs = DB.find('subscriptions', s => s.doctorId === u.id && s.status === 'Active');
        root.innerHTML = UI.pageHead('Subscribed farmers', 'Farmers who can send complaints to you') +
          UI.table([{ h: 'Name', f: s => `<b>${esc(name(s.farmerId))}</b>` }, { h: 'Mobile', f: s => esc((DB.get('users', s.farmerId) || {}).phone) }, { h: 'Email', f: s => esc((DB.get('users', s.farmerId) || {}).email) }, { h: 'Area', f: s => esc((DB.get('users', s.farmerId) || {}).area) }, { h: 'Since', f: s => fmtDate(s.created) }, { h: 'Complaints', f: s => DB.find('complaints', c => c.farmerId === s.farmerId && c.doctorId === u.id).length }], subs, 'No farmer has subscribed yet.');
      }
    },
    '/payments': {
      roles: ['doctor'], view(root, q, u) {
        const pays = DB.find('payments', p => p.doctorId === u.id).reverse();
        root.innerHTML = UI.pageHead('Payment details') + `<div class="grid four" style="margin-bottom:16px">${UI.stat('Payments received', pays.length, '&#128179;')}${UI.stat('Total amount', money(pays.reduce((s, p) => s + p.amount, 0)), '&#128176;')}</div>` +
          UI.table([{ h: 'Date', f: p => fmtDateTime(p.created) }, { h: 'Farmer', f: p => esc(name(p.farmerId)) }, { h: 'Amount', f: p => money(p.amount) }, { h: 'Method', f: p => esc(p.method) }, { h: 'Reference', f: p => esc(p.ref) }, { h: 'Status', f: p => UI.badge(p.status) }], pays, isGovt(u) ? 'Government doctors are free for farmers, so there are no payments.' : 'No payments received yet.');
      }
    },
    '/feedbacks': {
      roles: ['doctor'], view(root, q, u) {
        const list = DB.find('feedback', f => f.doctorId === u.id).reverse();
        const avg = list.length ? (list.reduce((s, f) => s + f.rating, 0) / list.length).toFixed(1) : '-';
        root.innerHTML = UI.pageHead('Feedback details') + `<div class="grid four" style="margin-bottom:16px">${UI.stat('Reviews', list.length, '&#128172;')}${UI.stat('Average rating', avg, '&#11088;')}</div>` +
          (list.length ? `<div class="stack">${list.map(f => `<div class="card">${UI.stars(f.rating)} <b>${esc(name(f.farmerId))}</b> <small class="muted">${fmtDate(f.created)}</small><p style="margin:6px 0 0">${esc(f.message)}</p></div>`).join('')}</div>` : UI.empty('No feedback yet.'));
      }
    }
  };

  function doctorDashboard(root, u) {
    const mine = DB.find('complaints', c => c.doctorId === u.id);
    root.innerHTML = UI.pageHead('Welcome, ' + u.name, u.clinic + ' ' + (isGovt(u) ? '(Government CVH)' : '(Private)'), '<a class="btn" href="#/complaints">View complaints</a>') +
      `<div class="grid four">${UI.stat('Pending complaints', mine.filter(c => c.status === 'Pending').length, '&#9203;')}${UI.stat('Solved', mine.filter(c => c.status === 'Solved').length, '&#9989;')}${UI.stat('Subscribed farmers', DB.find('subscriptions', s => s.doctorId === u.id && s.status === 'Active').length, '&#128104;&#8205;&#127806;')}${UI.stat('Earnings', money(DB.find('payments', p => p.doctorId === u.id).reduce((s, p) => s + p.amount, 0)), '&#128176;')}</div>
      <h2 style="margin:22px 0 8px">Disease analysis by area</h2><div id="rep"></div>`;
    mountReport($('#rep', root));
  }

  function withdraw(b) {
    if (!confirm('Withdraw this complaint?')) return;
    DB.remove('complaints', b.dataset.withdraw); UI.toast('Complaint withdrawn.'); App.render();
  }

  function solveModal(c) {
    const m = UI.modal('Post solution - ' + c.title, `<form id="sf" class="form">
      ${UI.field({ name: 'diagnosis', label: 'Diagnosis (disease)', required: true, value: c.diagnosis, attrs: 'list="dl2"' })}${datalist('dl2', DISEASES)}
      ${UI.field({ name: 'prescription', label: 'Prescription', type: 'textarea', required: true, value: c.prescription })}
      ${UI.field({ name: 'advice', label: 'Advice / precautions', type: 'textarea', value: c.advice, rows: 3 })}
      <label class="check"><input type="checkbox" name="gallery" value="1"> Also add this disease to the VetCure gallery</label>
      <button class="btn">Send solution</button></form>`);
    UI.form(m.el, '#sf', d => {
      DB.update('complaints', c.id, { status: 'Solved', diagnosis: d.diagnosis, prescription: d.prescription, advice: d.advice, solvedAt: new Date().toISOString() });
      if (d.gallery && !DB.one('cures', x => x.disease.toLowerCase() === d.diagnosis.toLowerCase() && x.animal === c.animal)) {
        const img = (c.media || []).find(x => x.data && x.type.startsWith('image/'));
        DB.insert('cures', { doctorId: c.doctorId, disease: d.diagnosis, animal: c.animal, symptoms: c.description || c.title, prescription: d.prescription, image: img ? img.data : UI.art('&#128004;', '#e0f2f1') });
      }
      m.close(); UI.toast('Solution sent to the farmer.'); App.render();
    });
  }

  /* ---------- sample data ---------- */
  function seed() {
    const mk = (id, o) => DB.insert('users', Object.assign({ id, password: 'doctor123' }, o));
    mk('d1', { role: 'doctor', name: 'Dr. Ayesha Khan', email: 'govt@vetcure.test', phone: '0300-1112233', type: 'govt', clinic: 'Govt. Central Veterinary Hospital (CVH)', specialization: 'Large animals', area: 'Riverside', fee: 0 });
    mk('d2', { role: 'doctor', name: 'Dr. Ravi Menon', email: 'private@vetcure.test', phone: '0321-9988776', type: 'private', clinic: 'GreenPaws Veterinary Clinic', specialization: 'Dairy cattle & pets', area: 'Hilltop', fee: 500, bankName: 'City Bank', bankTitle: 'GreenPaws Veterinary Clinic', bankAccount: 'PK36CITY0000123456789', easypaisa: '0321-9988776' });
    const f = (id, n, e, a) => DB.insert('users', { id, role: 'user', name: n, email: e, password: 'farmer123', phone: '0345-000' + id.slice(1) + '111', area: a });
    f('f1', 'Ramesh Farmer', 'farmer@vetcure.test', 'Riverside'); f('f2', 'Sita Devi', 'sita@vetcure.test', 'Hilltop'); f('f3', 'Imran Ali', 'imran@vetcure.test', 'Lakeview');
    DB.insert('subscriptions', { farmerId: 'f1', doctorId: 'd1', status: 'Active', amount: 0 });
    DB.insert('subscriptions', { farmerId: 'f2', doctorId: 'd1', status: 'Active', amount: 0 });
    DB.insert('subscriptions', { farmerId: 'f2', doctorId: 'd2', status: 'Active', amount: 500 });
    DB.insert('payments', { farmerId: 'f2', doctorId: 'd2', amount: 500, method: 'EasyPaisa', ref: 'EP-883120', status: 'Paid' });
    const days = n => new Date(Date.now() - n * 86400000).toISOString();
    const cases = [['f1', 'd1', 'Cow', 'Riverside', 'Mouth blisters and limping', 'Foot and Mouth Disease'], ['f1', 'd1', 'Buffalo', 'Riverside', 'Drooling, will not eat', 'Foot and Mouth Disease'], ['f1', 'd1', 'Cow', 'Riverside', 'Hot swollen udder', 'Mastitis'],
      ['f2', 'd2', 'Cow', 'Hilltop', 'Reduced milk, clotted milk', 'Mastitis'], ['f2', 'd2', 'Cow', 'Hilltop', 'Swollen udder, fever', 'Mastitis'], ['f2', 'd1', 'Goat', 'Hilltop', 'Skin nodules all over', 'Lumpy Skin Disease'],
      ['f3', 'd1', 'Poultry', 'Lakeview', 'Twisted necks, green droppings', 'Newcastle Disease'], ['f3', 'd1', 'Poultry', 'Lakeview', 'Many birds sudden death', 'Newcastle Disease'], ['f3', 'd1', 'Dog', 'Lakeview', 'Hair loss and itching', 'Mange']];
    cases.forEach((c, i) => DB.insert('complaints', { farmerId: c[0], doctorId: c[1], animal: c[2], area: c[3], title: c[4], description: c[4] + '. Started two days ago.', media: [], status: 'Solved', diagnosis: c[5], prescription: 'Follow the standard treatment for ' + c[5] + '; isolate the animal.', advice: 'Keep the shed clean and dry.', solvedAt: days(i), created: days(i + 1) }));
    DB.insert('complaints', { farmerId: 'f1', doctorId: 'd1', animal: 'Cow', area: 'Riverside', title: 'Cow is bloated after eating green fodder', description: 'Left side of the abdomen is swollen and she is restless.', media: [], status: 'Pending' });
    [['Foot and Mouth Disease', 'Cow', 'Fever, blisters in the mouth and between hooves, drooling, limping, drop in milk.', 'Isolate sick animals, wash mouth with mild antiseptic (potassium permanganate), supportive care and vaccinate the herd.', '&#128004;', '#fde68a'],
      ['Mastitis', 'Cow', 'Hot, swollen, painful udder, clots or blood in milk, fever, reduced milk yield.', 'Strip the quarter frequently, intramammary antibiotic course as prescribed, improve milking hygiene.', '&#129371;', '#bfdbfe'],
      ['Newcastle Disease', 'Poultry', 'Gasping, greenish diarrhoea, twisted neck, sudden deaths in the flock.', 'No cure once infected: isolate, disinfect the shed and vaccinate healthy birds (Lasota/R2B).', '&#128020;', '#fecaca'],
      ['Mange', 'Dog', 'Intense itching, hair loss, scabs and thickened skin.', 'Medicated bath, ivermectin or as prescribed, treat bedding and in-contact animals.', '&#128021;', '#ddd6fe']]
      .forEach(c => DB.insert('cures', { doctorId: 'd1', disease: c[0], animal: c[1], symptoms: c[2], prescription: c[3], image: UI.art(c[4], c[5]) }));
    DB.insert('news', { doctorId: 'd1', title: 'Free FMD vaccination camp this Saturday', body: 'The Government CVH will vaccinate cattle and buffaloes against Foot and Mouth Disease free of charge. Bring your animal tag card.' });
    DB.insert('news', { doctorId: 'd2', title: 'Protect dairy animals from mastitis this monsoon', body: 'Wet bedding increases mastitis risk. Keep sheds dry, dip teats after milking and report swollen udders early.' });
  }

  App.init({
    key: 'vetcure', name: 'VetCure', logo: '&#128004;', currency: 'Rs.', routes, seed, home: () => '/dashboard',
    menus: {
      guest: [['/', 'Home'], ['/news', 'News'], ['/login', 'Login'], ['/register', 'Farmer register'], ['/doctor-register', 'Doctor register']],
      user: [['/dashboard', 'Home'], ['/complaint', 'Post complaint'], ['/my-complaints', 'My complaints'], ['/doctors', 'Doctors'], ['/vetcure', 'VetCure details'], ['/news', 'News'], ['/report', 'Report'], ['/payment', 'Payment'], ['/feedback', 'Feedback'], ['/profile', 'Profile']],
      doctor: [['/dashboard', 'Dashboard'], ['/complaints', 'Complaints'], ['/cures', 'Manage cure'], ['/manage-news', 'Manage news'], ['/farmers', 'Farmers'], ['/payments', 'Payments'], ['/feedbacks', 'Feedback'], ['/profile', 'Profile']]
    }
  });
})();
