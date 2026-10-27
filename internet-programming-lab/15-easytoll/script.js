/* EasyToll - advance toll payment. Roles: admin, user, gate. Data in localStorage (demo). */
const $=s=>document.querySelector(s),app=$('#app');
const L=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)};
const today=()=>new Date().toISOString().slice(0,10),addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const PASS_FEE={Bike:500,Car:1500,Truck:4000},MULT={Bike:.5,Car:1,Truck:2};
let users=L('et_users',[{u:'admin',p:'admin123',role:'admin',name:'Administrator'},{u:'gate1',p:'gate123',role:'gate',name:'Gate Operator 1',gate:1}]),
 gates=L('et_gates',[{id:1,name:'Sriperumbudur Toll Plaza',loc:'NH48, Tamil Nadu',fee:120},{id:2,name:'Walajapet Toll Plaza',loc:'NH48, Vellore',fee:90}]),
 passes=L('et_pass',[]),tickets=L('et_tix',[]),tx=L('et_tx',[]),scans=L('et_scan',[]),sess=L('et_sess',null);
const save=()=>{S('et_users',users);S('et_gates',gates);S('et_pass',passes);S('et_tix',tickets);S('et_tx',tx);S('et_scan',scans);S('et_sess',sess)};
const me=()=>users.find(x=>x.u==sess.u),gate=id=>gates.find(g=>g.id==id),uid=p=>p+Math.random().toString(36).slice(2,8).toUpperCase();
const lk=(f,t)=>`<a href="#" onclick="${f};return false">${t}</a>`;
const tbl=(h,r)=>`<div class="wrap"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.join('')||`<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table></div>`;
const opts=a=>a.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('');
function nav(){$('#nav').innerHTML=sess?`<span>${esc(sess.u)} (${sess.role})</span>`+lk('dash()','Dashboard')+lk('logout()','Logout'):lk('home()','Home')+lk('loginPage()','Login')+lk('loginPage(1)','Register')}
function home(){nav();app.innerHTML=`<h1>Pay toll in advance. Skip the queue.</h1><p>Top up your wallet, buy an e-ticket or a toll pass, and show the QR code at the gate.</p><div class="row"><button onclick="loginPage(1)">Register</button><button class="alt" onclick="loginPage()">Login</button></div><h2>Toll gates</h2>`+tbl(['Gate','Location','Car fee','Bike fee','Truck fee'],gates.map(g=>`<tr><td>${esc(g.name)}</td><td>${esc(g.loc)}</td><td>${inr(g.fee)}</td><td>${inr(g.fee*MULT.Bike)}</td><td>${inr(g.fee*MULT.Truck)}</td></tr>`))}
function loginPage(reg){nav();app.innerHTML=`<form class="panel" onsubmit="auth(event,${!!reg})"><h1>${reg?'Register':'Login'}</h1>${reg?'<input id="n" placeholder="Full name" required>':''}<input id="u" placeholder="Username" required><input id="p" type="password" placeholder="Password" required minlength="4"><button>${reg?'Create account':'Login'}</button><small>Demo: admin / admin123, toll gate: gate1 / gate123</small></form>`}
function auth(e,reg){e.preventDefault();const u=$('#u').value,p=$('#p').value;
 if(reg){if(users.some(x=>x.u==u))return toast('Username taken');users.push({u,p,role:'user',name:$('#n').value,wallet:0});save();toast('Registered. Please login.');return loginPage()}
 const x=users.find(y=>y.u==u&&y.p==p);if(!x)return toast('Wrong username or password');sess={u,role:x.role};save();dash()}
function logout(){sess=null;save();home()}
function dash(){if(!sess)return loginPage();nav();({admin,user:userDash,gate:gateDash}[sess.role])()}
/* ---- QR (uses qrcodejs from cdnjs; falls back to a pattern if offline) ---- */
function showQR(code){const b=$('#qrbox');b.innerHTML=`<b>${code}</b><div id="qrc"></div><small>Show this at the toll gate</small>`;
 if(window.QRCode)return new QRCode($('#qrc'),{text:code,width:170,height:170});
 const c=document.createElement('canvas');c.width=c.height=168;const x=c.getContext('2d');let h=[...code].reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7);
 for(let i=0;i<21;i++)for(let j=0;j<21;j++){h=(h*1103515245+12345)>>>0;if(h>>>16&1)x.fillRect(j*8,i*8,8,8)}$('#qrc').appendChild(c)}
const addTx=(u,desc,amt)=>tx.push({u,t:new Date().toLocaleString(),desc,amt});
/* ---- admin ---- */
function admin(){const g=users.filter(x=>x.role=='gate');
 app.innerHTML=`<h1>Admin</h1><div id="qrbox" class="card" style="max-width:240px"></div>
 <h2>Toll pass requests</h2>`+tbl(['Pass ID','Owner','Vehicle','Type','Status','Expiry',''],passes.map(p=>`<tr><td>${p.id}</td><td>${esc(p.owner)}</td><td>${esc(p.veh)}</td><td>${p.type}</td><td>${p.status}</td><td>${p.exp||'-'}</td><td class="row">${p.status=='Pending'?`<button onclick="approve('${p.id}')">Approve</button><button class="del" onclick="rejectPass('${p.id}')">Reject</button>`:''}${p.status=='Approved'?`<button class="alt" onclick="showQR('${p.id}')">Generate QR</button>`:''}</td></tr>`))
 +`<h2>Toll details</h2><form class="row" onsubmit="addGate(event)"><input id="gn" placeholder="Toll plaza name" required><input id="gl" placeholder="Location" required><input id="gf" type="number" min="1" placeholder="Car fee" required style="width:110px"><button>Create toll</button></form>`+tbl(['Toll','Location','Car fee',''],gates.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.loc)}</td><td>${inr(x.fee)}</td><td><button class="del" onclick="delGate(${x.id})">Delete</button></td></tr>`))
 +`<h2>Toll gate logins</h2><form class="row" onsubmit="addGateUser(event)"><input id="tu" placeholder="Username" required><input id="tp" placeholder="Password" required><select id="tg">${opts(gates.map(x=>[x.id,x.name]))}</select><button>Create toll login</button></form>`+tbl(['Username','Toll',''],g.map(x=>`<tr><td>${x.u}</td><td>${esc(gate(x.gate)?.name||'-')}</td><td><button class="del" onclick="delUser('${x.u}')">Delete</button></td></tr>`))
 +`<h2>Users</h2>`+tbl(['Username','Name','Wallet',''],users.filter(x=>x.role=='user').map(x=>`<tr><td>${x.u}</td><td>${esc(x.name)}</td><td>${inr(x.wallet)}</td><td><button class="del" onclick="delUser('${x.u}')">Delete</button></td></tr>`))}
