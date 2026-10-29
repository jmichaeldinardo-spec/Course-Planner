import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceState} from '../workspace-state.js';
import {createWorkspaceNavigation} from '../workspace-navigation.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(){
 const state=createWorkspaceState();state.setAccount('owner');
 const course=id=>({course:{id,owner_id:'owner'},units:[{id:'unit-'+id,course_id:id,revision:1,title:'Unit'}],lessons:[{id:'lesson-'+id,course_id:id,unit_id:'unit-'+id,revision:2,title:'Saved',objective:'Before'}],exceptions:[]});
 for(const id of ['a','b'])state.publish(state.beginRead(id),course(id));
 const ref=state.reference('a','lessons','lesson-a');
 return {state,ref};
}
const acknowledge=(state,ref,patch={objective:'Submitted'})=>state.save(ref,patch,()=>({data:{id:ref.recordId||'created',revision:ref.recordId?state.record(ref).revision+1:1}}));

test('manual lifecycle retains immutable acknowledgement and busy guards until readback finishes',async()=>{
 const {state,ref}=setup(),read=deferred();state.edit(ref,{objective:'  Submitted  '});
 assert.equal(state.summary().phase,'dirty');
 const result=await acknowledge(state,ref);assert.equal(state.summary().phase,'verifying');
 assert.equal(state.operation(ref).phase,'acknowledged');assert.equal(state.isSaving(),true);
 assert.equal(result.receipt.raw.objective,'  Submitted  ');assert.ok(Object.isFrozen(result.receipt.patch));
 const verification=state.verify(result.receipt,()=>read.promise);
 const nav=createWorkspaceNavigation({hasDraft:()=>false,isSaving:state.isSaving,discard:()=>assert.fail(),confirmDiscard:()=>assert.fail()});
 assert.equal(nav.transition({kind:'replace',courseId:'a'}).reason,'saving');
 assert.equal(nav.transition({kind:'home',courseId:'a'}).ok,true);
 assert.equal(state.discardRecord(ref),false);assert.equal(state.discard('a'),false);
 await assert.rejects(state.save(ref,{},()=>assert.fail()),/Wait/);
 read.resolve(state.snapshot('a'));assert.equal((await verification).newerEdits,false);
 assert.equal(state.summary().phase,'verified');assert.equal(state.isSaving(),false);assert.equal(state.hasUnresolved(),false);
});

test('typing during verification remains raw, dirty, and based on acknowledged revision',async()=>{
 const {state,ref}=setup(),read=deferred();state.edit(ref,{objective:'Submitted'});
 const result=await acknowledge(state,ref),confirmed=state.snapshot('a');
 const verification=state.verify(result.receipt,()=>read.promise);state.edit(ref,{objective:'  Later café text  '});
 assert.equal(state.publish(state.beginRead('a'),confirmed),false);
 read.resolve(confirmed);assert.equal((await verification).newerEdits,true);
 assert.equal(state.summary().phase,'dirty');assert.equal(state.draft(ref).values.objective,'  Later café text  ');
 assert.equal(state.draft(ref).baseRevision,3);assert.equal(state.record(ref).objective,'Submitted');
 const next=await state.save(ref,{objective:'Later café text'},({record})=>{assert.equal(record.revision,3);return {data:{id:record.id,revision:4}};});
 await state.verify(next.receipt,()=>state.snapshot('a'));assert.equal(state.summary().phase,'verified');
});

for(const table of ['units','lessons'])test('acknowledged '+table+' create survives failed verification; retry reads only',async()=>{
 const {state}=setup(),ref=state.reference('a',table),patch={course_id:'a',title:'Created',...(table==='lessons'?{unit_id:'unit-a'}:{})};let writes=0,reads=0;
 state.edit(ref,{title:'Created'});const result=await state.save(ref,patch,()=>{writes++;return {data:{id:'created',revision:1}};});
 await assert.rejects(state.verify(result.receipt,()=>{reads++;throw Error('Read unavailable');}),/Read unavailable/);
 assert.equal(state.operation(result.ref).phase,'unconfirmed');assert.equal(state.isSaving(),false);assert.equal(state.hasUnresolved(),true);
 assert.equal(state.operation(ref).ref.recordId,'created');assert.equal(state.record(result.ref).title,'Created');
 await assert.rejects(state.save(result.ref,patch,()=>{writes++;}),/Verify/);
 state.edit(result.ref,{title:'Newer while unconfirmed'});
 const retry=state.summary().retry;assert.equal(retry.id,result.receipt.id);
 const checked=await state.verify(retry,()=>{reads++;return state.snapshot('a');});
 assert.equal(checked.newerEdits,true);assert.equal(writes,1);assert.equal(reads,2);
 assert.equal(state.draft(result.ref).values.title,'Newer while unconfirmed');
});

