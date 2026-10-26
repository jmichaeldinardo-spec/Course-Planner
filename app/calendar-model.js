import {normalizeEvent,eventDayState} from "./event-effects.js";
/* Read-only projections of canonical saved records. Civil dates use UTC solely
 * for arithmetic: never parse a database DATE as an instant in the host zone. */
export function isCalendarDate(value) {
 if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T12:00:00Z");
 return Number.isFinite(+date) && date.toISOString().slice(0,10)===value;
}
export function addCalendarDays(date,days){
 const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
}
export const calendarWeekday=date=>new Date(date+"T12:00:00Z").getUTCDay()||7;
export const weekStart=date=>addCalendarDays(date,-(calendarWeekday(date)%7));
export function shiftCalendarMonth(date,amount){
 const d=new Date(date.slice(0,7)+"-01T12:00:00Z");d.setUTCMonth(d.getUTCMonth()+amount);
 return d.toISOString().slice(0,10);
}
export function calendarMonth(date){
 const first=date.slice(0,7)+"-01",next=shiftCalendarMonth(first,1);
 const last=addCalendarDays(next,-1),start=weekStart(first);
 const count=Math.ceil(((Date.parse(last+"T12:00:00Z")-Date.parse(start+"T12:00:00Z"))/86400000+1)/7)*7;
 return Array.from({length:count},(_,i)=>({date:addCalendarDays(start,i),inMonth:addCalendarDays(start,i).slice(0,7)===first.slice(0,7)}));
}
export function calendarDateLabel(date,options={dateStyle:"full"}){
 return new Intl.DateTimeFormat("en-US",{...options,timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
}
export function todayInCourse(timezone,now=new Date()){
 try{const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=type=>parts.find(x=>x.type===type).value;return `${part("year")}-${part("month")}-${part("day")}`;
 }catch{return now.toISOString().slice(0,10);}
}
export const savedCalendarDates=lesson=>Array.isArray(lesson.scheduled_dates)?lesson.scheduled_dates:[];
const order=(a,b)=>(a.position-b.position)||String(a.id).localeCompare(String(b.id),"en");
const duration=l=>Number.isInteger(l.duration_days)&&l.duration_days>=1&&l.duration_days<=366?l.duration_days:null;

// Calendar scope only: keep the complete saved collections for recovery/export.
// Archiving a unit suppresses its lessons without changing their own archive flags.
// Missing units remain diagnostic errors rather than silently hiding their lessons.
export function activeCalendarRecords({course,units=[],lessons=[]}){
 const courseUnits=units.filter(u=>u.course_id===course.id);
 const archivedUnits=new Set(courseUnits.filter(u=>u.archived_at!=null).map(u=>u.id));
 return {
  units:courseUnits.filter(u=>u.archived_at==null).sort(order),
  lessons:lessons.filter(l=>l.course_id===course.id&&l.archived_at==null&&!archivedUnits.has(l.unit_id)).sort(order)
 };
}

export function buildCalendarModel({course,units=[],lessons=[],exceptions=[]}){
 // Derived collections only. No edits, database calls, or second lesson store.
 const {units:unitList,lessons:lessonList}=activeCalendarRecords({course,units,lessons});
 const exceptionList=exceptions.filter(e=>e.course_id===course.id).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
 const days={},warnings=[];
 const warn=(code,message,date=null,lessonId=null)=>warnings.push({code,message,date,lessonId});
 const day=date=>days[date]??= {date,lessons:[],exceptions:[],pins:[],preferences:[]};
 const weekdays=Array.isArray(course.teaching_weekdays)?[...new Set(course.teaching_weekdays)].sort((a,b)=>a-b):[];
 const validWeekdays=weekdays.length>0&&weekdays.every(n=>Number.isInteger(n)&&n>=1&&n<=7);
 const validTerm=isCalendarDate(course.first_day)&&isCalendarDate(course.last_day)&&course.first_day<=course.last_day;
 const bounded=validTerm&&(Date.parse(course.last_day)-Date.parse(course.first_day))/86400000<=3660;
 if(!bounded)warn("term","Set valid term bounds (up to ten years) to assess instructional capacity.");
 if(!validWeekdays)warn("weekdays","Teaching weekdays are missing or invalid; capacity is unknown.");
 try{new Intl.DateTimeFormat("en-US",{timeZone:course.timezone}).format();if(!course.timezone)throw Error();}catch{warn("timezone","Course timezone is missing or invalid. Saved civil dates are still shown unchanged.");}
 for(const e of exceptionList){
  if(!isCalendarDate(e.date)){warn("exception-date",`Exception “${e.title}” has no valid saved date.`);continue;}
  day(e.date).exceptions.push(e);
  if(normalizeEvent(e).errors.length)warn("ambiguous-effect",`“${e.title}”: ${e.effect||"missing effect"} — instructional capacity is uncertain; clarify event constraints.`,e.date);
 }
 function availability(date){
  if(!bounded||!validWeekdays)return "unknown";
  if(date<course.first_day||date>course.last_day)return "outside term";
  if(!weekdays.includes(calendarWeekday(date)))return "non-teaching weekday";
  const effects=days[date]?.exceptions||[];
  return eventDayState(effects.map(e=>normalizeEvent(e)));
 }
 const instructionalDates=[],uncertainDates=[];
 if(bounded&&validWeekdays)for(let d=course.first_day;d<=course.last_day;d=addCalendarDays(d,1)){
  const state=availability(d);if(state==="instructional")instructionalDates.push(d);if(state==="uncertain")uncertainDates.push(d);
 }
 let demand=0,savedLessonDays=0,unknownDurations=0;
 const unscheduled=[],incomplete=[];
 let priorSavedEnd=null;
 for(const l of lessonList){
  const n=duration(l);if(n===null){unknownDurations++;warn("duration",`“${l.title}” has an invalid duration.`,null,l.id);}else demand+=n;
  if(!unitList.some(u=>u.id===l.unit_id))warn("unit",`“${l.title}” has no matching saved unit.`,null,l.id);
  const raw=savedCalendarDates(l);
  const dates=[...new Set(raw.filter(isCalendarDate))].sort();
  if(raw.length!==dates.length || (!Array.isArray(l.scheduled_dates)&&l.scheduled_dates!=null))warn("saved-dates",`“${l.title}” has invalid or repeated saved dates.`,null,l.id);
  if(!dates.length)unscheduled.push(l);
  if(dates.length){
   if(priorSavedEnd&&dates[0]<priorSavedEnd)warn("saved-order",`“${l.title}” starts before an earlier sequence lesson ends (${priorSavedEnd}).`,dates[0],l.id);
   priorSavedEnd=priorSavedEnd&&priorSavedEnd>dates.at(-1)?priorSavedEnd:dates.at(-1);
  }
  if(n!==null&&dates.length!==n){incomplete.push(l);warn("duration-mismatch",`“${l.title}”: ${dates.length} saved day(s) for ${n} required day(s).`,null,l.id);}
  for(const d of dates){day(d).lessons.push(l);savedLessonDays++;
   const state=availability(d);if(state!=="instructional")warn("saved-unavailable",`“${l.title}” is saved on a date marked ${state}.`,d,l.id);
  }
  const pin=l.protected_pin_date,preference=l.flexible_preference_date;
  if(pin){
   if(!isCalendarDate(pin))warn("pin-date",`“${l.title}” has an invalid protected pin.`,null,l.id);
   else{day(pin).pins.push(l);const state=availability(pin);
    if(state!=="instructional")warn("pin-unavailable",`Protected pin for “${l.title}” conflicts with ${state}.`,pin,l.id);
    if(!dates.includes(pin))warn("pin-mismatch",`Protected pin for “${l.title}” is not in its saved dates.`,pin,l.id);
   }
  }
  if(preference){
   if(!isCalendarDate(preference))warn("preference-date",`“${l.title}” has an invalid flexible preference.`,null,l.id);
   else{day(preference).preferences.push(l);if(availability(preference)!=="instructional"||!dates.includes(preference))warn("preference",`Flexible preference for “${l.title}” is unmet or unavailable; it is not a pin.`,preference,l.id);}
  }
 }
 for(const d of Object.keys(days).sort())if(days[d].lessons.length>1)warn("overlap",`${days[d].lessons.length} lessons share one day's capacity.`,d);
 if(bounded&&validWeekdays&&demand>instructionalDates.length)warn("capacity",`${demand} required lesson days exceed ${instructionalDates.length} confirmed instructional days by ${demand-instructionalDates.length}${uncertainDates.length?`; ${uncertainDates.length} uncertain day(s) excluded`:""}.`);
 // Bounded feasibility only: one lesson-day per confirmed instructional date,
 // canonical sequence order, hard pins as starts. No proposed dates are returned.
 // Soft preferences deliberately do not reserve capacity or change order.
 const feasibility=[];let cursor=0;
 if(bounded&&validWeekdays&&!unknownDurations){
  for(let i=0;i<lessonList.length;i++){
   const l=lessonList[i],n=duration(l),pin=l.protected_pin_date;
   const start=pin?instructionalDates.indexOf(pin):cursor;
   const nextPin=lessonList.slice(i+1).find(x=>x.protected_pin_date);
   const nextIndex=nextPin?instructionalDates.indexOf(nextPin.protected_pin_date):-1;
   let reason=null;
   if(pin&&start<0)reason="Protected date is unavailable.";
   else if(start<cursor)reason="Protected date conflicts with lesson order or another pin.";
   else if(nextIndex>=0&&start+n>nextIndex)reason="Insufficient confirmed capacity before the next protected lesson.";
   else if(start+n>instructionalDates.length)reason="Insufficient confirmed capacity before term end.";
   if(reason){feasibility.push({lessonId:l.id,state:"unplaceable",reason});warn("unplaceable",`“${l.title}”: ${reason}`,pin||null,l.id);}
   else{cursor=start+n;feasibility.push({lessonId:l.id,state:"fits"});}
  }
 }
 const pacing=unitList.map(u=>({unit:u,requiredDays:lessonList.filter(l=>l.unit_id===u.id).reduce((s,l)=>s+(duration(l)||0),0),savedDays:lessonList.filter(l=>l.unit_id===u.id).reduce((s,l)=>s+new Set(savedCalendarDates(l).filter(isCalendarDate)).size,0)}));
 return {course,units:unitList,lessons:lessonList,exceptions:exceptionList,days,warnings,unscheduled,incomplete,feasibility,pacing,
  summary:{capacityKnown:bounded&&validWeekdays,confirmedDays:instructionalDates.length,uncertainDays:uncertainDates.length,requiredDays:demand,unknownDurations,savedLessonDays,occupiedDates:Object.values(days).filter(d=>d.lessons.length).length},
  availability};
}
