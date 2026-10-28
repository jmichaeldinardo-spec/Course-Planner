// Synthetic harness safety checks only. These never establish hosted acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {backend,permitted,target,canonical,fingerprint,validateSnapshots,validateExport,hash,counts,loginRequest} from './safety.mjs';
import {unzip,validateZip} from './zip.mjs';
import {zipEntries} from '../../backup.js';
const origin='https://course-planner-app-git-test-course-planner.vercel.app';
const sha='a'.repeat(40),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const snapshots=Array.from({length:4},(_,i)=>({course:{id:id(i+1),owner_id:id(100),name:'Fictional '+i,revision:1},units:[{id:id(10+i),course_id:id(i+1),revision:1}],lessons:[{id:id(20+i),course_id:id(i+1),unit_id:id(10+i),objective:'Original',revision:1}],exceptions:[]}));
const fixture={accountId:id(100),courses:snapshots.map(s=>({id:s.course.id,counts:counts(s)}))};
const exported=s=>({schema:'course-planner.pilot-export.v1',exportedAt:'2026-10-28',...s,calendarExceptions:s.exceptions});
function archive(){
 const files=snapshots.map(s=>({name:`course-planner-${s.course.id}.json`,data:Buffer.from(JSON.stringify(exported(s)))}));
 const manifest={schema:'course-planner.account-backup-manifest.v1',courseCount:4,courses:snapshots.map((s,i)=>({courseId:s.course.id,courseName:s.course.name,filename:files[i].name,sha256:hash(files[i].data),counts:{units:1,lessons:1,calendarExceptions:0}}))};
 files.push({name:'backup-manifest.json',data:Buffer.from(JSON.stringify(manifest))});return files;
}
test('preview and immutable commit required; reject production, localhost and callback tokens',()=>{
 assert.equal(target(origin+'/',sha),origin+'/');
 for(const url of ['http://localhost/','https://course-planner-app.vercel.app/',origin+'/?token=secret',origin+'/#access_token=secret','https://user:pass@'+new URL(origin).hostname+'/'])assert.throws(()=>target(url,sha));
 assert.throws(()=>target(origin+'/','HEAD'));
});
test('all saved-table writes, RPCs, logout, OTP and arbitrary hosts fail closed',()=>{
 for(const setup of [false,true]){
  for(const table of ['courses','units','lessons','calendar_exceptions'])for(const method of ['POST','PATCH','PUT','DELETE'])assert.equal(permitted(backend+'/rest/v1/'+table,method,{origin,setup}),false);
  for(const method of ['GET','POST'])assert.equal(permitted(backend+'/rest/v1/rpc/restore_course_export',method,{origin,setup}),false);
  for(const path of ['/auth/v1/logout','/auth/v1/admin/users'])assert.equal(permitted(backend+path,'POST',{origin,setup}),false);
 }
 assert.equal(permitted(backend+'/auth/v1/otp','POST',{origin}),false);
 assert.equal(permitted(backend+'/auth/v1/otp','POST',{origin,setup:true}),true);
 assert.equal(permitted(backend+'/auth/v1/otp','POST',{origin,setup:true,otpUsed:true}),false);
 assert.equal(permitted('https://unrelated.example/','GET',{origin}),false);
 assert.equal(permitted(origin+'/','POST',{origin}),false);
});
test('only real read paths, SDK and refresh-token flow are allowed in test mode',()=>{
 for(const table of ['courses','units','lessons','calendar_exceptions'])assert.equal(permitted(backend+'/rest/v1/'+table,'GET',{origin}),true);
 assert.equal(permitted(backend+'/auth/v1/user','GET',{origin}),true);
 assert.equal(permitted(backend+'/auth/v1/token?grant_type=refresh_token','POST',{origin}),true);
 assert.equal(permitted(backend+'/auth/v1/token?grant_type=password','POST',{origin}),false);
 assert.equal(permitted('https://esm.sh/@supabase/supabase-js@2.57.0','GET',{origin}),true);
});
test('allowlist, counts, owners and relational failures abort',()=>{
 validateSnapshots(snapshots,fixture);
 for(const change of [s=>s.pop(),s=>s[0].lessons[0].unit_id=id(999),s=>s[0].course.owner_id=id(999),s=>s[0].lessons.push({...s[0].lessons[0]}),s=>s[0].course.id=id(999)]){const copy=structuredClone(snapshots);change(copy);assert.throws(()=>validateSnapshots(copy,fixture));}
});
test('full-record fingerprint detects content changes even without changed revisions',()=>{
 const copy=structuredClone(snapshots);copy.reverse();assert.equal(fingerprint(copy),fingerprint(snapshots));
 copy[0].lessons[0].objective='Changed without revision';assert.notEqual(fingerprint(copy),fingerprint(snapshots));
 assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));
});
test('JSON comparison includes all saved fields and rejects missing children',()=>{
 validateExport(exported(snapshots[0]),snapshots[0]);const copy=exported(structuredClone(snapshots[0]));copy.lessons=[];assert.throws(()=>validateExport(copy,snapshots[0]));
});
test('independent ZIP validation checks directory, CRC, hashes and every record',()=>{
 const files=archive(),bytes=Buffer.from(zipEntries(files));assert.equal(validateZip(bytes,snapshots).files,5);
 const corrupt=Buffer.from(bytes);corrupt[100]^=1;assert.throws(()=>unzip(corrupt));
 assert.throws(()=>unzip(bytes.subarray(0,bytes.length-1)));
 const badManifest=archive();const m=JSON.parse(badManifest[4].data);m.courses[0].sha256='0'.repeat(64);badManifest[4].data=Buffer.from(JSON.stringify(m));assert.throws(()=>validateZip(Buffer.from(zipEntries(badManifest)),snapshots));
 const duplicate=archive();duplicate[1].name=duplicate[0].name;assert.throws(()=>unzip(Buffer.from(zipEntries(duplicate))));
 const traversal=archive();traversal[0].name='../escape.json';assert.throws(()=>unzip(Buffer.from(zipEntries(traversal))));
 const wrongRecord=archive();const e=JSON.parse(wrongRecord[0].data);e.lessons[0].objective='Altered';wrongRecord[0].data=Buffer.from(JSON.stringify(e));const manifest=JSON.parse(wrongRecord[4].data);manifest.courses[0].sha256=hash(wrongRecord[0].data);wrongRecord[4].data=Buffer.from(JSON.stringify(manifest));assert.throws(()=>validateZip(Buffer.from(zipEntries(wrongRecord)),snapshots));
});

test('one-time manual OTP stays on expected existing account and cannot create an Auth user',()=>{
 const body=loginRequest({email:'Fictional@example.test',create_user:true},'fictional@example.test');assert.equal(body.create_user,false);
 assert.throws(()=>loginRequest({email:'someone-else@example.test'},'fictional@example.test'));assert.throws(()=>loginRequest({phone:'123'},'fictional@example.test'));
});
