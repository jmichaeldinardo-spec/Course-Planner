export const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function scheduleFixture(){
 const course={id:id(1),owner_id:id(2),name:'Fictional Event Preview Course',first_day:'2026-09-14',last_day:'2026-09-25',timezone:'America/New_York',teaching_weekdays:[1,2,3,4,5],revision:1};
 const unit={id:id(3),course_id:course.id,title:'Fictional decisions',position:1,target_days:4,revision:1};
 const lessons=['2026-09-14','2026-09-15','2026-09-16','2026-09-17'].map((date,i)=>({id:id(10+i),course_id:course.id,unit_id:unit.id,title:'Fictional lesson '+(i+1),objective:'Preserve fictional objective '+i,position:i+1,lesson_type:i===2?'Assessment':'Content',duration_days:1,scheduled_dates:[date],revision:1}));
 return {course,units:[unit],lessons,exceptions:[]};
}
export const scenarios=[
 {name:'Closure displaces the sequence',note:'Tuesday closes. Lesson 1 stays Monday; all three downstream lessons shift, with no changed IDs or authored fields.',event:{title:'Fictional closure',date:'2026-09-15',eventType:'Closure',availability:'closed',effect:'Move'},expected:[['2026-09-14'],['2026-09-16'],['2026-09-17'],['2026-09-18']]},
 {name:'Flagged instruction stays in place',note:'Shortened periods are an annotation only. Keep preserves dates; no claim is made about minutes or extension.',event:{title:'Fictional shortened periods',date:'2026-09-15',eventType:'Shortened periods',availability:'instructional',effect:'Keep'},expected:[['2026-09-14'],['2026-09-15'],['2026-09-16'],['2026-09-17']]},
 {name:'A protected assessment blocks ripple',note:'Wednesday assessment is pinned. Tuesday closure cannot move Lesson 2 into that commitment; preview blocks, with the pin untouched.',pinIndex:2,event:{title:'Fictional closure before assessment',date:'2026-09-15',eventType:'Closure',availability:'closed',effect:'Move'},blocked:'pin-contention'}
];

// Fully scheduled success baseline, independent of the preview allocator.
// Ordinary lesson-days are packed into declared eligible dates; no engine output
// is used to generate this fixture. Plenty of term capacity permits safe ripple.
export function fullyScheduled80Fixture(){
 const course={id:id(1000),owner_id:id(1001),name:'Fully Scheduled — Fictional Civic Systems',first_day:'2026-09-01',last_day:'2027-05-31',timezone:'America/New_York',teaching_weekdays:[1,2,3,4,5],revision:1};
 const units=Array.from({length:5},(_,i)=>({id:id(1010+i),course_id:course.id,title:'Complete fictional unit '+(i+1),position:i+1,target_days:18,revision:1}));
 const definitions=[['2026-09-07','No Lesson'],['2026-09-18','Continue Lesson'],['2026-10-12','No Lesson'],['2026-10-28','Replace Lesson'],['2026-11-03','No Lesson'],['2026-11-11','Continue Lesson'],['2026-11-26','No Lesson'],['2026-11-27','No Lesson'],['2026-12-04','Replace Lesson'],['2026-12-25','No Lesson'],['2027-01-01','No Lesson'],['2027-01-18','Replace Lesson']];
 const exceptions=definitions.map(([date,effect],i)=>({id:id(1300+i),course_id:course.id,date,effect,event_type:effect==='No Lesson'?'Closure':effect==='Continue Lesson'?'Shortened periods':'Testing',title:'Fictional complete-baseline event '+(i+1),revision:1}));
 const unavailable=new Set(definitions.filter(([,effect])=>effect!=='Continue Lesson').map(([date])=>date));
 const eligible=[];
 for(let d=course.first_day;d<=course.last_day;d=fixtureAddDay(d))if(fixtureWeekday(d)<=5&&!unavailable.has(d))eligible.push(d);
 let slot=0;
 const lessons=Array.from({length:80},(_,i)=>{
  const duration=i>0&&i%8===0?2:1,dates=eligible.slice(slot,slot+duration);slot+=duration;
  return {id:id(1100+i),course_id:course.id,unit_id:units[Math.floor(i/16)].id,title:'Complete fictional lesson '+(i+1),objective:'Preserve complete fictional objective '+(i+1),position:i+1,lesson_type:i%16===0?'Assessment':'Content',planning_status:'Draft',duration_days:duration,scheduled_dates:dates,protected_pin_date:i===0?dates[0]:null,flexible_preference_date:i===20?dates[0]:null,revision:1};
 });
 return {course,units,lessons,exceptions};
}
function fixtureAddDay(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function fixtureWeekday(date){return new Date(date+'T12:00:00Z').getUTCDay()||7;}
