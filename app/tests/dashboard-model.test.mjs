import test from 'node:test';
import assert from 'node:assert/strict';
import {needsAttention} from '../dashboard-model.js';
const course={id:'c1',name:'Fictional civics',owner_id:'owner',timezone:'America/New_York'};
const units=[{id:'u1',course_id:'c1',title:'Foundations',position:1},{id:'u2',course_id:'c1',title:'Archived unit',archived_at:'2026-01-01',position:2}];
const lesson=(id,status,dates=[],unit_id='u1')=>({id,course_id:'c1',unit_id,title:id,planning_status:status,scheduled_dates:dates,position:Number(id.slice(1))||1});
test('Needs Attention uses real statuses and overlapping neutral unscheduled facts',()=>{
 const records={course,units,lessons:[lesson('l1','Draft'),lesson('l2','In Progress',['2026-10-26']),lesson('l3','Ready'),lesson('l4','Ready',['2026-10-27']),lesson('l5','Needs Revision',['2026-10-27'])]};
 const before=JSON.stringify(records),r=needsAttention(records);
 assert.equal(r.unique,3);assert.equal(r.groups.draft.count,1);assert.equal(r.groups.inProgress.count,1);assert.equal(r.groups.unscheduled.count,2);assert.equal(r.unknownStatuses,1);assert.equal(JSON.stringify(records),before);
 assert.deepEqual(Object.keys(r.groups),['draft','inProgress','unscheduled']);
});
test('archives, foreign courses and invalid dates remain distinct',()=>{
 const r=needsAttention({course,units,lessons:[{...lesson('l1','Draft'),archived_at:'2026-01-01'},lesson('l2','Draft',[],'u2'),{...lesson('l3','Draft'),course_id:'other'},lesson('l4','Ready',['bad']),lesson('l5','Ready','bad')]});
 assert.equal(r.unique,0);assert.equal(r.invalidDates,2);assert.equal(r.groups.unscheduled.count,0);
});
test('bounded attention lists retain exact totals and empty courses',()=>{
 const r=needsAttention({course,units,lessons:Array.from({length:1201},(_,i)=>lesson('l'+(i+1),'Draft'))});
 assert.equal(r.unique,1201);assert.equal(r.groups.draft.count,1201);assert.equal(r.groups.draft.items.length,20);
 assert.equal(needsAttention({course,units:[],lessons:[]}).unique,0);
});

