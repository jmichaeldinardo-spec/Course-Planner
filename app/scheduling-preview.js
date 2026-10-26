import {activeCalendarRecords,isCalendarDate,addCalendarDays,calendarWeekday,savedCalendarDates} from './calendar-model.js';
import {normalizeEvent,eventDayState} from './event-effects.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export function schedulingSnapshotToken(snapshot){
 const byId=rows=>[...(rows||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id),'en'));
 return JSON.stringify(canonical({course:snapshot.course,units:byId(snapshot.units),lessons:byId(snapshot.lessons),exceptions:byId(snapshot.exceptions)}));
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const revisionOK=value=>/^[1-9]\d*$/.test(String(value??''));

export function previewSchedulingEvent(snapshot,proposal){
 const {course,units=[],lessons=[],exceptions=[]}=snapshot;
 const active=activeCalendarRecords(snapshot),conflicts=[],warnings=[];
 const block=(code,message,extra={})=>conflicts.push({code,message,...extra});
 const info=(code,message,extra={})=>warnings.push({code,message,...extra});
 const token=schedulingSnapshotToken(snapshot);
 if(proposal.expectedSnapshot!==token)block('stale-snapshot','Saved inputs changed or the preview basis is missing. Close, reload and preview again.');
 for(const [kind,records] of [['course',[course]],['unit',units],['lesson',lessons],['event',exceptions]]){
  const ids=new Set();for(const r of records){
   if(!r?.id||ids.has(r.id))block('identity',`Missing or duplicate ${kind} identity.`);ids.add(r?.id);
   if(kind!=='course'&&r.course_id!==course.id)block('foreign-record',`A ${kind} belongs to another course.`);
   if(!revisionOK(r.revision))block('revision',`Missing/invalid ${kind} revision; freshness cannot be checked.`);
  }
 }
 const bounded=isCalendarDate(course.first_day)&&isCalendarDate(course.last_day)&&course.first_day<=course.last_day&&(Date.parse(course.last_day)-Date.parse(course.first_day))/86400000<=3660;
 const weekdays=course.teaching_weekdays;
 if(!bounded)block('term','Set valid inclusive term bounds (at most 3660 days).');
 if(!Array.isArray(weekdays)||!weekdays.length||weekdays.some(n=>!Number.isInteger(n)||n<1||n>7)||new Set(weekdays).size!==weekdays.length)block('weekdays','Teaching weekdays must be distinct ISO values 1–7.');
 const termDates=[];
 if(bounded&&Array.isArray(weekdays)&&weekdays.every(n=>Number.isInteger(n)&&n>=1&&n<=7))for(let d=course.first_day;d<=course.last_day;d=addCalendarDays(d,1))if(weekdays.includes(calendarWeekday(d)))termDates.push(d);
 const teaching=new Set(termDates);
 const beforeEvents=exceptions.map(e=>normalizeEvent(e));
 const original=proposal.eventId?exceptions.find(e=>e.id===proposal.eventId):null;
 if(proposal.eventId&&!original)block('event-identity','The event to change is no longer in this course.');
 const draft={...proposal,id:original?.id??'unsaved-event',course_id:course.id,event_type:proposal.eventType,legacyEffect:original?.effect};
 const event=normalizeEvent(draft,{proposed:true});
 if(original&&normalizeEvent(original).availability==='closed'&&event.availability!=='closed')block('closure-constraint','A saved full closure cannot be reopened by changing the effect or its default. Keep the closure constraint; reclassification needs a separately reviewed policy.',{date:event.date});
 if(!String(event.title).trim())block('title','Enter an event title.');
 if(!isCalendarDate(event.date)||!bounded||event.date<course.first_day||event.date>course.last_day)block('event-date','Choose a valid event date inside this course term.');
 for(const message of event.errors)block('event-policy',message,{date:event.date});
 for(const message of event.uncertainties)info('subtype',message,{date:event.date});
 const afterEvents=[...beforeEvents.filter(e=>e.id!==original?.id),event].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
 function inspectEvents(events,label){
  for(const e of events){
   if(!isCalendarDate(e.date))block('saved-event-date',`${label}: an event has an invalid date.`);
   if(e.id!==event.id)for(const message of e.errors)block('saved-event-policy',`${e.title}: ${message}`,{date:e.date});
  }
  for(const date of [...new Set(events.map(e=>e.date))].sort()){
   const onDate=events.filter(e=>e.date===date);
   if(onDate.some(e=>e.effect==='Keep')&&onDate.some(e=>e.effect==='Move'||e.availability==='closed'||e.availability==='occupied'))block('event-conflict','Keep cannot bypass another event that removes ordinary instruction.',{date});
   if(onDate.filter(e=>e.availability!=='closed'&&e.effect==='Move').length>1)block('event-contention','Multiple activities claim the same ordinary instructional opportunity; clarify their allocation.',{date});
  }
 }
 inspectEvents(beforeEvents,'Saved events');inspectEvents(afterEvents,'Proposed events');
 const eligible=(date,events)=>teaching.has(date)&&eventDayState(events.filter(e=>e.date===date))==='instructional';
 const beforeAvailable=termDates.filter(d=>eligible(d,beforeEvents));
 const available=termDates.filter(d=>eligible(d,afterEvents));
 const availableSet=new Set(available),beforeIndex=new Map(beforeAvailable.map((d,i)=>[d,i]));
 const rows=active.lessons.map(l=>({lessonId:l.id,unitId:l.unit_id,position:l.position,before:[...savedCalendarDates(l)],proposed:null,protected:!!l.protected_pin_date,changed:false,status:'not assessed',unmetDuration:l.duration_days}));
 const positions=new Set(),occupied=new Map();let priorEnd=null,requiredDays=0;
 for(let i=0;i<active.lessons.length;i++){
  const l=active.lessons[i],dates=rows[i].before;
  if(!active.units.some(u=>u.id===l.unit_id))block('orphan','An active lesson has no active saved parent unit.',{lessonId:l.id});
  if(!Number.isInteger(l.position)||l.position<1||positions.has(l.position))block('order','Lesson order is missing or duplicated; clarify sequence before previewing.',{lessonId:l.id});positions.add(l.position);
  const validDuration=Number.isInteger(l.duration_days)&&l.duration_days>=1&&l.duration_days<=366;
  if(!validDuration)block('duration','A lesson needs a whole-day duration from 1–366.',{lessonId:l.id});else requiredDays+=l.duration_days;
  if(!Array.isArray(l.scheduled_dates)||dates.some(d=>!isCalendarDate(d))||new Set(dates).size!==dates.length||!same(dates,[...dates].sort()))block('saved-dates','Saved lesson dates are invalid, repeated or out of order.',{lessonId:l.id});
  if(dates.length!==l.duration_days)block('incomplete','An existing lesson is unscheduled or has incomplete duration. Establish its baseline before ripple scheduling.',{lessonId:l.id});
  for(const d of dates){
   if(!eligible(d,beforeEvents))block('before-unavailable','A saved placement is already on an unavailable date.',{lessonId:l.id,date:d});
   if(occupied.has(d))block('before-overlap','Two saved lessons already contend for one instructional day.',{lessonId:l.id,date:d});else occupied.set(d,l.id);
  }
  if(dates.length&&priorEnd&&dates[0]<=priorEnd)block('before-order','Saved dates contradict the canonical lesson order.',{lessonId:l.id});
  if(dates.length)priorEnd=dates.at(-1);
  if(dates.length>1&&dates.every(d=>beforeIndex.has(d))&&dates.some((d,j)=>j&&beforeIndex.get(d)!==beforeIndex.get(dates[j-1])+1))block('continuity','A multi-day lesson skips eligible saved days; continuity policy needs clarification.',{lessonId:l.id});
  if(l.protected_pin_date&&(!isCalendarDate(l.protected_pin_date)||!dates.includes(l.protected_pin_date)))block('pin-baseline','A protected pin is invalid or missing from its saved date array.',{lessonId:l.id});
  if(l.protected_pin_date&&l.flexible_preference_date)block('pin-preference','A lesson cannot have both a protected pin and soft preference.',{lessonId:l.id});
 }
 const baseBlocked=conflicts.length>0;
 if(!baseBlocked){
  let cursor=course.first_day,failed=false;
  for(let i=0;i<active.lessons.length;i++){
   const l=active.lessons[i],row=rows[i],nextPin=active.lessons.slice(i+1).find(x=>x.protected_pin_date),limit=nextPin?savedCalendarDates(nextPin)[0]:null;
   if(l.protected_pin_date){
    row.proposed=[...row.before];row.status='protected';row.unmetDuration=0;
    if(row.before.some(d=>!availableSet.has(d))||row.before[0]<cursor){block('protected-pin','The proposed event/ripple conflicts with a protected saved date array; the pin has not moved.',{lessonId:l.id,date:l.protected_pin_date});row.status='blocked commitment';failed=true;}
    cursor=addCalendarDays(row.before.at(-1),1);
   }else if(failed){row.status='not assessed after conflict';}
   else{
    const start=cursor>row.before[0]?cursor:row.before[0];
    const dates=[];let slotStart=start;
    for(let slot=0;slot<l.duration_days;slot++){
     const floor=slotStart>row.before[slot]?slotStart:row.before[slot];
     const date=available.find(d=>d>=floor&&(!limit||d<limit));
     if(!date)break;dates.push(date);slotStart=addCalendarDays(date,1);
    }
    if(dates.length!==l.duration_days){row.proposed=[];row.status='unplaceable';block(limit?'pin-contention':'capacity',limit?'The displaced lesson cannot fit before the next protected commitment.':'Insufficient eligible dates before term end; the lesson is wholly unplaced.',{lessonId:l.id,date:limit});failed=true;}
    else{row.proposed=dates;row.status='proposed';row.unmetDuration=0;cursor=addCalendarDays(dates.at(-1),1);}
   }
  }
 }
 for(let i=0;i<rows.length;i++){
  const row=rows[i],l=active.lessons[i];row.unmetDuration=Number.isInteger(l.duration_days)?Math.max(0,l.duration_days-(row.proposed||[]).filter(d=>availableSet.has(d)).length):null;row.changed=row.proposed!==null&&!same(row.before,row.proposed);
  if(row.proposed&&l.flexible_preference_date&&!row.proposed.includes(l.flexible_preference_date))info('soft-preference','The flexible preference is not met under ordered full-day ripple; it is not a protected pin.',{lessonId:l.id,date:l.flexible_preference_date});
 }
 const touchedDates=new Set([event.date,original?.date].filter(Boolean));
 const affectedIds=rows.filter(r=>r.changed||r.proposed===null||r.status==='unplaceable'||r.status==='blocked commitment'||r.before.some(d=>touchedDates.has(d))).map(r=>r.lessonId);
 const placements=Object.fromEntries(rows.map(r=>[r.lessonId,{before:r.before,proposed:r.proposed}]));
 const occupiedProposed=new Set(rows.flatMap(r=>r.proposed||[]).filter(d=>availableSet.has(d)));
 return {basisToken:token,eventChange:{action:original?'change':'add',before:original?normalizeEvent(original):null,proposed:event},
  valid:conflicts.length===0,applyEnabled:false,conflicts,warnings,rows,placements,affectedIds,
  commitments:rows.filter(r=>r.protected).map(r=>({lessonId:r.lessonId,dates:r.before})),
  availability:{before:beforeAvailable,proposed:available,reserved:termDates.filter(d=>!availableSet.has(d)),events:afterEvents},
  totals:{activeUnits:active.units.length,activeLessons:active.lessons.length,excludedUnits:units.filter(u=>u.course_id===course.id).length-active.units.length,excludedLessons:lessons.filter(l=>l.course_id===course.id).length-active.lessons.length,
   requiredDays,beforeConsumedDays:rows.reduce((s,r)=>s+r.before.length,0),availableDays:available.length,reservedDays:termDates.length-available.length,consumedDays:occupiedProposed.size,
   notPlacedLessons:rows.filter(r=>r.proposed===null||r.proposed.length!==active.lessons.find(l=>l.id===r.lessonId).duration_days||r.proposed.some(d=>!availableSet.has(d))).length,
   unmetDays:rows.reduce((sum,r)=>sum+Math.max(0,(Number.isInteger(r.unmetDuration)?r.unmetDuration:0)),0)},
  assumptions:['Whole-date slots only; no fractional time or Extend.','Rightward ripple retains saved starts as lower bounds; no automatic course compression.','All saved dates of pinned lessons are protected in this preview; pin-span semantics need review before writes.']};
}
