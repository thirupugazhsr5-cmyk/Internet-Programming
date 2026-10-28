/* =====================================================================
   22 - CleanCity : solid waste management (segregation, collection, transport)
   Roles: admin  |  public (citizen)  |  driver (workforce)
   ===================================================================== */
(function () {
  /* ---------- map & routing maths ---------- */
  const B = { lat0: 12.94, lat1: 13.0, lng0: 77.55, lng1: 77.64 };           // area shown on the map
  const DEPOT = { id: 'depot', name: 'Municipal depot', lat: 12.95, lng: 77.56 };
  const DUMP = { id: 'dump', name: 'Dumping site', lat: 12.99, lng: 77.635 };
  const W = 870, H = 600, KG_PER_LITRE = 0.18, THRESHOLD = 70;
  const COMPLAINTS = ['Overflowing bin', 'Missed collection', 'Illegal dumping', 'Damaged / missing bin', 'Bad smell', 'Other'];
  const px = p => ({ x: (p.lng - B.lng0) / (B.lng1 - B.lng0) * W, y: (B.lat1 - p.lat) / (B.lat1 - B.lat0) * H });
  const colour = f => f >= 80 ? '#ef4444' : f >= 50 ? '#f59e0b' : '#22c55e';
  const rad = x => x * Math.PI / 180;
  const hav = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  const pathLen = pts => pts.slice(1).reduce((s, p, i) => s + hav(pts[i], p), 0);
  const routeLen = order => order.length ? pathLen([DEPOT, ...order, DUMP]) : 0;
  const estKg = b => Math.round(b.capacity * b.fill / 100 * KG_PER_LITRE);

  function nearest(start, bins) {                       // nearest-neighbour heuristic
    const left = bins.slice(), out = []; let cur = start;
    while (left.length) { let bi = 0, bd = Infinity; left.forEach((b, i) => { const d = hav(cur, b); if (d < bd) { bd = d; bi = i; } }); cur = left.splice(bi, 1)[0]; out.push(cur); }
    return out;
  }
  function twoOpt(order) {                              // improve by reversing segments while it gets shorter
    let best = order.slice(), improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < best.length - 1; i++) for (let k = i + 1; k < best.length; k++) {
        const cand = best.slice(0, i).concat(best.slice(i, k + 1).reverse(), best.slice(k + 1));
        if (routeLen(cand) + 1e-9 < routeLen(best)) { best = cand; improved = true; }
      }
    }
    return best;
  }
  const shortest = bins => twoOpt(nearest(DEPOT, bins));
  const urgent = bins => bins.slice().sort((a, b) => b.fill - a.fill);

  /* ---------- data helpers ---------- */
  const bin = id => DB.get('bins', id);
  const uName = id => (DB.get('users', id) || {}).name || 'Unknown';
  const activeRoutes = did => DB.find('routes', r => (!did || r.driverId === did) && ['Assigned', 'In progress'].includes(r.status));
  const assignedBinIds = () => new Set(activeRoutes().flatMap(r => r.order));
  const routeBins = r => r.order.map(bin).filter(Boolean);
  const drivers = () => DB.find('users', u => u.role === 'driver');
  const mapsUrl = bins => `https://www.google.com/maps/dir/?api=1&origin=${DEPOT.lat},${DEPOT.lng}&destination=${DUMP.lat},${DUMP.lng}&travelmode=driving${bins.length ? '&waypoints=' + bins.slice(0, 9).map(b => b.lat + ',' + b.lng).join('%7C') : ''}`;
  const meter = f => `<div class="meter"><span style="width:${f}%;background:${colour(f)}"></span></div>`;

  function mapSVG(o = {}) {
    const bins = o.bins || DB.all('bins'); const order = o.order || [];
    let s = `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of garbage bins">`;
    for (let i = 1; i < 9; i++) s += `<line x1="${i * W / 9}" y1="0" x2="${i * W / 9}" y2="${H}" stroke="#d3e2cc"/><line x1="0" y1="${i * H / 9}" x2="${W}" y2="${i * H / 9}" stroke="#d3e2cc"/>`;
    if (order.length) s += `<polyline points="${[DEPOT, ...order, DUMP].map(px).map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" fill="none" stroke="#2563eb" stroke-width="4" stroke-dasharray="10 7" stroke-linejoin="round" opacity=".9"/>`;
    [[DEPOT, '&#127981;'], [DUMP, '&#9851;&#65039;']].forEach(([p, e]) => { const q = px(p); s += `<g><circle cx="${q.x}" cy="${q.y}" r="20" fill="#1f2937"/><text x="${q.x}" y="${q.y + 7}" text-anchor="middle" font-size="20">${e}</text><text x="${q.x}" y="${q.y + 38}" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2937">${p.name}</text><title>${p.name}</title></g>`; });
    bins.forEach(b => {
      const p = px(b); const i = order.findIndex(x => x.id === b.id);
      s += `<g><circle cx="${p.x}" cy="${p.y}" r="${i >= 0 ? 15 : 11}" fill="${colour(b.fill)}" stroke="#fff" stroke-width="3"/>${i >= 0 ? `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${i + 1}</text>` : ''}${o.labels === false ? '' : `<text x="${p.x}" y="${p.y + 28}" text-anchor="middle" font-size="11" fill="#374151">${esc(b.name)}</text>`}<title>${esc(b.name)} - ${b.fill}% full</title></g>`;
    });
    if (o.pick) { const q = px(o.pick); s += `<circle id="pickm" cx="${q.x}" cy="${q.y}" r="9" fill="none" stroke="#2563eb" stroke-width="4"/>`; }
    return s + '</svg><div class="legend"><span><i style="background:#22c55e"></i>Below 50%</span><span><i style="background:#f59e0b"></i>50-79%</span><span><i style="background:#ef4444"></i>80% and above</span><span>&#127981; depot &middot; &#9851;&#65039; dumping site &middot; dashed line = route</span></div>';
  }

  function cityStats() {
    const bins = DB.all('bins'); const avg = bins.length ? Math.round(bins.reduce((s, b) => s + b.fill, 0) / bins.length) : 0;
    const wk = Date.now() - 7 * 86400000;
    return { bins: bins.length, avg, full: bins.filter(b => b.fill >= 80).length, kgWeek: DB.find('collections', c => new Date(c.time) > wk).reduce((s, c) => s + c.kg, 0) };
  }
  const tips = `<div class="grid three"><div class="card"><h3>&#128994; Wet / organic</h3><p class="muted">Food scraps, vegetable peels, garden waste. Use the green bin - ideal for composting.</p></div><div class="card"><h3>&#128309; Dry / recyclable</h3><p class="muted">Paper, plastic, metal and glass. Rinse and keep dry in the blue bin.</p></div><div class="card"><h3>&#128308; Hazardous</h3><p class="muted">Batteries, bulbs, medicines, e-waste. Never mix - hand over at collection points.</p></div></div>`;

  /* ---------- routes (pages) ---------- */
  const routes = {
    '/': {
      view(root, q, u) {
        if (u) { App.go('/dashboard'); return; }
        const s = cityStats();
        root.innerHTML = `<div class="hero"><span class="big">&#9851;&#65039;</span><h1>A cleaner city, collected smartly</h1><p>CleanCity tracks every public dustbin, plans the shortest collection route for garbage trucks and lets citizens report problems in seconds.</p><a class="btn accent" href="#/register">Citizen sign-up</a><a class="btn ghost" href="#/login">Login</a></div>
          <div class="grid four" style="margin-bottom:18px">${UI.stat('Public bins', s.bins, '&#128465;&#65039;')}${UI.stat('Average fill', s.avg + '%', '&#128200;')}${UI.stat('Bins almost full', s.full, '&#9888;&#65039;')}${UI.stat('Collected this week', s.kgWeek + ' kg', '&#128667;')}</div>
          <div class="card"><h3>Live bin status</h3>${mapSVG()}</div><h2 style="margin:22px 0 10px">Segregate at source</h2>${tips}`;
      }
    },
    '/login': { guest: true, view: root => App.loginView(root, { title: 'Login', registerLinks: [['/register', 'Citizen registration']], blurb: 'Citizens, drivers and administrators log in here. Driver accounts are created by the administrator.', demo: [{ role: 'Administrator', email: 'admin@waste.test', password: 'admin123' }, { role: 'Driver', email: 'driver@waste.test', password: 'driver123' }, { role: 'Citizen', email: 'public@waste.test', password: 'public123' }] }) },
    '/register': {
      guest: true, view: root => App.registerView(root, {
        title: 'Citizen registration', role: 'public',
        fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', required: true }, { name: 'address', label: 'Address / ward', required: true }]
      })
    },
    '/profile': {
      roles: '*', view(root, q, u) {
        const f = [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', attrs: 'readonly' }, { name: 'phone', label: 'Phone' }];
        if (u.role === 'public') f.push({ name: 'address', label: 'Address / ward' }); if (u.role === 'driver') f.push({ name: 'truckNo', label: 'Truck number', attrs: 'readonly' });
        App.profileView(root, u, f);
      }
    },
    '/dashboard': {
      roles: '*', view(root, q, u) {
        if (u.role === 'admin') return adminDash(root);
        if (u.role === 'driver') return driverDash(root, u);
        const s = cityStats(); const mine = DB.find('complaints', c => c.userId === u.id);
        const full = DB.all('bins').filter(b => b.fill >= 80);
        const today_ = DB.find('routes', r => r.date === today());
        root.innerHTML = UI.pageHead('Hello, ' + u.name, 'Citizen dashboard - waste collection in your city', '<a class="btn" href="#/complaint">Register complaint</a>') +
          `<div class="grid four">${UI.stat('Public bins', s.bins, '&#128465;&#65039;')}${UI.stat('Average fill', s.avg + '%', '&#128200;')}${UI.stat('Collected this week', s.kgWeek + ' kg', '&#128667;')}${UI.stat('My open complaints', mine.filter(c => c.status !== 'Resolved').length, '&#128226;')}</div>
          <div class="grid two" style="margin-top:18px"><div class="card"><h3>Bin map</h3>${mapSVG({ labels: false })}</div>
          <div class="stack"><div class="card"><h3>Today's collection</h3><p>${today_.length} route${today_.length === 1 ? '' : 's'} planned &middot; ${today_.filter(r => r.status === 'Completed').length} completed &middot; ${today_.filter(r => r.status === 'In progress').length} on the road</p></div>
          <div class="card"><h3>Bins that are almost full</h3>${full.length ? `<ul class="list">${full.map(b => `<li><b>${esc(b.name)}</b> <span class="muted">${esc(b.address)}</span>${meter(b.fill)}<small>${b.fill}% full${assignedBinIds().has(b.id) ? ' &middot; collection scheduled' : ''}</small></li>`).join('')}</ul>` : '<p class="muted">All bins have space.</p>'}</div></div></div>
          <h2 style="margin:22px 0 10px">Segregation tips</h2>${tips}`;
      }
    },

    /* ----- citizen ----- */
    '/complaint': {
      roles: ['public'], view(root, q, u) {
        root.innerHTML = UI.pageHead('Register a complaint', 'Tell the municipality about a problem') + `<div class="card narrow"><form id="cf" class="form">
          ${UI.field({ name: 'type', label: 'Complaint type', type: 'select', options: COMPLAINTS })}
          ${UI.field({ name: 'binId', label: 'Related dustbin (optional)', type: 'select', options: [['', 'Not about a specific bin'], ...DB.all('bins').map(b => [b.id, b.name + ' - ' + b.address])] })}
          ${UI.field({ name: 'location', label: 'Location / landmark', value: u.address, required: true })}
          ${UI.field({ name: 'description', label: 'Details', type: 'textarea', required: true })}
          ${UI.field({ name: 'photo', label: 'Photo (optional)', type: 'file', attrs: 'accept="image/*"' })}<button class="btn">Submit complaint</button></form></div>`;
        UI.form(root, '#cf', async (d, f) => {
          const photo = (await UI.readFiles(f.elements.photo))[0];
          DB.insert('complaints', { userId: u.id, type: d.type, binId: d.binId, location: d.location, description: d.description, photo: photo && photo.data ? photo.data : '', status: 'Open', response: '' });
          UI.toast('Complaint registered. Track it under "My complaints".'); App.go('/my-complaints');
        });
      }
    },
    '/my-complaints': {
      roles: ['public'], view(root, q, u) {
        const list = DB.find('complaints', c => c.userId === u.id).reverse();
        root.innerHTML = UI.pageHead('My complaints & status', '', '<a class="btn" href="#/complaint">+ New complaint</a>') + (list.length ? `<div class="stack">${list.map(c => complaintCard(c)).join('')}</div>` : UI.empty('You have not registered any complaint.'));
      }
    },

    /* ----- driver ----- */
    '/route': {
      roles: ['driver'], view(root, q, u) {
        const list = activeRoutes(u.id);
        if (!list.length) { root.innerHTML = UI.pageHead('Choose best route') + UI.empty('No route is assigned to you right now. Check back later.'); return; }
        const r = list.find(x => x.id === q.r) || list[0]; const bins = routeBins(r);
        const opts = { shortest: shortest(bins), urgent: urgent(bins) };
        const km = { shortest: routeLen(opts.shortest), urgent: routeLen(opts.urgent) };
        const best = km.shortest <= km.urgent ? 'shortest' : 'urgent';
        const curOrder = bins; const strat = r.strategy;
        root.innerHTML = UI.pageHead('Choose best route', `Route of ${fmtDate(r.date)} - ${bins.length} bins`, `<a class="btn ghost" target="_blank" rel="noopener" href="${mapsUrl(curOrder)}">&#128506;&#65039; Open in Google Maps</a>${r.status === 'Assigned' ? '<button class="btn" id="start">&#9654; Start route</button>' : '<a class="btn" href="#/load">Update load</a>'}`) +
          (list.length > 1 ? `<div class="tabs">${list.map(x => `<a class="${x.id === r.id ? 'on' : ''}" href="#/route?r=${x.id}">${fmtDate(x.date)} (${x.order.length} bins)</a>`).join('')}</div>` : '') +
          `<div class="grid two"><div class="card"><h3>Route map</h3>${mapSVG({ bins: DB.all('bins'), order: curOrder })}</div>
          <div class="stack"><div class="card"><h3>Pick a strategy</h3><div class="stack">${[['shortest', 'Shortest distance', 'Nearest-neighbour + 2-opt improvement'], ['urgent', 'Most urgent first', 'Fullest bins are collected first']].map(([k, t, d]) => `<div class="row between"><div><b>${t}</b> ${k === best ? '<span class="badge ok">Best</span>' : ''}${strat === k ? '<span class="badge info">Selected</span>' : ''}<br><small class="muted">${d} &middot; ${km[k].toFixed(1)} km</small></div><button class="btn sm ${strat === k ? 'ghost' : ''}" data-strat="${k}">Use this</button></div>`).join('')}</div></div>
          <div class="card"><h3>Stops (${routeLen(curOrder).toFixed(1)} km total)</h3><ol class="steps"><li><span>Depot - start</span></li>${curOrder.map(b => `<li><div style="flex:1"><b>${esc(b.name)}</b><br><small class="muted">${esc(b.address)}</small></div><div style="min-width:120px">${meter(b.fill)}<small>${b.fill}% &middot; ~${estKg(b)} kg</small></div></li>`).join('')}<li><span>Dumping site - unload</span></li></ol>${bins.length > 9 ? '<p class="muted"><small>Google Maps links support 9 waypoints; the first 9 stops are included.</small></p>' : ''}</div></div></div>`;
        UI.click(root, '[data-strat]', b => { const o = opts[b.dataset.strat]; DB.update('routes', r.id, { order: o.map(x => x.id), strategy: b.dataset.strat }); UI.toast('Route updated: ' + (b.dataset.strat === 'shortest' ? 'shortest distance' : 'most urgent first') + '.'); App.render(); });
        const st = $('#start', root); if (st) st.addEventListener('click', () => { DB.update('routes', r.id, { status: 'In progress', startedAt: new Date().toISOString() }); UI.toast('Route started. Drive safely!'); App.go('/load?r=' + r.id); });
      }
    },
    '/load': {
      roles: ['driver'], view(root, q, u) {
        const list = activeRoutes(u.id);
        if (!list.length) { root.innerHTML = UI.pageHead('Update garbage load') + UI.empty('No active route. Completed routes are listed on your dashboard.'); return; }
        const r = list.find(x => x.id === q.r) || list[0]; const bins = routeBins(r);
        const col = r.collected || [], skip = r.skipped || [];
        const done = bins.every(b => col.includes(b.id) || skip.includes(b.id));
        const cap = u.capacity || 1500; const pct = Math.min(100, Math.round((r.loadKg || 0) / cap * 100));
        root.innerHTML = UI.pageHead('Update garbage load', `Route of ${fmtDate(r.date)}`, '<a class="btn ghost" href="#/route?r=' + r.id + '">View route</a>') +
          `<div class="card" style="margin-bottom:16px"><div class="row between"><b>Truck ${esc(u.truckNo || '')} load</b><span><b>${r.loadKg || 0}</b> / ${cap} kg</span></div><div class="meter" style="height:16px;margin-top:8px"><span style="width:${pct}%;background:${pct >= 90 ? '#ef4444' : '#2563eb'}"></span></div></div>
          ${r.status === 'Assigned' ? '<div class="note warn" style="margin-bottom:14px">You have not started this route yet. Collecting a bin will start it automatically.</div>' : ''}
          <div class="stack">${bins.map((b, i) => {
            const isC = col.includes(b.id), isS = skip.includes(b.id);
            return `<div class="card"><div class="row between"><div><h3 style="margin:0">${i + 1}. ${esc(b.name)}</h3><span class="muted">${esc(b.address)}</span></div>${isC ? UI.badge('Collected') : isS ? UI.badge('Skipped', 'bad') : UI.badge(b.fill + '% full', b.fill >= 80 ? 'bad' : 'warn')}</div>
            ${isC || isS ? '' : `<form class="row" data-collect="${b.id}" style="margin-top:10px"><div class="field" style="width:170px"><label>Weight collected (kg)</label><input type="number" name="kg" min="0" value="${estKg(b)}" required></div><button class="btn" style="margin-top:22px">&#10003; Mark collected</button><button type="button" class="btn ghost danger" style="margin-top:22px" data-skip="${b.id}">Skip</button></form>`}</div>`;
          }).join('')}</div>
          <div class="card" style="margin-top:16px"><div class="row between"><div><h3 style="margin:0">Dumping site</h3><span class="muted">${col.length} collected, ${skip.length} skipped, ${bins.length - col.length - skip.length} remaining</span></div><button class="btn dark" id="fin" ${done ? '' : 'disabled'}>Unload &amp; complete route</button></div></div>`;
        root.addEventListener('submit', e => {
          const f = e.target.closest('[data-collect]'); if (!f) return; e.preventDefault();
          const b = bin(f.dataset.collect); const kg = Number(f.elements.kg.value);
          DB.insert('collections', { routeId: r.id, driverId: u.id, binId: b.id, kg, fillPct: b.fill, time: new Date().toISOString() });
          DB.update('bins', b.id, { fill: 0, lastCollected: new Date().toISOString() });
          DB.update('routes', r.id, { status: 'In progress', startedAt: r.startedAt || new Date().toISOString(), collected: col.concat(b.id), loadKg: (r.loadKg || 0) + kg });
          UI.toast(b.name + ' collected (' + kg + ' kg).'); App.render();
        });
        UI.click(root, '[data-skip]', b => { const why = prompt('Why is this bin skipped? (blocked road, locked, etc.)'); if (why === null) return; DB.update('routes', r.id, { skipped: skip.concat(b.dataset.skip), skipNotes: (r.skipNotes || []).concat(bin(b.dataset.skip).name + ': ' + why) }); UI.toast('Stop skipped.', 'warn'); App.render(); });
        const fin = $('#fin', root); if (fin) fin.addEventListener('click', () => { DB.update('routes', r.id, { status: 'Completed', completedAt: new Date().toISOString(), km: routeLen(bins) }); UI.toast('Route completed - ' + (r.loadKg || 0) + ' kg delivered to the dumping site.'); App.go('/dashboard'); });
      }
    },

    /* ----- admin ----- */
    '/bins': {
      roles: ['admin'], view(root) {
        const list = DB.all('bins');
        root.innerHTML = UI.pageHead('Garbage bins', list.length + ' bins registered', '<button class="btn ghost" id="sim">&#128225; Simulate sensor readings</button><a class="btn" href="#/bin-form">+ Create bin</a>') +
          UI.table([{ h: 'Bin', f: b => `<b>${esc(b.name)}</b><br><span class="muted">${esc(b.address)}</span>` }, { h: 'Capacity', f: b => b.capacity + ' L' }, { h: 'Fill level', f: b => `${meter(b.fill)}<small>${b.fill}%</small>` }, { h: 'Coordinates', f: b => `<small>${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}</small>` }, { h: 'Last collected', f: b => b.lastCollected ? fmtDateTime(b.lastCollected) : '-' }, { h: '', f: b => `<a class="btn sm ghost" href="#/bin-form?id=${b.id}">Update</a> <button class="btn sm danger" data-del="${b.id}">Delete</button>` }], list, 'No bins yet.');
        UI.click(root, '[data-del]', b => { if (assignedBinIds().has(b.dataset.del)) return UI.toast('This bin is part of an active route.', 'error'); if (confirm('Delete this bin?')) { DB.remove('bins', b.dataset.del); App.render(); } });
        $('#sim', root).addEventListener('click', () => { DB.all('bins').forEach(b => DB.update('bins', b.id, { fill: Math.min(100, b.fill + Math.floor(Math.random() * 20)) })); UI.toast('Sensor readings updated (demo: random increase).'); App.render(); });
      }
    },
    '/bin-form': {
      roles: ['admin'], view(root, q) {
        const e = q.id ? bin(q.id) : null; const v = e || { lat: ((B.lat0 + B.lat1) / 2), lng: ((B.lng0 + B.lng1) / 2), capacity: 660, fill: 0 };
        root.innerHTML = UI.pageHead(e ? 'Update bin' : 'Create bin', 'Click the map to set the location, or type the coordinates') + `<div class="grid two"><div class="card"><form id="bf" class="form">
          ${UI.field({ name: 'name', label: 'Bin name / ID', value: v.name, required: true })}${UI.field({ name: 'address', label: 'Address / landmark', value: v.address, required: true })}
          <div class="form two">${UI.field({ name: 'lat', label: 'Latitude', type: 'number', value: Number(v.lat).toFixed(5), required: true, attrs: `step="any" min="${B.lat0}" max="${B.lat1}"` })}${UI.field({ name: 'lng', label: 'Longitude', type: 'number', value: Number(v.lng).toFixed(5), required: true, attrs: `step="any" min="${B.lng0}" max="${B.lng1}"` })}
          ${UI.field({ name: 'capacity', label: 'Capacity (litres)', type: 'number', value: v.capacity, required: true, attrs: 'min="50"' })}${UI.field({ name: 'fill', label: 'Current fill level (%)', type: 'number', value: v.fill, attrs: 'min="0" max="100"' })}</div>
          <div><button class="btn">${e ? 'Save changes' : 'Create bin'}</button> <a class="btn ghost" href="#/bins">Cancel</a></div></form></div>
          <div class="card"><h3>Pick location</h3><div id="pm">${mapSVG({ pick: v, labels: false })}</div></div></div>`;
        root.addEventListener('click', ev => {
          const svg = ev.target.closest('svg.map'); if (!svg) return;
          const r = svg.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width * W, y = (ev.clientY - r.top) / r.height * H;
          const lat = B.lat1 - y / H * (B.lat1 - B.lat0), lng = B.lng0 + x / W * (B.lng1 - B.lng0);
          $('#f-lat', root).value = lat.toFixed(5); $('#f-lng', root).value = lng.toFixed(5);
          const m = $('#pickm', root); m.setAttribute('cx', x); m.setAttribute('cy', y);
        });
        UI.form(root, '#bf', d => {
          const rec = { name: d.name, address: d.address, lat: Number(d.lat), lng: Number(d.lng), capacity: Number(d.capacity), fill: Math.max(0, Math.min(100, Number(d.fill || 0))) };
          if (e) DB.update('bins', e.id, rec); else DB.insert('bins', Object.assign(rec, { lastCollected: '' }));
          UI.toast('Bin saved.'); App.go('/bins');
        });
      }
    },
    '/drivers': {
      roles: ['admin'], view(root, q) {
        const e = q.id ? DB.get('users', q.id) : null; const v = e || {};
        const list = drivers();
        root.innerHTML = UI.pageHead('Manage drivers', 'Drivers log in with the account you create here') + `<div class="card" style="margin-bottom:18px"><h3>${e ? 'Edit driver' : 'Add driver'}</h3><form id="df" class="form two">
          ${UI.field({ name: 'name', label: 'Full name', value: v.name, required: true })}${UI.field({ name: 'email', label: 'Email (login)', type: 'email', value: v.email, required: true })}
          ${UI.field({ name: 'phone', label: 'Phone', value: v.phone, required: true })}${UI.field({ name: 'truckNo', label: 'Truck number', value: v.truckNo, required: true })}
          ${UI.field({ name: 'capacity', label: 'Truck capacity (kg)', type: 'number', value: v.capacity || 1500, attrs: 'min="100"' })}${UI.field({ name: 'password', label: e ? 'New password (optional)' : 'Password', type: 'password', required: !e, attrs: 'minlength="6"' })}
          <div class="full"><button class="btn">${e ? 'Save driver' : 'Add driver'}</button> ${e ? '<a class="btn ghost" href="#/drivers">Cancel</a>' : ''}</div></form></div>` +
          UI.table([{ h: 'Driver', f: d => `<b>${esc(d.name)}</b><br><small class="muted">${esc(d.email)}</small>` }, { h: 'Phone', f: d => esc(d.phone) }, { h: 'Truck', f: d => `${esc(d.truckNo)}<br><small class="muted">${d.capacity} kg</small>` }, { h: 'Status', f: d => activeRoutes(d.id).length ? UI.badge('On route', 'info') : UI.badge('Available', 'ok') }, { h: 'Routes done', f: d => DB.find('routes', r => r.driverId === d.id && r.status === 'Completed').length }, { h: '', f: d => `<a class="btn sm ghost" href="#/drivers?id=${d.id}">Edit</a> <button class="btn sm danger" data-del="${d.id}">Delete</button>` }], list, 'No drivers yet.');
        UI.form(root, '#df', d => {
          const rec = { name: d.name, email: d.email.toLowerCase(), phone: d.phone, truckNo: d.truckNo, capacity: Number(d.capacity) };
          if (DB.one('users', x => x.email.toLowerCase() === rec.email && (!e || x.id !== e.id))) throw new Error('This email is already used by another account.');
          if (e) { if (d.password) rec.password = d.password; DB.update('users', e.id, rec); } else DB.insert('users', Object.assign(rec, { role: 'driver', password: d.password }));
          UI.toast('Driver saved.'); App.go('/drivers');
        });
        UI.click(root, '[data-del]', b => { if (activeRoutes(b.dataset.del).length) return UI.toast('This driver has an active route.', 'error'); if (confirm('Delete this driver account?')) { DB.remove('users', b.dataset.del); App.render(); } });
      }
    },
    '/assign': {
      roles: ['admin'], view(root) {
        const free = DB.all('bins').filter(b => !assignedBinIds().has(b.id)).sort((a, b) => b.fill - a.fill);
        root.innerHTML = UI.pageHead('Assign best route', 'Select a driver and the bins to collect - the shortest route is calculated automatically', '<button class="btn ghost" id="auto">&#9889; Auto-plan for free drivers</button>') + `<div class="grid two"><div class="card"><form id="af" class="form">
          ${UI.field({ name: 'driver', label: 'Driver', type: 'select', options: drivers().map(d => [d.id, `${d.name} - ${d.truckNo} (${d.capacity} kg)${activeRoutes(d.id).length ? ' - already on a route' : ''}`]) })}
          <div class="row"><div class="field" style="width:150px"><label>Fill level at least (%)</label><input type="number" id="thr" value="${THRESHOLD}" min="0" max="100"></div><button type="button" class="btn ghost sm" id="pick">Select bins above level</button></div>
          <div class="field"><label>Bins (${free.length} not on a route)</label><div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:9px;padding:6px 10px">${free.map(b => `<label class="check" style="padding:5px 0;border-bottom:1px solid var(--line)"><input type="checkbox" name="bin" value="${b.id}"> <span style="flex:1"><b>${esc(b.name)}</b> <small class="muted">${esc(b.address)}</small></span><span class="badge ${b.fill >= 80 ? 'bad' : b.fill >= 50 ? 'warn' : 'ok'}">${b.fill}%</span></label>`).join('') || '<p class="muted">All bins are already assigned.</p>'}</div></div>
          <button class="btn">Assign route to driver</button></form></div>
          <div class="card"><h3>Route preview</h3><div id="prev"></div></div></div>
          <h2 style="margin:24px 0 8px">Active routes</h2>${UI.table([{ h: 'Driver', f: r => esc(uName(r.driverId)) }, { h: 'Date', f: r => fmtDate(r.date) }, { h: 'Bins', f: r => r.order.map(id => esc((bin(id) || {}).name)).join(' &rarr; ') }, { h: 'Distance', f: r => routeLen(routeBins(r)).toFixed(1) + ' km' }, { h: 'Status', f: r => UI.badge(r.status) }, { h: '', f: r => `<button class="btn sm danger" data-cancel="${r.id}">Cancel</button>` }], activeRoutes(), 'No active routes.')}`;
        const sel = () => $$('input[name=bin]:checked', root).map(i => bin(i.value));
        const prev = () => {
          const bins = sel(); const d = DB.get('users', $('#f-driver', root).value); const o = shortest(bins); const kg = bins.reduce((s, b) => s + estKg(b), 0); const cap = d ? d.capacity : 0;
          $('#prev', root).innerHTML = mapSVG({ order: o, labels: false }) + (bins.length ? `<dl class="kv" style="margin-top:10px"><dt>Stops</dt><dd>${bins.length}</dd><dt>Distance</dt><dd>${routeLen(o).toFixed(1)} km (depot &rarr; bins &rarr; dump)</dd><dt>Estimated load</dt><dd>${kg} kg ${cap && kg > cap ? '<span class="badge bad">exceeds truck capacity (' + cap + ' kg)</span>' : '<span class="badge ok">fits (' + cap + ' kg)</span>'}</dd></dl>` : '<p class="muted">Tick some bins to preview the best route.</p>');
        };
        root.addEventListener('change', prev); prev();
        $('#pick', root).addEventListener('click', () => { const t = Number($('#thr', root).value); $$('input[name=bin]', root).forEach(i => i.checked = bin(i.value).fill >= t); prev(); });
        UI.form(root, '#af', d => {
          const drv = DB.get('users', d.driver); if (!drv) throw new Error('Create a driver first.');
          if (activeRoutes(drv.id).length) throw new Error(drv.name + ' already has an active route.');
          const bins = sel(); if (!bins.length) throw new Error('Select at least one bin.');
          const kg = bins.reduce((s, b) => s + estKg(b), 0); if (kg > drv.capacity) throw new Error(`Estimated ${kg} kg is more than the truck capacity (${drv.capacity} kg). Remove some bins.`);
          DB.insert('routes', { driverId: drv.id, date: today(), order: shortest(bins).map(b => b.id), strategy: 'shortest', status: 'Assigned', collected: [], skipped: [], loadKg: 0 });
          UI.toast('Route assigned to ' + drv.name + '.'); App.render();
        });
        $('#auto', root).addEventListener('click', () => {
          let pool = DB.all('bins').filter(b => b.fill >= THRESHOLD && !assignedBinIds().has(b.id)); let n = 0;
          drivers().filter(d => !activeRoutes(d.id).length).forEach(d => {
            let kg = 0; const pick = []; pool.sort((a, b) => hav(DEPOT, a) - hav(DEPOT, b));
            for (const b of pool.slice()) { if (kg + estKg(b) <= d.capacity) { pick.push(b); kg += estKg(b); pool = pool.filter(x => x.id !== b.id); } }
            if (pick.length) { DB.insert('routes', { driverId: d.id, date: today(), order: shortest(pick).map(b => b.id), strategy: 'shortest', status: 'Assigned', collected: [], skipped: [], loadKg: 0 }); n++; }
          });
          UI.toast(n ? n + ' route(s) planned automatically.' : 'Nothing to plan: no free driver or no bin above ' + THRESHOLD + '%.', n ? 'ok' : 'warn'); App.render();
        });
        UI.click(root, '[data-cancel]', b => { if (confirm('Cancel this route?')) { DB.update('routes', b.dataset.cancel, { status: 'Cancelled' }); App.render(); } });
      }
    },
    '/complaints': {
      roles: ['admin'], view(root, q) {
        const s = q.s || 'Open'; const all = DB.all('complaints').reverse(); const list = all.filter(c => s === 'All' || c.status === s);
        root.innerHTML = UI.pageHead('Complaints from the public') + `<div class="tabs">${['Open', 'In progress', 'Resolved', 'All'].map(t => `<a class="${s === t ? 'on' : ''}" href="#/complaints?s=${encodeURIComponent(t)}">${t}${t === 'All' ? '' : ' (' + all.filter(c => c.status === t).length + ')'}</a>`).join('')}</div>` + (list.length ? `<div class="stack">${list.map(c => complaintCard(c, true)).join('')}</div>` : UI.empty('No complaints here.'));
        UI.click(root, '[data-prog]', b => { DB.update('complaints', b.dataset.prog, { status: 'In progress' }); UI.toast('Marked in progress.'); App.render(); });
        UI.click(root, '[data-res]', b => {
          const c = DB.get('complaints', b.dataset.res);
          const m = UI.modal('Resolve complaint', `<form id="rf" class="form">${UI.field({ name: 'response', label: 'Response to the citizen', type: 'textarea', value: c.response, required: true })}<button class="btn">Mark resolved</button></form>`);
          UI.form(m.el, '#rf', d => { DB.update('complaints', c.id, { status: 'Resolved', response: d.response, resolvedAt: new Date().toISOString() }); m.close(); UI.toast('Complaint resolved.'); App.render(); });
        });
      }
    },
    '/report': {
      roles: ['admin'], view(root) {
        const cols = DB.all('collections'); const bins = DB.all('bins'); const rts = DB.all('routes');
        const days = [...Array(7)].map((_, i) => addDays(today(), i - 6));
        const perDay = days.map(d => ({ label: fmtDate(d).slice(0, 6), value: cols.filter(c => c.time.slice(0, 10) === d).reduce((s, c) => s + c.kg, 0) }));
        const byDriver = drivers().map(d => ({ label: d.name, value: cols.filter(c => c.driverId === d.id).reduce((s, c) => s + c.kg, 0) }));
        const band = [{ label: 'Low (<50%)', value: bins.filter(b => b.fill < 50).length, color: '#22c55e' }, { label: 'Medium (50-79%)', value: bins.filter(b => b.fill >= 50 && b.fill < 80).length, color: '#f59e0b' }, { label: 'High (80%+)', value: bins.filter(b => b.fill >= 80).length, color: '#ef4444' }];
        const cc = {}; DB.all('complaints').forEach(c => cc[c.type] = (cc[c.type] || 0) + 1);
        const util = bins.map(b => { const l = cols.filter(c => c.binId === b.id); return { b, n: l.length, avg: l.length ? Math.round(l.reduce((s, c) => s + c.fillPct, 0) / l.length) : null }; }).filter(x => x.n >= 2);
        const done = rts.filter(r => r.status === 'Completed');
        root.innerHTML = UI.pageHead('Garbage report', 'Analytics generated from collection data', '<button class="btn ghost" id="csv">&#11015; Download collections CSV</button>') +
          `<div class="grid four" style="margin-bottom:18px">${UI.stat('Total collected', cols.reduce((s, c) => s + c.kg, 0) + ' kg', '&#9851;&#65039;')}${UI.stat('Collections logged', cols.length, '&#128465;&#65039;')}${UI.stat('Routes completed', done.length, '&#128667;')}${UI.stat('Distance driven', done.reduce((s, r) => s + (r.km || 0), 0).toFixed(1) + ' km', '&#128739;&#65039;')}</div>
          <div class="grid two"><div class="card"><h3>Waste collected - last 7 days (kg)</h3>${UI.bars(perDay)}</div><div class="card"><h3>Waste collected by driver (kg)</h3>${UI.bars(byDriver)}</div>
          <div class="card"><h3>Current bin fill levels</h3>${UI.bars(band)}</div><div class="card"><h3>Complaints by type</h3>${UI.bars(Object.entries(cc).map(([label, value]) => ({ label, value })))}</div></div>
          <h2 style="margin:22px 0 8px">Effective use of dustbins</h2>${UI.table([{ h: 'Bin', f: x => `<b>${esc(x.b.name)}</b>` }, { h: 'Collections', f: x => x.n }, { h: 'Avg. fill at pickup', f: x => x.avg + '%' }, { h: 'Insight', f: x => x.avg >= 85 ? UI.badge('Over-used: add a second bin or collect more often', 'bad') : x.avg < 35 ? UI.badge('Under-used: collect less often or relocate', 'warn') : UI.badge('Well used', 'ok') }], util, 'Not enough collection data yet.')}`;
        $('#csv', root).addEventListener('click', () => UI.download('collections.csv', ['Time,Bin,Driver,Kg,Fill%'].concat(cols.map(c => [c.time, '"' + ((bin(c.binId) || {}).name || '') + '"', '"' + uName(c.driverId) + '"', c.kg, c.fillPct].join(','))).join('\n'), 'text/csv'));
      }
    }
  };

  function complaintCard(c, admin) {
    const b = c.binId ? bin(c.binId) : null;
    return `<div class="card"><div class="row between"><div><h3 style="margin:0">${esc(c.type)}</h3><span class="muted">${admin ? esc(uName(c.userId)) + ' &middot; ' : ''}${fmtDateTime(c.created)}</span></div>${UI.badge(c.status)}</div>
      <p class="muted" style="margin:6px 0">&#128205; ${esc(c.location)}${b ? ' &middot; Bin: ' + esc(b.name) : ''}</p><p>${esc(c.description)}</p>${c.photo ? `<img class="thumb" src="${esc(c.photo)}" alt="">` : ''}
      ${c.response ? `<div class="note" style="margin-top:8px"><b>Municipality response:</b> ${esc(c.response)}</div>` : ''}
      ${admin && c.status !== 'Resolved' ? `<div class="row" style="margin-top:8px">${c.status === 'Open' ? `<button class="btn sm ghost" data-prog="${c.id}">Mark in progress</button>` : ''}<button class="btn sm" data-res="${c.id}">Resolve</button></div>` : ''}</div>`;
  }

  function adminDash(root) {
    const s = cityStats(); const urgentBins = DB.all('bins').filter(b => b.fill >= 80 && !assignedBinIds().has(b.id));
    const ar = activeRoutes();
    root.innerHTML = UI.pageHead('Admin dashboard', 'Collection overview', '<a class="btn" href="#/assign">Assign routes</a>') +
      `<div class="grid four">${UI.stat('Bins', s.bins, '&#128465;&#65039;')}${UI.stat('Average fill', s.avg + '%', '&#128200;')}${UI.stat('Need collection (80%+)', s.full, '&#9888;&#65039;')}${UI.stat('Open complaints', DB.find('complaints', c => c.status !== 'Resolved').length, '&#128226;')}</div>
      <div class="grid two" style="margin-top:18px"><div class="card"><h3>City map</h3>${mapSVG({ order: ar.length ? routeBins(ar[0]) : [] })}${ar.length ? `<small class="muted">Dashed line: active route of ${esc(uName(ar[0].driverId))}</small>` : ''}</div>
      <div class="stack"><div class="card"><h3>Unassigned bins that are almost full</h3>${urgentBins.length ? `<ul class="list">${urgentBins.map(b => `<li><b>${esc(b.name)}</b> <small class="muted">${esc(b.address)}</small>${meter(b.fill)}<small>${b.fill}%</small></li>`).join('')}</ul><a class="btn sm" href="#/assign">Plan a route</a>` : '<p class="muted">Every full bin already has a route.</p>'}</div>
      <div class="card"><h3>Drivers today</h3>${drivers().length ? `<ul class="list">${drivers().map(d => { const r = activeRoutes(d.id)[0]; return `<li><b>${esc(d.name)}</b> <small class="muted">${esc(d.truckNo)}</small><br>${r ? UI.badge(r.status) + ' ' + r.order.length + ' bins &middot; ' + (r.loadKg || 0) + ' kg loaded' : UI.badge('Available', 'ok')}</li>`; }).join('')}</ul>` : '<p class="muted">No drivers yet.</p>'}</div></div></div>`;
  }
  function driverDash(root, u) {
    const mine = DB.find('routes', r => r.driverId === u.id).reverse(); const act = mine.filter(r => ['Assigned', 'In progress'].includes(r.status));
    const todayC = DB.find('collections', c => c.driverId === u.id && c.time.slice(0, 10) === today());
    root.innerHTML = UI.pageHead('Hello, ' + u.name, `Truck ${u.truckNo} - capacity ${u.capacity} kg`, act.length ? '<a class="btn" href="#/route">Choose route</a>' : '') +
      `<div class="grid four">${UI.stat('Active routes', act.length, '&#128739;&#65039;')}${UI.stat('Bins collected today', todayC.length, '&#128465;&#65039;')}${UI.stat('Collected today', todayC.reduce((s, c) => s + c.kg, 0) + ' kg', '&#9851;&#65039;')}${UI.stat('Routes completed', mine.filter(r => r.status === 'Completed').length, '&#9989;')}</div>
      <h2 style="margin:22px 0 8px">Daily work updates</h2>${act.length ? `<div class="stack">${act.map(r => { const bs = routeBins(r); return `<div class="card"><div class="row between"><div><h3 style="margin:0">Route for ${fmtDate(r.date)}</h3><span class="muted">${bs.length} bins &middot; ${routeLen(bs).toFixed(1)} km &middot; ~${bs.reduce((s, b) => s + estKg(b), 0)} kg expected</span></div>${UI.badge(r.status)}</div>
        <p style="margin:8px 0">${bs.map((b, i) => `<span class="chip">${i + 1}. ${esc(b.name)} (${b.fill}%)</span>`).join('')}</p><div class="row"><a class="btn sm" href="#/route?r=${r.id}">View &amp; choose route</a><a class="btn sm ghost" href="#/load?r=${r.id}">Update load</a></div></div>`; }).join('')}</div>` : UI.empty('No work assigned yet. The administrator will assign a route when bins fill up.')}
      <h2 style="margin:22px 0 8px">Recent routes</h2>${UI.table([{ h: 'Date', f: r => fmtDate(r.date) }, { h: 'Bins', f: r => r.order.length }, { h: 'Load', f: r => (r.loadKg || 0) + ' kg' }, { h: 'Status', f: r => UI.badge(r.status) }], mine.slice(0, 5), 'No routes yet.')}`;
  }

  /* ---------- sample data ---------- */
  function seed() {
    DB.insert('users', { id: 'a1', role: 'admin', name: 'City Administrator', email: 'admin@waste.test', password: 'admin123' });
    DB.insert('users', { id: 'dr1', role: 'driver', name: 'Suresh Kumar', email: 'driver@waste.test', password: 'driver123', phone: '555-0101', truckNo: 'KA-01-GT-4521', capacity: 1500 });
    DB.insert('users', { id: 'dr2', role: 'driver', name: 'Anil Das', email: 'anil@waste.test', password: 'driver123', phone: '555-0102', truckNo: 'KA-01-GT-7788', capacity: 1200 });
    DB.insert('users', { id: 'p1', role: 'public', name: 'Citizen Demo', email: 'public@waste.test', password: 'public123', phone: '555-0199', address: '14, Lakeview Layout' });
    const bins = [['b1', 'Market Square', 'Main Market, Gate 1', 12.9716, 77.5946, 1100, 88], ['b2', 'City Hospital Gate', 'Hospital Road', 12.979, 77.599, 660, 92], ['b3', 'Central Bus Stand', 'Platform 4 side', 12.962, 77.578, 1100, 74], ['b4', 'Lakeview Park', 'Park entrance', 12.988, 77.615, 240, 35],
      ['b5', 'Green Valley Apartments', 'Block C gate', 12.954, 77.588, 660, 81], ['b6', 'School Road', 'Near Govt. School', 12.969, 77.612, 240, 56], ['b7', 'Temple Street', 'Opp. temple', 12.983, 77.582, 660, 66], ['b8', 'Tech Park Gate', 'Gate 2', 12.993, 77.624, 1100, 24],
      ['b9', 'Railway Station', 'Exit road', 12.956, 77.606, 1100, 85], ['b10', 'Old Town Plaza', 'Plaza east', 12.965, 77.564, 660, 48], ['b11', 'Riverside Colony', 'Colony main road', 12.976, 77.627, 240, 90], ['b12', 'Sports Complex', 'Stadium road', 12.946, 77.57, 660, 12]];
    bins.forEach(b => DB.insert('bins', { id: b[0], name: b[1], address: b[2], lat: b[3], lng: b[4], capacity: b[5], fill: b[6], lastCollected: new Date(Date.now() - 86400000).toISOString() }));
    DB.insert('routes', { id: 'r1', driverId: 'dr1', date: today(), order: shortest(['b1', 'b2', 'b3', 'b9'].map(bin)).map(b => b.id), strategy: 'shortest', status: 'Assigned', collected: [], skipped: [], loadKg: 0 });
    /* a week of past collections so the report has data */
    const pickups = [['b1', 90], ['b2', 95], ['b9', 88], ['b3', 80], ['b5', 86], ['b11', 92], ['b7', 70], ['b10', 55], ['b4', 30], ['b8', 28], ['b12', 20]];
    for (let d = 6; d >= 1; d--) pickups.forEach(([id, f], i) => { if ((d + i) % 3 === 0 || ['b1', 'b2'].includes(id)) { const b = bin(id); const t = new Date(Date.now() - d * 86400000 + i * 600000).toISOString(); DB.insert('collections', { routeId: 'seed', driverId: i % 2 ? 'dr2' : 'dr1', binId: id, kg: Math.round(b.capacity * (f / 100) * KG_PER_LITRE), fillPct: f, time: t }); } });
    DB.insert('routes', { id: 'r0', driverId: 'dr2', date: addDays(today(), -1), order: ['b5', 'b10'], strategy: 'shortest', status: 'Completed', collected: ['b5', 'b10'], skipped: [], loadKg: 190, km: 9.4, completedAt: new Date(Date.now() - 86400000).toISOString() });
    DB.insert('complaints', { userId: 'p1', type: 'Overflowing bin', binId: 'b2', location: 'Hospital Road', description: 'The bin near the hospital gate has been overflowing since morning.', photo: '', status: 'In progress', response: '' });
    DB.insert('complaints', { userId: 'p1', type: 'Missed collection', binId: '', location: '14, Lakeview Layout', description: 'Door-to-door collection did not come yesterday.', photo: '', status: 'Resolved', response: 'Sorry for the miss. A truck covered your street this morning.' });
  }

  App.init({
    key: 'cleancity', name: 'CleanCity', logo: '&#9851;&#65039;', routes, seed, home: () => '/dashboard',
    menus: {
      guest: [['/', 'Home'], ['/login', 'Login'], ['/register', 'Citizen register']],
      public: [['/dashboard', 'Dashboard'], ['/complaint', 'Register complaint'], ['/my-complaints', 'My complaints'], ['/profile', 'Profile']],
      driver: [['/dashboard', 'Daily work'], ['/route', 'Choose route'], ['/load', 'Update load'], ['/profile', 'Profile']],
      admin: [['/dashboard', 'Dashboard'], ['/bins', 'Bins'], ['/drivers', 'Drivers'], ['/assign', 'Assign route'], ['/complaints', 'Complaints'], ['/report', 'Report'], ['/profile', 'Profile']]
    }
  });
})();