import {dashboardWeek,readDashboardCourse,projectDashboardCourse,combineDashboard} from '../dashboard-model.js';
const week=dashboardWeek({date:'2026-10-27',timezone:'America/New_York'}),user={id:'owner'};
test('dashboard week is Monday–Sunday, including Sunday, DST and invalid zone fallback',()=>{
 assert.equal(week.start,'2026-10-26');assert.equal(week.end,'2026-11-01');
 assert.equal(dashboardWeek({date:'2026-11-01',timezone:'Pacific/Auckland'}).start,week.start);
 assert.equal(dashboardWeek({date:'2026-03-08',timezone:'America/New_York'}).start,'2026-03-02');
 const fallback=dashboardWeek({now:new Date('2026-10-27T01:00:00Z'),timezone:'Invalid/Zone'});assert.equal(fallback.timezone,'UTC');assert.equal(fallback.fallback,true);
 assert.equal(dashboardWeek({now:new Date('2026-10-26T01:00:00Z'),timezone:'America/New_York'}).start,'2026-10-19');
});
test('weekly agenda retains saved multiday dates, assessments, ambiguous events and per-course provenance',()=>{
 const records={course,units,lessons:[lesson('l1','Draft',['2026-10-26','2026-10-27','bad','2026-10-27']),{...lesson('l2','Ready',['2026-10-27']),lesson_type:'Assessment'},lesson('l3','Ready',[],'u2')],exceptions:[{id:'e1',course_id:course.id,date:'2026-10-27',title:'Closure',event_type:'Closure',effect:'No Lesson'},{id:'e2',course_id:course.id,date:'2026-10-27',title:'Closure',event_type:'Closure',effect:'Continue Lesson'},{id:'e3',course_id:course.id,date:'bad',title:'Missing date'},{id:'e4',course_id:'other',date:'2026-10-27',title:'Other owner event'}]};
 const original=JSON.stringify(records),p=projectDashboardCourse(records,user,week);
 assert.equal(p.days['2026-10-26'].count,1);assert.equal(p.days['2026-10-27'].count,4);assert.equal(p.invalidEvents,1);
 assert.deepEqual(p.days['2026-10-27'].entries.map(e=>e.kind),['exception','exception','assessment','lesson']);
 assert.equal(p.days['2026-10-27'].entries[0].uncertain,false);assert.equal(p.days['2026-10-27'].entries[1].uncertain,true);
 assert.equal(p.days['2026-10-27'].entries.at(-1).multiday,true);assert.equal(JSON.stringify(records),original);
 const other={...p,courseId:'c2',courseName:'Second course',days:Object.fromEntries(Object.entries(p.days).map(([date,d])=>[date,{...d,entries:d.entries.map(e=>({...e,courseId:'c2',courseName:'Second course'}))}]))};
 const combined=combineDashboard([p,other],week);assert.equal(combined.days[1].count,8);assert.equal(combined.days[1].entries.filter(e=>e.kind==='exception').length,4);
});
test('owner boundary, invalid timezone and dense/empty weeks are explicit without generated dates',()=>{
 assert.throws(()=>projectDashboardCourse({course,units,lessons:[],exceptions:[]},{id:'someone-else'},week),/account/);
 const p=projectDashboardCourse({course:{...course,timezone:null},units,lessons:Array.from({length:1201},(_,i)=>lesson('l'+i,'Ready',['2026-10-26'])),exceptions:null},user,week);
 assert.equal(p.timezoneUnknown,true);assert.equal(p.eventError,true);assert.equal(p.days[week.start].count,1201);assert.equal(p.days[week.start].entries.length,20);
 assert.equal(combineDashboard([],week).days.length,7);assert.equal(combineDashboard([],week).attention.unique,0);
});
function dataClient({failEvents=false}={}){
 const db={courses:[course,{...course,id:'other',owner_id:'someone-else'}],units,lessons:Array.from({length:1201},(_,i)=>lesson('l'+i,'Draft')),calendar_exceptions:[]},reads=[];
 return {reads,from(table){let filters=[],bounds=null;return {select(columns){reads.push({table,columns,filters});return this;},eq(k,v){filters.push([k,v]);return this;},order(){return this;},range(a,b){bounds=[a,b];return this;},single(){return run(true);},then(a,b){return run().then(a,b);}};
 async function run(single=false){if(table==='calendar_exceptions'&&failEvents)return {data:null,error:{message:'Events unavailable'}};let rows=db[table].filter(r=>filters.every(([k,v])=>r[k]===v));if(bounds)rows=rows.slice(bounds[0],bounds[1]+1);return {data:single?rows[0]:rows,error:null};}}};
}
test('dashboard loader uses owner/course filters, bounded pagination and partial event failure',async()=>{
 const client=dataClient({failEvents:true}),r=await readDashboardCourse(client,user,course.id);
 assert.equal(r.lessons.length,1201);assert.equal(r.exceptions,null);
 assert.ok(client.reads.filter(r=>r.table==='courses').every(r=>r.filters.some(([k,v])=>k==='owner_id'&&v===user.id)));
 assert.ok(client.reads.filter(r=>r.table!=='courses').every(r=>r.filters.some(([k,v])=>k==='course_id'&&v===course.id)&&!r.columns.includes('*')&&!r.columns.includes('objective')));
 await assert.rejects(()=>readDashboardCourse(client,{id:'someone-else'},course.id),/account/);
 await assert.rejects(()=>readDashboardCourse(client,null,course.id),/Sign in/);
});

test('missing dates are neutral unscheduled facts; repeated or invalid dates remain unclear',()=>{
 const a=lesson('l1','Ready');delete a.scheduled_dates;
 const b={...lesson('l2','Ready'),scheduled_dates:null};
 const c=lesson('l3','Ready',['2026-10-27','2026-10-27']);
 const r=needsAttention({course,units,lessons:[a,b,c]});assert.equal(r.groups.unscheduled.count,2);assert.equal(r.invalidDates,1);
 assert.equal(dashboardWeek({date:'invalid',now:new Date('2026-10-27T12:00:00Z'),timezone:'UTC'}).start,'2026-10-26');
});
