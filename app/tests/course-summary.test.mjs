import test from 'node:test';
import assert from 'node:assert/strict';
import {readCourseSummary,summarizeCourse,summaryLabel} from '../course-summary.js';
const course={id:'course-a',updated_at:'2026-10-26T12:00:00Z'};
const unit=(id,archived_at=null)=>({id,course_id:course.id,archived_at});
const lesson=(id,unit_id,archived_at=null)=>({id,unit_id,course_id:course.id,archived_at});
function reader(db,{fail=false}={}){
 const reads=[];
 return {reads,from(table){let columns,field,value;return {select(c){columns=c;return this;},eq(k,v){field=k;value=v;return this;},order(k){assert.equal(k,'id');return this;},async range(start,end){reads.push({table,columns,field,value,start,end});return fail?{data:null,error:{message:'Denied'}}:{data:db[table].filter(r=>r[field]===value).slice(start,end+1),error:null};}};}};
}
test('course facts share archive rules without altering saved records',()=>{
 const units=[unit('u1'),unit('u2','2026-10-26')],lessons=[lesson('l1','u1'),lesson('l2','u1','2026-10-26'),lesson('l3','u2')];
 const before=JSON.stringify({course,units,lessons});
 assert.deepEqual(summarizeCourse(course,units,lessons),{units:1,lessons:1});assert.equal(JSON.stringify({course,units,lessons}),before);
});
test('empty/singular summaries are accurate and never treat course timestamp as last edited',()=>{
 assert.deepEqual(summarizeCourse(course,[],[]),{units:0,lessons:0});
 assert.equal(summaryLabel({units:1,lessons:1}),'1 active unit · 1 active lesson');
 assert.equal(summaryLabel({units:0,lessons:2}),'0 active units · 2 active lessons');
 assert.equal('lastEdited' in summarizeCourse(course,[],[]),false);
});
test('summary reads are course-filtered, metadata-only and paginated beyond 1000 lessons',async()=>{
 const db={units:[unit('u1'),{...unit('other'),course_id:'other-course'}],lessons:Array.from({length:1201},(_,i)=>lesson('l'+i,'u1'))};
 const client=reader(db);assert.deepEqual(await readCourseSummary(client,course),{units:1,lessons:1201});
 assert.deepEqual(client.reads.filter(r=>r.table==='lessons').map(r=>r.start),[0,500,1000]);
 assert.ok(client.reads.every(r=>r.field==='course_id'&&r.value===course.id&&!r.columns.includes('*')&&!r.columns.includes('title')));
});
test('failed reads and oversized courses reject rather than invent partial or zero counts',async()=>{
 await assert.rejects(()=>readCourseSummary(reader({},{fail:true}),course),/unavailable/);
 await assert.rejects(()=>readCourseSummary(reader({units:[unit('u1')],lessons:Array.from({length:2001},(_,i)=>lesson('l'+i,'u1'))}),course),/limits/);
});
test('unexpected cross-course and missing-parent records cannot become course facts',()=>{
 assert.throws(()=>summarizeCourse(course,[{...unit('u1'),course_id:'other'}],[]),/relationship/);
 assert.throws(()=>summarizeCourse(course,[unit('u1')],[{...lesson('l1','u1'),course_id:'other'}]),/relationship/);
 assert.throws(()=>summarizeCourse(course,[unit('u1')],[lesson('l1','missing')]),/relationship/);
});
