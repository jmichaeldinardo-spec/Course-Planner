import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceState} from '../workspace-state.js';
import {createWorkspaceNavigation} from '../workspace-navigation.js';
const fixture=()=>({course:{id:'course-a',owner_id:'owner-a',name:'Fictional'},units:[{id:'unit-a',course_id:'course-a',revision:3,title:'Unit'}],lessons:[{id:'lesson-a',course_id:'course-a',unit_id:'unit-a',revision:7,title:'Lesson',objective:'Saved',archived_at:'2026-01-01'}],exceptions:[]});
function setup(){const state=createWorkspaceState();state.setAccount('owner-a');state.publish(state.beginRead('course-a'),fixture());return {state,ref:state.reference('course-a','lessons','lesson-a')};}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('Stage A: two independent view references share one immutable canonical record and draft',()=>{
 const {state,ref}=setup(),second=state.reference('course-a','lessons','lesson-a');
 assert.notEqual(ref,second);assert.equal(state.record(ref),state.record(second));
 state.edit(ref,{objective:'Shared raw draft',title:'  Untrimmed  '});
 assert.equal(state.draft(ref),state.draft(second));assert.equal(state.editing(second).objective,'Shared raw draft');
 assert.equal(state.record(ref).objective,'Saved');assert.throws(()=>state.record(ref).title='Mutated',TypeError);
 assert.equal(state.editing(second).id,'lesson-a');assert.equal(state.snapshot('course-a').lessons.length,1);
});
test('Stage A: clean navigation is presentation-only; dirty cancellation changes neither destination nor draft',()=>{
 const {state,ref}=setup();let consent=false,applied=0;
 const nav=createWorkspaceNavigation({hasDraft:id=>state.hasDraft(id),isSaving:state.isSaving,discard:state.discard,confirmDiscard:()=>consent});
 const original=JSON.stringify(state.snapshot('course-a'));
 assert.equal(nav.transition({kind:'replace',courseId:'course-a',view:'sequence'},()=>applied++).ok,true);
 state.edit(ref,{objective:'Keep'});const previous=nav.destination();
 assert.deepEqual(nav.transition({kind:'replace',courseId:'course-a',view:'calendar'},()=>applied++),{ok:false,reason:'cancelled'});
 assert.equal(nav.destination(),previous);assert.equal(state.draft(ref).values.objective,'Keep');assert.equal(applied,1);
 consent=true;assert.equal(nav.transition({kind:'replace',courseId:'course-a',view:'calendar'}).ok,true);
 assert.equal(state.hasDraft(),false);assert.equal(JSON.stringify(state.snapshot('course-a')),original);
});
test('Stage A: Home and course navigation preserve independent course drafts and stable identities',()=>{
 const {state,ref}=setup(),next={...fixture(),course:{id:'course-b',owner_id:'owner-a'},units:[],lessons:[]};
 state.publish(state.beginRead('course-b'),next);state.edit(ref,{objective:'Course A only'});
 const other=state.reference('course-b','lessons',null);state.edit(other,{title:'Uncreated B'});
 const nav=createWorkspaceNavigation({hasDraft:state.hasDraft,isSaving:state.isSaving,discard:state.discard,confirmDiscard:()=>assert.fail('No discard prompt')});
 for(const kind of ['home','resume','course'])assert.equal(nav.transition({kind,courseId:'course-b'}).ok,true);
 assert.equal(state.draft(ref).values.objective,'Course A only');assert.equal(state.draft(other).values.title,'Uncreated B');
 assert.equal(state.snapshot('course-b').lessons.length,0);assert.equal(state.snapshot('course-a').lessons[0].id,'lesson-a');
});
test('Stage A: pending save blocks competing saves/navigation; newer edits survive and use acknowledged revision',async()=>{
 const {state,ref}=setup(),wait=deferred();state.edit(ref,{objective:'Submitted'});
 let revision;
 const save=state.save(ref,{objective:'Submitted'},input=>{revision=input.record.revision;return wait.promise;});
 assert.equal(revision,7);assert.equal(state.isSaving(),true);
 const nav=createWorkspaceNavigation({hasDraft:state.hasDraft,isSaving:state.isSaving,discard:state.discard,confirmDiscard:()=>assert.fail('Pending')});
 assert.deepEqual(nav.transition({kind:'replace',courseId:'course-a'}),{ok:false,reason:'saving'});
 assert.equal(nav.transition({kind:'home',courseId:'course-a'}).ok,true);
 await assert.rejects(state.save(ref,{},()=>assert.fail()),/Wait for the current save/);
 state.edit(ref,{objective:'Newer'});wait.resolve({data:{id:'lesson-a',revision:8},error:null});
 assert.equal((await save).newerEdits,true);assert.equal(state.record(ref).objective,'Submitted');assert.equal(state.draft(ref).values.objective,'Newer');
 const result=await state.save(ref,{objective:'Newer'},input=>{assert.equal(input.record.revision,8);return {data:{id:'lesson-a',revision:9},error:null};});
 assert.equal(result.newerEdits,false);assert.equal(state.hasDraft(),false);assert.equal(state.record(ref).objective,'Newer');assert.equal(state.record(ref).archived_at,'2026-01-01');
});
for(const outcome of ['failure','conflict','throw'])test('Stage A: '+outcome+' retains exact draft/base revision and permits manual retry',async()=>{
 const {state,ref}=setup();state.edit(ref,{objective:'  Keep exactly  '});
 await assert.rejects(state.save(ref,{objective:'Keep exactly'},()=>{
  if(outcome==='throw')throw Error('Offline');return outcome==='failure'?{error:{message:'Denied'}}:{data:null,error:null};
 }),/Denied|Save conflict|Offline/);
 assert.equal(state.draft(ref).values.objective,'  Keep exactly  ');assert.equal(state.draft(ref).baseRevision,7);assert.ok(state.draft(ref).error);
 assert.equal(state.isSaving(),false);assert.equal(state.record(ref).objective,'Saved');
});
test('Stage A: create acknowledgement remaps a newer draft to the assigned identity, never a second insert',async()=>{
 const {state}=setup(),ref=state.reference('course-a','lessons',null),wait=deferred();state.edit(ref,{title:'Created',unit_id:'unit-a'});
 const save=state.save(ref,{title:'Created',unit_id:'unit-a',course_id:'course-a'},()=>wait.promise);
 state.edit(ref,{title:'Typed while creating'});wait.resolve({data:{id:'new-stable-id',revision:1},error:null});const result=await save;
 assert.equal(state.draft(ref),null);assert.equal(result.ref.recordId,'new-stable-id');assert.equal(state.draft(result.ref).values.title,'Typed while creating');
 await state.save(result.ref,{title:'Typed while creating'},({record})=>{assert.equal(record.id,'new-stable-id');return {data:{id:record.id,revision:2},error:null};});
 assert.equal(state.snapshot('course-a').lessons.length,2);assert.equal(state.record(result.ref).unit_id,'unit-a');
});
for(const fail of [false,true])test('Stage A: late previous-account save '+(fail?'failure':'success')+' cannot publish or release a new pending save',async()=>{
 const {state,ref}=setup(),old=deferred(),newer=deferred();state.edit(ref,{title:'Old draft'});
 const oldSave=state.save(ref,{title:'Old submission'},()=>old.promise);
 state.setAccount('owner-b');assert.equal(state.snapshot('course-a'),null);assert.equal(state.hasDraft(),false);assert.equal(state.isSaving(),false);
 state.publish(state.beginRead('course-b'),{course:{id:'course-b',owner_id:'owner-b'},units:[],lessons:[{id:'lesson-b',revision:1}],exceptions:[]});
 const b=state.reference('course-b','lessons','lesson-b');state.edit(b,{title:'B draft'});const newSave=state.save(b,{title:'B submitted'},()=>newer.promise);
 if(fail)old.reject(Error('Late failure'));else old.resolve({data:{id:'lesson-a',revision:8},error:null});
 assert.deepEqual(await oldSave,{current:false});assert.equal(state.isSaving(),true);assert.equal(state.hasDraft('course-a'),false);
 newer.resolve({data:{id:'lesson-b',revision:2},error:null});assert.equal((await newSave).current,true);assert.equal(state.isSaving(),false);
});
test('Stage A: stale/account-mismatched reads and background reads over drafts never publish',()=>{
 const {state,ref}=setup(),first=state.beginRead('course-a'),second=state.beginRead('course-a');
 assert.equal(state.publish(first,fixture()),false);state.edit(ref,{title:'Keep'});assert.equal(state.publish(second,fixture()),false);
 state.discard('course-a');assert.equal(state.publish(second,fixture()),true);
 const old=state.beginRead('course-a');state.setAccount(null);state.setAccount('owner-a');assert.equal(state.publish(old,fixture()),false);
 assert.throws(()=>state.publish(state.beginRead('course-a'),{...fixture(),course:{id:'course-a',owner_id:'other'}}),/ownership/);
});
test('Stage A: canonical snapshots round-trip export shape without changing IDs, archives or relationships',()=>{
 const {state,ref}=setup(),before=fixture();state.edit(ref,{title:'Unsaved'});
 const snapshot=state.snapshot('course-a'),json=JSON.parse(JSON.stringify({schema:'course-planner.pilot-export.v1',course:snapshot.course,units:snapshot.units,lessons:snapshot.lessons,calendarExceptions:snapshot.exceptions}));
 assert.deepEqual(json.lessons,before.lessons);assert.deepEqual(json.units,before.units);assert.equal(json.lessons[0].unit_id,json.units[0].id);
 assert.equal(json.lessons[0].title,'Lesson');assert.equal(json.lessons[0].archived_at,'2026-01-01');
});

test('Stage A: expired view references cannot edit or save after account/session replacement',async()=>{
 const {state,ref}=setup();state.setAccount(null);state.setAccount('owner-a');state.publish(state.beginRead('course-a'),fixture());
 assert.equal(state.record(ref),null);assert.throws(()=>state.edit(ref,{title:'Stale'}),/expired/);
 await assert.rejects(state.save(ref,{title:'Stale'},()=>assert.fail('No request allowed')),/expired/);
 const fresh=state.reference('course-a','lessons','lesson-a');
 for(const field of ['id','owner_id','course_id','revision'])assert.throws(()=>state.edit(fresh,{[field]:'Changed'}),/identities/);
 assert.equal(state.hasDraft(),false);
});
test('Stage A: pending save freezes its submitted values independently of later caller mutations',async()=>{
 const {state,ref}=setup(),wait=deferred(),patch={objective:'Submitted'};state.edit(ref,patch);
 const save=state.save(ref,patch,({patch:submitted})=>{assert.ok(Object.isFrozen(submitted));return wait.promise;});
 patch.objective='External mutation';wait.resolve({data:{id:'lesson-a',revision:8},error:null});await save;
 assert.equal(state.record(ref).objective,'Submitted');
});
