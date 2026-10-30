import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceTabs} from '../workspace-tabs.js';
import {createWorkspaceState} from '../workspace-state.js';
const setup=()=>{const tabs=createWorkspaceTabs();tabs.setAccount('owner');tabs.ensure('course');return tabs;};
test('Stage B: five ordinary destinations replace one selected tab; explicit open preserves it',()=>{
 const tabs=setup(),id=tabs.active('course').id;
 for(const kind of ['overview','sequence','units','lessons','calendar'])tabs.navigate('course',{kind});
 assert.equal(tabs.list('course').length,1);assert.equal(tabs.active('course').id,id);
 tabs.open('course',{kind:'lesson-plan',table:'lessons',recordId:'lesson'});
 assert.equal(tabs.list('course').length,2);assert.equal(tabs.list('course')[0].history.at(-1).destination.kind,'calendar');
 assert.notEqual(tabs.active('course').id,'lesson');
});
test('Stage B: independent histories prune only their own forward branch and remain bounded',()=>{
 const tabs=setup(),first=tabs.active('course').id;tabs.navigate('course',{kind:'units'});tabs.navigate('course',{kind:'lessons'});
 const second=tabs.open('course',{kind:'calendar'}).id;assert.equal(tabs.travel('course',-1),false);
 tabs.select('course',first);tabs.travel('course',-1);tabs.navigate('course',{kind:'overview'});assert.equal(tabs.travel('course',1),false);
 tabs.select('course',second);assert.equal(tabs.current('course').destination.kind,'calendar');
 for(let n=0;n<80;n++)tabs.navigate('course',{kind:'calendar',date:String(n)});assert.equal(tabs.active('course').history.length,50);
});
test('Stage B: final close leaves one blank; recently closed is bounded and reopening never creates data',()=>{
 const tabs=setup();for(let n=0;n<15;n++)tabs.close('course',tabs.active('course').id);
 assert.equal(tabs.list('course').length,1);assert.equal(tabs.current('course').destination.kind,'new');assert.equal(tabs.closed('course').length,10);
 const previous=tabs.active('course').id;tabs.reopen('course',0);assert.notEqual(tabs.active('course').id,previous);assert.equal(tabs.list('course').length,2);
});
test('Stage B: per-course arrangements stay separate; account changes invalidate all views',()=>{
 const tabs=setup(),first=tabs.active('course').id;tabs.open('course',{kind:'calendar'});const selected=tabs.active('course').id;
 tabs.ensure('second');assert.equal(tabs.list('second').length,1);assert.equal(tabs.active('course').id,selected);
 assert.throws(()=>tabs.open('course',{kind:'lesson-plan',courseId:'second'}),/Cross-course/);
 tabs.setAccount(null);assert.throws(()=>tabs.ensure('course'),/account/);tabs.setAccount('other');assert.notEqual(tabs.active('course').id,first);assert.equal(tabs.list('course').length,1);
});
test('Stage B: temporary drafts are unique, canonical references share one draft, discard is record scoped',async()=>{
 const state=createWorkspaceState();state.setAccount('owner');state.publish(state.beginRead('course'),{course:{id:'course',owner_id:'owner'},units:[{id:'unit',revision:1}],lessons:[{id:'lesson',revision:1,title:'Saved'}],exceptions:[]});
 const a=state.reference('course','lessons'),b=state.reference('course','lessons');assert.notEqual(a.draftId,b.draftId);
 state.edit(a,{title:'A'});state.edit(b,{title:'B'});state.discardRecord(a);assert.equal(state.draft(a),null);assert.equal(state.draft(b).values.title,'B');
 const ref=state.reference('course','lessons','lesson'),second=state.reference('course','lessons','lesson');state.edit(ref,{title:'Shared'});assert.equal(state.draft(ref),state.draft(second));
 const result=await state.save(b,{title:'B',course_id:'course',unit_id:'unit'},()=>({data:{id:'created',revision:1}}));
 assert.equal(result.ref.recordId,'created');assert.equal(result.ref.draftId,null);assert.equal(state.snapshot('course').lessons.length,2);assert.equal(state.draft(ref).values.title,'Shared');
 state.setAccount(null);assert.equal(state.isCurrent(ref),false);assert.equal(state.draft(ref),null);
});
test('Stage B: create acknowledgement promotes only its temporary identity across presentation histories',()=>{
 const tabs=setup(),a=tabs.newDraftId(),b=tabs.newDraftId();tabs.navigate('course',{kind:'create-lesson',table:'lessons',draftId:a});
 tabs.open('course',{kind:'create-lesson',table:'lessons',draftId:b});tabs.promote('course','lessons',a,'saved-lesson');
 assert.equal(tabs.list('course')[0].history.at(-1).destination.recordId,'saved-lesson');assert.equal(tabs.current('course').destination.draftId,b);
});

test('phone reorder retains selected identity and independent histories without creating views',()=>{
 const tabs=createWorkspaceTabs();tabs.setAccount('owner');const a=tabs.ensure('c').tabs[0],b=tabs.open('c',{kind:'lessons'});tabs.navigate('c',{kind:'units'});const before=structuredClone(b.history);
 assert.equal(tabs.move('c',b.id,0),true);assert.equal(tabs.active('c').id,b.id);assert.deepEqual(b.history,before);assert.equal(tabs.list('c').length,2);assert.equal(tabs.list('c')[1],a);assert.equal(tabs.move('c',b.id,99),false);
});
