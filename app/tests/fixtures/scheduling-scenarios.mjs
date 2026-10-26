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
