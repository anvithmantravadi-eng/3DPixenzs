import { validateConfig, upgradeConfig } from './config.mjs';
import { handleOperations } from './operations.mjs';
const configKey='store/configuration.json';
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
const json=(data,status=200)=>Response.json(data,{status,headers:{...headers,'Cache-Control':'no-store'}});
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isAdmin(request,env) {
  return Boolean(env.ADMIN_EMAIL && request.headers.get('oai-authenticated-user-id') &&
    request.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.ADMIN_EMAIL.toLowerCase());
}
async function readState(env,defaults) {
  const object=await env.BUCKET.get(configKey);
  if (!object) return {record:{draft:defaults,published:defaults,previous:null,spinnerVisibilityUpdated:true},etag:null};
  const record=await object.json();
  const newDraft=record.draft.schemaVersion<3,newPublished=record.published.schemaVersion<3;
  record.draft=upgradeConfig(record.draft);
  record.published=upgradeConfig(record.published);
  if(newDraft)record.draft.policies=structuredClone(defaults.policies);
  if(newPublished)record.published.policies=structuredClone(defaults.policies);
  if (record.previous) record.previous=upgradeConfig(record.previous);
  for(const configuration of [record.draft,record.published,record.previous].filter(Boolean)){
    if (configuration.supportEmail?.toLowerCase() === 'anvith.mantravadi@gmail.com') configuration.supportEmail = defaults.supportEmail;
    if(['TACTELYX','Tactelyx'].includes(configuration.brand))configuration.brand='3dPixenzs';
    for(const policy of Object.values(configuration.policies||{}))policy.text=policy.text.replaceAll('TACTELYX','3dPixenzs').replaceAll('Tactelyx','3dPixenzs');
  }
  if (!record.spinnerVisibilityUpdated) {
    for (const configuration of [record.draft, record.published, record.previous].filter(Boolean)) {
      for (const product of configuration.products) {
        if (product.id === 'top' || product.id === 'spiral') product.enabled = false;
      }
    }
    record.spinnerVisibilityUpdated = true;
  }
  return {record,etag:object.etag};
}
export function createWorker(assets,defaults) {
  return {async fetch(request,env) {
    try {
      const url=new URL(request.url);
      const path=url.pathname;
      const admin=isAdmin(request,env);
      if (path.startsWith('/api/admin/') || path==='/admin' || path==='/admin.html') {
        if (!admin) {
          if (path.startsWith('/api/')) return json({error:'Sign in with the site owner account.'},403);
          return new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Owner sign-in</title></head><body style="background:#111;color:#eee;font:18px Arial;padding:50px"><h1>Store owner access</h1><p>Sign in with the account that owns this site.</p><a style="color:#dcc46d" target="_top" href="/signin-with-chatgpt?return_to=%2Fadmin">Sign in with ChatGPT</a><p><a style="color:#ddd" href="/">Back to store</a></p></body></html>',{headers:{...headers,'Content-Type':'text/html','Cache-Control':'no-store'}});
        }
      }
      if (path.startsWith('/api/')) {
        const state=await readState(env,defaults);
        const handled=await handleOperations(request,env,state.record.published,admin,json);
        if(handled)return handled;
      }
      if (path==='/api/admin/config') {
        const state=await readState(env,defaults);
        if (request.method==='GET') return json({...state.record,version:state.etag,ownerEmail:request.headers.get('oai-authenticated-user-email')});
        if (request.method!=='PUT') return json({error:'Method not allowed.'},405);
        if (request.headers.get('Origin')!==url.origin) return json({error:'Request origin rejected.'},403);
        const raw=await request.text();
        if (raw.length>500000) return json({error:'Settings are too large.'},413);
        const body=JSON.parse(raw);
        if (body.version!==state.etag) return json({error:'Another edit was saved. Reload settings before saving.'},409);
        const config=validateConfig(body.config);
        const record={...state.record,draft:config};
        if (body.publish===true) {record.previous=state.record.published;record.published=config;}
        const onlyIf=new Headers();
        onlyIf.set(state.etag?'If-Match':'If-None-Match',state.etag?'"'+state.etag+'"':'*');
        const written=await env.BUCKET.put(configKey,JSON.stringify(record),{onlyIf,httpMetadata:{contentType:'application/json'}});
        if (!written) return json({error:'A concurrent edit was saved. Reload settings.'},409);
        return json({...record,version:written.etag});
      }
      if (path==='/api/admin/upload') {
        if (request.method!=='POST') return json({error:'Method not allowed.'},405);
        if (request.headers.get('Origin')!==url.origin) return json({error:'Request origin rejected.'},403);
        const declared=Number(request.headers.get('Content-Length'));
        if (declared>5*1024*1024) return json({error:'Image limit is 5 MB.'},413);
        const data=await request.arrayBuffer();
        if (data.byteLength>5*1024*1024) return json({error:'Image limit is 5 MB.'},413);
        const bytes=new Uint8Array(data);
        const type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':
          bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':
          new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'?'image/webp':null;
        if (!type) return json({error:'Upload a PNG, JPEG or WebP image.'},400);
        const key='media/'+crypto.randomUUID()+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type]);
        await env.BUCKET.put(key,data,{httpMetadata:{contentType:type}});
        return json({url:'/'+key});
      }
      if (path.startsWith('/media/')) {
        if (!/^\/media\/[a-zA-Z0-9._-]+$/.test(path)) return new Response('Not found',{status:404});
        const object=await env.BUCKET.get(path.slice(1));
        if (!object) return new Response('Not found',{status:404});
        return new Response(object.body,{headers:{...headers,'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public,max-age=31536000,immutable'}});
      }
      if (!['GET','HEAD'].includes(request.method)) return json({error:'Method not allowed.'},405);
      const assetPath=path==='/'?'/index.html':path==='/admin'?'/admin.html':path;
      const asset=assets[assetPath];
      if (!asset) return new Response('Not found',{status:404,headers});
      let content=asset.body;
      if (asset.type==='text/html') {
        const state=await readState(env,defaults);
        const config=url.searchParams.get('preview')==='draft'&&admin?state.record.draft:state.record.published;
        content = content.replace(/<a[^>]* data-nav-filter="([^"]+)"[^>]*>[^<]*<\/a>/g, (link, id) =>
          config.products.some(product => product.id === id && product.enabled) ? link : '');
        const safeJson=JSON.stringify(config).replace(/</g,'\\u003c');
        content=content.replace('</head>','<script>window.STORE_CONFIG='+safeJson+';</script></head>');
        content=content.replaceAll('3dPixenzs',escapeHtml(config.brand)).replaceAll('TACTELYX',escapeHtml(config.brand)).replaceAll('Tactelyx',escapeHtml(config.brand));
        content=content.replaceAll('9084154730',escapeHtml(config.phone)).replaceAll('(908) 415-4730',escapeHtml(config.phone));
        content=content.replaceAll('30 calendar days',config.shippingDays+' calendar days');
        content=content.replaceAll('anvith206@gmail.com',escapeHtml(config.supportEmail)).replaceAll('__ORDER_EMAIL__',escapeHtml(config.orderEmail));
        content=content.replaceAll('30 days of delivery',config.returnDays+' days of delivery');
        content=content.replaceAll('Spinning Tops and Spiral Spinners require a confirmed quote before payment until a price is listed.','All products are $4 each. Any 10 mixed pieces cost $30, with extra singles at $4 each.');
        content=content.replaceAll('Spinning Top and Spiral Spinner pricing is confirmed by text before payment until a price is listed.','All products are $4 each, or any 10 mixed pieces for $30. Extra singles cost $4 each.');
        if (['shipping','terms','payments'].includes(path.slice(1).replace('.html',''))) {
          const amount=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
          const summary=(config.shippingEnabled?'Shipping enabled. Free over '+amount(config.freeShippingOverCents)+' after discounts, otherwise '+amount(config.shippingCents)+'.':'No parcel shipping. Local handoff is arranged by confirmation.')+' Payment is cash on delivery. NJ sales tax of 6.625% is included in the order calculation. Buyers must be 18+; intended product age is 13+.';
          content=content.replace('<main class="wrap document">','<main class="wrap document"><p class="draft">'+escapeHtml(summary)+'</p>');
        }

        if (config.legalName) content=content.replaceAll('[legal business name]',escapeHtml(config.legalName));
        if (config.mailingAddress) content=content.replaceAll('[business mailing address]',escapeHtml(config.mailingAddress));
        const policyId=path.slice(1).replace('.html','');
        if (config.policies[policyId] && config.policies[policyId].text!==defaults.policies[policyId].text) {
          const policy=config.policies[policyId];
          content=content.replace(/<main[\s\S]*?<\/main>/,'<main class="wrap document"><p class="eyebrow">STORE POLICIES</p><h1>'+escapeHtml(policy.title)+'</h1><div style="white-space:pre-wrap">'+escapeHtml(policy.text)+'</div></main>');
        }
      }
      const responseHeaders={...headers,'Content-Type':asset.type+(asset.type.startsWith('text/')?'; charset=utf-8':''),'Cache-Control':asset.type==='text/html'?'no-store':'public,max-age=300'};
      if (asset.base64) {
        const binary=atob(content);const bytes=new Uint8Array(binary.length);
        for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
        return new Response(request.method==='HEAD'?null:bytes,{headers:responseHeaders});
      }
      return new Response(request.method==='HEAD'?null:content,{headers:responseHeaders});
    } catch (error) {
      if (error instanceof SyntaxError || /Invalid|Enter |Use |Settings |Keep |Product |price|too long|must|bundle|Choose|selected|checkout|discount|Limit|Collected cash|refund exceeds/i.test(error.message)) return json({error:error.message},400);
      console.error('Store request failed:',error.message);
      return json({error:'The store could not complete this request. Please try again.'},500);
    }
  }};
}
