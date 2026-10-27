const DB={get(k,d=[]){try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const genOTP=()=>String(Math.floor(100000+Math.random()*900000));
(function seed(){if(localStorage.getItem('vo_seeded'))return;
 DB.set('candidates',[{id:1,name:'Anita Rao',party:'Unity Party',info:'Teacher, 10 years of community work'},{id:2,name:'Ravi Kumar',party:'Progress Alliance',info:'Engineer, focus on infrastructure'},{id:3,name:'Meena Iyer',party:'Independent',info:'Doctor, focus on healthcare'}]);
 DB.set('elections',[{id:1,name:'Ward Council Election 2026',ward:'Ward 1',candidateIds:[1,2,3],open:true}]);
 DB.set('voters',[{voterId:'V001',name:'Arun',ward:'Ward 1'},{voterId:'V002',name:'Priya',ward:'Ward 1'}]);
 DB.set('votes',[]);localStorage.setItem('vo_seeded','1')})();
function logout(){sessionStorage.clear();location.href='index.html'}
function initTabs(){const bs=document.querySelectorAll('nav button');
 bs.forEach(b=>b.onclick=()=>{bs.forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.querySelectorAll('section.pane').forEach(s=>s.hidden=s.id!==b.dataset.t);
  if(window.onTab)onTab(b.dataset.t)});bs[0].click()}
