/* InsureEasy - roles: admin, agent, user. Data in localStorage (demo). SMS is simulated. */
const $=s=>document.querySelector(s),app=$('#app');
const L=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)};
const PLANS=[{id:1,type:'Health',name:'Health Basic',premium:4000,cover:300000,perks:'Hospitalisation, day-care'},{id:2,type:'Health',name:'Health Plus',premium:9000,cover:1000000,perks:'Adds maternity and critical illness'},{id:3,type:'Auto',name:'Auto Third-Party',premium:3000,cover:750000,perks:'Legal liability only'},{id:4,type:'Auto',name:'Auto Comprehensive',premium:8000,cover:1500000,perks:'Own damage and theft'},{id:5,type:'Home',name:'Home Secure',premium:5000,cover:2000000,perks:'Fire, flood, burglary'}];
let users=L('ie_users',[{u:'admin',p:'admin123',role:'admin',name:'Administrator',approved:true}]),pols=L('ie_pols',[]),claims=L('ie_claims',[]),sms=L('ie_sms',[]),sess=L('ie_sess',null);
const save=()=>{S('ie_users',users);S('ie_pols',pols);S('ie_claims',claims);S('ie_sms',sms);S('ie_sess',sess)};
const lk=(f,t)=>`<a href="#" onclick="${f};return false">${t}</a>`;
const U=u=>users.find(x=>x.u==u),plan=id=>PLANS.find(p=>p.id==id);
const tbl=(h,rows)=>`<div class="wrap"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.join('')||`<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table></div>`;
function nav(){$('#nav').innerHTML=lk('home()','Plans')+(sess?lk('dash()','Dashboard')+`<span>${esc(sess.u)} (${sess.role})</span>`+lk('logout()','Logout'):lk('loginPage()','Login')+lk('regAgent()','Agent register'))}
function home(){nav();app.innerHTML=`<h1>Compare insurance plans</h1><p>Select two or more plans to compare them side by side.</p>`+tbl(['','Plan','Type','Premium / yr','Cover','Highlights'],PLANS.map(p=>`<tr><td><input type="checkbox" class="cmp" value="${p.id}"></td><td>${p.name}</td><td>${p.type}</td><td>${inr(p.premium)}</td><td>${inr(p.cover)}</td><td>${p.perks}</td></tr>`))+`<br><button onclick="compare()">Compare selected</button><div id="cmpOut"></div>`}
function compare(){const ids=[...document.querySelectorAll('.cmp:checked')].map(x=>+x.value);if(ids.length<2)return toast('Select at least two plans');const a=ids.map(plan);
 $('#cmpOut').innerHTML=`<h2>Comparison</h2>`+tbl(['Feature',...a.map(p=>p.name)],[['Type','type'],['Premium','premium'],['Cover','cover'],['Highlights','perks']].map(([l,k])=>`<tr><td><b>${l}</b></td>${a.map(p=>`<td>${k=='premium'||k=='cover'?inr(p[k]):p[k]}</td>`).join('')}</tr>`))}
function loginPage(){nav();app.innerHTML=`<form class="panel" onsubmit="login(event)"><h1>Login</h1><input id="u" placeholder="Username" required><input id="p" type="password" placeholder="Password" required><button>Login</button><small>Admin demo: admin / admin123. Agents need admin approval. Customers are created by agents.</small></form>`}
function login(e){e.preventDefault();const u=users.find(x=>x.u==$('#u').value&&x.p==$('#p').value);if(!u)return toast('Wrong username or password');if(u.role=='agent'&&!u.approved)return toast('Your agent account is waiting for admin approval');sess={u:u.u,role:u.role};save();dash()}
function logout(){sess=null;save();home()}
function regAgent(){nav();app.innerHTML=`<form class="panel" onsubmit="addAgent(event)"><h1>Agent registration</h1><input id="n" placeholder="Full name" required><input id="ph" placeholder="Mobile number" required pattern="[0-9]{10}"><input id="u" placeholder="Username" required><input id="p" type="password" placeholder="Password" required minlength="4"><button>Register</button></form>`}
function addAgent(e){e.preventDefault();if(U($('#u').value))return toast('Username taken');users.push({u:$('#u').value,p:$('#p').value,role:'agent',name:$('#n').value,phone:$('#ph').value,approved:false});save();toast('Registered. Wait for admin approval.');loginPage()}
function dash(){if(!sess)return loginPage();nav();({admin,agent,user}[sess.role])()}
/* ---- admin ---- */
function admin(){const ag=users.filter(x=>x.role=='agent');
 app.innerHTML=`<h1>Admin dashboard</h1><h2>Agent approvals</h2>`+tbl(['Agent','Username','Phone','Status',''],ag.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.u}</td><td>${esc(a.phone)}</td><td>${a.approved?'Approved':'Pending'}</td><td>${a.approved?'':`<button onclick="approve('${a.u}')">Approve</button> `}<button class="del" onclick="rejectAgent('${a.u}')">Remove</button></td></tr>`))
 +`<h2>All agent details</h2>`+tbl(['Agent','Customers','Policies','Premium value'],ag.filter(a=>a.approved).map(a=>{const c=users.filter(x=>x.agent==a.u).map(x=>x.u),p=pols.filter(x=>x.agent==a.u);return `<tr><td>${esc(a.name)}</td><td>${c.length}</td><td>${p.length}</td><td>${inr(p.reduce((s,x)=>s+plan(x.plan).premium,0))}</td></tr>`}))}
