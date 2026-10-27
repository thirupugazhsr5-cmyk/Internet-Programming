/* ReNewMarket - second-hand marketplace. Data in localStorage (demo, no server). */
const $=s=>document.querySelector(s),app=$('#app');
const L=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
const SEED=[
 {id:1,title:'Used iPhone 11 (64GB)',cat:'Electronics',price:18000,desc:'Good condition, battery 85%, with charger.',seller:'seller1',icon:'📱'},
 {id:2,title:'Wooden Study Table',cat:'Furniture',price:3500,desc:'Solid teak, 4 ft, minor scratches.',seller:'seller1',icon:'🪑'},
 {id:3,title:'Leather Jacket (M)',cat:'Clothing',price:2200,desc:'Worn twice, black.',seller:'seller1',icon:'🧥'},
 {id:4,title:'Vintage Coin Set',cat:'Collectibles',price:1500,desc:'20 coins from 1950-1990.',seller:'seller1',icon:'🪙'}];
let users=L('rm_users',[{u:'admin',p:'admin123',role:'admin'},{u:'seller1',p:'pass1',role:'user'}]),cats=L('rm_cats',['Electronics','Furniture','Clothing','Collectibles']),
 items=L('rm_items',SEED),offers=L('rm_off',[]),orders=L('rm_ord',[]),fb=L('rm_fb',[]),favs=L('rm_fav',{}),sess=L('rm_sess',null);
