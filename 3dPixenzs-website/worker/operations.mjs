export const NJ_TAX_RATE=0.06625;
export function calculateOrder(config,requested) {
  if(!Array.isArray(requested)||requested.length<1||requested.length>60)throw new Error('Choose 1–60 product/color lines.');
  const merged=new Map();
  for(const line of requested){
    const p=config.products.find(p=>p.id===line.id&&p.enabled&&!p.quoteOnly);
    if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>100||!p.colors.includes(line.color))throw new Error('A selected product, color or quantity is unavailable.');
    const key=line.id+'|'+line.color;
    const current=merged.get(key);
    const quantity=(current?.quantity||0)+line.quantity;
    if(quantity>100)throw new Error('Limit each product/color to 100 pieces.');
    merged.set(key,{id:p.id,name:p.name,color:line.color,quantity,unitCents:p.priceCents,bundleQuantity:p.bundleQuantity,bundlePriceCents:p.bundlePriceCents});
  }
  const lines=[...merged.values()],groups=new Map();
  for(const line of lines){
    const key=config.mixBundles?JSON.stringify([line.unitCents,line.bundleQuantity,line.bundlePriceCents]):line.id;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(line);
  }
  for(const group of groups.values()){
    const p=group[0],quantity=group.reduce((s,l)=>s+l.quantity,0);
    const amount=p.bundleQuantity?Math.floor(quantity/p.bundleQuantity)*p.bundlePriceCents+(quantity%p.bundleQuantity)*p.unitCents:quantity*p.unitCents;
    let allocated=0;
    group.forEach((line,index)=>{line.subtotalCents=index===group.length-1?amount-allocated:Math.floor(amount*line.quantity/quantity);allocated+=line.subtotalCents;});
  }
  const subtotalCents=lines.reduce((s,l)=>s+l.subtotalCents,0);
  return {lines,subtotalCents};
}
function validText(value,label,max=1000){
 if(typeof value!=='string'||value.length>max||!value.trim())throw new Error('Enter '+label+'.');
 return value.trim();
}
function validateCustomer(value){
 const customer={name:validText(value?.name,'your name',120),email:validText(value?.email,'a contact email',254),phone:validText(value?.phone,'a phone number',30),town:validText(value?.town,'your New Jersey town',100),handoff:typeof value?.handoff==='string'?value.handoff.trim().slice(0,500):''};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)||/[\r\n]/.test(customer.email))throw new Error('Enter a valid email.');
 if(customer.phone.replace(/\D/g,'').length<10)throw new Error('Enter a valid phone number.');
 if(value?.state!=='NJ')throw new Error('Current checkout supports New Jersey local orders.');
 return {...customer,state:'NJ'};
}
const conditions=etag=>{const h=new Headers();h.set(etag?'If-Match':'If-None-Match',etag?'"'+etag+'"':'*');return h;};
const orderKey=id=>'operations/orders/'+id+'.json';
async function loadOrder(env,id){const obj=await env.BUCKET.get(orderKey(id));return obj?{order:await obj.json(),version:obj.etag}:null;}
function summary(order,config){
 return [config.brand+' order '+order.reference,'Adult buyer: '+order.customer.name,'Email: '+order.customer.email,'Phone: '+order.customer.phone,'Town: '+order.customer.town+', NJ','Handoff details: '+order.customer.handoff,
 ...order.lines.map(l=>l.name+' / '+l.color+' × '+l.quantity+' — $'+(l.subtotalCents/100).toFixed(2)),
 'Products: $'+(order.subtotalCents/100).toFixed(2),'Discount: -$'+(order.discountCents/100).toFixed(2),'Shipping: $'+(order.shippingCents/100).toFixed(2),'NJ sales tax 6.625%: $'+(order.taxCents/100).toFixed(2),'Cash due at handoff: $'+(order.totalCents/100).toFixed(2),'Fulfillment: '+order.fulfillment,'Buyer confirmed age 18+. Product intended age 13+.',order.notes?'Notes: '+order.notes:'','Submitted: '+order.createdAt].filter(Boolean).join('\n');
}
async function sendOrderEmail(env,order,config){
 if(env.MAIL_PREVIEW==='true')return {status:'preview_only',message:'Local preview. No email was sent.'};
 if(!env.RESEND_API_KEY||!env.ORDER_EMAIL_FROM){
  if(env.FORMSUBMIT_ENABLED!=='true')return {status:'not_configured',message:'Automatic email is disabled pending provider approval and inbox activation.'};
  try{
   const response=await fetch('https://formsubmit.co/ajax/'+encodeURIComponent(config.orderEmail),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({_subject:config.brand+' order '+order.reference,_template:'table',email:order.customer.email,order:summary(order,config)}),signal:AbortSignal.timeout(15000)});
   const body=await response.json();
   const message=String(body.message||'');
   if(/activat|confirm your email/i.test(message))return {status:'activation_required',message:'Activate the inbox using the FormSubmit email.',attemptedAt:new Date().toISOString()};
   if(response.ok&&(body.success===true||body.success==='true'))return {status:'accepted',provider:'formsubmit',attemptedAt:new Date().toISOString()};
   return {status:'failed',message:'FormSubmit did not accept the notification. Review inbox activation and retry after checking for duplicates.',attemptedAt:new Date().toISOString()};
  }catch{return {status:'uncertain',message:'No provider confirmation was received. Check the inbox before retrying.',attemptedAt:new Date().toISOString()};}
 }
 const requestBody={from:env.ORDER_EMAIL_FROM,to:[config.orderEmail],reply_to:order.customer.email,subject:config.brand+' order '+order.reference,text:summary(order,config)};
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'order-'+order.id},body:JSON.stringify(requestBody),signal:AbortSignal.timeout(15000)});
  const body=await response.json();
  return response.ok?{status:'accepted',providerId:body.id,attemptedAt:new Date().toISOString()}:{status:'failed',message:'Email provider rejected the request. Check sender verification and credentials.',attemptedAt:new Date().toISOString()};
 }catch{return {status:'failed',message:'Email delivery request did not complete. Retry from Admin.',attemptedAt:new Date().toISOString()};}
}
export async function handleOperations(request,env,config,admin,json){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/order-status')return json({emailConfigured:Boolean((env.RESEND_API_KEY&&env.ORDER_EMAIL_FROM)||env.FORMSUBMIT_ENABLED==='true'),emailProvider:env.RESEND_API_KEY&&env.ORDER_EMAIL_FROM?'resend':env.FORMSUBMIT_ENABLED==='true'?'formsubmit':'disabled',orderEmail:config.orderEmail,shippingEnabled:config.shippingEnabled,paymentMethod:'cash_on_delivery'});
 if(path==='/api/orders'&&request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return json({error:'Request origin rejected.'},403);
  const raw=await request.text();if(raw.length>30000)return json({error:'Order is too large.'},413);
  const input=JSON.parse(raw);
  if(input.adultConfirmed!==true||input.policiesConfirmed!==true)return json({error:'An adult buyer must confirm age and read the order policies.'},400);
  if(input.website)return json({error:'Unable to accept request.'},400);
  if(!/^[a-f0-9-]{36}$/.test(input.idempotencyKey))return json({error:'Invalid request reference.'},400);
  const existing=await loadOrder(env,input.idempotencyKey);
  if(existing)return json({order:publicOrder(existing.order),duplicate:true});
  const customer=validateCustomer(input.customer);
  const price=calculateOrder(config,input.items);
  const code=typeof input.coupon==='string'?input.coupon.trim().toUpperCase():'';
  if(code&&(!config.couponEnabled||code!==config.couponCode))throw new Error('The discount code is unavailable.');
  const discountCents=code?Math.round(price.subtotalCents*config.couponPercent/100):0;
  const shippingCents=config.shippingEnabled&&price.subtotalCents-discountCents<=config.freeShippingOverCents?config.shippingCents:0;
  const taxCents=Math.round((price.subtotalCents-discountCents+shippingCents)*6625/100000);
  const totalCents=price.subtotalCents-discountCents+shippingCents+taxCents;
  if(input.expectedTotalCents!==totalCents)return json({error:'Pricing changed. Refresh your bag and review the updated total.'},409);
  const order={id:input.idempotencyKey,reference:'TX-'+input.idempotencyKey.slice(0,8).toUpperCase(),createdAt:new Date().toISOString(),customer,...price,discountCents,shippingCents,taxCents,totalCents,coupon:code,paymentMethod:'cash_on_delivery',fulfillment:config.shippingEnabled?'shipping_by_confirmation':'local_handoff',status:'new',cashCollectedCents:0,refundCents:0,scheduledFor:'',scheduleTimezone:'America/New_York',estimatedMinutes:0,actualMinutes:0,notes:typeof input.notes==='string'?input.notes.slice(0,1500):'',internalNotes:'',adultConfirmed:true,policiesConfirmed:true,mail:{status:'pending',attemptedAt:new Date().toISOString()},history:[]};
  const written=await env.BUCKET.put(orderKey(order.id),JSON.stringify(order),{onlyIf:conditions(null),httpMetadata:{contentType:'application/json'}});
  if(!written){const current=await loadOrder(env,order.id);return json({order:publicOrder(current.order),duplicate:true});}
  order.mail=await sendOrderEmail(env,order,config);
  await env.BUCKET.put(orderKey(order.id),JSON.stringify(order),{onlyIf:conditions(written.etag),httpMetadata:{contentType:'application/json'}});
  return json({order:publicOrder(order)},201);
 }
 if(!path.startsWith('/api/admin/'))return null;
 if(!admin)return json({error:'Owner access required.'},403);
 if(path==='/api/admin/orders'&&request.method==='GET'){
  let cursor,orders=[];
  do{
   const page=await env.BUCKET.list({prefix:'operations/orders/',limit:1000,...(cursor?{cursor}:{})});
   const records=await Promise.all(page.objects.map(async item=>{const object=await env.BUCKET.get(item.key);return object?{...(await object.json()),version:object.etag}:null;}));
   orders.push(...records.filter(Boolean));cursor=page.truncated?page.cursor:null;
  }while(cursor);
  orders.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return json({orders,emailConfigured:Boolean((env.RESEND_API_KEY&&env.ORDER_EMAIL_FROM)||env.FORMSUBMIT_ENABLED==='true'),emailProvider:env.RESEND_API_KEY&&env.ORDER_EMAIL_FROM?'resend':env.FORMSUBMIT_ENABLED==='true'?'formsubmit':'disabled'});
 }
 const match=path.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})(\/retry-email)?$/);
 if(match&&request.method==='PUT'){
  if(request.headers.get('Origin')!==url.origin)return json({error:'Request origin rejected.'},403);
  const current=await loadOrder(env,match[1]);if(!current)return json({error:'Order not found.'},404);
  const input=await request.json();
  if(input.version!==current.version)return json({error:'Order was updated. Reload before saving.'},409);
  const order=current.order;
  if(match[2]){
   if(order.mail.status==='accepted')return json({order:{...order,version:current.version}});
   if(order.mail.attemptedAt&&Date.now()-Date.parse(order.mail.attemptedAt)>23*60*60*1000)return json({error:'The safe retry window expired. Review your inbox before contacting the customer manually.'},409);
   if(order.mail.status==='sending'&&Date.now()-Date.parse(order.mail.attemptedAt)<60000)return json({error:'A notification is already being attempted.'},409);
   order.mail={status:'sending',attemptedAt:new Date().toISOString()};
   const lock=await env.BUCKET.put(orderKey(order.id),JSON.stringify(order),{onlyIf:conditions(current.version),httpMetadata:{contentType:'application/json'}});
   if(!lock)return json({error:'Another notification attempt is in progress. Reload.'},409);
   current.version=lock.etag;
   order.mail=await sendOrderEmail(env,order,config);
  }else{
   const states=['new','confirmed','queued','printing','quality_check','ready','delivered','cancelled','returned'];
   if(!states.includes(input.status))throw new Error('Invalid order status.');
   for(const key of ['cashCollectedCents','refundCents','estimatedMinutes','actualMinutes'])if(!Number.isSafeInteger(input[key])||input[key]<0)throw new Error('Enter valid order amounts and minutes.');
   if(input.cashCollectedCents>order.totalCents||input.refundCents>input.cashCollectedCents)throw new Error('Collected cash or refund exceeds the order balance.');
   if(input.scheduledFor&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.scheduledFor))throw new Error('Enter a valid schedule time.');
   if(input.status!==order.status)order.history.push({from:order.status,to:input.status,at:new Date().toISOString()});
   for(const key of ['status','cashCollectedCents','refundCents','estimatedMinutes','actualMinutes'])order[key]=input[key];
   order.scheduledFor=input.scheduledFor||'';order.internalNotes=typeof input.internalNotes==='string'?input.internalNotes.slice(0,5000):'';
   order.updatedAt=new Date().toISOString();
  }
  const written=await env.BUCKET.put(orderKey(order.id),JSON.stringify(order),{onlyIf:conditions(current.version),httpMetadata:{contentType:'application/json'}});
  return written?json({order:{...order,version:written.etag}}):json({error:'Concurrent update. Reload this order.'},409);
 }
 if(path==='/api/admin/board'){
  const key='operations/board.json';const object=await env.BUCKET.get(key);
  const board=object?await object.json():{tasks:[],inventory:[],notes:''};
  if(request.method==='GET')return json({board,version:object?.etag||null});
  if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'Request origin rejected.'},403);
  const raw=await request.text();if(raw.length>150000)return json({error:'Board is too large.'},413);
  const input=JSON.parse(raw);
  if(input.version!==(object?.etag||null))return json({error:'Board changed. Reload before saving.'},409);
  if(!Array.isArray(input.board?.tasks)||input.board.tasks.length>500||!Array.isArray(input.board?.inventory)||input.board.inventory.length>200)throw new Error('Invalid operations board.');
  const clean={tasks:input.board.tasks.map(t=>({id:validText(t.id,'task ID',80),title:validText(t.title,'task title',300),due:typeof t.due==='string'?t.due.slice(0,16):'',done:t.done===true,category:typeof t.category==='string'?t.category.slice(0,80):'General',notes:typeof t.notes==='string'?t.notes.slice(0,2000):''})),inventory:input.board.inventory.map(i=>({name:validText(i.name,'inventory item',120),quantity:Number.isFinite(i.quantity)&&i.quantity>=0?i.quantity:0,unit:typeof i.unit==='string'?i.unit.slice(0,30):'units',notes:typeof i.notes==='string'?i.notes.slice(0,500):''})),notes:typeof input.board.notes==='string'?input.board.notes.slice(0,10000):''};
  const written=await env.BUCKET.put(key,JSON.stringify(clean),{onlyIf:conditions(object?.etag),httpMetadata:{contentType:'application/json'}});
  return written?json({board:clean,version:written.etag}):json({error:'Concurrent update. Reload board.'},409);
 }
 return null;
}
function publicOrder(order){
 return {id:order.id,reference:order.reference,subtotalCents:order.subtotalCents,discountCents:order.discountCents,shippingCents:order.shippingCents,taxCents:order.taxCents,totalCents:order.totalCents,status:order.status,mailStatus:order.mail.status,paymentMethod:order.paymentMethod};
}