function approve(u){U(u).approved=true;save();admin();toast('Agent approved')}
function rejectAgent(u){users=users.filter(x=>x.u!=u);save();admin()}
/* ---- agent ---- */
function agent(){const mine=users.filter(x=>x.agent==sess.u),mp=pols.filter(x=>x.agent==sess.u);
 app.innerHTML=`<h1>Agent dashboard</h1><h2>Create customer</h2><form class="row" onsubmit="addCust(event)"><input id="cn" placeholder="Name" required><input id="cp" placeholder="Mobile (10 digits)" required pattern="[0-9]{10}"><input id="cu" placeholder="Username" required><input id="cw" placeholder="Password" required><button>Create</button></form>
 <h2>Customers</h2>`+tbl(['Name','Username','Mobile',''],mine.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.u}</td><td>${esc(c.phone)}</td><td class="row"><button class="alt" onclick="editCust('${c.u}')">Edit</button><button class="del" onclick="delCust('${c.u}')">Delete</button></td></tr>`))
 +`<h2>Add policy</h2><form class="row" onsubmit="addPol(event)"><select id="po">${mine.map(c=>`<option value="${c.u}">${esc(c.name)}</option>`).join('')}</select><select id="pp">${PLANS.map(p=>`<option value="${p.id}">${p.name} - ${inr(p.premium)}</option>`).join('')}</select><input id="pd" type="date" required><button>Add policy</button></form>
 <h2>Policies</h2><button class="alt" onclick="alertDue()">Send SMS to all due within 30 days</button><br><br>`+tbl(['Customer','Plan','Premium','Due date',''],mp.map(p=>`<tr><td>${esc(U(p.owner).name)}</td><td>${plan(p.plan).name}</td><td>${inr(plan(p.plan).premium)}</td><td>${p.due}</td><td class="row"><button onclick="sendSms(${p.id})">Send SMS alert</button><button class="alt" onclick="editDue(${p.id})">Change due date</button><button class="del" onclick="delPol(${p.id})">Delete</button></td></tr>`))}
function addCust(e){e.preventDefault();if(U($('#cu').value))return toast('Username taken');users.push({u:$('#cu').value,p:$('#cw').value,role:'user',name:$('#cn').value,phone:$('#cp').value,agent:sess.u});save();agent();toast('Customer created')}
function editCust(u){const c=U(u),n=prompt('Name',c.name);if(n===null)return;const p=prompt('Mobile',c.phone);c.name=n||c.name;c.phone=p||c.phone;save();agent()}
function delCust(u){if(!confirm('Delete customer and their policies?'))return;users=users.filter(x=>x.u!=u);pols=pols.filter(p=>p.owner!=u);save();agent()}
function addPol(e){e.preventDefault();if(!$('#po').value)return toast('Create a customer first');pols.push({id:Date.now(),owner:$('#po').value,agent:sess.u,plan:+$('#pp').value,due:$('#pd').value});save();agent();toast('Policy added')}
function editDue(id){const p=pols.find(x=>x.id==id),d=prompt('New due date (YYYY-MM-DD)',p.due);if(d){p.due=d;save();agent()}}
function delPol(id){pols=pols.filter(p=>p.id!=id);save();agent()}
function sendSms(id,quiet){const p=pols.find(x=>x.id==id),c=U(p.owner),late=new Date(p.due)<new Date();
 sms.push({to:c.u,phone:c.phone,t:new Date().toLocaleString(),msg:`Dear ${c.name}, your ${plan(p.plan).name} premium of ${inr(plan(p.plan).premium)} ${late?'was due on':'is due on'} ${p.due}. Please pay to keep your policy active.`});save();if(!quiet)toast('SMS sent to '+c.phone)}
function alertDue(){const lim=Date.now()+30*864e5;const d=pols.filter(p=>p.agent==sess.u&&new Date(p.due)<=lim);d.forEach(p=>sendSms(p.id,1));toast(d.length+' SMS alert(s) sent')}
/* ---- user ---- */
function user(){const mine=pols.filter(p=>p.owner==sess.u),have=mine.map(p=>plan(p.plan).type),sug=PLANS.filter(p=>!have.includes(p.type));
 app.innerHTML=`<h1>My policies</h1>`+tbl(['Plan','Premium','Next due',''],mine.map(p=>`<tr><td>${plan(p.plan).name}</td><td>${inr(plan(p.plan).premium)}</td><td>${p.due}</td><td class="row"><button onclick="pay(${p.id})">Pay premium</button><button class="alt" onclick="claim(${p.id})">File claim</button></td></tr>`))
 +`<h2>My claims</h2>`+tbl(['Policy','Amount','Reason','Status'],claims.filter(c=>c.u==sess.u).map(c=>`<tr><td>${esc(c.plan)}</td><td>${inr(c.amt)}</td><td>${esc(c.why)}</td><td>${c.status}</td></tr>`))
 +`<h2>SMS alerts</h2>`+tbl(['Time','Message'],sms.filter(s=>s.to==sess.u).reverse().map(s=>`<tr><td>${s.t}</td><td>${esc(s.msg)}</td></tr>`))
 +(sug.length?`<h2>Suggested for you</h2><p>You have no ${[...new Set(sug.map(p=>p.type))].join(', ')} cover. Ask your agent about ${sug.map(p=>p.name).join(', ')}.</p>`:'')}
function pay(id){const p=pols.find(x=>x.id==id),d=new Date(p.due);d.setFullYear(d.getFullYear()+1);p.due=d.toISOString().slice(0,10);save();user();toast('Premium paid. Next due '+p.due)}
function claim(id){const p=pols.find(x=>x.id==id),a=+prompt('Claim amount');if(!a)return;const w=prompt('Reason for claim');if(!w)return;claims.push({u:sess.u,plan:plan(p.plan).name,amt:a,why:w,status:'Submitted'});save();user();toast('Claim filed')}
home();