const save=()=>{S('rm_users',users);S('rm_cats',cats);S('rm_items',items);S('rm_off',offers);S('rm_ord',orders);S('rm_fb',fb);S('rm_fav',favs);S('rm_sess',sess)};
const lk=(f,t)=>`<a href="#" onclick="${f};return false">${t}</a>`;
const tbl=(h,r)=>`<div class="wrap"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.join('')||`<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table></div>`;
const it=id=>items.find(i=>i.id==id);
function nav(){$('#nav').innerHTML=lk('home()','Browse')+(sess?(sess.role=='admin'?lk('admin()','Admin'):lk('sell()','Sell')+lk('myOrders()','My orders')+lk('favPage()','Favourites'))+`<span>Hi, ${esc(sess.u)}</span>`+lk('logout()','Logout'):lk('loginPage()','Login')+lk('loginPage(1)','Register'))}
function need(){if(!sess){toast('Please login first');loginPage();return false}return true}
/* ---- buyers ---- */
function home(f){f=f||{};nav();
 const r=items.filter(i=>!i.sold&&(!f.q||(i.title+i.desc).toLowerCase().includes(f.q.toLowerCase()))&&(!f.cat||i.cat==f.cat)&&(!f.max||i.price<=+f.max));
 app.innerHTML=`<h1>Pre-loved goods</h1><form class="row" onsubmit="event.preventDefault();home({q:$('#q').value,cat:$('#c').value,max:$('#m').value})"><input id="q" placeholder="Search listings" value="${esc(f.q||'')}"><select id="c"><option value="">All categories</option>${cats.map(c=>`<option ${c==f.cat?'selected':''}>${esc(c)}</option>`).join('')}</select><input id="m" type="number" placeholder="Max price" style="width:130px" value="${f.max||''}"><button>Search</button></form><br>
 <div class="grid">${r.map(i=>`<div class="card"><div class="img">${i.icon}</div><span class="tag">${esc(i.cat)}</span><strong>${esc(i.title)}</strong><div class="price">${inr(i.price)}</div><small>Seller: ${esc(i.seller)}</small><div class="row"><button onclick="detail(${i.id})">Details</button><button class="alt" onclick="fav(${i.id})">♡</button></div></div>`).join('')||'<p>No listings match.</p>'}</div>`}
function detail(id){const i=it(id),rate=fb.filter(f=>f.seller==i.seller);
 app.innerHTML=`<button class="alt" onclick="home()">&larr; Back</button><h1>${esc(i.title)}</h1><span class="tag">${esc(i.cat)}</span><p>${esc(i.desc)}</p><div class="price">${inr(i.price)}</div><p>Seller: <b>${esc(i.seller)}</b> (${rate.length} feedback)</p>
 <div class="row"><select id="mt"><option>Pick-up</option><option>Delivery</option></select><button onclick="buy(${i.id})">Buy now</button><button class="alt" onclick="offer(${i.id})">Make an offer</button></div>
 <h2>Seller feedback</h2>${rate.map(f=>`<div class="review"><b>${esc(f.from)}</b>: ${esc(f.text)}</div>`).join('')||'<p>No feedback yet.</p>'}`}
function mkOrder(i,buyer,price,method){orders.push({id:Date.now()+Math.random(),item:i.id,title:i.title,buyer,seller:i.seller,price,method,status:'Pending'});i.sold=true}
function buy(id){if(!need())return;const i=it(id);if(i.seller==sess.u)return toast('This is your own listing');mkOrder(i,sess.u,i.price,$('#mt').value);save();toast('Order placed');orders_()}
function offer(id){if(!need())return;const i=it(id);if(i.seller==sess.u)return toast('This is your own listing');const a=+prompt('Your offer (₹)');if(!a)return;offers.push({id:Date.now(),item:id,buyer:sess.u,amt:a,status:'Open'});save();toast('Offer sent to seller')}
function fav(id){if(!need())return;const a=favs[sess.u]=favs[sess.u]||[];if(!a.includes(id))a.push(id);save();toast('Added to favourites')}
function favPage(){if(!need())return;app.innerHTML=`<h1>Favourites</h1>`+tbl(['Item','Price',''],(favs[sess.u]||[]).map(it).filter(Boolean).map(i=>`<tr><td>${esc(i.title)}</td><td>${inr(i.price)}</td><td><button onclick="detail(${i.id})">View</button></td></tr>`))}
/* ---- sellers ---- */
function sell(){if(!need())return;const mine=items.filter(i=>i.seller==sess.u),mo=offers.filter(o=>it(o.item)?.seller==sess.u);
 app.innerHTML=`<h1>Sell an item</h1><form class="row" onsubmit="addItem(event)"><input id="t" placeholder="Title" required><select id="k">${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><input id="p" type="number" min="1" placeholder="Price" required style="width:120px"><input id="d" placeholder="Description" required><button>Create listing</button></form>
 <h2>My listings</h2>`+tbl(['Item','Price','Status',''],mine.map(i=>`<tr><td>${esc(i.title)}</td><td>${inr(i.price)}</td><td>${i.sold?'Sold':'Live'}</td><td><button class="del" onclick="rmItem(${i.id},'sell')">Remove</button></td></tr>`))
 +`<h2>Offers received</h2>`+tbl(['Item','Buyer','Offer','Status',''],mo.map(o=>`<tr><td>${esc(it(o.item).title)}</td><td>${esc(o.buyer)}</td><td>${inr(o.amt)}</td><td>${o.status}</td><td>${o.status=='Open'&&!it(o.item).sold?`<button onclick="acceptOffer(${o.id})">Accept</button> <button class="del" onclick="rejectOffer(${o.id})">Reject</button>`:''}</td></tr>`))}
function addItem(e){e.preventDefault();items.push({id:Date.now(),title:$('#t').value,cat:$('#k').value,price:+$('#p').value,desc:$('#d').value,seller:sess.u,icon:'📦'});save();sell();toast('Listing created')}
function rmItem(id,back){items=items.filter(i=>i.id!=id);save();window[back]()}
function acceptOffer(id){const o=offers.find(x=>x.id==id),i=it(o.item);mkOrder(i,o.buyer,o.amt,'Pick-up');offers.forEach(x=>{if(x.item==o.item)x.status=x.id==id?'Accepted':'Closed'});save();sell();toast('Offer accepted, order created')}
function rejectOffer(id){offers.find(x=>x.id==id).status='Rejected';save();sell()}
function myOrders(){if(!need())return;orders_()}
function orders_(){nav();const my=orders.filter(o=>o.buyer==sess.u),sold=orders.filter(o=>o.seller==sess.u),myo=offers.filter(o=>o.buyer==sess.u);
 app.innerHTML=`<h1>My purchases</h1>`+tbl(['Item','Price','Method','Status',''],my.map(o=>`<tr><td>${esc(o.title)}</td><td>${inr(o.price)}</td><td>${o.method}</td><td>${o.status}</td><td>${o.status=='Received'&&!fb.some(f=>f.order==o.id)?`<button onclick="feedback(${o.id})">Leave feedback</button>`:''}</td></tr>`))
 +`<h2>My sales</h2>`+tbl(['Item','Buyer','Price','Status'],sold.map(o=>`<tr><td>${esc(o.title)}</td><td>${esc(o.buyer)}</td><td>${inr(o.price)}</td><td>${o.status}</td></tr>`))
 +`<h2>My offers</h2>`+tbl(['Item','Offer','Status'],myo.map(o=>`<tr><td>${esc(it(o.item)?.title||'(removed)')}</td><td>${inr(o.amt)}</td><td>${o.status}</td></tr>`))}
function feedback(id){const o=orders.find(x=>x.id==id),t=prompt('Feedback for '+o.seller);if(!t)return;fb.push({order:id,from:sess.u,seller:o.seller,text:t});save();orders_();toast('Thanks for your feedback')}
/* ---- admin ---- */
function admin(){if(sess?.role!='admin')return loginPage();
 app.innerHTML=`<h1>Admin</h1><h2>User management</h2><form class="row" onsubmit="addUser(event)"><input id="nu" placeholder="New username" required><input id="np" placeholder="Password" required><button>Set login account</button></form>`
 +tbl(['User','Role',''],users.map(u=>`<tr><td>${esc(u.u)}</td><td>${u.role}</td><td class="row"><button class="alt" onclick="editUser('${u.u}')">Edit password</button>${u.role=='admin'?'':`<button class="del" onclick="delUser('${u.u}')">Delete</button>`}</td></tr>`))
 +`<h2>Category management</h2><form class="row" onsubmit="addCat(event)"><input id="nc" placeholder="New category" required><button>Add category</button></form>`+tbl(['Category',''],cats.map(c=>`<tr><td>${esc(c)}</td><td><button class="del" onclick="delCat('${c}')">Delete</button></td></tr>`))
 +`<h2>Commodity management</h2>`+tbl(['Item','Price','Description',''],items.map(i=>`<tr><td>${esc(i.title)}</td><td><input id="p${i.id}" type="number" value="${i.price}" style="width:90px"></td><td><input id="d${i.id}" value="${esc(i.desc)}" style="width:100%"></td><td class="row"><button onclick="saveItem(${i.id})">Save</button><button class="del" onclick="rmItem(${i.id},'admin')">Delete</button></td></tr>`))
 +`<h2>Order management</h2>`+tbl(['Item','Buyer','Seller','Price','Logistics status',''],orders.map((o,k)=>`<tr><td>${esc(o.title)}</td><td>${esc(o.buyer)}</td><td>${esc(o.seller)}</td><td>${inr(o.price)}</td><td><select onchange="setStatus(${k},this.value)">${['Pending','Shipped','Received'].map(s=>`<option ${s==o.status?'selected':''}>${s}</option>`).join('')}</select></td><td><button class="del" onclick="delOrder(${k})">Delete</button></td></tr>`))}
function addUser(e){e.preventDefault();if(users.some(x=>x.u==$('#nu').value))return toast('Username taken');users.push({u:$('#nu').value,p:$('#np').value,role:'user'});save();admin()}
function editUser(u){const p=prompt('New password for '+u);if(p){users.find(x=>x.u==u).p=p;save();toast('Password updated')}}
function delUser(u){if(!confirm('Delete '+u+'?'))return;users=users.filter(x=>x.u!=u);save();admin()}
function addCat(e){e.preventDefault();if(!cats.includes($('#nc').value))cats.push($('#nc').value);save();admin()}
function delCat(c){cats=cats.filter(x=>x!=c);save();admin()}
function saveItem(id){const i=it(id);i.price=+$('#p'+id).value;i.desc=$('#d'+id).value;save();toast('Commodity updated')}
function setStatus(k,v){orders[k].status=v;save();toast('Status: '+v)}
function delOrder(k){if(confirm('Delete this order?')){orders.splice(k,1);save();admin()}}
/* ---- auth ---- */
function loginPage(reg){nav();app.innerHTML=`<form class="panel" onsubmit="auth(event,${!!reg})"><h1>${reg?'Register':'Login'}</h1><input id="u" placeholder="Username" required><input id="p" type="password" placeholder="Password" required minlength="4"><button>${reg?'Create account':'Login'}</button><small>Demo: admin / admin123 or seller1 / pass1</small></form>`}
function auth(e,reg){e.preventDefault();const u=$('#u').value,p=$('#p').value;
 if(reg){if(users.some(x=>x.u==u))return toast('Username taken');users.push({u,p,role:'user'});save();toast('Registered. Please login.');return loginPage()}
 const x=users.find(y=>y.u==u&&y.p==p);if(!x)return toast('Wrong username or password');sess={u,role:x.role};save();x.role=='admin'?admin():home()}
function logout(){sess=null;save();home()}
home();
