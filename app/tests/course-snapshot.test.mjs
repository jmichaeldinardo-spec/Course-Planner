import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readCompleteCourse,makeCourseExport} from '../course-snapshot.js';
import {makeAccountBackup} from '../backup.js';

const id=n=>'70000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(count=1201){
 const course={id:id(1),owner_id:id(2),name:'Fictional complete-read acceptance',revision:1,updated_at:'2026-10-28T00:00:00Z'};
 const units=Array.from({length:200},(_,i)=>({id:id(10+i),course_id:course.id,title:'Unit '+i,position:200-i,revision:1,essential_questions:'¿Por qué? '+i,...(i===2?{archived_at:'2026-10-28T00:00:00Z'}:{})}));
 const lessons=Array.from({length:count},(_,i)=>({id:id(1000+i),course_id:course.id,unit_id:units[i%200].id,title:'Lesson '+i,position:count-i,revision:1,objective:'Fictional café objective '+i,scheduled_dates:['2026-10-28'],duration_days:1,planning_status:'Draft',...(i===1000?{archived_at:'2026-10-28T00:00:00Z'}:{})}));
 const events=Array.from({length:601},(_,i)=>({id:id(5000+i),course_id:course.id,title:'Event '+i,date:'2026-10-28',effect:'Continue Lesson',event_type:'Assembly',revision:1}));
 return {courses:[course],units,lessons,calendar_exceptions:events};
}
function clientFor(db,hook=()=>{}){
 const requests=[];let activeUser=db.courses[0].owner_id;
 const client={requests,db,setUser(id){activeUser=id;},auth:{async getUser(){return {data:{user:{id:activeUser}},error:null};}},from(table){
  let columns='*',options={},filters=[],bounds=null,sort=null;
  const q={select(c='*',o={}){columns=c;options=o;return q;},eq(k,v){filters.push([k,v]);return q;},order(k){sort=k;return q;},range(a,b){bounds=[a,b];return q;},async single(){const r=await run();return {...r,data:r.data?.[0]||null};},then(a,b){return run().then(a,b);}};
  async function run(){
   const request={table,columns,filters,bounds};requests.push(request);
   const override=await hook(request,db,client);if(override)return override;
   let rows=db[table].filter(row=>filters.every(([k,v])=>row[k]===v));
   rows=rows.filter(row=>table==='courses'?row.owner_id===activeUser:db.courses.some(c=>c.id===row.course_id&&c.owner_id===activeUser));
   if(sort)rows.sort((a,b)=>a[sort]<b[sort]?-1:a[sort]>b[sort]?1:0);
   const count=rows.length;rows=rows.slice(...(bounds?[bounds[0],bounds[1]+1]:[0,1000]));
   return {data:structuredClone(rows.map(row=>columns==='*'?row:Object.fromEntries(columns.split(',').map(k=>[k,row[k]])))),error:null,...(options.count==='exact'?{count}:{})};
  }return q;
 }};return client;
}
for(const size of [1001,1201,2000])test('complete editor/export and ZIP retain '+size+' lessons, 200 units, 601 events including archives',async()=>{
 const db=fixture(size),client=clientFor(db),user={id:db.courses[0].owner_id};
 const records=await readCompleteCourse(client,user,db.courses[0].id);
 assert.equal(records.units.length,200);assert.equal(records.lessons.length,size);assert.equal(records.exceptions.length,601);
 assert.equal(records.units[0].position,1);assert.equal(records.lessons[0].position,1);
 const {json,text}=await makeCourseExport(client,user,db.courses[0].id);
 const restored=JSON.parse(text);assert.deepEqual(restored,json);
 for(const [key,source] of [['units',db.units],['lessons',db.lessons],['calendarExceptions',db.calendar_exceptions]]){
  assert.equal(new Set(json[key].map(r=>r.id)).size,source.length);
  assert.deepEqual([...json[key]].sort((a,b)=>a.id.localeCompare(b.id)),source);
 }
 assert.deepEqual(json.course,db.courses[0]);
 const {manifest,bytes}=await makeAccountBackup(client,user,()=>{},webcrypto.subtle);
 assert.deepEqual(manifest.courses[0].counts,{units:200,lessons:size,calendarExceptions:601});
 assert.ok(Buffer.from(bytes).includes(Buffer.from('Fictional caf')));assert.equal(manifest.courses[0].sha256.length,64);
 assert.ok(client.requests.filter(r=>r.table==='units'&&r.bounds?.[0]===100).length>=2);
 assert.ok(client.requests.some(r=>r.table==='lessons'&&r.bounds?.[0]===1000));
});
test('missing counts, short pages, duplicate IDs and incorrect page order fail closed',async()=>{
 for(const response of [{data:[],error:null},{data:[],error:null,count:1201},{data:[{id:'z',course_id:id(1),revision:1},{id:'z',course_id:id(1),revision:1}],error:null,count:2},{data:[{id:'z',course_id:id(1),revision:1},{id:'a',course_id:id(1),revision:1}],error:null,count:2}]){
  const db=fixture(),client=clientFor(db,r=>r.table==='lessons'?response:null);
  await assert.rejects(makeCourseExport(client,{id:id(2)},id(1)),/count|page|duplicate|out-of-order/);
 }
});
test('every child-table page failure aborts without accepting a partial snapshot',async()=>{
 for(const [table,start] of [['units',100],['lessons',1000],['calendar_exceptions',500]]){
  const db=fixture(),client=clientFor(db,r=>r.table===table&&r.bounds?.[0]===start?{data:null,count:null,error:{message:'page failure'}}:null);
  await assert.rejects(makeCourseExport(client,{id:id(2)},id(1)),/page failure/);
 }
});
test('configured pilot bounds reject excess units, lessons and events',async()=>{
 for(const [table,max] of [['units',200],['lessons',2000],['calendar_exceptions',1000]]){
  const db=fixture();db[table]=Array.from({length:max+1},(_,i)=>({...db[table][0],id:id(10000+i)}));
  await assert.rejects(readCompleteCourse(clientFor(db),{id:id(2)},id(1)),/pilot limit/);
 }
});
test('foreign ownership, wrong course rows and orphan lessons are rejected',async()=>{
 const db=fixture();await assert.rejects(readCompleteCourse(clientFor(db),{id:'other'},id(1)),/access/);
 db.lessons[0].unit_id='foreign-unit';await assert.rejects(readCompleteCourse(clientFor(db),{id:id(2)},id(1)),/relationships/);
 const mixed=clientFor(fixture(),r=>r.table==='units'?{data:[{id:'foreign',course_id:'other',revision:1}],count:1,error:null}:null);
 await assert.rejects(readCompleteCourse(mixed,{id:id(2)},id(1)),/Invalid/);
});
test('revision edits, inserts, deletes and course edits during verification abort',async()=>{
 for(const mutation of [db=>db.lessons[0].revision++,db=>db.lessons.push({...db.lessons[0],id:id(4000)}),db=>db.lessons.pop(),db=>db.courses[0].revision++]){
  let changed=false;const db=fixture(),client=clientFor(db,r=>{if(!changed&&r.table==='lessons'&&r.columns!=='*'){changed=true;mutation(db);}});
  await assert.rejects(makeCourseExport(client,{id:id(2)},id(1)),/changed/);
 }
});
test('changed counts between pages and missing revisions abort',async()=>{
 const db=fixture();let changed=false;
 const client=clientFor(db,r=>{if(!changed&&r.table==='lessons'&&r.bounds?.[0]===100){changed=true;db.lessons.pop();}});
 await assert.rejects(readCompleteCourse(client,{id:id(2)},id(1)),/changed/);
 const invalid=fixture();delete invalid.units[0].revision;await assert.rejects(readCompleteCourse(clientFor(invalid),{id:id(2)},id(1)),/Invalid/);
});
test('interrupted read or account switch cannot complete an export',async()=>{
 let current=true;const db=fixture(),client=clientFor(db,r=>{if(r.table==='lessons'&&r.bounds?.[0]===100)current=false;});
 await assert.rejects(makeCourseExport(client,{id:id(2)},id(1),{isCurrent:()=>current}),/canceled/);
 const changed=clientFor(fixture());let calls=0;changed.auth.getUser=async()=>({data:{user:{id:++calls===1?id(2):'other'}}});
 await assert.rejects(makeCourseExport(changed,{id:id(2)},id(1)),/Authentication changed/);
});
test('oversized UTF-8 export is refused instead of producing an unrestorable file',async()=>{
 const db=fixture(1);db.courses[0].notes='é'.repeat(3100000);
 await assert.rejects(makeCourseExport(clientFor(db),{id:id(2)},id(1)),/6 MB/);
});
