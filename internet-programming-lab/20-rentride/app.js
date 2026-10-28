/* =====================================================================
   20 - RentRide : online vehicle rental
   Roles: user (customer)  |  admin
   ===================================================================== */
(function () {
  const TYPES = ['Car', 'SUV', 'Truck', 'Van'];
  const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const qs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const vehicle = id => DB.get('vehicles', id);
  const nDays = (a, b) => daysBetween(a, b);
  const rating = vid => { const r = DB.find('reviews', x => x.vehicleId === vid); return { n: r.length, avg: r.length ? r.reduce((s, x) => s + x.rating, 0) / r.length : 0 }; };
  const locations = () => [...new Set(DB.all('vehicles').map(v => v.location))].sort();
  const ref = () => 'RR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const isPast = b => ['Completed', 'Rejected', 'Cancelled'].includes(b.status) || b.to < today();

  /* a vehicle is busy if an approved/pending booking overlaps the requested dates */
  function conflicts(vid, from, to, ignoreId) {
    return DB.find('bookings', x => x.vehicleId === vid && x.id !== ignoreId && ['Pending', 'Approved'].includes(x.status) && from < x.to && x.from < to);
  }
  function datesError(from, to) {
    if (!from || !to) return 'Please choose pickup and return dates.';
    if (from < today()) return 'Pickup date cannot be in the past.';
    if (to <= from) return 'Return date must be after the pickup date.';
    return '';
  }

  function vehicleCard(v, q = {}) {
    const r = rating(v.id); const d = q.from && q.to && q.to > q.from ? nDays(q.from, q.to) : 0;
    return `<div class="card item"><img class="cover" src="${esc(v.image)}" alt="${esc(v.name)}"><div class="body">
      <div class="row between"><h3 style="margin:0">${esc(v.name)}</h3><span class="tag">${esc(v.type)}</span></div>
      <span class="muted">${esc(v.brand)} &middot; ${v.seats} seats &middot; ${esc(v.transmission)} &middot; ${esc(v.fuel)}</span>
      <span class="muted">&#128205; ${esc(v.location)}</span>
      ${r.n ? `<span>${UI.stars(r.avg)} <small class="muted">${r.avg.toFixed(1)} (${r.n})</small></span>` : '<small class="muted">No reviews yet</small>'}
      <p class="price" style="margin:4px 0 0">${money(v.price)} <small>/ day</small></p>${d ? `<small class="muted">${d} day${d > 1 ? 's' : ''}: <b>${money(v.price * d)}</b></small>` : ''}</div>
      <div class="foot2"><a class="btn sm ghost" href="#/vehicle?id=${v.id}">Details</a><a class="btn sm" href="#/book?${qs({ id: v.id, from: q.from, to: q.to })}">Book now</a></div></div>`;
  }

  function searchForm(q, compact) {
    return `<form id="sf" class="filters">
      ${UI.field({ name: 'type', label: 'Vehicle type', type: 'select', value: q.type || '', options: [['', 'Any type'], ...TYPES] })}
      ${UI.field({ name: 'location', label: 'Pickup location', type: 'select', value: q.location || '', options: [['', 'Any location'], ...locations()] })}
      ${UI.field({ name: 'from', label: 'Pickup date', type: 'date', value: q.from || '', attrs: `min="${today()}"` })}
      ${UI.field({ name: 'to', label: 'Return date', type: 'date', value: q.to || '', attrs: `min="${today()}"` })}
      ${compact ? '' : UI.field({ name: 'max', label: 'Max price / day', type: 'number', value: q.max || '', attrs: 'min="0" step="500"' })}
      ${compact ? '' : UI.field({ name: 'sort', label: 'Sort by', type: 'select', value: q.sort || 'price', options: [['price', 'Price: low to high'], ['priceDesc', 'Price: high to low'], ['rating', 'Best rated']] })}
      <button class="btn" style="height:40px">&#128269; Search</button></form>`;
  }
  function bindSearch(root) {
    UI.form(root, '#sf', d => {
      if (d.from && d.to && d.to <= d.from) throw new Error('Return date must be after the pickup date.');
      App.go('/search?' + qs(d));
    });
  }

  /* ---------- booking helpers ---------- */
  function statusLine(b) {
    return { Pending: 'Waiting for admin approval', Approved: 'Confirmed - see you at pickup!', Rejected: 'Not available - ' + (b.reason || 'rejected by admin'), Cancelled: 'Cancelled by you', Completed: 'Rental completed' }[b.status] || '';
  }
  function bookingCard(b, admin) {
    const v = vehicle(b.vehicleId) || { name: 'Removed vehicle', image: UI.art('&#128663;') };
    const u = DB.get('users', b.userId) || {};
    const reviewed = DB.one('reviews', r => r.bookingId === b.id);
    const canReview = !admin && ['Approved', 'Completed'].includes(b.status) && b.to <= today() && !reviewed;
    const canChange = !admin && ['Pending', 'Approved'].includes(b.status) && b.from > today();
    return `<div class="card"><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><img src="${esc(v.image)}" alt="" style="width:120px;height:80px;object-fit:cover;border-radius:10px">
      <div style="flex:1"><div class="row between"><h3 style="margin:0">${esc(v.name)}</h3>${UI.badge(b.status)}</div>
      <p class="muted" style="margin:4px 0">Ref <b>${esc(b.ref)}</b> &middot; ${fmtDate(b.from)} ${esc(b.time)} &rarr; ${fmtDate(b.to)} (${b.days} day${b.days > 1 ? 's' : ''}) &middot; <b>${money(b.total)}</b></p>
      <p class="muted" style="margin:0"><small>${admin ? `Customer: <b>${esc(b.customerName)}</b> (${esc(b.customerNo)}), ${esc(b.phone || u.phone || '')}, ${esc(b.address)}<br>Payment: ${esc(b.payment)}` : esc(statusLine(b))}</small></p>
      ${reviewed ? `<p style="margin:6px 0 0">${UI.stars(reviewed.rating)} <small class="muted">${esc(reviewed.comment)}</small></p>` : ''}
      <div class="row" style="margin-top:8px">
        ${admin && b.status === 'Pending' ? `<button class="btn sm" data-act="approve" data-id="${b.id}">Approve</button><button class="btn sm danger" data-act="reject" data-id="${b.id}">Reject</button>` : ''}
        ${admin && b.status === 'Approved' ? `<button class="btn sm dark" data-act="complete" data-id="${b.id}">Mark returned</button>` : ''}
        ${canChange ? `<button class="btn sm ghost" data-act="resched" data-id="${b.id}">Reschedule</button><button class="btn sm danger" data-act="cancel" data-id="${b.id}">Cancel booking</button>` : ''}
        ${canReview ? `<button class="btn sm accent" data-act="review" data-id="${b.id}">&#9733; Write review</button>` : ''}</div></div></div></div>`;
  }
  function bookingActions(root) {
    UI.click(root, '[data-act]', btn => {
      const b = DB.get('bookings', btn.dataset.id); const act = btn.dataset.act;
      if (act === 'approve') {
        if (DB.find('bookings', x => x.id !== b.id && x.vehicleId === b.vehicleId && x.status === 'Approved' && b.from < x.to && x.from < b.to).length) return UI.toast('Another approved booking overlaps these dates.', 'error');
        DB.update('bookings', b.id, { status: 'Approved' }); UI.toast('Booking approved. The customer is notified.'); App.render();
      }
      if (act === 'reject') { const reason = prompt('Reason for rejecting (shown to the customer):', 'Vehicle not available'); if (reason === null) return; DB.update('bookings', b.id, { status: 'Rejected', reason }); UI.toast('Booking rejected.', 'warn'); App.render(); }
      if (act === 'complete') { DB.update('bookings', b.id, { status: 'Completed' }); UI.toast('Marked as returned.'); App.render(); }
      if (act === 'cancel') { if (confirm('Cancel this booking?')) { DB.update('bookings', b.id, { status: 'Cancelled' }); UI.toast('Booking cancelled.', 'warn'); App.render(); } }
      if (act === 'resched') reschedule(b);
      if (act === 'review') reviewModal(b);
    });
  }
  function reschedule(b) {
    const v = vehicle(b.vehicleId);
    const m = UI.modal('Reschedule - ' + v.name, `<form id="rs" class="form">
      ${UI.field({ name: 'from', label: 'Pickup date', type: 'date', value: b.from, required: true, attrs: `min="${today()}"` })}
      ${UI.field({ name: 'to', label: 'Return date', type: 'date', value: b.to, required: true, attrs: `min="${today()}"` })}
      ${UI.field({ name: 'time', label: 'Pickup time', type: 'select', value: b.time, options: TIMES })}
      <p class="muted"><small>The booking returns to "Pending" until the admin approves the new schedule.</small></p><button class="btn">Save new schedule</button></form>`);
    UI.form(m.el, '#rs', d => {
      const e = datesError(d.from, d.to); if (e) throw new Error(e);
      if (conflicts(b.vehicleId, d.from, d.to, b.id).length) throw new Error('The vehicle is not free on those dates.');
      const days = nDays(d.from, d.to);
      DB.update('bookings', b.id, { from: d.from, to: d.to, time: d.time, days, total: days * v.price, status: 'Pending' });
      m.close(); UI.toast('Schedule updated.'); App.render();
    });
  }
  function reviewModal(b) {
    const v = vehicle(b.vehicleId);
    const m = UI.modal('Review - ' + v.name, `<form id="rv" class="form">
      ${UI.field({ name: 'rating', label: 'Rating', type: 'select', value: '5', options: [['5', '5 - Excellent'], ['4', '4 - Good'], ['3', '3 - Okay'], ['2', '2 - Poor'], ['1', '1 - Terrible']] })}
      ${UI.field({ name: 'comment', label: 'Your experience', type: 'textarea', required: true })}<button class="btn">Submit review</button></form>`);
    UI.form(m.el, '#rv', d => { DB.insert('reviews', { userId: b.userId, vehicleId: b.vehicleId, bookingId: b.id, rating: Number(d.rating), comment: d.comment }); m.close(); UI.toast('Thanks for your review!'); App.render(); });
  }

  /* ---------- routes ---------- */
  const routes = {
    '/': {
      view(root, q, u) {
        if (u && u.role === 'admin') { App.go('/admin'); return; }
        const featured = DB.all('vehicles').filter(v => v.available).slice(0, 3);
        root.innerHTML = `<div class="hero"><span class="big">&#128663;</span><h1>Rent the right vehicle in minutes</h1><p>Cars, SUVs, trucks and vans. Compare prices, book online, pay securely and get instant confirmation - with 24/7 support if anything goes wrong.</p>${searchForm({}, true)}</div>
          <div class="grid three"><div class="card"><h3>&#128269; Smart search</h3><p class="muted">Filter by vehicle type, rental duration and pickup location.</p></div><div class="card"><h3>&#128274; Secure payment</h3><p class="muted">Pay by card or online banking. Card numbers are never stored.</p></div><div class="card"><h3>&#128222; 24/7 support</h3><p class="muted">Rental issue at midnight? Our support desk never sleeps.</p></div></div>
          <h2 style="margin:26px 0 10px">Popular right now</h2><div class="grid three">${featured.map(v => vehicleCard(v)).join('')}</div>`;
        bindSearch(root);
      }
    },
    '/login': { guest: true, view: root => App.loginView(root, { title: 'Login to RentRide', registerLinks: [['/register', 'Create an account']], demo: [{ role: 'Customer', email: 'user@rentride.test', password: 'user123' }, { role: 'Admin', email: 'admin@rentride.test', password: 'admin123' }] }) },
    '/register': {
      guest: true, view: root => App.registerView(root, {
        title: 'Create your account', role: 'user',
        fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone number', required: true }, { name: 'address', label: 'Address', required: true }, { name: 'licence', label: 'Driving licence no.', required: true }],
        extra: () => ({ customerNo: 'CUS-' + (1001 + DB.find('users', x => x.role === 'user').length) })
      })
    },
    '/search': {
      view(root, q) {
        let list = DB.all('vehicles').filter(v => v.available);
        if (q.type) list = list.filter(v => v.type === q.type);
        if (q.location) list = list.filter(v => v.location === q.location);
        if (q.max) list = list.filter(v => v.price <= Number(q.max));
        const dated = q.from && q.to && q.to > q.from;
        if (dated) list = list.filter(v => !conflicts(v.id, q.from, q.to).length);
        const sort = q.sort || 'price';
        list.sort((a, b) => sort === 'priceDesc' ? b.price - a.price : sort === 'rating' ? rating(b.id).avg - rating(a.id).avg : a.price - b.price);
        root.innerHTML = UI.pageHead('Search vehicles', dated ? `Available from ${fmtDate(q.from)} to ${fmtDate(q.to)} (${nDays(q.from, q.to)} days)` : 'Add pickup and return dates to see only vehicles free on those days') +
          `<div class="card" style="margin-bottom:18px">${searchForm(q)}</div><p class="muted">${list.length} vehicle${list.length === 1 ? '' : 's'} found</p>` +
          (list.length ? `<div class="grid three">${list.map(v => vehicleCard(v, q)).join('')}</div>` : UI.empty('No vehicle matches your filters. Try different dates or a different type.'));
        bindSearch(root);
      }
    },
    '/vehicle': {
      view(root, q, u) {
        const v = vehicle(q.id); if (!v) { root.innerHTML = UI.empty('Vehicle not found.'); return; }
        const revs = DB.find('reviews', r => r.vehicleId === v.id).reverse(); const r = rating(v.id);
        root.innerHTML = `<p><a href="#/search">&larr; Back to search</a></p><div class="grid two"><div><img src="${esc(v.image)}" alt="${esc(v.name)}" style="width:100%;border-radius:16px;max-height:380px;object-fit:cover"></div>
          <div class="card"><div class="row between"><h1 style="margin:0">${esc(v.name)}</h1><span class="tag">${esc(v.type)}</span></div>
          ${r.n ? `<p>${UI.stars(r.avg)} ${r.avg.toFixed(1)} <span class="muted">(${r.n} reviews)</span></p>` : '<p class="muted">No reviews yet</p>'}
          <p class="price">${money(v.price)} <small>/ day</small></p><p>${esc(v.description)}</p>
          <dl class="kv"><dt>Brand</dt><dd>${esc(v.brand)}</dd><dt>Seats</dt><dd>${v.seats}</dd><dt>Transmission</dt><dd>${esc(v.transmission)}</dd><dt>Fuel</dt><dd>${esc(v.fuel)}</dd><dt>Pickup</dt><dd>${esc(v.location)}</dd><dt>Status</dt><dd>${v.available ? UI.badge('Available', 'ok') : UI.badge('Unavailable', 'bad')}</dd></dl>
          <p style="margin-top:16px">${v.available ? `<a class="btn" href="#/book?id=${v.id}">Book this vehicle</a>` : ''}</p></div></div>
          <h2 style="margin:24px 0 10px">Customer reviews</h2>${revs.length ? `<div class="stack">${revs.map(x => `<div class="card flat">${UI.stars(x.rating)} <b>${esc((DB.get('users', x.userId) || {}).name || 'Customer')}</b> <small class="muted">${fmtDate(x.created)}</small><p style="margin:4px 0 0">${esc(x.comment)}</p></div>`).join('')}</div>` : UI.empty('Be the first to review this vehicle after your trip.')}`;
      }
    },
    '/book': {
      roles: ['user'], view(root, q, u) {
        const v = vehicle(q.id); if (!v || !v.available) { root.innerHTML = UI.empty('This vehicle is not available for booking.'); return; }
        root.innerHTML = `<p><a href="#/vehicle?id=${v.id}">&larr; ${esc(v.name)}</a></p>${UI.pageHead('Book ' + v.name, 'Fill in the check-in form, choose a pickup time and pay securely.')}
          <div class="grid two"><div class="card"><form id="bf" class="form two"><h3 class="full" style="margin:0">Check-in form</h3>
            ${UI.field({ name: 'customerName', label: 'Name', value: u.name, required: true })}${UI.field({ name: 'customerNo', label: 'Customer no.', value: u.customerNo || '', attrs: 'readonly' })}
            ${UI.field({ name: 'phone', label: 'Phone', value: u.phone, required: true })}${UI.field({ name: 'type', label: 'Type', value: v.type, attrs: 'readonly' })}
            ${UI.field({ name: 'address', label: 'Address', value: u.address, required: true, cls: 'full' })}
            <h3 class="full" style="margin:6px 0 0">Schedule</h3>
            ${UI.field({ name: 'from', label: 'Pickup date', type: 'date', value: q.from || '', required: true, attrs: `min="${today()}"` })}${UI.field({ name: 'to', label: 'Return date', type: 'date', value: q.to || '', required: true, attrs: `min="${today()}"` })}
            ${UI.field({ name: 'time', label: 'Pickup time', type: 'select', value: '10:00', options: TIMES, cls: 'full' })}
            <h3 class="full" style="margin:6px 0 0">Payment</h3>
            ${UI.field({ name: 'method', label: 'Payment method', type: 'select', options: ['Credit / Debit card', 'Online banking', 'Pay at pickup'], cls: 'full' })}
            <div id="card" class="full form two"><div class="field full"><label>Card number</label><input id="cardno" inputmode="numeric" maxlength="23" placeholder="1234 5678 9012 3456" autocomplete="off"></div><div class="field"><label>Expiry (MM/YY)</label><input id="exp" placeholder="MM/YY" maxlength="5"></div><div class="field"><label>CVV</label><input id="cvv" type="password" inputmode="numeric" maxlength="4"></div><small class="full muted">Demo only: the card number is validated for length and only the last 4 digits are stored. CVV is never stored.</small></div>
            <div class="full"><button class="btn">Confirm booking</button></div></form></div>
          <div class="card" style="align-self:start"><img src="${esc(v.image)}" alt="" style="width:100%;border-radius:10px;height:150px;object-fit:cover"><h3 style="margin-top:10px">${esc(v.name)}</h3><p class="muted">${esc(v.location)}</p><div id="sum"></div></div></div>`;
        const sum = () => {
          const f = $('#bf', root).elements; const ok = f.from.value && f.to.value && f.to.value > f.from.value; const d = ok ? nDays(f.from.value, f.to.value) : 0;
          $('#sum', root).innerHTML = d ? `<dl class="kv"><dt>Rate</dt><dd>${money(v.price)} / day</dd><dt>Duration</dt><dd>${d} day${d > 1 ? 's' : ''}</dd><dt>Total</dt><dd class="price">${money(d * v.price)}</dd></dl>${conflicts(v.id, f.from.value, f.to.value).length ? '<div class="note warn">Not available on these dates.</div>' : '<div class="note">Available on these dates &#10003;</div>'}` : '<p class="muted">Select pickup and return dates to see the total.</p>';
          $('#card', root).style.display = f.method.value === 'Credit / Debit card' ? '' : 'none';
        };
        root.addEventListener('input', sum); root.addEventListener('change', sum); sum();
        UI.form(root, '#bf', d => {
          const e = datesError(d.from, d.to); if (e) throw new Error(e);
          if (conflicts(v.id, d.from, d.to).length) throw new Error('Sorry, this vehicle is already booked for those dates.');
          let payment = d.method === 'Pay at pickup' ? 'Pay at pickup' : d.method + ' - paid';
          if (d.method === 'Credit / Debit card') {
            const digits = $('#cardno', root).value.replace(/\D/g, ''); if (digits.length < 13 || digits.length > 19) throw new Error('Enter a valid card number.');
            if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test($('#exp', root).value)) throw new Error('Enter the expiry as MM/YY.');
            if (!/^\d{3,4}$/.test($('#cvv', root).value)) throw new Error('Enter the 3 or 4 digit CVV.');
            payment = 'Card ending ' + digits.slice(-4) + ' - paid';
          }
          const days = nDays(d.from, d.to);
          const b = DB.insert('bookings', { ref: ref(), userId: u.id, vehicleId: v.id, customerName: d.customerName, customerNo: d.customerNo, phone: d.phone, address: d.address, type: v.type, from: d.from, to: d.to, time: d.time, days, total: days * v.price, payment, status: 'Pending' });
          DB.update('users', u.id, { phone: d.phone, address: d.address });
          const m = UI.modal('Booking received!', `<div class="center"><div style="font-size:3rem">&#9989;</div><h2>Reference ${esc(b.ref)}</h2><p>${esc(v.name)}<br>${fmtDate(b.from)} at ${esc(b.time)} &rarr; ${fmtDate(b.to)} (${days} days)</p><p class="price">${money(b.total)}</p><p class="muted">${esc(payment)}<br>Your booking is <b>pending approval</b>. You will see the confirmation under My bookings as soon as the admin approves it.</p><a class="btn" href="#/bookings" data-close>View my bookings</a></div>`);
          UI.toast('Booking ' + b.ref + ' confirmed - awaiting approval.');
        });
      }
    },
    '/bookings': {
      roles: ['user'], view(root, q, u) {
        const t = q.t === 'history' ? 'history' : 'current';
        const all = DB.find('bookings', b => b.userId === u.id).sort((a, b) => b.created.localeCompare(a.created));
        const list = all.filter(b => t === 'history' ? isPast(b) : !isPast(b));
        root.innerHTML = UI.pageHead('My bookings', 'Track status, reschedule or review your rentals', '<a class="btn" href="#/search">+ New booking</a>') +
          `<div class="tabs"><a class="${t === 'current' ? 'on' : ''}" href="#/bookings?t=current">Current &amp; upcoming (${all.filter(b => !isPast(b)).length})</a><a class="${t === 'history' ? 'on' : ''}" href="#/bookings?t=history">Rental history (${all.filter(isPast).length})</a></div>` +
          (list.length ? `<div class="stack">${list.map(b => bookingCard(b)).join('')}</div>` : UI.empty(t === 'history' ? 'No past rentals yet.' : 'No active bookings. Start by searching for a vehicle.'));
        bookingActions(root);
      }
    },
    '/support': {
      roles: ['user'], view(root, q, u) {
        const mine = DB.find('tickets', t => t.userId === u.id).reverse();
        root.innerHTML = UI.pageHead('24/7 customer support', 'Breakdown, accident or billing question? We are always here.') + `<div class="grid three" style="margin-bottom:16px"><div class="card"><h3>&#128222; Hotline</h3><p class="price">1-800-RENT-RIDE</p><p class="muted">Open 24 hours, every day</p></div><div class="card"><h3>&#9993; Email</h3><p>help@rentride.test</p><p class="muted">Reply within 1 hour</p></div><div class="card"><h3>&#128679; Roadside</h3><p>Press 9 on the hotline</p><p class="muted">Tow &amp; replacement vehicle</p></div></div>
          <div class="grid two"><div class="card"><h3>Send a request</h3><form id="tf" class="form">${UI.field({ name: 'subject', label: 'Subject', required: true })}${UI.field({ name: 'message', label: 'Message', type: 'textarea', required: true })}<button class="btn">Send to support</button></form></div>
          <div class="card"><h3>My requests</h3>${mine.length ? `<ul class="list">${mine.map(t => `<li><b>${esc(t.subject)}</b> ${UI.badge(t.status)}<br><span class="muted">${esc(t.message)}</span></li>`).join('')}</ul>` : '<p class="muted">No requests yet.</p>'}</div></div>`;
        UI.form(root, '#tf', d => { DB.insert('tickets', { userId: u.id, subject: d.subject, message: d.message, status: 'Open' }); UI.toast('Support request sent.'); App.render(); });
      }
    },
    '/profile': {
      roles: '*', view(root, q, u) {
        const f = [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', attrs: 'readonly' }];
        if (u.role === 'user') f.push({ name: 'customerNo', label: 'Customer no.', attrs: 'readonly' }, { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address' }, { name: 'licence', label: 'Driving licence no.' });
        App.profileView(root, u, f);
      }
    },

    /* ---------------- admin ---------------- */
    '/admin': {
      roles: ['admin'], view(root) {
        const b = DB.all('bookings'); const tickets = DB.find('tickets', t => t.status === 'Open');
        root.innerHTML = UI.pageHead('Admin dashboard') + `<div class="grid four">${UI.stat('Vehicles', DB.all('vehicles').length, '&#128663;')}${UI.stat('Pending bookings', b.filter(x => x.status === 'Pending').length, '&#9203;')}${UI.stat('Customers', DB.find('users', u => u.role === 'user').length, '&#128101;')}${UI.stat('Revenue', money(b.filter(x => ['Approved', 'Completed'].includes(x.status)).reduce((s, x) => s + x.total, 0)), '&#128176;')}</div>
          <div class="grid two" style="margin-top:20px"><div><h2>Bookings waiting for approval</h2>${(() => { const p = b.filter(x => x.status === 'Pending'); return p.length ? `<div class="stack">${p.map(x => bookingCard(x, true)).join('')}</div>` : UI.empty('All caught up.'); })()}</div>
          <div><h2>Open support requests</h2>${tickets.length ? `<div class="card"><ul class="list">${tickets.map(t => `<li><b>${esc(t.subject)}</b> <small class="muted">from ${esc((DB.get('users', t.userId) || {}).name)}</small><br>${esc(t.message)}<br><button class="btn sm ghost" data-res="${t.id}">Mark resolved</button></li>`).join('')}</ul></div>` : UI.empty('No open requests.')}</div></div>`;
        bookingActions(root);
        UI.click(root, '[data-res]', x => { DB.update('tickets', x.dataset.res, { status: 'Resolved' }); App.render(); });
      }
    },
    '/vehicles': {
      roles: ['admin'], view(root) {
        const list = DB.all('vehicles');
        root.innerHTML = UI.pageHead('Manage vehicles', 'Type, price, availability and details', '<a class="btn" href="#/vehicle-form">+ Add vehicle</a>') +
          UI.table([{ h: '', f: v => `<img src="${esc(v.image)}" alt="" style="width:80px;height:54px;object-fit:cover;border-radius:8px">` }, { h: 'Vehicle', f: v => `<b>${esc(v.name)}</b><br><span class="muted">${esc(v.brand)}</span>` }, { h: 'Type', f: v => esc(v.type) }, { h: 'Price / day', f: v => money(v.price) }, { h: 'Location', f: v => esc(v.location) }, { h: 'Status', f: v => v.available ? UI.badge('Available', 'ok') : UI.badge('Unavailable', 'bad') },
            { h: '', f: v => `<a class="btn sm ghost" href="#/vehicle-form?id=${v.id}">Edit</a> <button class="btn sm ghost" data-tog="${v.id}">${v.available ? 'Disable' : 'Enable'}</button> <button class="btn sm danger" data-del="${v.id}">Delete</button>` }], list, 'No vehicles yet.');
        UI.click(root, '[data-tog]', b => { const v = vehicle(b.dataset.tog); DB.update('vehicles', v.id, { available: !v.available }); App.render(); });
        UI.click(root, '[data-del]', b => { if (DB.find('bookings', x => x.vehicleId === b.dataset.del && ['Pending', 'Approved'].includes(x.status)).length) return UI.toast('This vehicle has active bookings. Disable it instead.', 'error'); if (confirm('Delete this vehicle permanently?')) { DB.remove('vehicles', b.dataset.del); App.render(); } });
      }
    },
    '/vehicle-form': {
      roles: ['admin'], view(root, q) {
        const e = q.id ? vehicle(q.id) : null; const v = e || {};
        root.innerHTML = UI.pageHead(e ? 'Edit vehicle' : 'Add vehicle') + `<div class="card narrow"><form id="vf" class="form two">
          ${UI.field({ name: 'name', label: 'Vehicle name', value: v.name, required: true })}${UI.field({ name: 'brand', label: 'Brand', value: v.brand, required: true })}
          ${UI.field({ name: 'type', label: 'Type', type: 'select', value: v.type, options: TYPES })}${UI.field({ name: 'price', label: 'Price per day', type: 'number', value: v.price, required: true, attrs: 'min="1"' })}
          ${UI.field({ name: 'seats', label: 'Seats', type: 'number', value: v.seats || 4, attrs: 'min="1" max="20"' })}${UI.field({ name: 'transmission', label: 'Transmission', type: 'select', value: v.transmission, options: ['Automatic', 'Manual'] })}
          ${UI.field({ name: 'fuel', label: 'Fuel', type: 'select', value: v.fuel, options: ['Petrol', 'Diesel', 'Hybrid', 'Electric'] })}${UI.field({ name: 'location', label: 'Pickup location', value: v.location, required: true, attrs: 'list="locs"' })}
          <datalist id="locs">${locations().map(l => `<option value="${esc(l)}">`).join('')}</datalist>
          ${UI.field({ name: 'description', label: 'Description', type: 'textarea', value: v.description, cls: 'full', rows: 3 })}
          ${UI.field({ name: 'image', label: 'Photo', type: 'file', attrs: 'accept="image/*"', cls: 'full', hint: e ? 'Leave empty to keep the current photo' : 'Optional - a placeholder is used if empty' })}
          <label class="check full"><input type="checkbox" name="available" value="1" ${v.available === false ? '' : 'checked'}> Available for booking</label>
          <div class="full"><button class="btn">${e ? 'Save changes' : 'Add vehicle'}</button> <a class="btn ghost" href="#/vehicles">Cancel</a></div></form></div>`;
        UI.form(root, '#vf', async (d, f) => {
          const img = (await UI.readFiles(f.elements.image))[0];
          const rec = { name: d.name, brand: d.brand, type: d.type, price: Number(d.price), seats: Number(d.seats), transmission: d.transmission, fuel: d.fuel, location: d.location, description: d.description, available: !!d.available };
          if (img && img.data) rec.image = img.data; else if (!e) rec.image = UI.art({ Car: '&#128663;', SUV: '&#128665;', Truck: '&#128667;', Van: '&#128656;' }[d.type], '#dbeafe');
          if (e) DB.update('vehicles', e.id, rec); else DB.insert('vehicles', rec);
          UI.toast('Vehicle saved.'); App.go('/vehicles');
        });
      }
    },
    '/admin-bookings': {
      roles: ['admin'], view(root, q) {
        const s = q.s || 'Pending'; const all = DB.all('bookings').sort((a, b) => b.created.localeCompare(a.created));
        const list = all.filter(b => s === 'All' || b.status === s);
        root.innerHTML = UI.pageHead('Manage bookings', 'Approve or reject customer bookings') + `<div class="tabs">${['Pending', 'Approved', 'Completed', 'Rejected', 'Cancelled', 'All'].map(t => `<a class="${s === t ? 'on' : ''}" href="#/admin-bookings?s=${t}">${t}${t === 'All' ? '' : ' (' + all.filter(b => b.status === t).length + ')'}</a>`).join('')}</div>` +
          (list.length ? `<div class="stack">${list.map(b => bookingCard(b, true)).join('')}</div>` : UI.empty('No bookings in this list.'));
        bookingActions(root);
      }
    }
  };

  /* ---------- sample data ---------- */
  function seed() {
    DB.insert('users', { id: 'a1', role: 'admin', name: 'RentRide Admin', email: 'admin@rentride.test', password: 'admin123' });
    DB.insert('users', { id: 'u1', role: 'user', name: 'Anita Sharma', email: 'user@rentride.test', password: 'user123', phone: '555-0142', address: '12 Park Street, Springfield', licence: 'DL-4455-2019', customerNo: 'CUS-1001' });
    const V = [['v1', 'Corolla Sedan', 'Toyota', 'Car', 3800, 5, 'Automatic', 'Petrol', 'Downtown', '&#128663;', '#dbeafe', 'Comfortable family sedan with excellent mileage and a large boot.'],
      ['v2', 'Civic Turbo', 'Honda', 'Car', 4500, 5, 'Automatic', 'Petrol', 'Airport', '&#128661;', '#e0e7ff', 'Sporty, smooth and fuel efficient - great for business trips.'],
      ['v3', 'Alto Compact', 'Suzuki', 'Car', 2400, 4, 'Manual', 'Petrol', 'Downtown', '&#128662;', '#fef3c7', 'Small and easy to park - the cheapest way to get around the city.'],
      ['v4', 'Fortuner 4x4', 'Toyota', 'SUV', 11500, 7, 'Automatic', 'Diesel', 'Airport', '&#128665;', '#dcfce7', 'Powerful 7-seater for family holidays and rough roads.'],
      ['v5', 'Tucson Hybrid', 'Hyundai', 'SUV', 9000, 5, 'Automatic', 'Hybrid', 'North Station', '&#128693;', '#cffafe', 'Modern crossover with panoramic roof and driver assistance.'],
      ['v6', 'Sportage', 'Kia', 'SUV', 8500, 5, 'Automatic', 'Petrol', 'Seaside', '&#128664;', '#fce7f3', 'Roomy SUV with a big boot and Apple CarPlay / Android Auto.'],
      ['v7', 'Canter 3-ton', 'Mitsubishi', 'Truck', 13500, 3, 'Manual', 'Diesel', 'North Station', '&#128667;', '#fee2e2', 'Reliable 3-tonne cargo truck for house moves and deliveries.'],
      ['v8', 'N-Series Box Truck', 'Isuzu', 'Truck', 16000, 3, 'Manual', 'Diesel', 'Downtown', '&#128666;', '#fde68a', 'Enclosed 5-tonne box truck with a tail-lift.'],
      ['v9', 'HiAce 14-seater', 'Toyota', 'Van', 8000, 14, 'Manual', 'Diesel', 'Seaside', '&#128656;', '#ede9fe', 'Group travel made easy: air-conditioned, 14 comfortable seats.']];
    V.forEach(v => DB.insert('vehicles', { id: v[0], name: v[1], brand: v[2], type: v[3], price: v[4], seats: v[5], transmission: v[6], fuel: v[7], location: v[8], image: UI.art(v[9], v[10]), description: v[11], available: true }));
    const mkB = (o) => DB.insert('bookings', Object.assign({ ref: ref(), userId: 'u1', customerName: 'Anita Sharma', customerNo: 'CUS-1001', phone: '555-0142', address: '12 Park Street, Springfield', payment: 'Card ending 4242 - paid' }, o));
    const price = id => vehicle(id).price;
    const done = mkB({ vehicleId: 'v1', type: 'Car', from: addDays(today(), -20), to: addDays(today(), -17), time: '10:00', days: 3, total: 3 * price('v1'), status: 'Completed' });
    mkB({ vehicleId: 'v4', type: 'SUV', from: addDays(today(), 5), to: addDays(today(), 8), time: '09:00', days: 3, total: 3 * price('v4'), status: 'Approved' });
    mkB({ vehicleId: 'v9', type: 'Van', from: addDays(today(), 12), to: addDays(today(), 14), time: '14:00', days: 2, total: 2 * price('v9'), status: 'Pending', payment: 'Pay at pickup' });
    DB.insert('reviews', { userId: 'u1', vehicleId: 'v1', bookingId: done.id, rating: 5, comment: 'Clean car, smooth pickup and the staff were friendly.' });
    DB.insert('reviews', { userId: 'u1', vehicleId: 'v4', bookingId: 'seed', rating: 4, comment: 'Great for our family trip, a bit thirsty on fuel.' });
  }

  App.init({
    key: 'rentride', name: 'RentRide', logo: '&#128663;', currency: 'Rs.', routes, seed,
    home: u => u.role === 'admin' ? '/admin' : '/',
    menus: {
      guest: [['/', 'Home'], ['/search', 'Browse vehicles'], ['/login', 'Login'], ['/register', 'Register']],
      user: [['/', 'Home'], ['/search', 'Search'], ['/bookings', 'My bookings'], ['/support', '24/7 support'], ['/profile', 'My profile']],
      admin: [['/admin', 'Dashboard'], ['/vehicles', 'Vehicles'], ['/vehicle-form', 'Add vehicle'], ['/admin-bookings', 'Bookings'], ['/profile', 'My profile']]
    }
  });
  /* "real-time" updates: when another browser tab changes the data, refresh the current page */
  window.addEventListener('storage', e => { if (e.key && e.key.startsWith('rentride:') && !document.querySelector('.modal-bg')) App.render(); });
})();
