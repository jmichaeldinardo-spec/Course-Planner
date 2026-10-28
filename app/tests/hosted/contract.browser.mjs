/* Local synthetic selector/cleanup contract test. NO hosted acceptance, credentials,
 * Supabase traffic or auth state. Kept separate from the hosted entry point. */
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {extname} from 'node:path';
import assert from 'node:assert/strict';
import {app,launch,defaultSha} from './runtime.mjs';
import {readonlyJourney,draftJourney} from './journeys.mjs';
import {fingerprint} from './safety.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const snapshots=Array.from({length:4},(_,i)=>({course:{id:id(i+1),owner_id:id(100),name:i===0?'Fictional Government':'Fictional Course '+i,revision:1,first_day:'2026-09-01',last_day:'2027-06-30',timezone:'America/New_York',teaching_weekdays:[1,2,3,4,5]},units:i===3?[]:[{id:id(10+i),course_id:id(i+1),title:'Fictional Unit '+i,position:1,revision:1}],lessons:i===3?[]:[{id:id(20+i),course_id:id(i+1),unit_id:id(10+i),title:'Fictional Lesson '+i,position:1,objective:'Original fictional objective '+i,planning_status:'Draft',duration_days:1,scheduled_dates:['2026-09-01'],revision:1}],exceptions:[]}));
const server=createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(!/^\/(?:[^/]+\.(?:js|css|html)|assets\/[\w./-]+\.(?:js|css|svg))$/.test(path)||path.includes('..'))throw Error('path');
 res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'}[extname(path)]});res.end(execFileSync('git',['show',defaultSha+':app'+path],{cwd:app}));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await launch();const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});const origin=`http://127.0.0.1:${server.address().port}`;
 await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();if(url.startsWith('https://esm.sh/'))return route.fulfill({contentType:'text/javascript',body:'export const createClient=()=>window.syntheticClient;'});return route.abort();});
 await context.addInitScript(snapshots=>{
  const db={courses:snapshots.map(s=>s.course),units:snapshots.flatMap(s=>s.units),lessons:snapshots.flatMap(s=>s.lessons),calendar_exceptions:snapshots.flatMap(s=>s.exceptions)};window.syntheticDb=db;window.syntheticWrites=0;
  const user={id:db.courses[0].owner_id,email:'fictional@example.test'};
  window.syntheticClient={auth:{async getSession(){return {data:{session:{user}}};},async getUser(){return {data:{user}};},onAuthStateChange(){}},from(table){
   let columns='*',bounds=null,exact=false;const filters=[],orders=[];
   const chain={select(c='*',o={}){columns=c;exact=o.count==='exact';return chain;},eq(k,v){filters.push(r=>r[k]===v);return chain;},order(k){orders.push(k);return chain;},range(a,b){bounds=[a,b];return chain;},async single(){const r=await run();return {...r,data:r.data[0]};},then(a,b){return run().then(a,b);},insert(){window.syntheticWrites++;throw Error('Forbidden synthetic write');},update(){window.syntheticWrites++;throw Error('Forbidden synthetic write');},delete(){window.syntheticWrites++;throw Error('Forbidden synthetic write');}};
   async function run(){let rows=db[table].filter(r=>filters.every(f=>f(r)));const count=rows.length;for(const key of orders.reverse())rows.sort((a,b)=>String(a[key]).localeCompare(String(b[key])));if(bounds)rows=rows.slice(bounds[0],bounds[1]+1);return {data:structuredClone(rows.map(r=>columns==='*'?r:Object.fromEntries(columns.split(',').map(k=>[k,r[k]])))),error:null,...(exact?{count}:{})};}return chain;
  },rpc(){window.syntheticWrites++;throw Error('Forbidden synthetic RPC');}};
 },snapshots);
 const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/index.html');await page.locator('#saved-courses [data-private-open]').nth(3).waitFor();
 let steps=0;const step=async(name,action)=>{console.log('LOCAL '+name);await action();steps++;};
 await readonlyJourney(page,snapshots,step);
 await draftJourney(page,snapshots,{governmentCourseId:id(1),governmentLessonId:id(20)},step);
 const after=await page.evaluate(()=>({snapshots:window.syntheticDb.courses.map(course=>({course,units:window.syntheticDb.units.filter(u=>u.course_id===course.id),lessons:window.syntheticDb.lessons.filter(l=>l.course_id===course.id),exceptions:window.syntheticDb.calendar_exceptions.filter(e=>e.course_id===course.id)})),writes:window.syntheticWrites}));
 assert.equal(fingerprint(after.snapshots),fingerprint(snapshots));assert.equal(after.writes,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({kind:'local-synthetic-ui-contract',hostedAcceptance:false,sourceSha:defaultSha,status:'PASS',steps,writes:after.writes}));await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}