function approve(id){const p=passes.find(x=>x.id==id);p.status='Approved';p.exp=addDays(today(),30);save();admin();toast('Pass approved')}
function rejectPass(id){const p=passes.find(x=>x.id==id);p.status='Rejected';users.find(x=>x.u==p.owner).wallet+=PASS_FEE[p.type];addTx(p.owner,'Refund: pass '+id,PASS_FEE[p.type]);save();admin()}
function addGate(e){e.preventDefault();gates.push({id:Date.now(),name:$('#gn').value,loc:$('#gl').value,fee:+$('#gf').value});save();admin()}
function delGate(id){gates=gates.filter(x=>x.id!=id);save();admin()}
function addGateUser(e){e.preventDefault();if(users.some(x=>x.u==$('#tu').value))return toast('Username taken');users.push({u:$('#tu').value,p:$('#tp').value,role:'gate',name:'Gate operator',gate:+$('#tg').value});save();admin();toast('Toll login created')}
function delUser(u){if(!confirm('Delete '+u+'?'))return;users=users.filter(x=>x.u!=u);save();admin()}
/* ---- user ---- */
function userDash(){const m=me(),mp=passes.filter(p=>p.owner==m.u),mt=tickets.filter(t=>t.owner==m.u),soon=mp.filter(p=>p.status=='Approved'&&p.exp<=addDays(today(),7));
 app.innerHTML=`<h1>Hello, ${esc(m.name)}</h1><p>eWallet balance</p><div class="big">${inr(m.wallet)}</div>
 <form class="row" onsubmit="addMoney(event)"><input id="am" type="number" min="1" placeholder="Amount" required style="width:130px"><button>Add money</button></form>
 ${soon.map(p=>`<p class="bad">Notice: pass ${p.id} expires on ${p.exp}. Renew it below.</p>`).join('')}<div id="qrbox" class="card" style="max-width:240px"></div>
 <h2>Buy toll e-ticket</h2><form class="row" onsubmit="buyTicket(event)"><select id="tg">${opts(gates.map(g=>[g.id,g.name]))}</select><select id="vt">${opts(Object.keys(MULT).map(k=>[k,k]))}</select><input id="vn" placeholder="Vehicle number" required><button>Buy e-ticket</button></form>
 <h2>Apply for a toll pass (30 days)</h2><form class="row" onsubmit="applyPass(event)"><select id="pt">${opts(Object.keys(PASS_FEE).map(k=>[k,k+' - '+inr(PASS_FEE[k])]))}</select><input id="pv" placeholder="Vehicle number" required><button>Apply</button></form>
 <h2>My passes</h2>`+tbl(['Pass ID','Vehicle','Status','Expiry',''],mp.map(p=>`<tr><td>${p.id}</td><td>${esc(p.veh)}</td><td>${p.status}</td><td>${p.exp||'-'}</td><td class="row">${p.status=='Approved'?`<button onclick="showQR('${p.id}')">Get QR code</button><button class="alt" onclick="renew('${p.id}')">Renew</button>`:''}</td></tr>`))
 +`<h2>My e-tickets</h2>`+tbl(['Ticket','Toll','Vehicle','Fee','Status',''],mt.map(t=>`<tr><td>${t.id}</td><td>${esc(gate(t.gate)?.name||'')}</td><td>${esc(t.veh)}</td><td>${inr(t.fee)}</td><td>${t.used?'Used':'Valid'}</td><td>${t.used?'':`<button onclick="showQR('${t.id}')">QR</button>`}</td></tr>`))
 +`<h2>Transaction history</h2>`+tbl(['Time','Details','Amount'],tx.filter(t=>t.u==m.u).reverse().map(t=>`<tr><td>${t.t}</td><td>${esc(t.desc)}</td><td class="${t.amt<0?'bad':'ok'}">${t.amt<0?'-':'+'}${inr(Math.abs(t.amt))}</td></tr>`))}
