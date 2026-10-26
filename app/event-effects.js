/* DEC-027 full-date normalization. No persistence or date placement here. */
export const EVENT_TYPES = Object.freeze(Object.assign(Object.create(null),{
 'Closure':{availability:'closed',effect:'Move'},
 'Testing':{availability:'occupied',effect:'Move'},
 'Shortened periods':{availability:'instructional',effect:'Keep'},
 'Assembly':{availability:'unknown',effect:'Move'},
 'Field trip':{availability:'unknown',effect:'Move'},
 'Other':{availability:'unknown',effect:'Move'}
}));
const LEGACY = Object.freeze(Object.assign(Object.create(null),{
 'No Lesson':{availability:'closed',effect:'Move'},
 'Replace Lesson':{availability:'occupied',effect:'Move'},
 'Continue Lesson':{availability:'instructional',effect:'Keep'}
}));
export function normalizeEvent(record,{proposed=false}={}){
 const rawType=record.event_type??record.eventType??'',rawEffect=record.effect??'';
 const defaults=EVENT_TYPES[rawType],legacy=LEGACY[rawEffect],suggested=legacy||LEGACY[record.legacyEffect]||defaults;
 const effect=legacy?.effect||(proposed?rawEffect:null);
 let availability=legacy?.availability||(proposed?(record.availability||defaults?.availability):'unknown');
 const errors=[],uncertainties=[];
 if(rawType==='Closure'&&availability!=='closed')errors.push('A full closure must remain closed, regardless of the selected effect.');
 if(rawType==='Closure')availability='closed';
 if(!['Move','Keep'].includes(effect))errors.push(effect==='Extend'?'Extend is deferred; additional-time allocation is not enabled.':'Choose a supported Move or Keep effect.');
 if(!['closed','occupied','instructional'].includes(availability))errors.push(availability==='partial'?'Partial-day time allocation is unresolved; no placement can be calculated.':'Clarify whether ordinary instruction is available, occupied or closed.');
 if(effect==='Keep'&&['closed','occupied'].includes(availability))errors.push('Keep cannot place ordinary instruction on a closed or occupied date.');
 if(!defaults)uncertainties.push('Legacy/unspecified event subtype: preserve the raw type and clarify the circumstance when editing.');
 if(record.reserved_flex||record.requires_extension)errors.push('Reserved flex or additional-time allocation requires a separately reviewed policy.');
 return {id:record.id??null,courseId:record.course_id??null,date:record.date,title:record.title??'',notes:record.notes??'',
  eventType:defaults?rawType:'Legacy / unspecified',rawType,rawEffect,effect,availability,
  defaultEffect:suggested?.effect||null,
  effectOrigin:legacy?'legacy mapping':effect===suggested?.effect?(record.legacyEffect?'legacy default':'suggested default'):'teacher override',errors,uncertainties};
}
export function eventDayState(events){
 if(events.some(e=>e.errors.length))return 'uncertain';
 if(events.some(e=>e.availability==='closed'||e.availability==='occupied'||e.effect==='Move'))return 'blocked';
 return 'instructional';
}
