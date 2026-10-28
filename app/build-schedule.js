import {activeCalendarRecords,isCalendarDate,addCalendarDays,calendarWeekday,savedCalendarDates} from './calendar-model.js';
import {normalizeEvent,eventDayState} from './event-effects.js';
import {schedulingSnapshotToken} from './scheduling-preview.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const duration=l=>Number.isInteger(l.duration_days)&&l.duration_days>=1&&l.duration_days<=366;

// WORKING/OPEN Phase 2A.5 policy. Projections contain IDs and date arrays only;
// saved records are never cloned into an editable schedule or changed here.
export function buildSchedule(snapshot,{startDate,unitId=null,expectedSnapshot}={}){
 const {course,units=[],lessons=[],exceptions=[]}=snapshot;
 const active=activeCalendarRecords(snapshot),basisToken=schedulingSnapshotToken(snapshot),conflicts=[],warnings=[];
 const block=(code,message,lessonId=null)=>conflicts.push({code,message,lessonId});
 const rows=active.lessons.map(l=>({lessonId:l.id,unitId:l.unit_id,before:[...savedCalendarDates(l)],proposed:null,state:'not assessed',protected:!!l.protected_pin_date,requiredDays:duration(l)?l.duration_days:null}));
 if(expectedSnapshot!==basisToken)block('stale','Saved inputs changed. Reload and build a fresh proposal.');
 const term=isCalendarDate(course.first_day)&&isCalendarDate(course.last_day)&&course.first_day<=course.last_day&&(Date.parse(course.last_day)-Date.parse(course.first_day))/86400000<=3660;
 const weekdays=course.teaching_weekdays;
 const validWeekdays=Array.isArray(weekdays)&&weekdays.length&&weekdays.every(n=>Number.isInteger(n)&&n>=1&&n<=7)&&new Set(weekdays).size===weekdays.length;
 if(!term)block('term','Valid course term bounds (up to ten years) are required.');
 if(!validWeekdays)block('weekdays','Specify distinct teaching weekdays (ISO 1–7).');
 if(!isCalendarDate(startDate)||!term||startDate<course.first_day||startDate>course.last_day)block('anchor','Choose an explicit start date inside the saved course term.');
 if(unitId&&!active.units.some(u=>u.id===unitId))block('scope','The selected unit is no longer active in this course.');
 for(const [kind,records] of [['course',[course]],['unit',units],['lesson',lessons],['event',exceptions]]){
  const ids=new Set();for(const r of records){
   if(!r?.id||ids.has(r.id))block('identity',`Missing or duplicated ${kind} identity.`);ids.add(r?.id);
   if(kind!=='course'&&r.course_id!==course.id)block('foreign',`A ${kind} belongs to another course.`);
   if(!/^[1-9]\d*$/.test(String(r.revision??'')))block('revision',`Missing or invalid ${kind} revision.`);
  }
 }
 const events=exceptions.map(e=>normalizeEvent(e));
 for(const e of events){if(!isCalendarDate(e.date)||e.errors.length)block('event','An event has an invalid date or unresolved availability/effect. Clarify it before forecasting.');}
 for(const date of new Set(events.map(e=>e.date))){
  const on=events.filter(e=>e.date===date);
  if(on.some(e=>e.effect==='Keep')&&on.some(e=>e.effect==='Move')||on.filter(e=>e.effect==='Move'&&e.availability!=='closed').length>1)block('event-conflict','Multiple events have unresolved claims on one instructional date.');
 }
 const eligible=[];
 if(term&&validWeekdays)for(let d=course.first_day;d<=course.last_day;d=addCalendarDays(d,1))if(weekdays.includes(calendarWeekday(d))&&eventDayState(events.filter(e=>e.date===d))==='instructional')eligible.push(d);
 const available=new Set(eligible),indices=new Map(eligible.map((d,i)=>[d,i])),occupied=new Set(),positions=new Set();let priorEnd=null;
 for(let i=0;i<active.lessons.length;i++){
  const l=active.lessons[i],dates=rows[i].before;
  if(!active.units.some(u=>u.id===l.unit_id))block('parent','An active lesson has no active parent unit.',l.id);
  if(!Number.isInteger(l.position)||l.position<1||positions.has(l.position))block('order','Lesson sequence positions must be distinct positive integers.',l.id);positions.add(l.position);
  if(!duration(l))block('duration','A whole-day lesson duration from 1–366 is required.',l.id);
  if(!Array.isArray(l.scheduled_dates)||dates.some(d=>!isCalendarDate(d))||new Set(dates).size!==dates.length||!same(dates,[...dates].sort()))block('dates','Saved dates are invalid, repeated or out of order.',l.id);
  if(dates.length>l.duration_days)block('dates','Saved dates exceed the required duration.',l.id);
  for(const d of dates){if(!available.has(d))block('saved-unavailable','A saved date conflicts with availability; it will not be moved.',l.id);if(occupied.has(d))block('overlap','Saved lessons overlap; no automatic repair is proposed.',l.id);occupied.add(d);}
  if(dates.length&&priorEnd&&dates[0]<=priorEnd)block('saved-order','Saved dates contradict lesson order.',l.id);
  if(dates.length)priorEnd=dates.at(-1);
  if(dates.length>1&&dates.some((d,j)=>j&&indices.get(d)!==indices.get(dates[j-1])+1))block('continuity','A saved multi-day lesson has an unresolved gap/continuity policy.',l.id);
  if(l.protected_pin_date&&(!isCalendarDate(l.protected_pin_date)||!dates.includes(l.protected_pin_date)))block('pin','A pin without its complete saved date array needs a reviewed initial-placement policy.',l.id);
  if(l.protected_pin_date&&l.flexible_preference_date)block('pin-preference','A lesson cannot have both a protected pin and a flexible preference.',l.id);
 }
 const baselineBlocked=conflicts.length>0;
 if(!baselineBlocked){
  let cursor=course.first_day,unresolved=false;
  for(let i=0;i<rows.length;i++){
   const row=rows[i],l=active.lessons[i];
   if(row.before.length){
    if(row.before.length!==l.duration_days){row.state='not assessed — partial saved lesson';block('partial','A partially saved multi-day lesson needs an explicit completion policy; its saved dates remain intact.',l.id);unresolved=true;}
    else{row.proposed=[...row.before];row.state=l.protected_pin_date?'protected saved commitment':'confirmed saved placement';}
    cursor=addCalendarDays(row.before.at(-1),1);continue;
   }
   if(unitId&&l.unit_id!==unitId){row.state='not assessed — outside selected unit';unresolved=true;continue;}
   if(unresolved){row.state='not assessed — earlier work unresolved';continue;}
   const nextSaved=rows.slice(i+1).find(r=>r.before.length),limit=nextSaved?.before[0]??addCalendarDays(course.last_day,1);
   const floor=cursor>startDate?cursor:startDate;
   const dates=eligible.filter(d=>d>=floor&&d<limit).slice(0,l.duration_days);
   if(dates.length!==l.duration_days){row.proposed=[];row.state='unplaceable within fixed saved commitments';block('capacity',nextSaved?'Not enough eligible dates before the next saved lesson. Saved placements stay fixed.':'Not enough eligible dates before term end.',l.id);unresolved=true;continue;}
   row.proposed=dates;row.state='tentative — unsaved';cursor=addCalendarDays(dates.at(-1),1);
   if(l.flexible_preference_date&&!dates.includes(l.flexible_preference_date))warnings.push({code:'preference',lessonId:l.id,message:'Flexible preference is unmet. Earliest ordered fit is used; preferences do not reserve dates or move saved lessons.'});
  }
 }
 const tentative=rows.filter(r=>r.state==='tentative — unsaved'),used=new Set([...occupied,...tentative.flatMap(r=>r.proposed)]);
 return {basisToken,configuration:{startDate,unitId},valid:conflicts.length===0&&rows.every(r=>r.proposed?.length===r.requiredDays),applyEnabled:false,rows,conflicts,warnings,
  capacity:{known:term&&!!validWeekdays&&!conflicts.some(c=>['event','event-conflict'].includes(c.code)),eligibleDays:eligible.length,requiredDays:rows.reduce((n,r)=>n+(r.requiredDays||0),0),unknownDurations:rows.filter(r=>r.requiredDays===null).length,savedAssignments:rows.reduce((n,r)=>n+r.before.length,0),tentativeDays:tentative.reduce((n,r)=>n+r.proposed.length,0),remainingDays:Math.max(0,eligible.length-[...used].filter(d=>available.has(d)).length)},
  totals:{activeLessons:rows.length,activeUnits:active.units.length,confirmedLessons:rows.filter(r=>r.before.length===r.requiredDays).length,tentativeLessons:tentative.length,notAssessed:rows.filter(r=>r.proposed===null).length,unplaceable:rows.filter(r=>r.proposed?.length===0).length,baselineUnscheduled:rows.filter(r=>!r.before.length).length},
  assumptions:['WORKING/OPEN: saved dates are fixed, including ordinary placements; pinned lessons protect their whole saved array.','WORKING/OPEN: wholly unscheduled lessons use earliest eligible dates from the explicit anchor, in canonical order; full-day allocation is all-or-nothing.','Partial saved arrays, unknown availability, initial pins, reserved flex and multi-day gaps need policy review. No automatic repair, compression or Extend.','Unit scope never hides whole-course constraints. Unscheduled work outside scope can prevent a later estimate.']};
}

