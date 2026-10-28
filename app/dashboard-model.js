import {normalizeEvent} from './event-effects.js';
import {activeCalendarRecords,isCalendarDate,addCalendarDays,calendarWeekday,todayInCourse} from './calendar-model.js';
import {readMetadata} from './course-summary.js';
export const DASHBOARD_LIMIT=20;
const order=(a,b)=>String(a.courseName).localeCompare(String(b.courseName),'en')||(a.position??0)-(b.position??0)||String(a.id).localeCompare(String(b.id),'en');
export function needsAttention({course,units,lessons}){
 const active=activeCalendarRecords({course,units,lessons}),groups={draft:[],inProgress:[],unscheduled:[]};
 let invalidDates=0,unknownStatuses=0;
 const unique=new Set();
 for(const l of active.lessons){
  const dates=l.scheduled_dates,unscheduled=dates==null||(Array.isArray(dates)&&dates.length===0);
  if(dates!=null&&(!Array.isArray(dates)||dates.some(d=>!isCalendarDate(d))||new Set(dates).size!==dates.length))invalidDates++;
  if(!['Draft','In Progress','Ready'].includes(l.planning_status))unknownStatuses++;
  const entry={id:l.id,courseId:course.id,courseName:course.name,unitName:units.find(u=>u.id===l.unit_id)?.title||'Unit unavailable',title:l.title,position:l.position,status:['Draft','In Progress','Ready'].includes(l.planning_status)?l.planning_status:'Status unavailable',unscheduled};
  if(l.planning_status==='Draft'){groups.draft.push(entry);unique.add(l.id);}
  if(l.planning_status==='In Progress'){groups.inProgress.push(entry);unique.add(l.id);}
  if(unscheduled){groups.unscheduled.push(entry);unique.add(l.id);}
 }
 return {unique:unique.size,invalidDates,unknownStatuses,groups:Object.fromEntries(Object.entries(groups).map(([key,items])=>[key,{count:items.length,items:items.sort(order).slice(0,DASHBOARD_LIMIT)}]))};
}
export async function readDashboardCourse(client,user,courseId){
 if(!user?.id)throw new Error('Sign in before reading the dashboard.');
 const {data:course,error}=await client.from('courses').select('id,name,owner_id,timezone').eq('id',courseId).eq('owner_id',user.id).single();
 if(error||!course||course.owner_id!==user.id||course.id!==courseId)throw new Error('Course unavailable for this account.');
 const [units,lessons]=await Promise.all([
  readMetadata(client,'units',courseId,'id,course_id,title,position,archived_at',200),
  readMetadata(client,'lessons',courseId,'id,course_id,unit_id,title,position,planning_status,scheduled_dates,lesson_type,archived_at',2000)
 ]);
 const ids=new Set(units.map(u=>u.id));
 if(units.some(u=>u.course_id!==courseId)||lessons.some(l=>l.course_id!==courseId||!ids.has(l.unit_id)))throw new Error('Course relationships unavailable.');
 let exceptions=null;
 try{exceptions=await readMetadata(client,'calendar_exceptions',courseId,'id,course_id,date,title,event_type,effect',1000);if(exceptions.some(e=>e.course_id!==courseId))throw new Error('Unexpected event course.');}catch{exceptions=null;}
 return {course,units,lessons,exceptions};
}

export function dashboardWeek({now=new Date(),timezone=Intl.DateTimeFormat().resolvedOptions().timeZone,date=null}={}){
 let zone=timezone,fallback=false;
 try{if(!zone)throw new Error();new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(now);}catch{zone='UTC';fallback=true;}
 const today=date&&isCalendarDate(date)?date:todayInCourse(zone,now);
 const start=addCalendarDays(today,-(calendarWeekday(today)-1));
 return {start,end:addCalendarDays(start,6),timezone:zone,fallback};
}
const agendaOrder=(a,b)=>({exception:0,assessment:1,lesson:2}[a.kind]-{exception:0,assessment:1,lesson:2}[b.kind])||order(a,b);
export function projectDashboardCourse(records,user,week){
 const {course,units,lessons,exceptions}=records;
 if(!user?.id||course.owner_id!==user.id)throw new Error('Course unavailable for this account.');
 const attention=needsAttention(records),active=activeCalendarRecords(records),days=Object.fromEntries(Array.from({length:7},(_,i)=>[addCalendarDays(week.start,i),[]]));
 let invalidEvents=0,timezoneUnknown=false;
 try{if(!course.timezone)throw new Error();new Intl.DateTimeFormat('en-US',{timeZone:course.timezone}).format();}catch{timezoneUnknown=true;}
 for(const l of active.lessons){
  const dates=[...new Set((Array.isArray(l.scheduled_dates)?l.scheduled_dates:[]).filter(isCalendarDate))].sort();
  for(const date of dates)if(days[date])days[date].push({id:l.id,courseId:course.id,courseName:course.name,unitName:units.find(u=>u.id===l.unit_id)?.title||'Unit unavailable',title:l.title,position:l.position,kind:String(l.lesson_type).trim().toLowerCase()==='assessment'?'assessment':'lesson',type:l.lesson_type||'Lesson',date,multiday:dates.length>1});
 }
 for(const e of exceptions||[]){
  if(e.course_id!==course.id)continue;
  if(!isCalendarDate(e.date)){invalidEvents++;continue;}
  if(!days[e.date])continue;
  const normalized=normalizeEvent(e),uncertain=normalized.errors.length>0;
  days[e.date].push({id:e.id,courseId:course.id,courseName:course.name,title:e.title,kind:'exception',type:uncertain?'Calendar exception · constraints unclear':normalized.availability==='closed'?'No instruction · saved exception':'Calendar exception',date:e.date,effect:e.effect||'Effect not specified',uncertain});
 }
 return {courseId:course.id,courseName:course.name,attention,timezoneUnknown,invalidEvents,eventError:exceptions===null,days:Object.fromEntries(Object.entries(days).map(([date,entries])=>[date,{count:entries.length,entries:entries.sort(agendaOrder).slice(0,DASHBOARD_LIMIT)}]))};
}
export function combineDashboard(projections,week){
 const groups={};
 for(const key of ['draft','inProgress','unscheduled'])groups[key]={count:projections.reduce((n,p)=>n+p.attention.groups[key].count,0),items:projections.flatMap(p=>p.attention.groups[key].items).sort(order).slice(0,DASHBOARD_LIMIT)};
 return {week,attention:{unique:projections.reduce((n,p)=>n+p.attention.unique,0),groups},days:Array.from({length:7},(_,i)=>{
  const date=addCalendarDays(week.start,i),entries=projections.flatMap(p=>p.days[date].entries).sort(agendaOrder).slice(0,DASHBOARD_LIMIT);
  return {date,count:projections.reduce((n,p)=>n+p.days[date].count,0),entries};
 }),issues:projections.filter(p=>p.timezoneUnknown||p.invalidEvents||p.attention.invalidDates||p.attention.unknownStatuses||p.eventError)};
}
