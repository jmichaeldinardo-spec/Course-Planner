import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {buildCalendarModel,calendarMonth,calendarWeekday,addCalendarDays,isCalendarDate,todayInCourse} from '../calendar-model.js';
import {renderSavedCalendar} from '../calendar-view.js';
const course={id:'c',first_day:'2026-09-01',last_day:'2026-09-30',teaching_weekdays:[1,2,3,4,5],timezone:'America/New_York'};
const unit={id:'u',course_id:'c',title:'Fictional civics',position:1,target_days:9};
const lesson=(id,patch={})=>({id,course_id:'c',unit_id:'u',title:id,position:1,duration_days:1,scheduled_dates:[],...patch});
const build=(patch={})=>buildCalendarModel({course,units:[unit],...patch});
const codes=m=>m.warnings.map(w=>w.code);
test('month grid has leap day, correct headings and complete weeks',()=>{
 for(const [date,count,first] of [['2024-02-01',29,'2024-01-28'],['2023-02-01',28,'2023-01-29'],['2026-08-01',31,'2026-07-26']]){
  const cells=calendarMonth(date);assert.equal(cells.filter(c=>c.inMonth).length,count);assert.equal(cells[0].date,first);assert.equal(cells.length%7,0);assert.equal(calendarWeekday(cells[0].date),7);
 }
 assert.equal(isCalendarDate('2023-02-29'),false);assert.equal(isCalendarDate('2024-02-29'),true);assert.equal(isCalendarDate('2026-02-30'),false);
});
test('civil-date arithmetic survives DST and extreme host timezones',()=>{
 for(const zone of ['America/New_York','Pacific/Kiritimati','Pacific/Honolulu']){
  const result=execFileSync(process.execPath,['--input-type=module','-e',`import {addCalendarDays} from './calendar-model.js'; console.log(['2026-03-07','2026-03-08','2026-10-31','2026-11-01'].map(d=>addCalendarDays(d,1)).join(','));`],{cwd:new URL('../',import.meta.url),env:{...process.env,TZ:zone}}).toString().trim();
  assert.equal(result,'2026-03-08,2026-03-09,2026-11-01,2026-11-02');
 }
 assert.equal(todayInCourse('America/New_York',new Date('2026-03-08T02:30:00Z')),'2026-03-07');
 assert.equal(addCalendarDays('2024-02-28',1),'2024-02-29');
});
test('term endpoints, ISO Sundays and teaching weekdays are respected',()=>{
 const m=build({course:{...course,first_day:'2026-09-04',last_day:'2026-09-07'}});
 assert.equal(m.summary.confirmedDays,2);assert.equal(m.availability('2026-09-03'),'outside term');assert.equal(m.availability('2026-09-05'),'non-teaching weekday');
 assert.equal(build({course:{...course,teaching_weekdays:[7]}}).summary.confirmedDays,4);
});
test('No Lesson blocks capacity; other effects stay explicitly uncertain',()=>{
 const exceptions=['No Lesson','Replace Lesson','Continue Lesson'].map((effect,i)=>({id:String(i),course_id:'c',date:`2026-09-0${i+1}`,effect,title:effect}));
 const m=build({exceptions});assert.equal(m.summary.confirmedDays,19);assert.equal(m.summary.uncertainDays,2);assert.equal(m.availability('2026-09-01'),'blocked');assert.equal(m.availability('2026-09-02'),'uncertain');assert.equal(codes(m).filter(x=>x==='ambiguous-effect').length,2);
});
test('one and multi-day lessons use duration rather than record count',()=>{
 const m=build({lessons:[lesson('one',{scheduled_dates:['2026-09-01']}),lesson('two',{duration_days:2,scheduled_dates:['2026-09-02','2026-09-03']})]});
 assert.equal(m.summary.requiredDays,3);assert.equal(m.summary.savedLessonDays,3);assert.equal(m.incomplete.length,0);
 assert.equal(m.days['2026-09-03'].lessons[0].id,'two');assert.equal(m.pacing[0].unit.target_days,9);
});
test('same-day overlap does not erase either lesson or double available capacity',()=>{
 const m=build({lessons:[lesson('a',{scheduled_dates:['2026-09-01']}),lesson('b',{scheduled_dates:['2026-09-01']})]});
 assert.equal(m.days['2026-09-01'].lessons.length,2);assert.equal(m.summary.occupiedDates,1);assert.equal(m.summary.savedLessonDays,2);assert.ok(codes(m).includes('overlap'));
});
test('invalid, duplicate and incomplete dates produce warnings without fabricating placements',()=>{
 const m=build({lessons:[lesson('a',{duration_days:3,scheduled_dates:['2026-09-01','2026-09-01','2026-02-30']}),lesson('b',{scheduled_dates:null}),lesson('c',{scheduled_dates:'bad'})]});
 assert.equal(m.incomplete.length,3);assert.equal(m.unscheduled[0].id,'b');assert.equal(m.days['2026-02-30'],undefined);assert.ok(codes(m).includes('saved-dates'));assert.equal(m.summary.savedLessonDays,1);
});
test('missing bounds and weekdays are unknown, never default fabricated capacity',()=>{
 assert.equal(build({course:{id:'c'}}).summary.capacityKnown,false);
 assert.equal(build({course:{...course,first_day:'2026-09-30',last_day:'2026-09-01'}}).summary.capacityKnown,false);
 assert.equal(build({course:{...course,teaching_weekdays:[0]}}).summary.capacityKnown,false);
 assert.equal(build({lessons:[lesson('a',{duration_days:null})]}).feasibility.length,0);
});
test('protected pins collide with closures while flexible preferences remain soft',()=>{
 const m=build({lessons:[lesson('pin',{protected_pin_date:'2026-09-01'}),lesson('flex',{position:2,flexible_preference_date:'2026-09-01'})],exceptions:[{id:'e',course_id:'c',date:'2026-09-01',effect:'No Lesson',title:'Closure'}]});
 assert.ok(m.warnings.some(w=>w.code==='pin-unavailable'&&w.lessonId==='pin'));assert.equal(m.feasibility.find(x=>x.lessonId==='pin').state,'unplaceable');assert.equal(m.feasibility.find(x=>x.lessonId==='flex').state,'fits');assert.equal(m.days['2026-09-01'].lessons.length,0);assert.equal(m.days['2026-09-01'].pins.length,1);
});
test('over-capacity and ordered protected constraints identify unplaceable lessons',()=>{
 const short={...course,first_day:'2026-09-01',last_day:'2026-09-02'};
 const m=build({course:short,lessons:[lesson('a',{duration_days:2}),lesson('b',{position:2})]});
 assert.ok(codes(m).includes('capacity'));assert.equal(m.feasibility[1].state,'unplaceable');
 const pinned=build({course:short,lessons:[lesson('a',{duration_days:2}),lesson('b',{position:2,protected_pin_date:'2026-09-02'})]});
 assert.equal(pinned.feasibility[0].state,'unplaceable');assert.equal(pinned.feasibility[1].state,'fits');
});
test('multi-day feasibility skips weekends and closures and preserves future pin capacity',()=>{
 const m=build({course:{...course,first_day:'2026-09-04',last_day:'2026-09-09'},lessons:[lesson('a',{duration_days:2}),lesson('b',{position:2,protected_pin_date:'2026-09-09'})],exceptions:[{id:'e',course_id:'c',date:'2026-09-07',effect:'No Lesson',title:'Holiday'}]});
 assert.equal(m.summary.confirmedDays,3);assert.ok(m.feasibility.every(x=>x.state==='fits'));
});
test('duplicate pins and out-of-order pins are diagnosed',()=>{
 const m=build({lessons:[lesson('a',{protected_pin_date:'2026-09-03'}),lesson('b',{position:2,protected_pin_date:'2026-09-02'})]});
 assert.ok(codes(m).includes('unplaceable'));
 const same=build({lessons:[lesson('a',{protected_pin_date:'2026-09-03'}),lesson('b',{position:2,protected_pin_date:'2026-09-03'})]});assert.ok(codes(same).includes('unplaceable'));
});
test('deterministic, immutable projections preserve identity and course boundaries',()=>{
 const input={course,units:[unit],lessons:[lesson('b'),lesson('a')],exceptions:[]};
 const before=JSON.stringify(input);const a=buildCalendarModel(input),b=buildCalendarModel({...input,lessons:[...input.lessons].reverse()});
 assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(input),before);assert.strictEqual(a.lessons[0],input.lessons[1]);
 assert.equal(build({lessons:[lesson('alien',{course_id:'other'})]}).lessons.length,0);
});
test('rendered saved facts, unscheduled records, preferences, types and pacing remain distinct',()=>{
 const html=renderSavedCalendar({course,units:[unit],lessons:[lesson('a',{lesson_type:'Assessment',flexible_preference_date:'2026-09-02'})],exceptions:[]},{view:'month',anchor:'2026-09-01',selected:'2026-09-02'});
 for(const s of ['Read-only saved calendar','Week / Agenda','Assessment','not pinned','Unscheduled lessons (1)','target 9','data-private-lesson="a"','Preference only (not a saved placement)'])assert.ok(html.includes(s),s);
 assert.equal(html.includes('data-private-save'),false);
});
test('empty course and large fictional course render without a second lesson state',()=>{
 const state={view:'month',anchor:'2026-09-01',selected:'2026-09-01'};
 assert.match(renderSavedCalendar({course:{id:'c'},lessons:[],units:[],exceptions:[]},state),/Capacity unknown/);
 const lessons=Array.from({length:80},(_,i)=>lesson('l'+i,{position:i+1}));
 const exceptions=Array.from({length:12},(_,i)=>({id:'e'+i,course_id:'c',date:addCalendarDays('2026-09-01',i),effect:'No Lesson',title:'Fictional closure '+i}));
 const m=build({lessons,exceptions});assert.equal(m.lessons.length,80);assert.equal(m.exceptions.length,12);assert.equal(m.unscheduled.length,80);assert.ok(codes(m).includes('capacity'));
 assert.match(renderSavedCalendar({course,units:[unit],lessons,exceptions},state),/Unscheduled lessons \(80\)/);
});

test('saved labels are HTML-escaped in every calendar surface',()=>{
 const html=renderSavedCalendar({course,units:[{...unit,title:'<svg onload="bad()">'}],lessons:[lesson('a',{title:'<script>bad()</script>',scheduled_dates:['2026-09-01']})],exceptions:[]},{view:'month',anchor:'2026-09-01',selected:'2026-09-01'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;svg'));assert.ok(!html.includes('<script>'));
});

test('saved dates out of sequence remain visible and produce a dated warning',()=>{
 const m=build({lessons:[lesson('a',{scheduled_dates:['2026-09-03']}),lesson('b',{position:2,scheduled_dates:['2026-09-01']})]});
 assert.ok(m.warnings.some(w=>w.code==='saved-order'&&w.lessonId==='b'&&w.date==='2026-09-01'));
 assert.equal(m.days['2026-09-01'].lessons[0].id,'b');
});