// Display horizon is independent of scheduling policy. Distant daily proposals
// stay out of the calendar; only opt-in review comparisons disclose full arrays.
export function planningOutlook(snapshot,result,{focusDate,weeks=4}={}){
 const active=activeCalendarRecords(snapshot),fresh=!!result&&result.basisToken===schedulingSnapshotToken(snapshot);
 const window=isCalendarDate(focusDate)&&[2,4,6].includes(weeks)?{start:focusDate,end:addCalendarDays(focusDate,weeks*7-1),weeks}:null;
 const rows=fresh?result.rows:[],byDate={};
 for(const r of rows.filter(r=>r.state==='tentative — unsaved'))for(const date of r.proposed)if(window&&date>=window.start&&date<=window.end)(byDate[date]??=[]).push(r.lessonId);
 const milestones=active.units.map(u=>{
  const ls=active.lessons.filter(l=>l.unit_id===u.id),rs=ls.map(l=>rows.find(r=>r.lessonId===l.id));
  const saved=ls.every(l=>duration(l)&&savedCalendarDates(l).length===l.duration_days&&savedCalendarDates(l).every(isCalendarDate));
  const complete=ls.length>0&&(fresh?rs.every(r=>r?.proposed?.length===r?.requiredDays):saved);
  const dates=complete?(fresh?rs.flatMap(r=>r.proposed):ls.flatMap(savedCalendarDates)).sort():[];
  return {unitId:u.id,state:complete?(fresh&&rs.some(r=>r.state==='tentative — unsaved')?'estimated — unsaved':'saved reference range'):'cannot estimate',start:dates[0]??null,end:dates.at(-1)??null,lessonCount:ls.length};
 });
 const assessments=active.lessons.filter(l=>/assessment/i.test(l.lesson_type||'')).map(l=>{
  const r=rows.find(r=>r.lessonId===l.id),dates=fresh?r?.proposed:savedCalendarDates(l),known=duration(l)&&dates?.length===l.duration_days&&dates.every(isCalendarDate);
  return {lessonId:l.id,state:known?(r?.state==='tentative — unsaved'?'estimated — unsaved':l.protected_pin_date?'protected saved anchor':'saved reference anchor'):'cannot estimate',dates:known?[...dates]:null};
 });
 return {fresh,stale:!!result&&!fresh,window,byDate,milestones,assessments};
}
