const byId=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let config,version,previous,tab='dashboard',dirty=false,busy=false;
const titles={dashboard:'Dashboard',orders:'Orders',schedule:'Schedule',tasks:'To-do & readiness',inventory:'Inventory',costs:'Cost calculator',brand:'Brand & contact',products:'Products',layout:'Layout & visibility',offers:'Shipping & offers',content:'Page content',policies:'Policies',backup:'Backup & restore'};
const status=(message,error=false)=>{byId('status').textContent=message;byId('status').classList.toggle('error',error);};
function field(label,path,type='text',hint=''){
 const value=path.split('.').reduce((v,k)=>v?.[k],config);
 const input=type==='textarea'?'<textarea data-path="'+path+'">'+esc(value)+'</textarea>':'<input type="'+type+'" data-path="'+path+'" value="'+esc(value)+'"'+(type==='number'?' min="0" step="1"':'')+'>';
 return '<label class="field">'+label+input+(hint?'<small>'+hint+'</small>':'')+'</label>';
}
function toggle(label,path){const value=path.split('.').reduce((v,k)=>v?.[k],config);return '<label class="toggle"><input type="checkbox" data-path="'+path+'"'+(value?' checked':'')+'>'+label+'</label>';}
function select(label,path,options){const value=path.split('.').reduce((v,k)=>v?.[k],config);return '<label class="field">'+label+'<select data-path="'+path+'">'+options.map(([key,text])=>'<option value="'+key+'"'+(String(value)===String(key)?' selected':'')+'>'+text+'</option>').join('')+'</select></label>';}
function imageEditor(path){const value=path.split('.').reduce((v,k)=>v?.[k],config);return '<div class="image-editor"><img src="'+esc(value)+'" alt="Current image"><label class="upload-label">Upload image<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="'+path+'"></label><span class="hint">PNG, JPEG or WebP · up to 5 MB</span></div>'+field('Image path',path,'text','Use a store asset filename or an uploaded /media/ path.');}
function render(){
 byId('tab-title').textContent=titles[tab];
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 if(['dashboard','orders','schedule','tasks','inventory','costs'].includes(tab)){window.operations.show(tab);return;}
 let content='';
 if(tab==='brand')content='<section class="panel"><h2>Brand</h2><div class="grid">'+field('Company / store name','brand')+field('Wordmark subtitle','tagline')+field('Legal business name','legalName')+field('Business mailing address','mailingAddress')+field('Customer support phone (10 digits)','phone')+field('Order inbox email','orderEmail')+field('Customer service email','supportEmail')+'</div><p class="hint">Admin access is tied to the site owner account and is enforced on the server.</p></section><section class="panel"><h2>Colors & typography</h2><div class="grid">'+field('Background','colors.background','color')+field('Text','colors.text','color')+field('Buttons and accents','colors.accent','color')+field('Campaign banner','colors.banner','color')+select('Font style','font',[['sans','Clean sans serif'],['condensed','Condensed'],['serif','Editorial serif']])+'</div></section>';
 if(tab==='products')content=config.products.map((p,i)=>'<section class="panel"><div class="product-header"><h2>'+esc(p.name)+'</h2><div class="product-tools"><button type="button" data-product-up="'+i+'"'+(!i?' disabled':'')+'>Move up</button><button type="button" data-product-down="'+i+'"'+(i===config.products.length-1?' disabled':'')+'>Move down</button><button type="button" data-remove-product="'+i+'">Remove</button></div></div>'+toggle('Visible in store','products.'+i+'.enabled')+toggle('Request price instead of buying','products.'+i+'.quoteOnly')+'<div class="grid">'+field('Product name','products.'+i+'.name')+field('Badge','products.'+i+'.badge')+field('Short advertising copy','products.'+i+'.description','textarea')+field('Product details','products.'+i+'.details','textarea')+field('Price in cents','products.'+i+'.priceCents','number','400 means $4.00. Set a price before disabling Request price.')+field('Bundle quantity (0 to disable)','products.'+i+'.bundleQuantity','number')+field('Bundle price in cents','products.'+i+'.bundlePriceCents','number')+'<label class="field">Available colors (comma-separated)<input data-colors="'+i+'" value="'+esc((p.colors||['Silver-white']).join(', '))+'"></label>'+'</div>'+imageEditor('products.'+i+'.image')+'</section>').join('')+'<button type="button" id="add-product">Add product</button>';
 if(tab==='layout')content='<section class="panel"><h2>Layout</h2><div class="grid">'+select('Desktop product columns','columns',[[2,'2 columns'],[3,'3 columns'],[4,'4 columns']])+select('Hero arrangement','heroLayout',[['image-right','Image on right'],['image-left','Image on left'],['centered','Centered copy']])+select('Product card corners','cardStyle',[['square','Square'],['rounded','Rounded']])+'</div></section><section class="panel"><h2>Section order and visibility</h2><p class="hint">Promotional strip stays above the navigation. Other sections follow the order below.</p>'+config.sections.map((s,i)=>'<div class="section-row">'+toggle(esc(s.id.charAt(0).toUpperCase()+s.id.slice(1)),'sections.'+i+'.enabled')+'<div><button type="button" data-section-up="'+i+'"'+(!i?' disabled':'')+'>Up</button> <button type="button" data-section-down="'+i+'"'+(i===7?' disabled':'')+'>Down</button></div></div>').join('')+'</section>';
 if(tab==='offers')content='<section class="panel"><h2>Fulfillment & cash payment</h2>'+toggle('Enable parcel shipping','shippingEnabled')+field('Local service area / handoff note','deliveryArea')+'<p class="hint">Cash on delivery is active. New Jersey tax is calculated at 6.625% on each taxable order.</p><div class="grid">'+field('Shipping charge in cents','shippingCents','number')+field('Free shipping when merchandise exceeds (cents)','freeShippingOverCents','number','Strictly greater than this amount, after discounts and before tax.')+field('Ship within calendar days','shippingDays','number')+field('Standard return window (days)','returnDays','number')+'</div></section><section class="panel"><h2>Welcome offer</h2>'+toggle('Enable coupon','couponEnabled')+toggle('Show email welcome form','emailOffer')+'<div class="grid">'+field('Coupon code','couponCode')+field('Discount percentage','couponPercent','number')+'</div><p class="hint">The email offer reveals the code on the page. Automatic email delivery is not configured. First-order eligibility is confirmed manually.</p></section>';

 if(tab==='content')content='<section class="panel"><h2>Hero campaign</h2><div class="grid">'+field('Eyebrow','heroEyebrow')+field('Headline (new line for a line break)','heroTitle','textarea')+field('Description','heroText','textarea')+'</div>'+imageEditor('heroImage')+'</section><section class="panel"><h2>Store copy</h2><div class="grid">'+field('Promotional strip','promoText')+field('Campaign banner title','bannerText')+field('Campaign banner detail','bannerDetail')+field('Collection heading','collectionTitle')+field('Footer statement','footerText')+'</div></section>';
 if(tab==='policies')content='<section class="panel"><h2>Policy text</h2><p class="hint">Policy edits are plain text. Review your operating practices and legal details before publishing.</p><label class="field">Choose policy<select id="policy-select">'+Object.entries(config.policies).map(([key,p])=>'<option value="'+key+'">'+esc(p.title)+'</option>').join('')+'</select></label><div id="policy-fields"></div></section>';
 if(tab==='backup')content='<section class="panel"><h2>Configuration backup</h2><p>Download your draft as JSON or import a previously exported configuration.</p><button type="button" id="export">Download draft backup</button> <label class="upload-label">Import backup<input type="file" id="import" accept="application/json"></label></section><section class="panel"><h2>Previous published version</h2><p>Load the previous published configuration into the editor, review it, then save or publish.</p><button type="button" id="restore"'+(!previous?' disabled':'')+'>Load previous published version</button></section>';
 byId('editor').innerHTML=content;
 if(tab==='policies'){byId('policy-select').onchange=renderPolicy;renderPolicy();}
 bindSpecial();
}
function renderPolicy(){const key=byId('policy-select').value;byId('policy-fields').innerHTML=field('Policy title','policies.'+key+'.title')+'<label class="field">Policy body<textarea class="policy-editor" data-path="policies.'+key+'.text">'+esc(config.policies[key].text)+'</textarea></label>';}
function setPath(path,value){const parts=path.split('.');const key=parts.pop();const parent=parts.reduce((o,p)=>o[p],config);parent[key]=value;dirty=true;status('Unsaved edits. Save draft to make them available in Preview draft.');}
byId('editor').addEventListener('input',e=>{
 if(e.target.dataset.colors!==undefined){config.products[Number(e.target.dataset.colors)].colors=e.target.value.split(',').map(s=>s.trim()).filter(Boolean);dirty=true;status('Color choices updated. Save draft or publish.');return;}
 const path=e.target.dataset.path;if(!path)return;
 const value=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value;
 setPath(path,value);
});
byId('editor').addEventListener('change',e=>{if(e.target.tagName==='SELECT'&&e.target.dataset.path)setPath(e.target.dataset.path,e.target.dataset.path==='columns'?Number(e.target.value):e.target.value);});
byId('editor').onsubmit=e=>e.preventDefault();
function move(array,from,to){if(to<0||to>=array.length)return;[array[from],array[to]]=[array[to],array[from]];dirty=true;render();status('Order updated. Save draft or publish.');}
byId('editor').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.productUp!==undefined)move(config.products,Number(b.dataset.productUp),Number(b.dataset.productUp)-1);
 if(b.dataset.productDown!==undefined)move(config.products,Number(b.dataset.productDown),Number(b.dataset.productDown)+1);
 if(b.dataset.sectionUp!==undefined)move(config.sections,Number(b.dataset.sectionUp),Number(b.dataset.sectionUp)-1);
 if(b.dataset.sectionDown!==undefined)move(config.sections,Number(b.dataset.sectionDown),Number(b.dataset.sectionDown)+1);
 if(b.dataset.removeProduct!==undefined){config.products.splice(Number(b.dataset.removeProduct),1);dirty=true;render();status('Product removed from the draft. Published store changes after you publish.');}
});
function bindSpecial(){
 if(byId('add-product'))byId('add-product').onclick=()=>{config.products.push({id:'print-'+crypto.randomUUID().slice(0,8),name:'New print',description:'Describe your print.',details:'Confirm material, model and dimensions before payment.',image:'fidget-dark-card.webp',badge:'NEW PRINT',priceCents:null,quoteOnly:true,enabled:false,bundleQuantity:0,bundlePriceCents:0,colors:['Gold','Silver','Blue','Red','Black','Green']});dirty=true;render();};
 document.querySelectorAll('[data-upload]').forEach(input=>input.onchange=async()=>{
   const file=input.files[0];if(!file)return;
   status('Uploading image…');
   try{const response=await fetch('/api/admin/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error);setPath(input.dataset.upload,data.url);render();status('Image uploaded. Save draft or publish to use it.');}catch(error){status(error.message,true);}
 });
 if(byId('export'))byId('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='store-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 if(byId('import'))byId('import').onchange=async e=>{try{const file=e.target.files[0];if(!file||file.size>500000)throw new Error('Use a configuration backup under 500 KB.');const imported=JSON.parse(await file.text());if(!Array.isArray(imported.products)||!imported.brand)throw new Error('Invalid store backup.');config=imported;dirty=true;render();status('Backup loaded into the editor. Save to validate, then preview.');}catch(error){status(error.message,true);}};
 if(byId('restore'))byId('restore').onclick=()=>{config=structuredClone(previous);dirty=true;render();status('Previous published settings loaded into the editor. Review before saving or publishing.');};
}
async function save(publish){
 if(busy)return;busy=true;byId('save').disabled=byId('publish').disabled=true;status(publish?'Publishing changes…':'Saving draft…');
 try{
  const response=await fetch('/api/admin/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({config,version,publish})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Save failed.');
  config=data.draft;version=data.version;previous=data.previous;dirty=false;
  status(publish?'Published. Your changes are live.':'Draft saved. Open Preview draft to review.');render();
 }catch(error){status(error.message,true);}finally{busy=false;byId('save').disabled=byId('publish').disabled=false;}
}
byId('save').onclick=()=>save(false);byId('publish').onclick=()=>save(true);
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(!config)return;tab=b.dataset.tab;render();});
byId('preview').onclick=()=>{if(dirty)status('Preview shows the last saved draft. Save draft to include your latest edits.');};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
(async()=>{try{const response=await fetch('/api/admin/config');const data=await response.json();if(!response.ok)throw new Error(data.error);config=data.draft;version=data.version;previous=data.previous;byId('owner').textContent='Owner · '+data.ownerEmail;status('Ready. Changes stay in draft until you publish.');render();}catch(error){status(error.message,true);byId('save').disabled=byId('publish').disabled=true;}})();
