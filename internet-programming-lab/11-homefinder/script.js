/* Home Finder - data kept in localStorage (demo, no server) */
const $=s=>document.querySelector(s),app=$('#app');
const L=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
const P=[
 {id:1,title:'3BHK Family House',type:'House',mode:'Buy',loc:'Anna Nagar',addr:'Anna Nagar, Chennai',price:9500000,beds:3,agent:'Meera Realty',company:'Prime Homes',icon:'🏠',desc:'Gated street, car parking, 1800 sq ft.'},
 {id:2,title:'2BHK Apartment',type:'Apartment',mode:'Rent',loc:'Velachery',addr:'Velachery, Chennai',price:22000,beds:2,agent:'Ravi Kumar',company:'CityNest',icon:'🏢',desc:'Near metro, lift, 24h security.'},
 {id:3,title:'Residential Plot 1200 sq ft',type:'Land',mode:'Buy',loc:'Sriperumbudur',addr:'Sriperumbudur, Tamil Nadu',price:2400000,beds:0,agent:'Meera Realty',company:'Prime Homes',icon:'🌳',desc:'DTCP approved, corner plot.'},
 {id:4,title:'Office Space 900 sq ft',type:'Commercial',mode:'Rent',loc:'OMR',addr:'OMR, Chennai',price:55000,beds:0,agent:'Anita Shah',company:'WorkSpaces Co',icon:'🏬',desc:'Furnished, 10 workstations.'},
 {id:5,title:'1BHK Studio',type:'Apartment',mode:'Rent',loc:'T Nagar',addr:'T Nagar, Chennai',price:14000,beds:1,agent:'Ravi Kumar',company:'CityNest',icon:'🏢',desc:'Close to shopping and bus stand.'},
 {id:6,title:'4BHK Villa with Pool',type:'House',mode:'Buy',loc:'ECR',addr:'East Coast Road, Chennai',price:24000000,beds:4,agent:'Anita Shah',company:'WorkSpaces Co',icon:'🏡',desc:'Sea-facing villa, garden, 3200 sq ft.'}
];
let users=L('hf_users',[]),sess=L('hf_sess',null),saved=L('hf_saved',{}),favs=L('hf_favs',{}),viewings=L('hf_view',[]),visits=L('hf_visits',[]),last={};
visits.push({user:sess?sess.u:'guest',time:new Date().toLocaleString()});S('hf_visits',visits);
const lk=(f,t)=>`<a href="#" onclick="${f};return false">${t}</a>`;
function nav(){$('#nav').innerHTML=lk('home()','Search')+lk('agents()','Agents')+lk('calc()','Mortgage')+(sess?lk('favPage()','Favourites')+lk('savedPage()','Saved searches')+lk('viewPage()','Viewings')+`<span>Hi, ${esc(sess.u)}</span>`+lk('logout()','Logout'):lk('loginPage()','Login'))+lk('visitors()','Visitors')}
function sel(id,ph,arr,v){return `<select id="${id}"><option value="">${ph}</option>${arr.map(x=>`<option ${x==v?'selected':''}>${x}</option>`).join('')}</select>`}
function form(f){return `<form class="row" onsubmit="doSearch(event)"><input id="q" placeholder="Area, agent or company" value="${esc(f.q||'')}">${sel('mode','Buy / Rent',['Buy','Rent'],f.mode)}${sel('type','Any type',['House','Apartment','Land','Commercial'],f.type)}<input id="max" type="number" placeholder="Max budget" style="width:140px" value="${f.max||''}"><select id="beds"><option value="">Beds</option>${[1,2,3,4].map(n=>`<option value="${n}" ${n==f.beds?'selected':''}>${n}+</option>`).join('')}</select><button>Search</button><button type="button" class="alt" onclick="saveSearch()">Save this search</button></form>`}
function read(){return {q:$('#q').value.trim(),mode:$('#mode').value,type:$('#type').value,max:$('#max').value,beds:$('#beds').value}}
function doSearch(e){e.preventDefault();home(read())}
function match(f){return P.filter(p=>(!f.q||(p.title+p.loc+p.addr+p.agent+p.company).toLowerCase().includes(f.q.toLowerCase()))&&(!f.type||p.type===f.type)&&(!f.mode||p.mode===f.mode)&&(!f.max||p.price<=+f.max)&&(!f.beds||p.beds>=+f.beds))}
function home(f){last=f||{};nav();const r=match(last);
 app.innerHTML=`<h1>Find your next home</h1>${form(last)}
 <div class="ad">Sponsored: <a href="https://www.99acres.com" target="_blank" rel="noopener">Browse more listings on 99acres</a> &middot; <a href="https://www.magicbricks.com" target="_blank" rel="noopener">Home loans on MagicBricks</a></div>
 <h2>${r.length} propert${r.length==1?'y':'ies'} found</h2><div class="grid">${r.map(card).join('')||'<p>No match. Try a wider budget.</p>'}</div>`}
function card(p){return `<div class="card"><div class="img">${p.icon}</div><span class="tag">${p.type} &middot; ${p.mode}</span><strong>${esc(p.title)}</strong>
 <div class="price">${inr(p.price)}${p.mode=='Rent'?' / month':''}</div><div>${esc(p.loc)}${p.beds?' &middot; '+p.beds+' beds':''}</div><small>${esc(p.agent)}, ${esc(p.company)}</small>
 <div class="row"><button onclick="detail(${p.id})">Details &amp; map</button><button class="alt" onclick="fav(${p.id})">♡</button></div></div>`}
