const DB={get(k,d=[]){try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const genOTP=()=>String(Math.floor(100000+Math.random()*900000));
const uid=()=>Date.now()+Math.floor(Math.random()*1000);
const CATS=['Seeds','Fertilizers','Pesticides','Farming Equipment','Tools'];
const ICON={Seeds:'🌱',Fertilizers:'🧪',Pesticides:'🐛','Farming Equipment':'🚜',Tools:'🔧'};
const rs=n=>'₹'+Number(n).toFixed(2);
const users=()=>DB.get('users'),saveUsers=u=>DB.set('users',u);
const curUser=()=>users().find(u=>u.id===+sessionStorage.getItem('uid'));
function guard(role){const u=curUser();if(!u||u.role!==role)location.href='index.html';return u}
function logout(){sessionStorage.clear();location.href='index.html'}
function initTabs(){const bs=document.querySelectorAll('nav button');
 bs.forEach(b=>b.onclick=()=>{bs.forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.querySelectorAll('section.pane').forEach(s=>s.hidden=s.id!==b.dataset.t);if(window.onTab)onTab(b.dataset.t)});bs[0].click()}
(function seed(){if(localStorage.getItem('am_seeded'))return;
 saveUsers([{id:1,role:'farmer',name:'Demo Farmer',mobile:'9999999999',password:'farmer123',wallet:0,address:null},
  {id:2,role:'customer',name:'Demo Customer',mobile:'8888888888',password:'cust123',wallet:5000,address:null}]);
 DB.set('products',[{id:1,farmerId:1,name:'Hybrid Tomato Seeds',category:'Seeds',price:120,stock:50,desc:'High-yield hybrid tomato seeds, 50g pack.',image:''},
  {id:2,farmerId:1,name:'Organic Compost 10kg',category:'Fertilizers',price:350,stock:30,desc:'Rich organic compost for all crops.',image:''},
  {id:3,farmerId:1,name:'Garden Spade',category:'Tools',price:420,stock:15,desc:'Steel spade with wooden handle.',image:''}]);
 DB.set('orders',[]);localStorage.setItem('am_seeded','1')})();
