if(!sessionStorage.getItem('admin'))location.href='index.html';
function onTab(t){({cand:rCand,elec:rElec,ward:rWard,voters:rVoters,res:rRes})[t]()}
/* Candidates */
function addCand(){const n=$('#cn').value.trim();if(!n)return alert('Name required');
 const c=DB.get('candidates');c.push({id:Date.now(),name:n,party:$('#cp').value,info:$('#ci').value});DB.set('candidates',c);
 $('#cn').value=$('#cp').value=$('#ci').value='';rCand()}
function delCand(id){DB.set('candidates',DB.get('candidates').filter(c=>c.id!==id));rCand()}
function rCand(){$('#candList').innerHTML='<h3>Candidates</h3><table><tr><th>Name</th><th>Party</th><th>Info</th><th></th></tr>'+
 DB.get('candidates').map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.party)}</td><td>${esc(c.info)}</td><td><button class="danger" onclick="delCand(${c.id})">Delete</button></td></tr>`).join('')+'</table>'}
/* Elections */
function addElec(){const n=$('#en').value.trim(),w=$('#ew').value.trim();if(!n||!w)return alert('Fill all fields');
 const e=DB.get('elections');e.push({id:Date.now(),name:n,ward:w,candidateIds:[],open:true});DB.set('elections',e);$('#en').value=$('#ew').value='';rElec()}
function rElec(){const els=DB.get('elections');
 $('#ae').innerHTML=els.map(e=>`<option value="${e.id}">${esc(e.name)} (${esc(e.ward)})</option>`).join('');renderAlloc();
 $('#elecList').innerHTML='<h3>Elections</h3><table><tr><th>Name</th><th>Ward</th><th>Candidates</th><th>Status</th><th></th></tr>'+els.map(e=>
  `<tr><td>${esc(e.name)}</td><td>${esc(e.ward)}</td><td>${e.candidateIds.length}</td><td>${e.open?'Open':'Closed'}</td>
  <td><button onclick="toggleElec(${e.id})">${e.open?'Close':'Open'}</button> <button class="danger" onclick="delElec(${e.id})">Delete</button></td></tr>`).join('')+'</table>'}
function toggleElec(id){const e=DB.get('elections');const x=e.find(i=>i.id===id);x.open=!x.open;DB.set('elections',e);rElec()}
function delElec(id){DB.set('elections',DB.get('elections').filter(e=>e.id!==id));rElec()}
function renderAlloc(){const e=DB.get('elections').find(x=>x.id==$('#ae').value);
 $('#allocBox').innerHTML=e?DB.get('candidates').map(c=>`<label class="cand"><input type="checkbox" value="${c.id}" ${e.candidateIds.includes(c.id)?'checked':''}>${esc(c.name)} – ${esc(c.party)}</label>`).join(''):'<p>Create an election first.</p>'}
function saveAlloc(){const els=DB.get('elections');const e=els.find(x=>x.id==$('#ae').value);if(!e)return;
 e.candidateIds=[...document.querySelectorAll('#allocBox input:checked')].map(i=>+i.value);DB.set('elections',els);alert('Saved');rElec()}
/* Wards */
function rWard(){$('#wv').innerHTML=DB.get('voters').map(v=>`<option value="${esc(v.voterId)}">${esc(v.voterId)} - ${esc(v.name)} (${esc(v.ward)})</option>`).join('')}
function setWard(){const w=$('#ww').value.trim();if(!w)return alert('Enter ward');const vs=DB.get('voters');const v=vs.find(x=>x.voterId===$('#wv').value);
 if(v){v.ward=w;DB.set('voters',vs);alert('Allocated');rWard()}}
/* Voters */
function addVoter(){const id=$('#vi').value.trim().toUpperCase(),n=$('#vn').value.trim(),w=$('#vw').value.trim();
 if(!id||!n||!w)return alert('Fill all fields');const vs=DB.get('voters');if(vs.find(v=>v.voterId===id))return alert('Voter ID exists');
 vs.push({voterId:id,name:n,ward:w});DB.set('voters',vs);$('#vi').value=$('#vn').value=$('#vw').value='';rVoters()}
$('#csvf').onchange=e=>{const r=new FileReader();r.onload=()=>$('#csvt').value=r.result;r.readAsText(e.target.files[0])};
function importCsv(){const vs=DB.get('voters');let n=0;
 $('#csvt').value.split(/\r?\n/).forEach(l=>{const [id,name,ward]=l.split(',').map(s=>s.trim());
  if(id&&name&&ward&&!/^voter/i.test(id)&&!vs.find(v=>v.voterId===id.toUpperCase())){vs.push({voterId:id.toUpperCase(),name,ward});n++}});
 DB.set('voters',vs);alert(n+' voters imported');$('#csvt').value='';rVoters()}
function editVoter(id){const vs=DB.get('voters');const v=vs.find(x=>x.voterId===id);
 const n=prompt('Name',v.name);if(n===null)return;const w=prompt('Ward',v.ward);if(w===null)return;v.name=n;v.ward=w;DB.set('voters',vs);rVoters()}
function delVoter(id){if(confirm('Delete voter?')){DB.set('voters',DB.get('voters').filter(v=>v.voterId!==id));rVoters()}}
function rVoters(){$('#voterList').innerHTML='<h3>Voter List</h3><table><tr><th>ID</th><th>Name</th><th>Ward</th><th></th></tr>'+DB.get('voters').map(v=>
 `<tr><td>${esc(v.voterId)}</td><td>${esc(v.name)}</td><td>${esc(v.ward)}</td><td><button onclick="editVoter('${esc(v.voterId)}')">Edit</button> <button class="danger" onclick="delVoter('${esc(v.voterId)}')">Delete</button></td></tr>`).join('')+'</table>'}
/* Results */
function rRes(){const votes=DB.get('votes'),cands=DB.get('candidates'),voters=DB.get('voters');let h='';
 DB.get('elections').forEach(e=>{const ev=votes.filter(v=>v.electionId===e.id);const elig=voters.filter(v=>v.ward===e.ward).length;
  const rows=e.candidateIds.map(id=>({c:cands.find(c=>c.id===id),n:ev.filter(v=>v.candidateId===id).length})).filter(r=>r.c).sort((a,b)=>b.n-a.n);
  h+=`<div class="card"><h3>${esc(e.name)} – ${esc(e.ward)}</h3><p>Votes cast: ${ev.length} / ${elig} eligible</p>`+
   rows.map((r,i)=>`<div>${i===0&&r.n?'🏆 ':''}<b>${esc(r.c.name)}</b> (${esc(r.c.party)}) – ${r.n}</div><div class="bar"><div style="width:${ev.length?r.n/ev.length*100:0}%"></div></div>`).join('')+'</div>'});
 $('#res').innerHTML=h||'<div class="card">No elections.</div>'}
initTabs();
