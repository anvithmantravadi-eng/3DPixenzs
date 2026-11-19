import http from 'node:http';
import {readFile} from 'node:fs/promises';
import worker from '../dist/server/index.js';
// Local preview simulates the platform's verified owner identity. Hosted access is handled by Sites.
const owner='preview-owner@example.test';
const objects=new Map();let serial=0;
const bucket={
 async list({prefix='',cursor,limit=1000}={}){const keys=[...objects.keys()].filter(k=>k.startsWith(prefix)).sort();const start=cursor?Number(cursor):0;return {objects:keys.slice(start,start+limit).map(key=>({key})),truncated:start+limit<keys.length,cursor:String(start+limit)};},
 async get(key){const item=objects.get(key);return item?{etag:item.etag,json:async()=>JSON.parse(item.value),body:item.value,httpMetadata:item.httpMetadata}:null;},
 async put(key,value,options={}){const old=objects.get(key);const condition=options.onlyIf;if(condition?.get('If-Match')&&condition.get('If-Match')!=='"'+old?.etag+'"')return null;if(condition?.get('If-None-Match')==='*'&&old)return null;const etag=String(++serial);objects.set(key,{value,etag,httpMetadata:options.httpMetadata});return {etag};}
};
const server=http.createServer(async(req,res)=>{
 try{
  const origin='http://'+req.headers.host;
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers=new Headers(req.headers);
  headers.set('oai-authenticated-user-id','local-preview-owner');headers.set('oai-authenticated-user-email',owner);
  const request=new Request(origin+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{ADMIN_EMAIL:owner,BUCKET:bucket,MAIL_PREVIEW:'true'});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){res.writeHead(500);res.end('Preview error: '+error.message);}
});
server.listen(Number(process.env.PORT||4173),'0.0.0.0',()=>console.log('Local worker preview is ready.'));
