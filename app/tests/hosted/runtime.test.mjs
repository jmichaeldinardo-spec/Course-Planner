// Local source-pinning contract; no browser, session or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {app,verifySource,defaultUrl,guard} from './runtime.mjs';
const testedSha=execFileSync('git',['rev-parse','HEAD'],{cwd:app,encoding:'utf8'}).trim();
test('source pin enumerates repository-root app files and verifies bytes without redirects',async()=>{
 let reads=0;const context={request:{async get(url,options){assert.equal(options.maxRedirects,0);assert.equal(new URL(url).origin,new URL(defaultUrl).origin);reads++;const path='app/'+new URL(url).pathname.slice(1);return {status:()=>200,body:async()=>execFileSync('git',['show',testedSha+':'+path],{cwd:app})};}}};
 assert.equal(await verifySource(context,{url:defaultUrl,sha:testedSha}),reads);assert.ok(reads>20);
});
test('protection response and changed source fail closed',async()=>{
 await assert.rejects(()=>verifySource({request:{get:async()=>({status:()=>401})}},{url:defaultUrl,sha:testedSha}),/DEPLOYMENT_ACCESS_BLOCKED/);
 await assert.rejects(()=>verifySource({request:{get:async()=>({status:()=>200,body:async()=>Buffer.from('different deployment')})}},{url:defaultUrl,sha:testedSha}),/DEPLOYMENT_SOURCE_MISMATCH/);
});

test('OIDC stays on the preview origin, refuses redirects and strips forwarded headers',async()=>{
 const previous=process.env.VERCEL_OIDC_TOKEN;process.env.VERCEL_OIDC_TOKEN='synthetic-test-token';
 try{
  let handler,continued,fetches=0,fulfilled=0,aborted=0;
  const context={route:async(_pattern,fn)=>{handler=fn;},routeWebSocket:async()=>{}};
  const blocked=await guard(context,{url:defaultUrl});
  const request=url=>({url:()=>url,method:()=> 'GET',headers:()=>({'x-vercel-trusted-oidc-idp-token':'synthetic-forwarded-token'})});
  await handler({request:()=>request('https://esm.sh/module'),continue:async opts=>{continued=opts;}});
  assert.equal(continued.headers['x-vercel-trusted-oidc-idp-token'],undefined);
  for(const status of [200,302])await handler({request:()=>request(defaultUrl),fetch:async opts=>{fetches++;assert.equal(opts.maxRedirects,0);assert.equal(opts.headers['x-vercel-trusted-oidc-idp-token'],'synthetic-test-token');return {status:()=>status};},fulfill:async()=>fulfilled++,abort:async()=>aborted++});
  assert.equal(fetches,2);assert.equal(fulfilled,1);assert.equal(aborted,1);assert.equal(blocked[0].category,'preview-redirect');
 }finally{if(previous===undefined)delete process.env.VERCEL_OIDC_TOKEN;else process.env.VERCEL_OIDC_TOKEN=previous;}
});
test('manual setup sends one expected-email OTP with signup disabled and all later OTPs blocked',async()=>{
 let handler,body,aborted=0;const context={route:async(_p,fn)=>{handler=fn;},routeWebSocket:async()=>{}};
 const blocked=await guard(context,{url:defaultUrl},{setup:true,expectedEmail:'fictional@example.test'});
 const route={request:()=>({url:()=> 'https://rlyrfbvxpmmfxdpzkyia.supabase.co/auth/v1/otp',method:()=> 'POST',headers:()=>({'content-length':'1'}),postDataJSON:()=>({email:'fictional@example.test',create_user:true})}),continue:async opts=>{body=JSON.parse(opts.postData);assert.equal(opts.headers['content-length'],undefined);},abort:async()=>aborted++};
 await handler(route);assert.equal(body.create_user,false);await handler(route);assert.equal(aborted,1);assert.equal(blocked.length,1);
});