function charge(m,amt,desc){if(m.wallet<amt){toast('Not enough balance. Add money first.');return false}m.wallet-=amt;addTx(m.u,desc,-amt);return true}
function addMoney(e){e.preventDefault();const m=me(),a=+$('#am').value;m.wallet+=a;addTx(m.u,'Wallet top-up',a);save();userDash();toast('Money added')}
function buyTicket(e){e.preventDefault();const m=me(),g=gate($('#tg').value),t=$('#vt').value,fee=g.fee*MULT[t];if(!charge(m,fee,'E-ticket: '+g.name))return;tickets.push({id:uid('TKT-'),owner:m.u,gate:g.id,veh:$('#vn').value,fee,used:false});save();userDash();toast('E-ticket bought')}
function applyPass(e){e.preventDefault();const m=me(),t=$('#pt').value;if(!charge(m,PASS_FEE[t],'Toll pass application ('+t+')'))return;passes.push({id:uid('PASS-'),owner:m.u,veh:$('#pv').value,type:t,status:'Pending'});save();userDash();toast('Applied. Waiting for admin approval.')}
function renew(id){const p=passes.find(x=>x.id==id);if(!charge(me(),PASS_FEE[p.type],'Pass renewal '+id))return;p.exp=addDays(p.exp>today()?p.exp:today(),30);save();userDash();toast('Renewed until '+p.exp)}
/* ---- toll gate user ---- */
function gateDash(){const g=gate(me().gate)||{name:'(no toll assigned)',loc:''};
 app.innerHTML=`<h1>${esc(g.name)}</h1><p>Location: <b>${esc(g.loc)}</b></p><form class="row" onsubmit="setLoc(event)"><input id="nl" placeholder="New toll location" required><button>Update toll location</button></form>
 <h2>Scan QR</h2><form class="row" onsubmit="verify(event)"><input id="code" placeholder="Scan or type pass ID / ticket ID" required style="min-width:280px"><button>Verify</button></form><h2 id="res"></h2>
 <h2>Recent scans</h2>`+tbl(['Time','Code','Result'],scans.filter(s=>s.gate==me().gate).slice(-10).reverse().map(s=>`<tr><td>${s.t}</td><td>${esc(s.code)}</td><td>${s.ok?'Passed':'Rejected'} - ${esc(s.why)}</td></tr>`))}
function setLoc(e){e.preventDefault();const g=gate(me().gate);if(g){g.loc=$('#nl').value;save();gateDash();toast('Location updated')}}
function verify(e){e.preventDefault();const c=$('#code').value.trim().toUpperCase();let ok=false,why='Unknown code';
 if(c.startsWith('PASS-')){const p=passes.find(x=>x.id==c);if(p){ok=p.status=='Approved'&&p.exp>=today();why=ok?'Valid pass for '+p.veh+' (expires '+p.exp+')':p.status!='Approved'?'Pass is '+p.status:'Pass expired on '+p.exp}}
 else if(c.startsWith('TKT-')){const t=tickets.find(x=>x.id==c);if(t){if(t.gate!=me().gate)why='Ticket is for another toll';else if(t.used)why='Ticket already used';else{ok=true;t.used=true;why='Valid ticket for '+t.veh}}}
 scans.push({t:new Date().toLocaleString(),gate:me().gate,code:c,ok,why});save();gateDash();$('#res').innerHTML=`<span class="${ok?'ok':'bad'}">${ok?'✔ ':'✖ '}${esc(why)}</span>`}
home();
