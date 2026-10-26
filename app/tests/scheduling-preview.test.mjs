import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeEvent,eventDayState} from '../event-effects.js';
import {previewSchedulingEvent,schedulingSnapshotToken} from '../scheduling-preview.js';
import {renderSchedulingPreview} from '../scheduling-preview-view.js';
import {scheduleFixture,fullyScheduled80Fixture,scenarios,id} from './fixtures/scheduling-scenarios.mjs';
const draft=(snapshot,patch={})=>({title:'Fictional test event',date:'2026-09-15',eventType:'Closure',availability:'closed',effect:'Move',expectedSnapshot:schedulingSnapshotToken(snapshot),...patch});
const preview=(s,patch={})=>previewSchedulingEvent(s,draft(s,patch));
const freeze=o=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);return o;};
for(const scenario of scenarios)test('annotated scenario: '+scenario.name,()=>{
 const s=scheduleFixture();if(scenario.pinIndex!=null)s.lessons[scenario.pinIndex].protected_pin_date=s.lessons[scenario.pinIndex].scheduled_dates[0];
 const before=JSON.stringify(s),p=preview(freeze(s),scenario.event);
 assert.equal(JSON.stringify(s),before);assert.equal(p.applyEnabled,false);
 if(scenario.blocked){assert.equal(p.valid,false);assert.ok(p.conflicts.some(c=>c.code===scenario.blocked));assert.deepEqual(p.rows[scenario.pinIndex].proposed,p.rows[scenario.pinIndex].before);}
 else{assert.equal(p.valid,true);assert.deepEqual(p.rows.map(r=>r.proposed),scenario.expected);}
});
test('legacy normalization retains raw type/title and maps No/Replace/Continue',()=>{
 for(const [effect,mapped,availability] of [['No Lesson','Move','closed'],['Replace Lesson','Move','occupied'],['Continue Lesson','Keep','instructional']]){
  const raw={id:id(100),effect,event_type:'Historic custom subtype',title:'Keep this title',date:'2026-09-15'};const n=normalizeEvent(freeze(raw));
  assert.equal(n.effect,mapped);assert.equal(n.availability,availability);assert.equal(n.title,raw.title);assert.equal(n.rawType,raw.event_type);assert.equal(n.rawEffect,effect);assert.equal(n.eventType,'Legacy / unspecified');assert.ok(n.uncertainties.length);assert.equal(n.effectOrigin,'legacy mapping');
 }
});
test('legacy event editing preserves the replacement event and computes from real baseline',()=>{
 const s=scheduleFixture();s.exceptions=[{id:id(30),course_id:s.course.id,date:'2026-09-18',title:'Replacement title',event_type:'Alternate activity',effect:'Replace Lesson',revision:1}];
 const p=preview(s,{eventId:id(30),date:'2026-09-15',title:'Replacement title',eventType:'Alternate activity',availability:'occupied',effect:'Move'});
 assert.equal(p.valid,true);assert.equal(p.eventChange.proposed.title,'Replacement title');assert.equal(p.eventChange.before.rawEffect,'Replace Lesson');assert.equal(p.eventChange.proposed.effectOrigin,'legacy default');assert.deepEqual(p.rows[1].proposed,['2026-09-16']);assert.equal(p.availability.events.length,1);
});
test('Continue Lesson keeps original dates and new same-type choices can override a default',()=>{
 const s=scheduleFixture();s.exceptions=[{id:id(30),course_id:s.course.id,date:'2026-09-15',title:'Short periods',event_type:'Shortened periods',effect:'Continue Lesson',revision:1}];
 const p=preview(s,{eventId:id(30),title:'Short periods',eventType:'Shortened periods',availability:'instructional',effect:'Keep'});assert.equal(p.valid,true);assert.deepEqual(p.rows.map(r=>r.proposed),s.lessons.map(l=>l.scheduled_dates));
 const moved=preview(s,{eventId:id(30),eventType:'Shortened periods',availability:'instructional',effect:'Move'});assert.equal(moved.eventChange.proposed.effectOrigin,'teacher override');assert.deepEqual(moved.rows[1].proposed,['2026-09-16']);
 const testing=preview(scheduleFixture(),{eventType:'Testing',availability:'instructional',effect:'Keep'});assert.equal(testing.valid,true);assert.equal(testing.eventChange.proposed.effectOrigin,'teacher override');
});
test('Keep cannot override full closure, occupied dates or another saved event',()=>{
 const s=scheduleFixture();
 for(const patch of [{effect:'Keep'},{eventType:'Testing',availability:'occupied',effect:'Keep'},{eventType:'Closure',availability:'instructional',effect:'Keep'}])assert.equal(preview(s,patch).valid,false);
 s.exceptions=[{id:id(30),course_id:s.course.id,date:'2026-09-18',title:'Closed',effect:'No Lesson',revision:1}];
 const p=preview(s,{date:'2026-09-18',eventType:'Shortened periods',availability:'instructional',effect:'Keep'});assert.ok(p.conflicts.some(c=>c.code==='event-conflict'));assert.ok(p.rows.every(r=>r.proposed===null));
});
test('partial-time, Extend, unknown and reserved-flex policies block without invented dates',()=>{
 for(const patch of [{eventType:'Other',availability:'partial'},{effect:'Extend'},{eventType:'Other',availability:'unknown'},{reserved_flex:true}]){
  const p=preview(scheduleFixture(),patch);assert.equal(p.valid,false);assert.ok(p.rows.every(r=>r.proposed===null));assert.equal(p.applyEnabled,false);
 }
 assert.equal(eventDayState([normalizeEvent({effect:'Mystery'})]),'uncertain');
});
test('multi-day ripple uses all eligible days across weekends, leap day and closure',()=>{
 const s=scheduleFixture();s.course.first_day='2024-02-28';s.course.last_day='2024-03-08';s.lessons=s.lessons.slice(0,2);s.lessons[0].duration_days=2;s.lessons[0].scheduled_dates=['2024-02-28','2024-02-29'];s.lessons[1].scheduled_dates=['2024-03-01'];
 const p=preview(s,{date:'2024-02-29'});assert.equal(p.valid,true);assert.deepEqual(p.rows[0].proposed,['2024-02-28','2024-03-01']);assert.deepEqual(p.rows[1].proposed,['2024-03-04']);assert.equal(p.totals.unmetDays,0);
});
test('pinned multi-day arrays stay protected and closing any protected date blocks',()=>{
 const s=scheduleFixture();s.lessons=s.lessons.slice(0,2);s.lessons[0].duration_days=2;s.lessons[0].scheduled_dates=['2026-09-14','2026-09-15'];s.lessons[0].protected_pin_date='2026-09-14';s.lessons[1].scheduled_dates=['2026-09-16'];
 const p=preview(s);assert.ok(p.conflicts.some(c=>c.code==='protected-pin'));assert.deepEqual(p.rows[0].proposed,s.lessons[0].scheduled_dates);assert.equal(p.rows[0].unmetDuration,1);assert.equal(p.rows[1].proposed,null);
});
test('insufficient capacity never truncates a multi-day lesson or hides downstream unplaced work',()=>{
 const s=scheduleFixture();s.course.last_day='2026-09-17';s.lessons[2].duration_days=2;s.lessons[2].scheduled_dates=['2026-09-16','2026-09-17'];s.lessons=s.lessons.slice(0,3);
 const p=preview(s);assert.equal(p.valid,false);assert.deepEqual(p.rows[2].proposed,[]);assert.equal(p.rows[2].unmetDuration,2);assert.equal(p.totals.notPlacedLessons,1);assert.ok(p.affectedIds.includes(s.lessons[2].id));
});
test('flexible preferences are warnings, never pin reservations or sequence edits',()=>{
 const s=scheduleFixture();s.lessons[1].flexible_preference_date='2026-09-15';const p=preview(s);
 assert.equal(p.valid,true);assert.deepEqual(p.rows[1].proposed,['2026-09-16']);assert.equal(p.rows[1].protected,false);assert.ok(p.warnings.some(w=>w.code==='soft-preference'));
 assert.deepEqual(p.rows.map(r=>[r.lessonId,r.unitId,r.position]),s.lessons.map(l=>[l.id,l.unit_id,l.position]));
});
test('existing overlaps, order inversions, invalid dates and unknown durations block all computation',()=>{
 for(const mutate of [s=>s.lessons[1].scheduled_dates=['2026-09-14'],s=>s.lessons[1].scheduled_dates=['2026-09-18'],s=>s.lessons[1].duration_days=null,s=>s.lessons[1].scheduled_dates=['bad'],s=>s.lessons[1].position=1]){
  const s=scheduleFixture();mutate(s);const p=preview(s);assert.equal(p.valid,false);assert.ok(p.rows.every(r=>r.proposed===null));assert.equal(Object.keys(p.placements).length,s.lessons.length);
 }
});
test('missing parents, duplicated/foreign IDs and missing revisions are blocked',()=>{
 for(const mutate of [s=>s.lessons[1].unit_id=id(999),s=>s.lessons[1].id=s.lessons[0].id,s=>s.lessons[1].course_id=id(999),s=>delete s.units[0].revision,s=>delete s.course.revision]){const s=scheduleFixture();mutate(s);assert.equal(preview(s).valid,false);}
});
test('archived lessons and units do not affect active preview or mutate recovery/export records',()=>{
 const s=scheduleFixture(),baseline=preview(s);s.lessons.push({...s.lessons[0],id:id(60),duration_days:366,archived_at:'2026-10-26'});s.units.push({...s.units[0],id:id(61),archived_at:'2026-10-26'});s.lessons.push({...s.lessons[0],id:id(62),unit_id:id(61)});
 const p=preview(freeze(s));assert.equal(p.valid,true);assert.equal(p.totals.excludedLessons,2);assert.equal(p.totals.excludedUnits,1);assert.deepEqual(p.placements,baseline.placements);assert.equal(p.totals.requiredDays,4);assert.equal(s.lessons.length,6);
});
test('stale dependencies include course, parent, pin, event, membership and content changes',()=>{
 for(const mutate of [s=>s.course.last_day='2026-09-24',s=>s.units[0].revision++,s=>s.lessons[0].protected_pin_date='2026-09-14',s=>s.lessons[0].objective+=' changed',s=>s.exceptions.push({id:id(40),course_id:s.course.id,date:'2026-09-24',effect:'No Lesson',revision:1}),s=>s.lessons.pop()]){
  const s=scheduleFixture(),choice=draft(s);mutate(s);const p=previewSchedulingEvent(s,choice);assert.ok(p.conflicts.some(c=>c.code==='stale-snapshot'));assert.ok(p.rows.every(r=>r.proposed===null));
 }
});
test('immutable inputs, deterministic output and explicit full affected date disclosure',()=>{
 const s=freeze(scheduleFixture()),choice=freeze(draft(s)),before=JSON.stringify(s);
 const a=previewSchedulingEvent(s,choice),b=previewSchedulingEvent(s,choice);assert.deepEqual(a,b);assert.equal(JSON.stringify(s),before);assert.equal(a.rows.length,4);assert.equal(a.affectedIds.length,3);assert.equal(a.rows[0].changed,false);assert.equal(a.eventChange.proposed.effectOrigin,'suggested default');
 const shuffled={...s,lessons:[...s.lessons].reverse()};assert.equal(schedulingSnapshotToken(shuffled),schedulingSnapshotToken(s));assert.deepEqual(previewSchedulingEvent(shuffled,choice),a);
});
test('empty course is meaningful, timezone does not affect civil-date output, invalid terms block',()=>{
 const s=scheduleFixture();s.lessons=[];s.units=[];assert.equal(preview(s).valid,true);assert.equal(preview(s).rows.length,0);
 for(const timezone of ['America/New_York','Pacific/Kiritimati','Pacific/Honolulu']){const x=scheduleFixture();x.course.timezone=timezone;assert.deepEqual(preview(x).rows.map(r=>r.proposed),scenarios[0].expected);}
 for(const patch of [{first_day:null},{last_day:'2026-09-13'},{teaching_weekdays:[0]}]){const x=scheduleFixture();Object.assign(x.course,patch);assert.equal(preview(x).valid,false);}
});
test('UI labels proposed state and missing allocations, escapes text, and exposes no Apply/Save action',()=>{
 const s=scheduleFixture(),d=draft(s,{title:'<script>bad()</script>'}),p=previewSchedulingEvent(s,d),html=renderSchedulingPreview(s,d,p);
 assert.match(html,/BEFORE · saved/);assert.match(html,/PROPOSED · not saved/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Extend — coming later/);assert.match(html,/Applying proposals is not enabled/);assert.doesNotMatch(html,/data-private-save|>Confirm<|>Apply<|>Save</);
 const core=readFileSync(new URL('../scheduling-preview.js',import.meta.url),'utf8');assert.doesNotMatch(core,/fetch\(|\.rpc\(|\.from\(|localStorage|sessionStorage/);
});

test('an existing genuine closure cannot be bypassed through an event-type default',()=>{
 const s=scheduleFixture();s.exceptions=[{id:id(30),course_id:s.course.id,date:'2026-09-18',title:'Genuine closure',effect:'No Lesson',event_type:'Closure',revision:1}];
 const p=preview(s,{eventId:id(30),date:'2026-09-18',eventType:'Shortened periods',availability:'instructional',effect:'Keep'});
 assert.equal(p.valid,false);assert.ok(p.conflicts.some(c=>c.code==='closure-constraint'));assert.ok(p.rows.every(r=>r.proposed===null));
});

test('ripple crosses a DST weekend with date-only outputs in every course timezone',()=>{
 for(const timezone of ['America/New_York','Pacific/Kiritimati','Pacific/Honolulu']){
  const s=scheduleFixture();s.course.first_day='2026-03-05';s.course.last_day='2026-03-20';s.course.timezone=timezone;
  ['2026-03-05','2026-03-06','2026-03-09','2026-03-10'].forEach((date,i)=>s.lessons[i].scheduled_dates=[date]);
  const p=preview(s,{date:'2026-03-06'});assert.equal(p.valid,true);assert.deepEqual(p.rows.map(r=>r.proposed),[['2026-03-05'],['2026-03-09'],['2026-03-10'],['2026-03-11']]);
 }
});

test('two replacement activities contend for one period without double-counting reservation',()=>{
 const s=scheduleFixture();s.exceptions=[{id:id(30),course_id:s.course.id,date:'2026-09-18',title:'Existing activity',effect:'Replace Lesson',revision:1}];
 const p=preview(s,{date:'2026-09-18',eventType:'Testing',availability:'occupied',effect:'Move'});
 assert.equal(p.valid,false);assert.ok(p.conflicts.some(c=>c.code==='event-contention'));assert.equal(p.totals.reservedDays,1);assert.ok(p.rows.every(r=>r.proposed===null));
});

test('legacy subtype lookup does not treat inherited object keys as known event types',()=>{
 for(const event_type of ['__proto__','constructor','toString']){const n=normalizeEvent({event_type,effect:'Continue Lesson'});assert.equal(n.eventType,'Legacy / unspecified');assert.equal(n.effect,'Keep');assert.ok(n.uncertainties.length);}
});


test('incomplete baseline permits only the complete leading segment within its saved horizon',()=>{
 const s=scheduleFixture();s.lessons[3].scheduled_dates=[];const before=JSON.stringify(s),p=preview(freeze(s));
 assert.equal(p.valid,false);assert.equal(p.applyEnabled,false);assert.equal(p.assessment.mode,'bounded-prefix');assert.equal(p.assessment.throughDate,'2026-09-16');
 assert.deepEqual(p.rows.map(r=>r.proposed),[['2026-09-14'],['2026-09-16'],null,null]);
 assert.equal(p.rows[2].status,'not assessed at incomplete boundary');assert.equal(p.totals.assessedLessons,2);assert.equal(p.totals.notAssessedLessons,2);assert.equal(p.totals.baselineUnscheduledLessons,1);assert.equal(p.totals.unplacedAssessedDays,0);assert.equal(p.totals.unassessedRequiredDays,2);assert.equal(JSON.stringify(s),before);
 const keep=preview(s,{eventType:'Shortened periods',availability:'instructional',effect:'Keep'});
 assert.deepEqual(keep.rows.map(r=>r.proposed),[['2026-09-14'],['2026-09-15'],['2026-09-16'],null]);assert.equal(keep.totals.assessedLessons,3);
 const html=renderSchedulingPreview(s,draft(s),p);assert.match(html,/Partial preview — overall blocked/);assert.match(html,/Not assessed — no proposed dates/);assert.match(html,/already unscheduled in saved data/);assert.doesNotMatch(html,/>Apply<|>Save</);
});
test('first incomplete lesson and partial multi-day baselines never receive invented anchors',()=>{
 for(const index of [0,1,3]){
  const s=scheduleFixture();s.lessons[index].duration_days=2;
  const p=preview(s,{eventType:'Shortened periods',availability:'instructional',effect:'Keep'});
  assert.equal(p.valid,false);assert.equal(p.assessment.prefixLength,index);assert.ok(p.rows.slice(index).every(r=>r.proposed===null));
  assert.ok(p.rows.slice(0,index).every(r=>JSON.stringify(r.proposed)===JSON.stringify(r.before)));
 }
});
test('partial previews retain pin constraints and hard blockers still prevent all assessment',()=>{
 const s=scheduleFixture();s.lessons[3].scheduled_dates=[];s.lessons[2].protected_pin_date='2026-09-16';const p=preview(s);
 assert.ok(p.conflicts.some(c=>c.code==='pin-contention'));assert.deepEqual(p.rows[1].proposed,[]);assert.deepEqual(p.rows[2].proposed,['2026-09-16']);assert.equal(p.rows[3].proposed,null);
 for(const mutate of [x=>x.lessons[1].scheduled_dates=['2026-09-14'],x=>x.units[0].revision=null,x=>x.lessons[1].duration_days=null]){
  const x=scheduleFixture();x.lessons[3].scheduled_dates=[];mutate(x);assert.ok(preview(x).rows.every(r=>r.proposed===null));
 }
 const choice=draft(s);s.course.revision++;assert.ok(previewSchedulingEvent(s,choice).rows.every(r=>r.proposed===null));
});
test('fully scheduled fictional 80-lesson course succeeds for Move and Keep without mutations',()=>{
 const s=freeze(fullyScheduled80Fixture()),before=JSON.stringify(s),move=preview(s,{date:'2026-09-02'}),keep=preview(s,{date:'2026-09-02',eventType:'Shortened periods',availability:'instructional',effect:'Keep'});
 assert.equal(s.units.length,5);assert.equal(s.exceptions.length,12);assert.equal(s.lessons.length,80);assert.equal(move.valid,true);assert.equal(keep.valid,true);assert.equal(move.applyEnabled,false);assert.equal(keep.applyEnabled,false);
 assert.equal(move.rows.filter(r=>r.changed).length,79);assert.equal(move.totals.assessedLessons,80);assert.equal(move.totals.notAssessedLessons,0);assert.equal(move.totals.unmetDays,0);assert.equal(move.totals.requiredDays,89);
 assert.deepEqual(keep.rows.map(r=>r.proposed),s.lessons.map(l=>l.scheduled_dates));assert.deepEqual(move.rows[0].proposed,s.lessons[0].scheduled_dates);
 const dates=move.rows.flatMap(r=>r.proposed);assert.equal(new Set(dates).size,89);assert.ok(dates.every(d=>move.availability.proposed.includes(d)));assert.ok(move.rows.every((r,i)=>r.proposed.length===s.lessons[i].duration_days));
 assert.deepEqual(move.rows.map(r=>[r.lessonId,r.unitId,r.position]),s.lessons.map(l=>[l.id,l.unit_id,l.position]));assert.equal(JSON.stringify(s),before);assert.deepEqual(preview(s,{date:'2026-09-02'}),move);
});


test('80-lesson incomplete-baseline regression stays blocked and retains all later saved records',()=>{
 const s=fullyScheduled80Fixture();for(const i of [15,31,47,63,74,79])s.lessons[i].scheduled_dates=[];
 const before=JSON.stringify(s),p=preview(freeze(s),{date:'2026-09-02',eventType:'Shortened periods',availability:'instructional',effect:'Keep'});
 assert.equal(p.valid,false);assert.equal(p.applyEnabled,false);assert.equal(p.rows.length,80);assert.equal(p.totals.assessedLessons,15);assert.equal(p.totals.notAssessedLessons,65);assert.equal(p.totals.baselineUnscheduledLessons,6);assert.ok(p.rows.slice(15).every(r=>r.proposed===null));assert.deepEqual(p.rows.slice(0,15).map(r=>r.proposed),s.lessons.slice(0,15).map(l=>l.scheduled_dates));assert.equal(JSON.stringify(s),before);
});
