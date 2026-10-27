let me=guard('customer');
const cartKey='cart_'+me.id,getCart=()=>DB.get(cartKey),setCart=c=>{DB.set(cartKey,c);$('#cc').textContent=c.length?`(${c.length})`:''};
const refresh=()=>{me=curUser()};
$('#who').textContent=me.name;setCart(getCart());
$('#cf').innerHTML='<option value="">All Categories</option>'+CATS.map(c=>`<option>${c}</option>`).join('');
const prod=id=>DB.get('products').find(p=>p.id===id);
function onTab(t){refresh();({shop:rShop,cart:rCart,myorders:rOrders,acct:rAcct})[t]()}
const pic=p=>p.image?`<img src="${p.image}">`:`<div class="ph">${ICON[p.category]||'🌿'}</div>`;
/* Shop */
function card(p){return `<div class="prod">${pic(p)}<h4>${esc(p.name)}</h4><span class="tag">${esc(p.category)}</span><p class="price">${rs(p.price)}</p>
 <p class="muted">${p.stock>0?p.stock+' in stock':'Out of stock'}</p><button onclick="showDetail(${p.id})">Details</button> <button ${p.stock<1?'disabled':''} onclick="addCart(${p.id})">Add to Cart</button></div>`}
function rShop(){const q=$('#q').value.toLowerCase(),c=$('#cf').value;
 const list=DB.get('products').filter(p=>(!c||p.category===c)&&(p.name+p.desc).toLowerCase().includes(q));
 $('#pgrid').innerHTML=list.map(card).join('')||'<p>No products found.</p>';
 const bought=new Set();DB.get('orders').filter(o=>o.customerId===me.id).forEach(o=>o.items.forEach(i=>{const p=prod(i.pid);if(p)bought.add(p.category)}));
 const rec=DB.get('products').filter(p=>bought.has(p.category)&&p.stock>0).slice(0,4);
 $('#reco').innerHTML=rec.length&&!q&&!c?`<h3>Recommended for you</h3><div class="grid" style="margin-bottom:20px">${rec.map(card).join('')}</div><h3>All Products</h3>`:''}
function showDetail(id){const p=prod(id),f=users().find(u=>u.id===p.farmerId)||{};
 $('#detail').innerHTML=`<div class="card row" style="align-items:flex-start"><div>${p.image?`<img src="${p.image}" style="width:100%;border-radius:8px">`:`<div class="ph" style="height:200px">${ICON[p.category]}</div>`}</div>
 <div style="flex:2"><h2>${esc(p.name)}</h2><span class="tag">${esc(p.category)}</span><p>${esc(p.desc)}</p><p class="price">${rs(p.price)}</p><p class="muted">Sold by ${esc(f.name)} · Stock: ${p.stock}</p>
 <button onclick="addCart(${p.id})" ${p.stock<1?'disabled':''}>Add to Cart</button> <button class="alt" onclick="$('#detail').innerHTML=''">Close</button></div></div>`;scrollTo(0,0)}
function addCart(id){const c=getCart(),p=prod(id),i=c.find(x=>x.pid===id);
 if(i){if(i.qty>=p.stock)return alert('Not enough stock');i.qty++}else c.push({pid:id,qty:1});setCart(c);alert('Added to cart')}
/* Cart */
function rCart(){const c=getCart().filter(i=>prod(i.pid));let total=0;
 const rows=c.map(i=>{const p=prod(i.pid),sub=p.price*i.qty;total+=sub;
  return `<tr><td>${esc(p.name)}</td><td>${rs(p.price)}</td><td><input type="number" min="1" max="${p.stock}" value="${i.qty}" style="width:70px" onchange="setQty(${i.pid},this.value)"></td><td>${rs(sub)}</td><td><button class="danger" onclick="delCart(${i.pid})">Remove</button></td></tr>`}).join('');
 const addr=me.address?`${me.address.line}, ${me.address.city} - ${me.address.pin}`:'';
 $('#cart').innerHTML=`<div class="card"><h3>My Cart</h3><table><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr>${rows||'<tr><td colspan=5>Cart is empty</td></tr>'}</table>
 ${c.length?`<h3>Total: <span class="price">${rs(total)}</span></h3><p><b>Ship to:</b> ${addr?esc(addr):'<span style="color:#c0392b">No address – add one in My Account</span>'}</p>
 <p>Wallet balance: <b>${rs(me.wallet)}</b></p><button onclick="placeOrder()">Order Product (pay from wallet)</button>`:''}</div>`}
