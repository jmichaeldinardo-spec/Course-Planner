import test from 'node:test';
import assert from 'node:assert/strict';
import {createBuildSample} from '../build-sample.js';
import {buildSchedule,planningOutlook} from '../build-schedule.js';
import {schedulingSnapshotToken} from '../scheduling-preview.js';
import {renderPlanningOutlook,defaultOutlookPreferences} from '../planning-outlook-view.js';
import {renderSavedCalendar} from '../calendar-view.js';
const s=createBuildSample(),configuration={startDate:s.course.first_day,unitId:null,expectedSnapshot:schedulingSnapshotToken(s)},result=buildSchedule(s,configuration),state={preferences:defaultOutlookPreferences(),draft:configuration,result},outlook=planningOutlook(s,result,{focusDate:s.course.first_day});
test('inspector gives a plain-language outcome and progressively discloses complete real-engine analysis',()=>{
 const html=renderPlanningOutlook(s,state,outlook,{surface:'inspector'});
 assert.match(html,/8 lessons placed; 0 need attention/);assert.match(html,/<details class="outlook-more"><summary>More details<\/summary>/);assert.doesNotMatch(html,/<details[^>]*open/);
 assert.equal((html.match(/data-build-row=/g)||[]).length,12);assert.match(html,/11 hypothetical day assignments/);assert.match(html,/2026-09-03, 2026-09-04/);assert.doesNotMatch(html,/<button[^>]*>\s*(Apply|Save|Confirm)\s*</);
});
test('main calendar and contextual details are separate surfaces of the same projection',()=>{
 const view={view:'month',anchor:s.course.first_day,selected:'2026-09-03'},presentation={byDate:outlook.byDate,allowEventPreview:false};
 const main=renderSavedCalendar(s,view,{...presentation,workspace:true}),detail=renderSavedCalendar(s,view,{...presentation,detailOnly:true}),diagnostics=renderSavedCalendar(s,view,{...presentation,diagnosticsOnly:true});
 assert.match(main,/class="saved-month"/);assert.doesNotMatch(main,/Instructional capacity|Unscheduled lessons|id="saved-day-details"|data-event-open/);assert.match(main,/data-private-lesson="sample-lesson-3"/);
 assert.match(detail,/data-private-lesson="sample-lesson-3"/);assert.match(detail,/Tier 2 · Tentative/);assert.doesNotMatch(detail,/class="saved-month"/);assert.match(diagnostics,/Instructional capacity/);
});
test('display options and milestones never include a second Build form or editor',()=>{
 const controls=renderPlanningOutlook(s,state,outlook,{surface:'controls'}),milestones=renderPlanningOutlook(s,state,outlook,{surface:'milestones'});
 assert.match(controls,/<details><summary>Display options/);assert.doesNotMatch(controls,/data-build-schedule-form|data-build-row/);assert.match(milestones,/2026-10-19 → 2026-10-23/);assert.doesNotMatch(milestones,/<form|<input|<textarea/);
});