for(const kind of ['throw','transport-error','malformed-ack'])test('commit-success/response-loss '+kind+' blocks uncertain create resubmission',async()=>{
 const {state}=setup(),ref=state.reference('a','lessons');state.edit(ref,{title:'  Keep raw  '});let inserted=0;
 await assert.rejects(state.save(ref,{title:'Keep raw'},()=>{inserted++;if(kind==='throw')throw Error('Response lost');return kind==='transport-error'?{status:0,error:{message:'Failed to fetch'}}:{data:{id:'committed',revision:null}};}));
 assert.equal(state.summary().phase,'unknown');assert.equal(state.draft(ref).values.title,'  Keep raw  ');
 state.edit(ref,{title:'Changed after uncertain write'});
 await assert.rejects(state.save(ref,{title:'Changed'},()=>{inserted++;}),/outcome unknown/);
 assert.equal(inserted,1);assert.equal(state.summary().retry,null);
 state.discardRecord(ref);assert.equal(state.summary().phase,'idle');
 state.edit(ref,{title:'Returned via history'});
 await assert.rejects(state.save(ref,{},()=>{inserted++;}),/outcome unknown/);assert.equal(inserted,1);assert.equal(state.summary().phase,'unknown');
});

test('known rejection and conflict retain base/text and remain distinct from unknown outcomes',async()=>{
 for(const conflict of [false,true]){
  const {state,ref}=setup();state.edit(ref,{objective:'  Retained  '});
  await assert.rejects(state.save(ref,{objective:'Retained'},()=>conflict?{data:null}:{error:{code:'42501',message:'Denied'}}));
  assert.equal(state.summary().phase,conflict?'conflict':'rejected');assert.equal(state.draft(ref).baseRevision,2);
  assert.equal(state.draft(ref).values.objective,'  Retained  ');assert.equal(state.summary().retry,null);
  if(!conflict){const result=await acknowledge(state,ref,{objective:'Retained'});await state.verify(result.receipt,()=>state.snapshot('a'));assert.equal(state.summary().phase,'verified');}
 }
});

test('aggregate status includes inactive course drafts and unconfirmed operations',async()=>{
 const {state,ref}=setup(),other=state.reference('b','lessons','lesson-b');state.edit(other,{objective:'Inactive'});state.edit(ref,{objective:'Submitted'});
 const result=await acknowledge(state,ref);await state.verify(result.receipt,()=>state.snapshot('a'));assert.equal(state.summary().phase,'dirty');assert.equal(state.summary().dirtyCount,1);
 const second=await acknowledge(state,other);await assert.rejects(state.verify(second.receipt,()=>Promise.reject(Error('Offline'))));
 state.edit(ref,{objective:'More'});assert.equal(state.summary().phase,'unconfirmed');assert.equal(state.summary().unresolvedCount,1);
 state.discardRecord(other);assert.equal(state.summary().phase,'dirty');
});

for(const fail of [false,true])test('old-session verification '+(fail?'failure':'success')+' cannot publish or release a same-account new operation',async()=>{
 const {state,ref}=setup(),old=deferred();state.edit(ref,{objective:'Old'});const result=await acknowledge(state,ref),snapshot=state.snapshot('a');
 const verification=state.verify(result.receipt,()=>old.promise);
 state.setAccount(null);state.setAccount('owner');state.publish(state.beginRead('a'),snapshot);
 const fresh=state.reference('a','lessons','lesson-a');state.edit(fresh,{objective:'New session'});
 const wait=deferred(),writing=state.save(fresh,{objective:'New session'},()=>wait.promise);
 if(fail)old.reject(Error('Old failure'));else old.resolve(snapshot);
 assert.deepEqual(await verification,{current:false});assert.equal(state.isSaving(),true);assert.equal(state.summary().phase,'writing');assert.equal(state.draft(fresh).values.objective,'New session');
 wait.resolve({data:{id:'lesson-a',revision:4}});const newResult=await writing;await state.verify(newResult.receipt,()=>state.snapshot('a'));
 assert.equal(state.summary().phase,'verified');assert.equal(state.operation(fresh).error,null);
});

test('verification mismatch stays unconfirmed and an obsolete receipt cannot verify a newer operation',async()=>{
 const {state,ref}=setup();state.edit(ref,{objective:'Submitted'});const first=await acknowledge(state,ref);
 const mismatch=structuredClone(state.snapshot('a'));mismatch.lessons[0].revision++;
 await assert.rejects(state.verify(first.receipt,()=>mismatch),/could not be verified/);
 assert.equal(state.summary().phase,'unconfirmed');assert.equal(state.record(ref).revision,3);
 await state.verify(state.summary().retry,()=>state.snapshot('a'));
 state.edit(ref,{objective:'Next'});const next=await acknowledge(state,ref,{objective:'Next'});
 assert.deepEqual(await state.verify(first.receipt,()=>assert.fail()),{current:false});assert.equal(state.isSaving(),true);
 await state.verify(next.receipt,()=>state.snapshot('a'));assert.equal(state.record(ref).objective,'Next');
});

test('unknown existing update requires explicit discard and fresh read before another write',async()=>{
 const {state,ref}=setup();state.edit(ref,{objective:'Unknown'});await assert.rejects(state.save(ref,{objective:'Unknown'},()=>Promise.reject(Error('Timeout'))));
 await assert.rejects(state.save(ref,{},()=>assert.fail()),/unknown/);
 state.discardRecord(ref);const fresh=structuredClone(state.snapshot('a'));fresh.lessons[0].revision=3;fresh.lessons[0].objective='Unknown';
 assert.equal(state.publish(state.beginRead('a'),fresh),true);state.edit(ref,{objective:'Next'});
 const next=await acknowledge(state,ref,{objective:'Next'});await state.verify(next.receipt,()=>state.snapshot('a'));assert.equal(state.record(ref).revision,4);
});
