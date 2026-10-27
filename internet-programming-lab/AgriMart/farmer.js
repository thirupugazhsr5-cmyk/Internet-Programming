const me=guard('farmer');$('#who').textContent=me.name;
const OS=['Pending','Confirmed','Packed','Cancelled'],SS=['Not Shipped','Shipped','Out for Delivery','Delivered'];
let img='';
$('#pc').innerHTML=CATS.map(c=>`<option>${c}</option>`).join('');
const myOrders=()=>DB.get('orders').filter(o=>o.farmerId===me.id).reverse();
function onTab(t){({orders:rOrders,prods:rProds,ship:rShip,sales:rSales})[t]()}
const items=o=>o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>');
const custName=id=>(users().find(u=>u.id===id)||{}).name||'';
/* Orders */
function rOrders(){const os=myOrders();
 $('#orders').innerHTML='<div class="card"><h3>Manage Orders</h3><table><tr><th>ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Address</th><th>Status</th><th></th></tr>'+
 (os.map(o=>`<tr><td>#${o.id}</td><td>${esc(custName(o.customerId))}</td><td>${items(o)}</td><td>${rs(o.total)}</td><td>${esc(o.address)}</td>
 <td><select id="os${o.id}" ${o.status==='Cancelled'?'disabled':''}>${OS.map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td>
 <td><button onclick="updOrder(${o.id})" ${o.status==='Cancelled'?'disabled':''}>Update</button></td></tr>`).join('')||'<tr><td colspan=7>No orders yet</td></tr>')+'</table></div>'}
function updOrder(id){const os=DB.get('orders'),o=os.find(x=>x.id===id),s=$('#os'+id).value;
 if(s==='Cancelled'&&o.status!=='Cancelled'){ // refund + restock
  const us=users(),c=us.find(u=>u.id===o.customerId);if(c){c.wallet+=o.total;saveUsers(us)}
  const ps=DB.get('products');o.items.forEach(i=>{const p=ps.find(x=>x.id===i.pid);if(p)p.stock+=i.qty});DB.set('products',ps)}
 o.status=s;DB.set('orders',os);rOrders()}
/* Products */
$('#pi').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>400000){alert('Image too large (max 400KB)');e.target.value='';return}
 const r=new FileReader();r.onload=()=>{img=r.result;$('#prev').src=img;$('#prev').hidden=false};r.readAsDataURL(f)};
function saveProd(){const name=$('#pn').value.trim(),price=+$('#pp').value,stock=+$('#ps').value;
 if(!name||!(price>=0)||$('#pp').value===''||$('#ps').value==='')return alert('Fill name, price and stock');
 const ps=DB.get('products'),id=+$('#pid').value;
 if(id){const p=ps.find(x=>x.id===id);Object.assign(p,{name,category:$('#pc').value,price,stock,desc:$('#pd').value});if(img)p.image=img}
 else ps.push({id:uid(),farmerId:me.id,name,category:$('#pc').value,price,stock,desc:$('#pd').value,image:img});
 DB.set('products',ps);resetForm();rProds()}
function resetForm(){['pid','pn','pp','ps','pd'].forEach(i=>$('#'+i).value='');$('#pi').value='';img='';$('#prev').hidden=true;$('#pf').textContent='Add Product'}
function editProd(id){const p=DB.get('products').find(x=>x.id===id);$('#pid').value=id;$('#pn').value=p.name;$('#pc').value=p.category;
 $('#pp').value=p.price;$('#ps').value=p.stock;$('#pd').value=p.desc;img='';if(p.image){$('#prev').src=p.image;$('#prev').hidden=false}$('#pf').textContent='Update Product';scrollTo(0,0)}
function delProd(id){if(confirm('Delete this product?')){DB.set('products',DB.get('products').filter(p=>p.id!==id));rProds()}}
function rProds(){$('#plist').innerHTML='<h3>My Products</h3><table><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>'+
 (DB.get('products').filter(p=>p.farmerId===me.id).map(p=>`<tr><td>${p.image?`<img class="thumb" src="${p.image}">`:ICON[p.category]}</td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${rs(p.price)}</td><td>${p.stock}</td>
 <td><button onclick="editProd(${p.id})">Edit</button> <button class="danger" onclick="delProd(${p.id})">Delete</button></td></tr>`).join('')||'<tr><td colspan=6>No products</td></tr>')+'</table>'}
/* Shipping */
function rShip(){const os=myOrders().filter(o=>o.status!=='Cancelled'&&o.status!=='Pending');
 $('#ship').innerHTML='<div class="card"><h3>Update Shipping Status</h3><p class="muted">Only confirmed/packed orders can be shipped.</p><table><tr><th>ID</th><th>Items</th><th>Address</th><th>Shipping</th><th></th></tr>'+
 (os.map(o=>`<tr><td>#${o.id}</td><td>${items(o)}</td><td>${esc(o.address)}</td><td><select id="ss${o.id}">${SS.map(s=>`<option ${s===o.shipping?'selected':''}>${s}</option>`).join('')}</select></td>
 <td><button onclick="updShip(${o.id})">Update</button></td></tr>`).join('')||'<tr><td colspan=5>No orders ready for shipping</td></tr>')+'</table></div>'}
function updShip(id){const os=DB.get('orders');os.find(o=>o.id===id).shipping=$('#ss'+id).value;DB.set('orders',os);alert('Shipping updated');rShip()}
/* Sales */
function rSales(){const os=myOrders().filter(o=>o.status!=='Cancelled'),total=os.reduce((s,o)=>s+o.total,0),del=os.filter(o=>o.shipping==='Delivered');
 $('#sales').innerHTML=`<div class="card"><h3>My Sales</h3><p>Total orders: <b>${os.length}</b> · Revenue: <b class="price">${rs(total)}</b> · Delivered: <b>${del.length}</b></p>
 <table><tr><th>ID</th><th>Date</th><th>Items</th><th>Amount</th><th>Shipping</th></tr>${os.map(o=>`<tr><td>#${o.id}</td><td>${o.date}</td><td>${items(o)}</td><td>${rs(o.total)}</td><td>${o.shipping}</td></tr>`).join('')||'<tr><td colspan=5>No sales yet</td></tr>'}</table></div>`}
initTabs();