function setQty(pid,v){const c=getCart(),i=c.find(x=>x.pid===pid),p=prod(pid);let q=Math.max(1,Math.min(+v||1,p.stock));i.qty=q;setCart(c);rCart()}
function delCart(pid){setCart(getCart().filter(i=>i.pid!==pid));rCart()}
function placeOrder(){refresh();if(!me.address)return alert('Please add a shipping address first');
 const c=getCart().filter(i=>prod(i.pid));let total=0;
 for(const i of c){const p=prod(i.pid);if(i.qty>p.stock)return alert('Not enough stock for '+p.name);total+=p.price*i.qty}
 if(total>me.wallet)return alert('Insufficient wallet balance. Add money in My Account.');
 const ps=DB.get('products'),os=DB.get('orders'),byF={};
 c.forEach(i=>{const p=ps.find(x=>x.id===i.pid);p.stock-=i.qty;(byF[p.farmerId]=byF[p.farmerId]||[]).push({pid:p.id,name:p.name,price:p.price,qty:i.qty})});
 Object.entries(byF).forEach(([fid,its])=>os.push({id:uid(),customerId:me.id,farmerId:+fid,items:its,total:its.reduce((s,i)=>s+i.price*i.qty,0),
  address:`${me.address.line}, ${me.address.city} - ${me.address.pin}`,status:'Pending',shipping:'Not Shipped',date:new Date().toLocaleDateString()}));
 const us=users();us.find(u=>u.id===me.id).wallet-=total;saveUsers(us);DB.set('products',ps);DB.set('orders',os);setCart([]);refresh();alert('Order placed successfully!');rCart()}
/* Orders */
function rOrders(){const os=DB.get('orders').filter(o=>o.customerId===me.id).reverse();
 $('#myorders').innerHTML='<div class="card"><h3>My Orders &amp; Shipping Status</h3><table><tr><th>ID</th><th>Date</th><th>Items</th><th>Total</th><th>Order Status</th><th>Shipping Status</th></tr>'+
 (os.map(o=>`<tr><td>#${o.id}</td><td>${o.date}</td><td>${o.items.map(i=>`${esc(i.name)} × ${i.qty}`).join('<br>')}</td><td>${rs(o.total)}</td><td><span class="tag">${o.status}</span></td><td><span class="tag">${o.shipping}</span></td></tr>`).join('')||'<tr><td colspan=6>No orders yet</td></tr>')+'</table></div>'}
/* Account */
function rAcct(){const a=me.address||{line:'',city:'',pin:''};
 $('#acct').innerHTML=`<div class="card"><h3>My Account</h3><p><b>${esc(me.name)}</b> · ${esc(me.mobile)}</p></div>
 <div class="card"><h3>Wallet Balance: <span class="price">${rs(me.wallet)}</span></h3><div class="row"><input id="amt" type="number" min="1" placeholder="Amount to add"><button onclick="addMoney()">Add Money</button></div></div>
 <div class="card"><h3>${me.address?'Edit':'Add'} Shipping Address</h3><label>Address Line</label><input id="al" value="${esc(a.line)}">
 <div class="row"><div><label>City</label><input id="ac" value="${esc(a.city)}"></div><div><label>PIN</label><input id="ap" maxlength="6" value="${esc(a.pin)}"></div></div><button onclick="saveAddr()">Save Address</button></div>`}
function addMoney(){const a=+$('#amt').value;if(!(a>0))return alert('Enter a valid amount');const us=users();us.find(u=>u.id===me.id).wallet+=a;saveUsers(us);refresh();rAcct()}
function saveAddr(){const line=$('#al').value.trim(),city=$('#ac').value.trim(),pin=$('#ap').value.trim();
 if(!line||!city||!/^\d{6}$/.test(pin))return alert('Fill all fields (PIN must be 6 digits)');
 const us=users();us.find(u=>u.id===me.id).address={line,city,pin};saveUsers(us);refresh();alert('Address saved');rAcct()}
initTabs();
