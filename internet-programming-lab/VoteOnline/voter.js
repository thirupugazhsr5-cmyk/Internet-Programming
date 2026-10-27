const vid=sessionStorage.getItem('voter');if(!vid)location.href='index.html';
const me=DB.get('voters').find(v=>v.voterId===vid)||{};
$('#who').textContent=`${me.name} (${vid} · ${me.ward})`;
const otps={};
const myElections=()=>DB.get('elections').filter(e=>e.ward===me.ward);
const candName=id=>(DB.get('candidates').find(c=>c.id===id)||{}).name;
function onTab(t){({vote:renderVote,hist:renderHist,live:renderLive})[t]()}
function renderVote(){const votes=DB.get('votes'),cands=DB.get('candidates');let h='';
 myElections().forEach(e=>{const done=votes.find(v=>v.electionId===e.id&&v.voterId===vid);
  h+=`<div class="card"><h3>${esc(e.name)} <small>(${esc(e.ward)})</small></h3>`;
  if(done)h+=`<p class="ok">✔ You voted for ${esc(candName(done.candidateId))}. Receipt: ${done.receipt}</p>`;
  else if(!e.open)h+='<p class="muted">Election is closed.</p>';
  else{e.candidateIds.map(id=>cands.find(c=>c.id===id)).filter(Boolean).forEach(c=>
    h+=`<label class="cand"><input type="radio" name="e${e.id}" value="${c.id}"><b>${esc(c.name)}</b> – ${esc(c.party)}<small>${esc(c.info)}</small></label>`);
   h+=`<button onclick="getOtp(${e.id})">Get OTP for Voting</button>
   <input id="o${e.id}" placeholder="Enter voting OTP" maxlength="6" style="margin-top:10px">
   <button class="green" onclick="submitVote(${e.id})">Submit Vote</button>`}
  h+='</div>'});
 $('#vote').innerHTML=h||'<div class="card">No elections for your ward.</div>'}
function getOtp(eid){otps[eid]=genOTP();alert('Your voting OTP is '+otps[eid]+' (demo SMS)')}
function submitVote(eid){const sel=document.querySelector(`input[name=e${eid}]:checked`);
 if(!sel)return alert('Select a candidate');
 if(!otps[eid]||$('#o'+eid).value.trim()!==otps[eid])return alert('Invalid or missing OTP');
 if(!confirm('Submit your vote? This cannot be changed.'))return;
 const votes=DB.get('votes');if(votes.find(v=>v.electionId===eid&&v.voterId===vid))return alert('Already voted');
 const receipt='R'+Date.now().toString(36).toUpperCase();
 votes.push({electionId:eid,candidateId:+sel.value,voterId:vid,time:new Date().toLocaleString(),receipt});
 DB.set('votes',votes);delete otps[eid];alert('Vote submitted! Receipt: '+receipt);renderVote()}
function renderHist(){const els=DB.get('elections');
 const rows=DB.get('votes').filter(v=>v.voterId===vid).map(v=>`<tr><td>${esc((els.find(e=>e.id===v.electionId)||{}).name)}</td><td>${esc(candName(v.candidateId))}</td><td>${v.time}</td><td>${v.receipt}</td></tr>`).join('');
 $('#hist').innerHTML=`<div class="card"><h3>My Voting History</h3><table><tr><th>Election</th><th>Voted For</th><th>Time</th><th>Receipt</th></tr>${rows||'<tr><td colspan=4>No votes yet</td></tr>'}</table></div>`}
function renderLive(){const votes=DB.get('votes'),voters=DB.get('voters');let h='';
 myElections().forEach(e=>{const ev=votes.filter(v=>v.electionId===e.id),eligible=voters.filter(v=>v.ward===e.ward).length;
  const pct=eligible?Math.round(ev.length/eligible*100):0;
  h+=`<div class="card"><h3>${esc(e.name)}</h3><p>Turnout: <b>${ev.length}/${eligible}</b> (${pct}%)</p><div class="bar"><div style="width:${pct}%"></div></div></div>`});
 $('#live').innerHTML=h||'<div class="card">Nothing to show.</div>'}
initTabs();