function need(){if(!sess){toast('Please login first');loginPage();return false}return true}
function saveSearch(){if(!need())return;const f=read();(saved[sess.u]=saved[sess.u]||[]).push(f);S('hf_saved',saved);toast('Search criteria saved')}
function savedPage(){if(!need())return;const a=saved[sess.u]||[];
 app.innerHTML=`<h1>Saved searches</h1>`+(a.map((f,i)=>`<div class="card"><div>${Object.entries(f).filter(e=>e[1]).map(e=>e[0]+': '+esc(e[1])).join(', ')||'All properties'}</div><div class="row"><button onclick="home(saved['${sess.u}'][${i}])">Use this search</button><button class="del" onclick="delSaved(${i})">Delete</button></div></div><br>`).join('')||'<p>Nothing saved yet. Save a search from the Search page.</p>')}
function delSaved(i){saved[sess.u].splice(i,1);S('hf_saved',saved);savedPage()}
function fav(id){if(!need())return;const a=favs[sess.u]=favs[sess.u]||[];if(!a.includes(id))a.push(id);S('hf_favs',favs);toast('Saved to favourites')}
function favPage(){if(!need())return;app.innerHTML=`<h1>Favourites</h1><div class="grid">${(favs[sess.u]||[]).map(i=>card(P.find(p=>p.id==i))).join('')||'<p>No favourites yet.</p>'}</div>`}
function detail(id){const p=P.find(x=>x.id==id);
 app.innerHTML=`<button class="alt" onclick="home(last)">&larr; Back to results</button><h1>${esc(p.title)}</h1><p>${esc(p.desc)} <b>${inr(p.price)}</b></p>
 <iframe title="Map" width="100%" height="320" style="border:0;border-radius:8px" loading="lazy" src="https://maps.google.com/maps?q=${encodeURIComponent(p.addr)}&output=embed"></iframe>
 <p>Agent: <b>${esc(p.agent)}</b> (${esc(p.company)})</p><div class="row"><input type="date" id="vd"><button onclick="book(${p.id})">Schedule viewing</button></div>`}
function book(id){if(!need())return;const d=$('#vd').value;if(!d)return toast('Pick a date');viewings.push({u:sess.u,id,d});S('hf_view',viewings);toast('Viewing booked for '+d)}
function viewPage(){if(!need())return;app.innerHTML=`<h1>My viewings</h1><div class="wrap"><table><tr><th>Property</th><th>Date</th></tr>${viewings.filter(v=>v.u==sess.u).map(v=>`<tr><td>${esc(P.find(p=>p.id==v.id).title)}</td><td>${v.d}</td></tr>`).join('')||'<tr><td colspan=2>No viewings yet</td></tr>'}</table></div>`}
function agents(q=''){const A={};P.forEach(p=>{A[p.agent]=A[p.agent]||{c:p.company,n:0};A[p.agent].n++});
 const list=Object.entries(A).filter(([a,d])=>(a+d.c).toLowerCase().includes(q.toLowerCase()));
 app.innerHTML=`<h1>Agents and companies</h1><input id="aq" placeholder="Search agent or company" value="${esc(q)}" oninput="agents(this.value);$('#aq').focus()"><br><br><div class="grid">${list.map(([a,d])=>`<div class="card"><strong>${esc(a)}</strong><span>${esc(d.c)}</span><span>${d.n} listing(s)</span><button onclick="home({q:'${a}'})">View listings</button></div>`).join('')||'<p>No agent found.</p>'}</div>`}
function calc(){app.innerHTML=`<div class="panel"><h1>Mortgage calculator</h1><input id="c1" type="number" placeholder="Loan amount" value="5000000"><input id="c2" type="number" placeholder="Interest % per year" value="8.5"><input id="c3" type="number" placeholder="Years" value="20"><button onclick="emi()">Calculate EMI</button><h2 id="out"></h2></div>`}
function emi(){const P_=+$('#c1').value,r=+$('#c2').value/1200,n=+$('#c3').value*12;const e=r?P_*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):P_/n;$('#out').textContent='Monthly EMI: '+inr(Math.round(e))}
function visitors(){app.innerHTML=`<h1>Visitor record</h1><p>Total visits: <b>${visits.length}</b></p><div class="wrap"><table><tr><th>User</th><th>Time</th></tr>${visits.slice(-30).reverse().map(v=>`<tr><td>${esc(v.user)}</td><td>${v.time}</td></tr>`).join('')}</table></div>`}
function loginPage(reg){app.innerHTML=`<form class="panel" onsubmit="auth(event,${!!reg})"><h1>${reg?'Register':'Buyer login'}</h1><input id="u" placeholder="Username" required><input id="p" type="password" placeholder="Password" required minlength="4"><button>${reg?'Create account':'Login'}</button>${lk(`loginPage(${!reg})`,reg?'I have an account':'New buyer? Register')}</form>`}
function auth(e,reg){e.preventDefault();const u=$('#u').value,p=$('#p').value;
 if(reg){if(users.some(x=>x.u==u))return toast('Username taken');users.push({u,p});S('hf_users',users);toast('Registered. Please login.');return loginPage()}
 if(!users.some(x=>x.u==u&&x.p==p))return toast('Wrong username or password');sess={u};S('hf_sess',sess);toast('Welcome '+u);home()}
function logout(){sess=null;S('hf_sess',null);home()}
home();
