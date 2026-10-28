import {activeCalendarRecords} from './calendar-model.js';

// Derived display facts only. No curriculum content or alternate record store.
export function summarizeCourse(course,units,lessons){
 if(units.some(u=>u.course_id!==course.id)||lessons.some(l=>l.course_id!==course.id))throw new Error('Unexpected course relationship.');
 const unitIds=new Set(units.map(u=>u.id));
 if(lessons.some(l=>!unitIds.has(l.unit_id)))throw new Error('Incomplete course relationships.');
 const active=activeCalendarRecords({course,units,lessons});
 return {units:active.units.length,lessons:active.lessons.length};
}
export async function readMetadata(client,table,courseId,columns,max){
 const rows=[];
 for(let start=0;start<=max;start+=500){
  const {data,error}=await client.from(table).select(columns).eq('course_id',courseId).order('id').range(start,start+499);
  if(error||!Array.isArray(data))throw new Error('Course summary unavailable.');
  rows.push(...data);
  if(rows.length>max)throw new Error('Course summary exceeds pilot limits.');
  if(data.length<500)return rows;
 }
 throw new Error('Course summary exceeds pilot limits.');
}
export async function readCourseSummary(client,course){
 const [units,lessons]=await Promise.all([
  readMetadata(client,'units',course.id,'id,course_id,archived_at',200),
  readMetadata(client,'lessons',course.id,'id,course_id,unit_id,archived_at',2000)
 ]);
 // courses.updated_at is not a reliable course-wide edit marker: unit/lesson
 // edits do not necessarily update it. Do not label it as "Last edited".
 return summarizeCourse(course,units,lessons);
}
export function summaryLabel(summary){return `${summary.units} active ${summary.units===1?'unit':'units'} · ${summary.lessons} active ${summary.lessons===1?'lesson':'lessons'}`;}
