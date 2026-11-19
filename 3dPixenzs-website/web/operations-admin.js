window.operations=(()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((n||0)/100);
 let orders=[],board={tasks:[],inventory:[],notes:''},boardVersion=null,active='dashboard',emailConfigured=false;
 const statuses=['new','confirmed','queued','printing','quality_check','ready','delivered','cancelled','returned'];
 const topics=['Product selection','Pricing and profitability','Product safety and age classification','Commercial design licenses','Business registration, tax and insurance','Website and ordering checks','Local fulfillment and packaging','Returns and complaint handling','Production capacity and quality checks','Adult-focused marketing and truthful reviews','Customer support','Analytics and privacy'];
 const status=(text,error=false)=>{document.getElementById('status').textContent=text;document.getElementById('status').classList.toggle('error',error);};
 async function api(path,options={}){const response=await fetch(path,options);const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed.');return result;}
 async function load(){
  const [o,b]=await Promise.all([api('/api/admin/orders'),api('/api/admin/board')]);
  orders=o.orders;emailConfigured=o.emailConfigured;board=b.board;boardVersion=b.version;
 }
 const field=(label,key,value,type='text')=>'<label class="field">'+label+'<input data-order-field="'+key+'" type="'+type+'" value="'+esc(value)+'"'+(type==='number'?' min="0" step="1"':'')+'></label>';
 function printReceipt(order) {
  const receipt = window.open('', '_blank');
  if (!receipt) {
   status('Allow pop-ups to open the printable receipt.', true);
   return;
  }
  receipt.opener = null;
  const collected = order.cashCollectedCents || 0;
  const refunded = order.refundCents || 0;
  const heading = collected > 0 ? 'Payment receipt' : 'Order summary';
  const totals = [
   ['Subtotal', order.subtotalCents], ['Discount', -order.discountCents],
   ['Shipping', order.shippingCents], ['NJ sales tax', order.taxCents],
   ['Order total', order.totalCents], ['Cash received', collected], ['Refunded', refunded]
  ];
  const rows = order.lines.map(line =>
   '<tr><td>'+esc(line.name)+'</td><td>'+esc(line.color)+'</td><td>'+esc(line.quantity)+'</td><td>'+money(line.subtotalCents)+'</td></tr>'
  ).join('');
  receipt.document.write('<!doctype html><html lang="en"><meta charset="utf-8"><title>'+heading+' '+esc(order.reference)+'</title>'+
   '<style>body{font:16px system-ui;margin:2rem auto;padding:0 1rem;max-width:40rem}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:.55rem;border-bottom:1px solid #bbb}@media print{button{display:none}}</style>'+
   '<main><h1>'+heading+'</h1><p>'+esc(window.STORE_CONFIG.brand)+' · '+esc(order.reference)+'</p>'+
   '<p>Customer: '+esc(order.customer.name)+'</p><p>Ordered: '+esc(new Date(order.createdAt).toLocaleDateString('en-US',{timeZone:'America/New_York'}))+'</p>'+
   '<table><thead><tr><th>Item</th><th>Color</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>'+rows+'</tbody></table>'+
   '<dl>'+totals.map(([label, cents])=>'<dt>'+label+'</dt><dd>'+money(cents)+'</dd>').join('')+'</dl>'+
   (collected ? '' : '<p>No payment recorded.</p>')+'<button type="button" id="print">Print or save as PDF</button></main></html>');
  receipt.document.close();
  receipt.document.getElementById('print').onclick = () => receipt.print();
 }
 function orderCard(order){
  return '<section class="panel order-card" data-order-id="'+order.id+'"><div class="product-header"><h2>'+esc(order.reference)+' · '+esc(order.customer.name)+'</h2><strong>'+money(order.totalCents)+'</strong></div><p>'+esc(order.customer.email)+' · '+esc(order.customer.phone)+' · '+esc(order.customer.town)+', NJ</p><p>'+order.lines.map(l=>esc(l.name)+' / '+esc(l.color)+' × '+l.quantity).join('<br>')+'</p><p class="hint">Received '+new Date(order.createdAt).toLocaleString()+' · Tax '+money(order.taxCents)+' · Cash due '+money(order.totalCents)+' · Email '+esc(order.mail.status)+'</p><p>'+esc(order.customer.handoff||'Handoff details not set')+'</p><p>'+esc(order.notes)+'</p><div class="grid"><label class="field">Order status<select data-order-field="status">'+statuses.map(s=>'<option'+(s===order.status?' selected':'')+'>'+s+'</option>').join('')+'</select></label>'+field('Cash collected (cents)','cashCollectedCents',order.cashCollectedCents,'number')+field('Refund paid (cents)','refundCents',order.refundCents,'number')+field('Scheduled handoff / work slot (New Jersey time)','scheduledFor',order.scheduledFor,'datetime-local')+field('Planned production minutes','estimatedMinutes',order.estimatedMinutes,'number')+field('Actual production minutes','actualMinutes',order.actualMinutes,'number')+'</div><label class="field">Internal notes<textarea data-order-field="internalNotes">'+esc(order.internalNotes)+'</textarea></label><div class="ops-actions"><button type="button" data-save-order="'+order.id+'" class="gold">Save order</button><button type="button" data-print-receipt="'+order.id+'">View receipt</button><button type="button" data-retry-email="'+order.id+'"'+(order.mail.status==='accepted'?' disabled':'')+'>Retry email after inbox check</button></div></section>';
 }
 function render(){
  const root=document.getElementById('editor');
  const open=orders.filter(o=>!['delivered','cancelled','returned'].includes(o.status));
  const collected=orders.reduce((s,o)=>s+o.cashCollectedCents,0),refunds=orders.reduce((s,o)=>s+o.refundCents,0);
  let body='<div class="ops-actions"><button type="button" data-ops-refresh>Refresh data</button><button type="button" data-export-orders>Export orders CSV</button></div>';
  if(active==='dashboard'){
   body+='<div class="metric-grid">'+[['Order requests',orders.length],['Open orders',open.length],['Delivered',orders.filter(o=>o.status==='delivered').length],['Cash collected',money(collected)],['Refunds paid',money(refunds)],['Net collected',money(collected-refunds)],['Average recorded production',orders.filter(o=>o.actualMinutes>0).length?Math.round(orders.reduce((s,o)=>s+o.actualMinutes,0)/orders.filter(o=>o.actualMinutes>0).length)+' min':'No times recorded'],['Planned open work',open.reduce((s,o)=>s+o.estimatedMinutes,0)+' min'],['Completed tasks',board.tasks.filter(t=>t.done).length+' / '+board.tasks.length]].map(([label,value])=>'<article><span>'+label+'</span><strong>'+value+'</strong></article>').join('')+'</div><section class="panel"><h2>Email notifications</h2><p>'+ (emailConfigured?'Email integration is configured for FormSubmit (or your authenticated sender when configured). Activate the Gmail inbox from the one-time FormSubmit email. Check each order’s notification status.':'Automatic email is disabled pending provider approval and inbox activation. Orders remain saved here. After setup, check the inbox before retrying notifications.')+'</p><p class="hint">Inbox: '+esc(window.STORE_CONFIG.orderEmail)+'. Revenue is based on cash you mark collected. Requests and unpaid orders do not count as collected sales.</p></section><section class="panel"><h2>Recent orders</h2>'+(!orders.length?'<p>No orders yet.</p>':orders.slice(0,5).map(o=>'<div class="section-row"><span>'+esc(o.reference)+' · '+esc(o.customer.name)+'</span><span>'+esc(o.status)+' · '+money(o.totalCents)+'</span></div>').join(''))+'</section>';
  }
  if(active==='orders')body+='<p class="hint">Record status, cash received, production time and the agreed handoff. Saving a status does not automatically mark cash collected.</p>'+(orders.map(orderCard).join('')||'<section class="panel"><p>No order requests yet.</p></section>');
  if(active==='schedule'){
   const scheduled=orders.filter(o=>o.scheduledFor).sort((a,b)=>a.scheduledFor.localeCompare(b.scheduledFor));
   body+='<section class="panel"><h2>Production & handoff schedule</h2><p class="hint">Times are entered as New Jersey local time (America/New_York). Set a time in Orders to add it here.</p>'+scheduled.map(o=>'<div class="section-row"><strong>'+esc(o.scheduledFor.replace('T',' '))+'</strong><span>'+esc(o.reference)+' · '+esc(o.customer.name)+' · '+esc(o.status)+' · '+o.estimatedMinutes+' min</span></div>').join('')+(!scheduled.length?'<p>No scheduled orders yet.</p>':'')+'</section><section class="panel"><h2>Unscheduled open work</h2>'+open.filter(o=>!o.scheduledFor).map(o=>'<p>'+esc(o.reference)+' · '+o.estimatedMinutes+' planned minutes</p>').join('')+'</section>';
  }
  if(active==='tasks'){
   body+='<section class="panel"><h2>Tasks & launch readiness</h2><p class="hint">Use these tasks to verify real operating requirements. A checked box records your completion, not a legal certification.</p><div class="grid"><label class="field">Task title<input id="new-task-title" maxlength="300"></label><label class="field">Due date<input id="new-task-due" type="date"></label><label class="field">Category<input id="new-task-category" maxlength="80" placeholder="Production, safety, support…"></label></div><button type="button" data-add-task>Add task</button><button type="button" data-add-checklist>Add business readiness checklist</button></section>'+board.tasks.map(t=>'<section class="panel task-card" data-task-id="'+esc(t.id)+'"><label class="toggle"><input type="checkbox" data-task-done="'+esc(t.id)+'"'+(t.done?' checked':'')+'><strong>'+esc(t.title)+'</strong></label><p class="hint">'+esc(t.category)+(t.due?' · Due '+esc(t.due):'')+'</p><label class="field">Notes<textarea data-task-notes>'+esc(t.notes)+'</textarea></label><div class="ops-actions"><button type="button" data-save-task="'+esc(t.id)+'">Save notes</button><button type="button" data-remove-task="'+esc(t.id)+'">Remove task</button></div></section>').join('');
  }
  if(active==='inventory'){
   body+='<section class="panel"><h2>Filament & packaging inventory</h2><div class="grid"><label class="field">Item<input id="stock-name" maxlength="120"></label><label class="field">Quantity<input id="stock-quantity" type="number" min="0" step=".01"></label><label class="field">Unit<input id="stock-unit" placeholder="grams, rolls, boxes…" maxlength="30"></label></div><button type="button" data-add-stock>Add inventory item</button></section>'+board.inventory.map((i,index)=>'<section class="panel stock-card" data-stock-index="'+index+'"><strong>'+esc(i.name)+'</strong><div class="grid"><label class="field">Quantity<input type="number" min="0" step=".01" data-stock-quantity value="'+i.quantity+'"></label><label class="field">Unit<input data-stock-unit value="'+esc(i.unit)+'"></label></div><label class="field">Notes<textarea data-stock-notes>'+esc(i.notes)+'</textarea></label><div class="ops-actions"><button type="button" data-save-stock="'+index+'">Save inventory</button><button type="button" data-remove-stock="'+index+'">Remove</button></div></section>').join('');
  }
  if(active==='costs')body+='<section class="panel"><h2>Print cost & contribution calculator</h2><p class="hint">Enter your actual costs. Tax collected is excluded from contribution.</p><div class="grid">'+[['Sale price before tax ($)','sale'],['Filament used (grams)','grams'],['Filament cost per kg ($)','filament'],['Print hours','hours'],['Printer watts','watts'],['Electricity per kWh ($)','power'],['Failure allowance (%)','failure'],['Packaging ($)','packaging'],['Labor minutes','labor'],['Labor rate per hour ($)','wage'],['Other costs / fees ($)','other']].map(([label,id])=>'<label class="field">'+label+'<input id="cost-'+id+'" data-cost type="number" min="0" step=".01" value="0"></label>').join('')+'</div><div id="cost-result" class="order-confirmation"></div></section>';
  root.innerHTML=body;
  bind();
 }
 async function saveBoard(){const response=await api('/api/admin/board',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({board,version:boardVersion})});board=response.board;boardVersion=response.version;status('Operations saved.');render();}
 function bind(){
  document.querySelectorAll('[data-ops-refresh]').forEach(b=>b.onclick=async()=>{try{await load();render();status('Operations refreshed.');}catch(e){status(e.message,true);}});
  document.querySelectorAll('[data-print-receipt]').forEach(button => {
   button.onclick = () => printReceipt(orders.find(order => order.id === button.dataset.printReceipt));
  });
  document.querySelectorAll('[data-save-order]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{
   const order=orders.find(o=>o.id===b.dataset.saveOrder),card=b.closest('.order-card'),input={version:order.version};
   card.querySelectorAll('[data-order-field]').forEach(el=>input[el.dataset.orderField]=el.type==='number'?Number(el.value):el.value);
   const result=await api('/api/admin/orders/'+order.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   orders=orders.map(o=>o.id===order.id?result.order:o);status('Order saved.');render();
  }catch(e){status(e.message,true);b.disabled=false;}});
  document.querySelectorAll('[data-retry-email]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const order=orders.find(o=>o.id===b.dataset.retryEmail);const result=await api('/api/admin/orders/'+order.id+'/retry-email',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:order.version})});orders=orders.map(o=>o.id===order.id?result.order:o);status('Email state: '+result.order.mail.status);render();}catch(e){status(e.message,true);b.disabled=false;}});
  const add=document.querySelector('[data-add-task]');if(add)add.onclick=async()=>{const title=document.getElementById('new-task-title').value.trim();if(!title){status('Enter a task title.',true);return;}board.tasks.push({id:crypto.randomUUID(),title,due:document.getElementById('new-task-due').value,category:document.getElementById('new-task-category').value||'General',done:false,notes:''});try{await saveBoard();}catch(e){status(e.message,true);}};
  const checklist=document.querySelector('[data-add-checklist]');if(checklist)checklist.onclick=async()=>{for(const title of topics)if(!board.tasks.some(t=>t.title===title))board.tasks.push({id:crypto.randomUUID(),title,due:'',category:'Business readiness',done:false,notes:''});try{await saveBoard();}catch(e){status(e.message,true);}};
  document.querySelectorAll('[data-task-done]').forEach(input=>input.onchange=async()=>{board.tasks.find(t=>t.id===input.dataset.taskDone).done=input.checked;try{await saveBoard();}catch(e){status(e.message,true);}});
  document.querySelectorAll('[data-save-task]').forEach(b=>b.onclick=async()=>{board.tasks.find(t=>t.id===b.dataset.saveTask).notes=b.closest('.task-card').querySelector('[data-task-notes]').value;try{await saveBoard();}catch(e){status(e.message,true);}});
  document.querySelectorAll('[data-remove-task]').forEach(b=>b.onclick=async()=>{board.tasks=board.tasks.filter(t=>t.id!==b.dataset.removeTask);try{await saveBoard();}catch(e){status(e.message,true);}});
  const stock=document.querySelector('[data-add-stock]');if(stock)stock.onclick=async()=>{const name=document.getElementById('stock-name').value.trim();if(!name){status('Enter an inventory name.',true);return;}board.inventory.push({name,quantity:Number(document.getElementById('stock-quantity').value),unit:document.getElementById('stock-unit').value||'units',notes:''});try{await saveBoard();}catch(e){status(e.message,true);}};
  document.querySelectorAll('[data-save-stock]').forEach(b=>b.onclick=async()=>{const i=board.inventory[Number(b.dataset.saveStock)],card=b.closest('.stock-card');i.quantity=Number(card.querySelector('[data-stock-quantity]').value);i.unit=card.querySelector('[data-stock-unit]').value;i.notes=card.querySelector('[data-stock-notes]').value;try{await saveBoard();}catch(e){status(e.message,true);}});
  document.querySelectorAll('[data-remove-stock]').forEach(b=>b.onclick=async()=>{board.inventory.splice(Number(b.dataset.removeStock),1);try{await saveBoard();}catch(e){status(e.message,true);}});
  document.querySelectorAll('[data-export-orders]').forEach(b=>b.onclick=()=>{
   const safe=value=>{let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
   const rows=[['Reference','Created','Name','Email','Town','Status','Subtotal cents','Discount cents','NJ tax cents','Total cents','Cash collected cents','Refund cents','Schedule','Planned minutes','Actual minutes'],...orders.map(o=>[o.reference,o.createdAt,o.customer.name,o.customer.email,o.customer.town,o.status,o.subtotalCents,o.discountCents,o.taxCents,o.totalCents,o.cashCollectedCents,o.refundCents,o.scheduledFor,o.estimatedMinutes,o.actualMinutes])];
   const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(safe).join(',')).join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='orders.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function costs(){const n=id=>Math.max(0,Number(document.getElementById('cost-'+id).value)||0);const material=n('grams')/1000*n('filament');const energy=n('hours')*n('watts')/1000*n('power');const print=(material+energy)*(1+n('failure')/100);const total=print+n('packaging')+n('labor')/60*n('wage')+n('other');document.getElementById('cost-result').textContent='Estimated cost $'+total.toFixed(2)+' · Contribution before tax $'+(n('sale')-total).toFixed(2);}
  document.querySelectorAll('[data-cost]').forEach(input=>input.oninput=costs);if(document.getElementById('cost-result'))costs();
 }
 return {async show(tab){active=tab;document.getElementById('editor').innerHTML='<p>Loading operations…</p>';try{await load();render();}catch(e){status(e.message,true);}}};
})();
