import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSchedule,planningOutlook} from '../build-schedule.js';
import {schedulingSnapshotToken} from '../scheduling-preview.js';
import {renderPlanningOutlook,defaultOutlookPreferences} from '../planning-outlook-view.js';
import {renderSavedCalendar} from '../calendar-view.js';
import {scheduleFixture,fullyScheduled80Fixture,buildOutlookFixture as buildFixture,id} from './fixtures/scheduling-scenarios.mjs';
const freeze=o=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);return o;};

const build=(s,patch={})=>buildSchedule(s,{startDate:s.course.first_day,expectedSnapshot:schedulingSnapshotToken(s),...patch});
test('Build assigns only unscheduled lessons from an explicit anchor without changing frozen records',()=>{
 const s=freeze(buildFixture()),before=JSON.stringify(s),a=build(s),b=build(s);
 assert.deepEqual(a,b);assert.equal(a.valid,true);assert.equal(a.applyEnabled,false);assert.equal(JSON.stringify(s),before);
 assert.deepEqual(a.rows.map(r=>r.proposed),[['2026-09-14'],['2026-09-15','2026-09-16'],['2026-09-21'],['2026-09-22']]);assert.deepEqual(a.rows.map(r=>[r.lessonId,r.unitId]),s.lessons.map(l=>[l.id,l.unit_id]));assert.equal(a.totals.tentativeLessons,2);assert.equal(a.capacity.tentativeDays,3);
 const shuffled={...s,lessons:[...s.lessons].reverse()};assert.deepEqual(build(shuffled),a);
});
test('new unscheduled course skips weekends, full closures and occupied legacy events, preserving Keep days',()=>{
 const s=buildFixture();s.lessons.forEach(l=>{l.scheduled_dates=[];l.protected_pin_date=null;});s.exceptions.push({id:id(31),course_id:s.course.id,date:'2026-09-18',effect:'Replace Lesson',revision:1},{id:id(32),course_id:s.course.id,date:'2026-09-22',effect:'Continue Lesson',revision:1});
 const p=build(s,{startDate:'2026-09-16'});assert.equal(p.valid,true);assert.deepEqual(p.rows.map(r=>r.proposed),[['2026-09-16'],['2026-09-21','2026-09-22'],['2026-09-23'],['2026-09-24']]);
});
test('missing or out-of-term anchor, stale input and unresolved policy do not invent dates',()=>{
 for(const patch of [{startDate:''},{startDate:'2026-09-13'},{startDate:'2026-11-01'},{expectedSnapshot:'stale'}]){const p=build(buildFixture(),patch);assert.equal(p.valid,false);assert.ok(p.rows.every(r=>r.proposed===null));}
 for(const mutate of [s=>s.course.first_day=null,s=>s.course.teaching_weekdays=[0],s=>s.lessons[1].duration_days=null,s=>s.exceptions[0].effect='Unknown',s=>s.exceptions[0].reserved_flex=true,s=>s.lessons[1].protected_pin_date='2026-09-15',s=>s.units[0].revision=null,s=>s.lessons[1].position=1,s=>s.lessons[1].course_id=id(999)]){
  const s=buildFixture();mutate(s);const p=build(s);assert.equal(p.valid,false);assert.ok(p.rows.every(r=>r.proposed===null));
 }
});
test('ordinary saved dates and pins both remain fixed when earlier unscheduled work cannot fit',()=>{
 const s=buildFixture(),p=build(s,{startDate:'2026-09-22'});assert.equal(p.valid,false);assert.deepEqual(p.rows[1].proposed,[]);assert.deepEqual(p.rows[2].proposed,['2026-09-21']);assert.equal(p.rows[3].proposed,null);assert.ok(p.conflicts.some(c=>c.code==='capacity'));
 s.lessons[2].protected_pin_date=null;assert.deepEqual(build(s,{startDate:'2026-09-22'}).rows[2].proposed,['2026-09-21']);
 const short=buildFixture();short.course.last_day='2026-09-21';short.lessons=short.lessons.slice(0,2);short.lessons[1].duration_days=10;assert.deepEqual(build(short).rows[1].proposed,[]);
});
test('partial multi-day dates, preexisting overlaps, continuity gaps and pin/closure collisions remain unresolved',()=>{
 const s=buildFixture();s.lessons[1].scheduled_dates=['2026-09-15'];const p=build(s);assert.equal(p.valid,false);assert.equal(p.rows[1].proposed,null);assert.deepEqual(s.lessons[1].scheduled_dates,['2026-09-15']);assert.equal(p.rows[3].proposed,null);
 for(const mutate of [s=>s.lessons[2].scheduled_dates=['2026-09-14'],s=>{s.lessons[1].scheduled_dates=['2026-09-15','2026-09-18'];},s=>s.exceptions[0].date='2026-09-21']){const x=buildFixture();mutate(x);assert.ok(build(x).rows.every(r=>r.proposed===null));}
});
test('unit scope preserves whole-course dependencies and cannot jump unknown earlier work',()=>{
 const s=buildFixture(),p=build(s,{unitId:id(4)});assert.equal(p.totals.activeUnits,2);assert.equal(p.totals.activeLessons,4);assert.equal(p.rows[1].proposed,null);assert.equal(p.rows[3].proposed,null);assert.equal(p.valid,false);
 const first=build(s,{unitId:s.units[0].id});assert.deepEqual(first.rows[1].proposed,['2026-09-15','2026-09-16']);assert.equal(first.rows[3].proposed,null);assert.equal(first.capacity.requiredDays,5);
});
test('archives exclude units, lessons and milestones while preserving underlying recovery records',()=>{
 const s=buildFixture(),base=build(s);s.units.push({...s.units[0],id:id(60),archived_at:'2026-10-26'});s.lessons.push({...s.lessons[1],id:id(61),position:80,unit_id:id(60),duration_days:366});s.lessons.push({...s.lessons[1],id:id(62),position:81,archived_at:'2026-10-26'});const before=JSON.stringify(s),p=build(freeze(s));assert.deepEqual(p.rows,base.rows);assert.equal(JSON.stringify(s),before);assert.equal(planningOutlook(s,p,{focusDate:s.course.first_day}).milestones.length,2);
});
test('fully scheduled 80-lesson fixture retains all dates; six-unscheduled regression cannot shift later confirmed work',()=>{
 const s=fullyScheduled80Fixture(),before=JSON.stringify(s),p=build(freeze(s));assert.equal(p.valid,true);assert.equal(p.totals.tentativeLessons,0);assert.equal(p.rows.length,80);assert.deepEqual(p.rows.map(r=>r.proposed),s.lessons.map(l=>l.scheduled_dates));assert.equal(JSON.stringify(s),before);
 const incomplete=fullyScheduled80Fixture();for(const i of [15,31,47,63,74,79])incomplete.lessons[i].scheduled_dates=[];const q=build(incomplete);assert.equal(q.valid,true);assert.equal(q.totals.baselineUnscheduled,6);assert.equal(q.totals.tentativeLessons,6);assert.ok(q.rows[15].proposed.length>0);assert.ok(q.rows.filter(r=>r.before.length).every(r=>JSON.stringify(r.proposed)===JSON.stringify(r.before)));
});
test('civil-date forecast crosses leap day and DST without host timezone dependence',()=>{
 for(const [first,last,expected] of [['2024-02-28','2024-03-07',['2024-02-28','2024-02-29','2024-03-01','2024-03-04']],['2026-03-06','2026-03-16',['2026-03-06','2026-03-09','2026-03-10','2026-03-11']]]){
  for(const timezone of ['America/New_York','Pacific/Kiritimati','Pacific/Honolulu']){const s=scheduleFixture();Object.assign(s.course,{first_day:first,last_day:last,timezone});s.lessons.forEach(l=>l.scheduled_dates=[]);assert.deepEqual(build(s).rows.map(r=>r.proposed[0]),expected);}
 }
});
test('horizon is a focus-anchored display lens with no distant daily clutter or stale overlays',()=>{
 const s=buildFixture(),p=build(s);for(const weeks of [2,4,6]){const o=planningOutlook(s,p,{focusDate:'2026-09-14',weeks});assert.equal(o.window.weeks,weeks);assert.equal(o.window.start,'2026-09-14');assert.equal(Object.values(o.byDate).flat().length,3);}
 const distant=planningOutlook(s,p,{focusDate:'2026-10-01',weeks:2});assert.deepEqual(distant.byDate,{});assert.equal(distant.milestones[0].state,'estimated — unsaved');assert.equal(distant.assessments[0].state,'protected saved anchor');
 const bad=planningOutlook(s,p,{focusDate:'bad',weeks:3});assert.equal(bad.window,null);assert.deepEqual(bad.byDate,{});
 s.lessons[1].objective='New saved content';const stale=planningOutlook(s,p,{focusDate:'2026-09-14'});assert.equal(stale.stale,true);assert.deepEqual(stale.byDate,{});assert.equal(stale.milestones[0].state,'cannot estimate');
});
test('three-tier view discloses certainty, known/unknown milestones, planning status and no writing controls',()=>{
 const s=buildFixture(),p=build(s),o=planningOutlook(s,p,{focusDate:'2026-09-14'}),state={preferences:defaultOutlookPreferences(),draft:{startDate:'2026-09-14'},result:p};
 const html=renderPlanningOutlook(s,state,o)+renderSavedCalendar(s,{selected:'2026-09-15',anchor:'2026-09-14',view:'month'},{byDate:o.byDate});
 for(const text of ['Tier 1','Tier 2','Tier 3','WORKING/OPEN','BEFORE · saved','PROPOSED · hypothetical','Whole-course capacity','estimated — unsaved','protected saved anchor','planning detail, not date certainty','Tentative · unsaved'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/>Apply<|>Save<|>Confirm<|data-private-save/);
 const savedOnly={...state,preferences:{...state.preferences,milestones:false}};assert.doesNotMatch(renderPlanningOutlook(s,savedOnly,o),/data-milestone-unit/);
 s.lessons[1].title='<script>bad()</script>';const fresh=build(s);const escaped=renderPlanningOutlook(s,{...state,result:fresh},planningOutlook(s,fresh,{focusDate:'2026-09-14'}));assert.match(escaped,/&lt;script&gt;/);assert.doesNotMatch(escaped,/<script>/);
 for(const name of ['build-schedule.js','planning-outlook-view.js'])assert.doesNotMatch(readFileSync(new URL('../'+name,import.meta.url),'utf8'),/fetch\(|\.rpc\(|\.from\(|localStorage|sessionStorage/);
});
