import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBuildSample,renderBuildSampleNotice} from '../build-sample.js';
import {buildSchedule,planningOutlook} from '../build-schedule.js';
import {schedulingSnapshotToken} from '../scheduling-preview.js';
import {renderSavedCalendar} from '../calendar-view.js';
const build=s=>buildSchedule(s,{startDate:s.course.first_day,expectedSnapshot:schedulingSnapshotToken(s)});
test('temporary success sample is recursively immutable, repeatable and contains only fictional identities',()=>{
 const a=createBuildSample(),b=createBuildSample();assert.notEqual(a,b);assert.deepEqual(a,b);
 const frozen=v=>{assert.ok(Object.isFrozen(v));for(const child of Object.values(v))if(child&&typeof child==='object')frozen(child);};frozen(a);
 assert.throws(()=>a.lessons[2].scheduled_dates.push('2026-09-03'),TypeError);
 for(const r of [a.course,...a.units,...a.lessons,...a.exceptions])assert.ok(r.id.startsWith('sample-'));
 assert.equal(a.lessons.length,12);assert.equal(a.units.length,3);
 assert.doesNotMatch(readFileSync(new URL('../build-sample.js',import.meta.url),'utf8'),/import |localStorage|(?:api|client)\.from\(|\.rpc\(/);
});
test('same real Build engine successfully places eight sample lessons without changing fixture dates or pins',()=>{
 const s=createBuildSample(),before=JSON.stringify(s),p=build(s);assert.deepEqual(p,build(s));assert.equal(p.valid,true);assert.equal(p.applyEnabled,false);
 assert.deepEqual(p.totals,{activeLessons:12,activeUnits:3,confirmedLessons:4,tentativeLessons:8,notAssessed:0,unplaceable:0,baselineUnscheduled:8});
 assert.deepEqual(p.rows.map(r=>r.proposed),[['2026-09-01'],['2026-09-02'],['2026-09-03','2026-09-04'],['2026-09-08'],['2026-09-10'],['2026-09-11','2026-09-14'],['2026-09-16'],['2026-09-17'],['2026-10-19'],['2026-10-20','2026-10-21'],['2026-10-22'],['2026-10-23']]);
 assert.equal(p.rows[4].state,'protected saved commitment');assert.equal(p.capacity.requiredDays,15);assert.equal(p.capacity.tentativeDays,11);assert.equal(JSON.stringify(s),before);
});
test('sample uses real horizon projection with estimated distant ranges and distinct assessment certainty',()=>{
 const s=createBuildSample(),p=build(s),o=planningOutlook(s,p,{focusDate:'2026-09-01',weeks:4});
 assert.equal(Object.keys(o.byDate).length,7);assert.ok(Object.keys(o.byDate).every(d=>d<='2026-09-28'));
 assert.deepEqual(o.milestones.map(m=>[m.state,m.start,m.end]),[['estimated — unsaved','2026-09-01','2026-09-08'],['estimated — unsaved','2026-09-10','2026-09-17'],['estimated — unsaved','2026-10-19','2026-10-23']]);
 assert.deepEqual(o.assessments.map(a=>a.state),['protected saved anchor','estimated — unsaved']);
 const october=planningOutlook(s,p,{focusDate:'2026-10-19',weeks:2});assert.deepEqual(Object.keys(october.byDate),['2026-10-20','2026-10-21','2026-10-22','2026-10-23']);
});
test('sample notice discloses provenance and read-only lesson identity; shared calendar can omit event authoring',()=>{
 const s=createBuildSample(),html=renderBuildSampleNotice(s,s.lessons[2].id);assert.match(html,/NOT your saved course/);assert.match(html,/local memory only/);assert.match(html,/sample-lesson-3/);assert.match(html,/fictional, read-only/);assert.doesNotMatch(html,/<form|<input|<textarea|data-private-save/);
 const state={view:'month',anchor:'2026-09-01',selected:'2026-09-03'};
 assert.doesNotMatch(renderSavedCalendar(s,state,{allowEventPreview:false}),/data-event-open/);
 assert.match(renderSavedCalendar(s,state),/data-event-open/);
});
