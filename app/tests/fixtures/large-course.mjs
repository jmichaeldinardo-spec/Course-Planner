import {addCalendarDays} from '../../calendar-model.js';
export function largeCourseFixture(count){
 const id=n=>'71000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const course={id:id(1),owner_id:id(2),name:'Fictional lossless acceptance — '+count+' lessons',revision:1,first_day:'2026-09-01',last_day:'2027-08-31',teaching_weekdays:[1,2,3,4,5],timezone:'America/New_York'};
 const units=Array.from({length:200},(_,i)=>({id:id(10+i),course_id:course.id,title:'Fictional unit '+i,position:i+1,revision:1,essential_questions:'Fictional question '+i,...(i===2?{archived_at:'2026-10-28T00:00:00Z'}:{})}));
 const lessons=Array.from({length:count},(_,i)=>({id:id(1000+i),course_id:course.id,unit_id:units[i%200].id,title:'Fictional complete lesson '+i,position:i+1,revision:1,objective:'Preserve café objective '+i,guiding_questions:'Why '+i+'?',duration_days:1,lesson_type:i%10===0?'Assessment':'Content',planning_status:'Draft',scheduled_dates:[addCalendarDays(course.first_day,Math.floor(i/8))],...(i===17?{archived_at:'2026-10-28T00:00:00Z'}:{})}));
 const exceptions=Array.from({length:601},(_,i)=>({id:id(5000+i),course_id:course.id,title:'Fictional saved event '+i,date:addCalendarDays(course.first_day,Math.floor(i/3)),event_type:'Assembly',effect:'Continue Lesson',revision:1}));
 return {course,units,lessons,exceptions};
}
