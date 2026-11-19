const $=id=>document.getElementById(id);
const money=dollars;
let items=[],coupon='',welcomeEmail='';
try {
  const saved=JSON.parse(localStorage.getItem('strata-v2')||'{}');
  const merged=new Map();
  for (const item of Array.isArray(saved.items)?saved.items:[]) {
    const id=item.id||item.type;
    const p=store.products.find(p=>p.id===id&&p.enabled&&!p.quoteOnly);
    if (!p || !Number.isInteger(item.quantity) || item.quantity<1) continue;
    const color=p.colors.includes(item.color)?item.color:p.colors[0];
    const key=id+'|'+color;
    const current=merged.get(key);
    merged.set(key,{key,id,color,quantity:Math.min(100,(current?.quantity||0)+item.quantity)});
  }
  items=[...merged.values()];
  if(store.couponEnabled&&saved.coupon===store.couponCode) coupon=store.couponCode;
  welcomeEmail=sessionStorage.getItem('strata-welcome-email')||'';
} catch {}
function product(id){return store.products.find(p=>p.id===id);}
function linePrice(item){
  const p=product(item.id);
  const group=store.mixBundles?items.filter(i=>{
    const other=product(i.id);
    return other.priceCents===p.priceCents&&other.bundleQuantity===p.bundleQuantity&&other.bundlePriceCents===p.bundlePriceCents;
  }):items.filter(i=>i.id===item.id);
  const quantity=group.reduce((sum,i)=>sum+i.quantity,0);
  const groupPrice=p.bundleQuantity?Math.floor(quantity/p.bundleQuantity)*p.bundlePriceCents+(quantity%p.bundleQuantity)*p.priceCents:quantity*p.priceCents;
  let allocated=0;
  for (let index=0;index<group.length;index++) {
    const entry=group[index];
    const price=index===group.length-1?groupPrice-allocated:Math.floor(groupPrice*entry.quantity/quantity);
    if(entry.key===item.key)return price;
    allocated+=price;
  }
  return 0;
}
function totals(){
  const subtotal=items.reduce((sum,item)=>sum+linePrice(item),0);
  const discount=coupon&&store.couponEnabled?Math.round(subtotal*store.couponPercent/100):0;
  const shipping=store.shippingEnabled&&items.length&&subtotal-discount<=store.freeShippingOverCents?store.shippingCents:0;
  const tax=Math.round((subtotal-discount+shipping)*6625/100000);
  return {subtotal,discount,shipping,tax,total:subtotal-discount+shipping+tax};
}
function save(){try{localStorage.setItem('strata-v2',JSON.stringify({items,coupon}));}catch{} $('count').textContent=items.reduce((sum,item)=>sum+item.quantity,0);}
function openPanel(title,content){$('panel-title').textContent=title;$('panel-content').innerHTML=content;if(!$('panel').open)$('panel').showModal();}
function add(id,quantity){
  const p=product(id);
  const color=$('color-'+id)?.value||p.colors[0];
  if(!p.colors.includes(color))return;
  const key=id+'|'+color;
  const current=items.find(item=>item.key===key);
  if(current)current.quantity=Math.min(100,current.quantity+quantity);else items.push({key,id,color,quantity});
  save();showBag();
}
function breakdown(){
 const t=totals();
 return '<div class="breakdown"><div><span>Products</span><strong>'+money(t.subtotal)+'</strong></div>'+(t.discount?'<div><span>'+html(coupon)+' · '+store.couponPercent+'% off</span><strong>−'+money(t.discount)+'</strong></div>':'')+(store.shippingEnabled?'<div><span>Shipping</span><strong>'+money(t.shipping)+'</strong></div>':'<div><span>Local handoff</span><strong>$0.00</strong></div>')+'<div><span>NJ sales tax · 6.625%</span><strong>'+money(t.tax)+'</strong></div><div class="total"><span>Cash due at handoff</span><span>'+money(t.total)+'</span></div></div><p class="fine">Adult buyer 18+. Intended product age 13+. '+(store.shippingEnabled?'Shipping by confirmation.':'No parcel shipping. Local handoff time and location are confirmed after review.')+'</p>';
}
function showBag(message=''){
 if(!items.length){openPanel('Your bag','<p>Your bag is empty.</p><button class="button" data-close>KEEP SHOPPING</button>');return;}
 openPanel('Your bag',items.map(item=>'<div class="row"><div><strong>'+html(product(item.id).name)+'</strong><p>'+html(item.color)+'</p><p>'+item.quantity+' pieces · '+money(linePrice(item))+'</p></div><div class="quantity"><button data-change="'+html(item.key)+'" data-delta="-1" aria-label="Decrease '+html(product(item.id).name)+' quantity">−</button><span>'+item.quantity+'</span><button data-change="'+html(item.key)+'" data-delta="1" aria-label="Increase '+html(product(item.id).name)+' quantity">+</button><button data-remove="'+html(item.key)+'" aria-label="Remove '+html(product(item.id).name)+'">Remove</button></div></div>').join('')+(store.couponEnabled?'<label class="field-label" for="coupon">Discount code</label><form id="coupon-form" class="coupon"><input id="coupon" maxlength="30" value="'+html(coupon)+'" placeholder="'+html(store.couponCode)+'"><button class="button">APPLY</button></form>':'')+'<p role="status" class="fine">'+html(message)+'</p>'+breakdown()+'<label class="field-label" for="order-note">Order notes (optional)</label><textarea id="order-note" maxlength="500" rows="2"></textarea><p><a href="terms.html">Terms</a> · <a href="returns.html">Returns</a> · <a href="privacy.html">Privacy</a></p><button class="button wide" id="review">REVIEW ORDER</button>');
 if(store.couponEnabled)$('coupon-form').onsubmit=e=>{e.preventDefault();const code=$('coupon').value.trim().toUpperCase();const notes=$('order-note').value;coupon=code===store.couponCode?code:'';save();showBag(coupon?'Discount applied.':code?'Invalid code.':'Discount removed.');$('order-note').value=notes;};
 $('review').onclick=()=>reviewOrder($('order-note').value.trim());
}
function smsLink(message){return 'sms:+1'+store.phone+(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'&body=':'?body=')+encodeURIComponent(message);}
function reviewOrder(notes){
 openPanel('Review & request', '<p>'+items.map(i=>html(product(i.id).name)+' · '+html(i.color)+' × '+i.quantity).join('<br>')+'</p>'+breakdown()+'<form id="order-form" class="order-form"><label>Your full name<input id="buyer-name" autocomplete="name" maxlength="120" required></label><label>Adult buyer email<input id="buyer-email" type="email" autocomplete="email" maxlength="254" required value="'+html(welcomeEmail)+'"></label><label>Phone<input id="buyer-phone" type="tel" autocomplete="tel" maxlength="30" required></label><label>New Jersey town<input id="buyer-town" maxlength="100" required></label><label>Preferred handoff details (optional)<textarea id="buyer-handoff" maxlength="500" rows="2" placeholder="A preferred time or public handoff location. Final arrangements require confirmation."></textarea></label><label class="check-label"><input id="buyer-adult" type="checkbox" required><span>I confirm I am 18 or older and will handle the order and cash payment.</span></label><label class="check-label"><input id="buyer-policies" type="checkbox" required><span>I have read the <a href="terms.html" target="_blank" rel="noopener">Terms</a>, <a href="returns.html" target="_blank" rel="noopener">30-day Returns policy</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy notice</a>.</span></label><div hidden><label>Website<input id="buyer-website" autocomplete="off"></label></div><p class="fine">Your request is reviewed for availability. Pay cash only at the confirmed handoff. The order notification inbox is '+html(store.orderEmail)+'.</p><button class="button wide" id="place-order">SUBMIT CASH-ON-DELIVERY REQUEST</button><p id="order-result" role="status"></p></form><button class="bundle" id="edit-bag">EDIT BAG</button>');
 $('edit-bag').onclick=()=>{showBag();$('order-note').value=notes;};
 $('order-form').onsubmit=async event=>{
  event.preventDefault();if(!$('order-form').reportValidity())return;
  const input={items:items.map(({id,color,quantity})=>({id,color,quantity})),coupon,notes,adultConfirmed:$('buyer-adult').checked,policiesConfirmed:$('buyer-policies').checked,website:$('buyer-website').value,customer:{name:$('buyer-name').value.trim(),email:$('buyer-email').value.trim(),phone:$('buyer-phone').value.trim(),town:$('buyer-town').value.trim(),state:'NJ',handoff:$('buyer-handoff').value.trim()},expectedTotalCents:totals().total};
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(input))))).map(byte=>byte.toString(16).padStart(2,"0")).join("");let id=crypto.randomUUID();
  try{const pending=JSON.parse(sessionStorage.getItem('tactelyx-pending-order')||'null');if(pending?.fingerprint===fingerprint)id=pending.id;sessionStorage.setItem('tactelyx-pending-order',JSON.stringify({fingerprint,id}));}catch{}
  input.idempotencyKey=id;
  $('place-order').disabled=true;$('order-result').textContent='Saving your request…';
  try{
   const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Order request failed.');
   const order=result.order;
   const notice=order.mailStatus==='accepted'?'The email service accepted the notification for the store inbox. Final availability and handoff details still require confirmation.':'Your request is saved, but the email notification is pending. Contact '+store.orderEmail+' with this reference to notify the store.';
   $('order-result').innerHTML='<div class="order-confirmation"><strong>Request saved · '+html(order.reference)+'</strong><p>'+html(notice)+'</p><p>Cash due at handoff: '+money(order.totalCents)+', including NJ sales tax '+money(order.taxCents)+'.</p><a href="customer-service.html">Customer Service</a></div>';
   $('place-order').textContent='REQUEST SAVED';
   items=[];save();try{sessionStorage.removeItem('tactelyx-pending-order');}catch{}
  }catch(error){$('order-result').textContent=error.message;$('order-result').className='order-error';$('place-order').disabled=false;}
 };
}
function showQuote(id){
 const p=product(id);
 openPanel(p.name+' · Price request','<p>'+html(p.details)+'</p><label class="field-label" for="quote-qty">Quantity</label><input id="quote-qty" type="number" min="1" max="100" value="1"><label class="field-label" for="quote-notes">Color or other notes</label><textarea id="quote-notes" maxlength="500" rows="2"></textarea><button class="button wide" id="prepare-quote">PREPARE PRICE REQUEST</button><p id="quote-status" role="status"></p><a id="send-quote" class="button wide" hidden>OPEN EMAIL TO SEND REQUEST</a>');
 $('prepare-quote').onclick=()=>{
 const quantity=Number($('quote-qty').value);if(!Number.isInteger(quantity)||quantity<1||quantity>100){$('quote-status').textContent='Enter a quantity from 1 to 100.';return;}
 const message=[store.brand+' PRICE REQUEST',p.name+' × '+quantity,$('quote-notes').value.trim(),welcomeEmail?'Contact email: '+welcomeEmail:'','Please confirm model, cash price, NJ tax and local handoff availability.'].filter(Boolean).join('\n');
 $('send-quote').href='mailto:'+store.orderEmail+'?subject='+encodeURIComponent(store.brand+' price request')+'&body='+encodeURIComponent(message);$('send-quote').hidden=false;$('quote-status').textContent='Request prepared. Send it through your email app. Wait for a quote before paying.';
 };
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-close'))$('panel').close();
 if(b.dataset.add){const q=Number($('qty-'+b.dataset.add).value);if(Number.isInteger(q)&&q>0&&q<=100)add(b.dataset.add,q);}
 if(b.dataset.bundle)add(b.dataset.bundle,product(b.dataset.bundle).bundleQuantity);
 if(b.dataset.quote)showQuote(b.dataset.quote);
 if(b.dataset.detail){const p=product(b.dataset.detail);openPanel(p.name,'<p>'+html(p.details)+'</p><p><a href="safety.html">Product care & safety</a></p><button class="button" data-close>CONTINUE SHOPPING</button>');}
 if(b.dataset.remove){items=items.filter(i=>i.key!==b.dataset.remove);save();showBag();}
 if(b.dataset.change){const i=items.find(i=>i.key===b.dataset.change);i.quantity=Math.min(100,i.quantity+Number(b.dataset.delta));items=items.filter(i=>i.quantity>0);save();showBag();}
 if(b.dataset.category){document.querySelectorAll('[data-category]').forEach(tab=>{const selected=tab===b;tab.classList.toggle('active',selected);tab.setAttribute('aria-pressed',String(selected));});document.querySelectorAll('[data-product]').forEach(p=>p.hidden=b.dataset.category!=='all'&&p.dataset.product!==b.dataset.category);}
});
$('bag').onclick=()=>showBag();$('close').onclick=()=>$('panel').close();
$('welcome-form').onsubmit=e=>{e.preventDefault();if(!$('welcome-email').reportValidity())return;welcomeEmail=$('welcome-email').value.trim();try{sessionStorage.setItem('strata-welcome-email',welcomeEmail);}catch{}coupon=store.couponCode;save();$('welcome-form').hidden=true;$('welcome-result').innerHTML='<strong>Your code is '+html(coupon)+'.</strong><p>'+store.couponPercent+'% off products. Cash payment at confirmed local handoff.</p><a href="#shop" class="button light">SHOP THE COLLECTION</a>';$('welcome-result').hidden=false;};
window.addEventListener('strata-data-cleared',()=>{items=[];coupon='';welcomeEmail='';$('welcome-email').value='';$('welcome-result').hidden=true;$('welcome-form').hidden=!store.emailOffer||!store.couponEnabled;$('count').textContent='0';if($('panel').open)showBag();});
save();
