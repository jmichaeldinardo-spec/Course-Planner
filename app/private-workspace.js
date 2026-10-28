import {syncWorkspaceShell} from './workspace-shell.js';
import {createBuildSample,renderBuildSampleNotice} from './build-sample.js';
import {buildSchedule,planningOutlook} from './build-schedule.js';
import {renderPlanningOutlook,defaultOutlookPreferences} from './planning-outlook-view.js';
import {EVENT_TYPES,normalizeEvent} from "./event-effects.js";
import {previewSchedulingEvent,schedulingSnapshotToken} from "./scheduling-preview.js";
import {renderSchedulingPreview} from "./scheduling-preview-view.js";
import {isCalendarDate,addCalendarDays,shiftCalendarMonth,weekStart,todayInCourse,activeCalendarRecords} from "./calendar-model.js";
import {renderSavedCalendar} from "./calendar-view.js";

/* Private Course Planner vertical slice: real, owner-isolated Supabase records.
 * The fictional preview remains separate and is NEVER a source of persisted data. */
const $ = id => document.getElementById(id);
const root = $("private-workspace");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const uuidRE = /^[0-9a-f-]{36}$/i;
const unitFields = [
 ["title","Unit title","text"],["position","Unit order","number"],
 ["target_days","Target days","number"],["essential_questions","Essential question(s)","textarea"],
 ["purpose","Purpose / rationale","textarea"],["enduring_understandings","Enduring understandings","textarea"],
 ["priority_standards","Priority standards","textarea"],["learning_outcomes","Learning outcomes","textarea"],
 ["culminating_assessment","Culminating assessment","textarea"],["formative_evidence","Other evidence","textarea"],
 ["key_vocabulary","Key vocabulary","textarea"],["prerequisite_knowledge","Prerequisites","textarea"],
 ["misconceptions","Common misconceptions","textarea"],["differentiation","Differentiation","textarea"],
 ["core_resources","Core resources","textarea"],["notes","Unit notes","textarea"]
];
const lessonFields = [
 ["title","Lesson title","text"],["position","Sequence position","number"],
 ["planning_status","Planning status","select",["Draft","In Progress","Ready"]],
 ["lesson_type","Lesson type","text"],["objective","Learning objective","textarea"],
 ["guiding_questions","Guiding question(s)","textarea"],["key_vocabulary","Vocabulary","textarea"],
 ["standards","Standards","textarea"],["chapter","Textbook chapter","text"],
 ["pages","Textbook pages","text"],["section","Textbook section","text"],
 ["evidence_source","Evidence / source","textarea"],["materials","Materials","textarea"],
 ["resources_links","Resource references","textarea"],["differentiation","Differentiation","textarea"],
 ["assessment","Assessment","textarea"],["homework","Homework","textarea"],["notes","Lesson notes","textarea"],
 ["textbook_map_item","Textbook map item","text"]
];
let api=null, owner=null, course=null, units=[],lessons=[],exceptions=[],selectedUnit=null,selectedLesson=null,tab="sequence",dirty=false,epoch=0,editEpoch=0;
let calendarState=null,eventDraft=null,eventPreview=null,sampleSession=null;
const newOutlookState=()=>({preferences:defaultOutlookPreferences(),draft:null,result:null,notice:''});
let outlookState=newOutlookState();
let inspector={open:false,kind:"none",width:360},buildReturnView=null,lastStatus={message:"",kind:"info"};
function discardOutlook(close=false,notice=''){outlookState.result=null;if(close)outlookState.draft=null;outlookState.notice=notice;}

function status(message,kind="info"){lastStatus={message,kind};const e=$("private-status");if(e){e.textContent=message;e.dataset.kind=kind;}const note=root.querySelector?.('[data-inspector-status]');if(note){note.textContent=message;note.dataset.kind=kind;note.hidden=!['error','pending'].includes(kind)&&!message.startsWith('Saved and verified');}}
function field([name,label,type,options],value){
 const text=escapeHtml(value??"");
 if(type==="select")return '<label class="private-field">'+escapeHtml(label)+'<select name="'+name+'">'+options.map(x=>'<option value="'+escapeHtml(x)+'"'+(x===value?' selected':'')+'>'+escapeHtml(x)+'</option>').join("")+'</select></label>';
 if(type==="textarea")return '<label class="private-field">'+escapeHtml(label)+'<textarea name="'+name+'" rows="3">'+text+'</textarea></label>';
 const required=(name==="title"||name==="position")?" required":"";
 const min=type==="number"?" min="+(name==="target_days"?"0":"1"):"";
 return '<label class="private-field">'+escapeHtml(label)+'<input type="'+type+'" name="'+name+'" value="'+text+'"'+min+required+'></label>';
}
function formValues(form,fields){const f=new FormData(form),out={};
 for(const [key,,type] of fields){const raw=String(f.get(key)??"").trim();out[key]=type==="number"?(raw===""?null:Number(raw)):(raw===""?null:raw);}
 return out;
}
function canNavigate(){if(!dirty)return true;const discard=confirm("Your current changes are not saved. Discard them?");if(discard){dirty=false;lastStatus={message:"",kind:"info"};}return discard;}
function setDirty(next){dirty=next;if(next){editEpoch++;status("Unsaved changes — select Save to store them.","pending");}}
function reset(){syncWorkspaceShell(null,null);inspector={open:false,kind:"none",width:360};buildReturnView=null;sampleSession=null;epoch++;editEpoch++;api=null;owner=null;course=null;units=[];lessons=[];exceptions=[];calendarState=null;eventDraft=null;eventPreview=null;outlookState=newOutlookState();dirty=false;root.hidden=true;root.replaceChildren();}
export function clearPrivateWorkspace(){reset();}
export function activePrivateCourseId(){return course?.id??null;}
export function isPrivateWorkspaceDirty(){return dirty;}
export async function openPrivateCourse(client,user,id,{discardUnsaved=false}={}){
 if(!uuidRE.test(id))throw new Error("Invalid course ID.");
 // Never replace a teacher's unsubmitted form. The auth client can refresh in
 // another browser tab at any time, including while this request is in flight.
 if(dirty && !discardUnsaved){
  status("Unsaved changes preserved. Save or explicitly discard before loading newer records.","pending");
  return false;
 }
 if(dirty && discardUnsaved){dirty=false;editEpoch++;}
 if(sampleSession){leaveBuildSample();render();}
 const call=++epoch,editAtStart=editEpoch;
 api=client;owner=user;root.hidden=false;
 const sameCourse=course?.id===id;
 if(sameCourse)status("Checking saved records…");
 else root.innerHTML='<p role="status">Loading your saved course…</p>';
 const [c,u,l,e]=await Promise.all([
  client.from("courses").select("*").eq("id",id).single(),
  client.from("units").select("*").eq("course_id",id).order("position"),
  client.from("lessons").select("*").eq("course_id",id).order("position"),
  client.from("calendar_exceptions").select("*").eq("course_id",id).order("date")
 ]);
 if(call!==epoch)return false;
 // An edit made after the request started must take priority over its reply.
 if(dirty || editEpoch!==editAtStart){
  status("Unsaved changes preserved. The saved version can be reloaded after you save or discard your draft.","pending");
  return false;
 }
 const firstError=[c.error,u.error,l.error,e.error].find(Boolean);
 if(firstError){if(sameCourse)status("Reload failed; current editor preserved: "+firstError.message,"error");else{root.replaceChildren();root.textContent="Unable to open private course: "+firstError.message;}return false;}
 if(!c.data || c.data.owner_id!==user.id){if(sameCourse)status("Course unavailable for this account.","error");else root.textContent="Course unavailable for this account.";return false;}
 const nextRecords={course:c.data,units:u.data||[],lessons:l.data||[],exceptions:e.data||[]};
 if(!sameCourse)outlookState=newOutlookState();
 else if((outlookState.result||outlookState.draft)&&schedulingSnapshotToken(nextRecords)!==schedulingSnapshotToken(calendarRecords()))discardOutlook(true,'Saved inputs changed. The old Build forecast was discarded; build again.');
 course=c.data;units=u.data||[];lessons=l.data||[];exceptions=e.data||[];
 if(!sameCourse){eventDraft=null;eventPreview=null;inspector.open=false;inspector.kind="none";buildReturnView=null;}
 if(sameCourse&&eventDraft&&eventPreview)eventPreview=previewSchedulingEvent({course,units,lessons,exceptions},eventDraft);
 if(!sameCourse||!calendarState){
  const initial=isCalendarDate(course.first_day)?course.first_day:activeCalendarRecords({course,units,lessons}).lessons.flatMap(l=>l.scheduled_dates||[]).filter(isCalendarDate).sort()[0]||todayInCourse(course.timezone);
  calendarState={view:"month",anchor:initial,selected:initial};
 }
 if(!units.some(x=>x.id===selectedUnit))selectedUnit=units[0]?.id||null;
 if(!lessons.some(x=>x.id===selectedLesson))selectedLesson=lessons[0]?.id||null;
 dirty=false;render();
 status("Loaded from private cloud storage.","saved");
 return true;
}
function render({primary=true,detail=true}={}){
 if(!course)return;
 const display=calendarRecords(),view=sampleSession?'calendar':tab;
 syncWorkspaceShell(course,view,!!sampleSession);
 root.setAttribute?.('aria-label',sampleSession?'Temporary fictional Build Schedule scenario':'Saved curriculum planning');
 const title={sequence:'Course Sequence',units:'Unit Planning',lessons:'Lesson Planning',calendar:'Calendar'}[view];
 const action=view==='calendar'?'<button type="button" data-outlook-open class="workspace-primary-action">Build Schedule</button>':`<button type="button" data-private-add="${view==='units'?'units':'lessons'}" class="workspace-primary-action">Add ${view==='units'?'unit':'lesson'}</button>`;
 const header=`<header class="private-header"><div><p class="private-kicker">${sampleSession?'FICTIONAL SUCCESS SCENARIO · IN MEMORY · NOT SAVED':'SAVED WORKSPACE · PRIVATE ACCOUNT'}</p><h2>${escapeHtml(display.course.name)}</h2><h1>${title}</h1><p class="workspace-counts">${display.units.length} unit(s) · ${display.lessons.length} lesson(s) · ${display.exceptions.length} calendar exception(s)</p></div><div class="workspace-toolbar">${action}<button type="button" data-inspector-open ${outlookState.result?'data-outlook-inspect':''} aria-label="${outlookState.result?'Review preview':'Show inspector'}">${outlookState.result?'Review preview':'Inspector'}</button>${sampleSession?'<button type="button" data-build-sample-reset>Reset sample</button><button type="button" data-build-sample-return>Return to your saved course</button>':'<details class="course-actions"><summary>Course actions</summary><button data-private-export type="button">Export course JSON</button><button type="button" data-private-reload>Reload saved data</button></details>'}</div></header>`;
 const content=view==='calendar'?renderCalendar():view==='units'?renderUnitList():renderSequence();
 const aside=`<div class="inspector-heading"><span>${inspector.kind==='lesson'?'Lesson details':inspector.kind==='unit'?'Unit details':inspector.kind==='build'?'Build Schedule':inspector.kind==='event'?'Calendar event':'Details'}</span><button type="button" data-inspector-close aria-label="Close inspector">×</button></div><details class="inspector-size"><summary>Inspector size</summary><label>Width<input type="range" data-inspector-width min="280" max="520" step="20" value="${inspector.width}" aria-label="Inspector width"></label></details><p data-inspector-status data-kind="${lastStatus.kind}" ${['error','pending'].includes(lastStatus.kind)?'':'hidden'}>${escapeHtml(lastStatus.message)}</p><div class="private-inspector-body">${renderInspector()}</div>`;
 const main=root.querySelector?.('.private-primary'),panel=root.querySelector?.('.private-inspector');
 if(!main){root.innerHTML=`<div class="private-frame" style="--inspector-width:${inspector.width}px"><section class="private-primary" aria-label="Primary planning workspace">${header}<p id="private-status" class="sr-only" role="status" aria-live="polite"></p><div class="private-content">${content}</div></section><aside class="private-inspector" aria-label="Contextual inspector" ${inspector.open?'':'hidden'}>${aside}</aside></div>`;}
 else{
  const top=main.scrollTop,left=main.scrollLeft;
  if(primary){
   main.querySelector('.private-header').outerHTML=header;
   patchWorkspaceContent(main.querySelector('.private-content'),content,view==='calendar');
   main.scrollTop=top;main.scrollLeft=left;
  }
  panel.hidden=!inspector.open;if(detail){const expanded=['.outlook-more','.event-more'].filter(selector=>panel.querySelector(selector)?.open);panel.innerHTML=aside;for(const selector of expanded)panel.querySelector(selector)?.setAttribute('open','');}
  root.querySelector('.private-frame').style.setProperty('--inspector-width',inspector.width+'px');
 }
 syncInspectorModality();
}
function narrowInspector(){return typeof matchMedia==='function'&&matchMedia('(max-width:1100px)').matches;}
function syncInspectorModality(){
 const panel=root.querySelector?.('.private-inspector'),main=root.querySelector?.('.private-primary');if(!panel)return;
 const modal=inspector.open&&narrowInspector();main.inert=modal;
 const sidebar=$('workspace-navigation')?.closest?.('.teacher-sidebar');if(sidebar)sidebar.inert=modal;
 if(modal){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');}else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');}
}
// Preserve the actual calendar grid/date buttons when only details or overlays
// change. This also keeps keyboard focus, grid position and scroll anchoring.
function patchWorkspaceContent(target,html,calendar){
 if(!calendar){if(target.innerHTML!==html)target.innerHTML=html;return;}
 const next=document.createElement('div');next.innerHTML=html;
 const grid=target.querySelector('.saved-month,.saved-agenda'),fresh=next.querySelector('.saved-month,.saved-agenda');
 if(grid&&fresh&&grid.className===fresh.className&&grid.getAttribute('aria-label')===fresh.getAttribute('aria-label')){
  const oldDays=[...grid.querySelectorAll('.saved-calendar-day')],newDays=[...fresh.querySelectorAll('.saved-calendar-day')];
  if(oldDays.length===newDays.length&&oldDays.every((d,i)=>d.querySelector('[data-private-calendar-day]').dataset.privateCalendarDay===newDays[i].querySelector('[data-private-calendar-day]').dataset.privateCalendarDay)){
   oldDays.forEach((d,i)=>{const n=newDays[i],b=d.querySelector('[data-private-calendar-day]'),nb=n.querySelector('[data-private-calendar-day]');d.className=n.className;d.dataset.availability=n.dataset.availability;for(const a of ['aria-label','aria-pressed'])b.setAttribute(a,nb.getAttribute(a));for(const cls of ['.saved-mobile-markers','.saved-day-events'])if(d.querySelector(cls).innerHTML!==n.querySelector(cls).innerHTML)d.querySelector(cls).innerHTML=n.querySelector(cls).innerHTML;});
   fresh.replaceWith(grid);
  }
 }
 // Keep disclosure preferences when rebuilding the small toolbar/milestones.
 for(const selector of ['.calendar-options>details','.outlook-milestones','.build-sample-help'])if(target.querySelector(selector)?.open)next.querySelector(selector)?.setAttribute('open','');
 target.replaceChildren(...next.childNodes);
}
function renderUnitList(){return `<div class="workspace-unit-list">${units.map(u=>`<button type="button" data-private-unit="${escapeHtml(u.id)}"><span class="unit-marker" style="--unit-marker:var(--unit-${(units.indexOf(u)%5)+1})" aria-hidden="true"></span><span><strong>${escapeHtml(u.title)}</strong><small>${lessons.filter(l=>l.unit_id===u.id).length} lessons · ${escapeHtml(u.essential_questions||'No essential question yet')}</small></span></button>`).join('')||'<p>No units yet. Add your first unit.</p>'}</div>`;}
function calendarPresentation(){const records=calendarRecords(),outlook=planningOutlook(records,outlookState.result,{focusDate:calendarState.selected,weeks:outlookState.preferences.weeks});return {records,outlook,presentation:{confirmed:outlookState.preferences.confirmed,byDate:outlookState.preferences.tentative?outlook.byDate:{},allowEventPreview:!sampleSession}};}
function renderInspector(){
 if(inspector.kind==='build'){const {records,outlook}=calendarPresentation();return renderPlanningOutlook(records,outlookState,outlook,{surface:'inspector'});}
 if(inspector.kind==='lesson')return sampleSession?renderBuildSampleNotice(sampleSession.records,sampleSession.lessonId):renderLessons(lessons.find(l=>l.id===selectedLesson));
 if(inspector.kind==='unit')return renderUnits(units.find(u=>u.id===selectedUnit));
 if(inspector.kind==='add')return inspector.table==='units'?renderUnits(null):renderLessons(null);
 if(tab==='calendar'){
  const {records,presentation}=calendarPresentation();
  if(inspector.kind==='event')return renderSchedulingPreview(records,eventDraft,eventPreview,{compact:true});
  return renderSavedCalendar(records,calendarState,{...presentation,detailOnly:true})+(sampleSession?'':'<button type="button" data-event-open="">Preview an event</button>'+renderSchedulingPreview(records,null,null))+`<details class="calendar-diagnostics"><summary>More details · Calendar diagnostics</summary>${renderSavedCalendar(records,calendarState,{...presentation,diagnosticsOnly:true})}</details>`;
 }
 return '<p>Select a lesson or unit to view its details here.</p>';
}
function renderSequence(){
 return '<p class="workspace-intro">Select a lesson to plan its details.</p>'+
 (lessons.length?'<div class="private-table-wrap"><table class="private-table"><thead><tr><th>Sequence</th><th>Unit</th><th>Lesson</th><th>Status</th><th>Scheduled</th></tr></thead><tbody>'+
 lessons.map(x=>'<tr><td>'+x.position+'</td><td>'+escapeHtml(units.find(u=>u.id===x.unit_id)?.title||"")+'</td><td><button data-private-lesson="'+x.id+'">'+escapeHtml(x.title)+'</button></td><td>'+escapeHtml(x.planning_status)+'</td><td>'+escapeHtml((x.scheduled_dates||[]).join(", ")||"Unscheduled")+'</td></tr>').join("")+
 '</tbody></table></div>':'<p>No saved lessons yet. Add a unit, then add lessons.</p>')+
 '';
}
function renderUnits(current){
 const selector=units.map(u=>'<option value="'+u.id+'"'+(u.id===selectedUnit?' selected':'')+'>'+escapeHtml(u.position+' · '+u.title)+'</option>').join("");
 const existing=current?'<label class="private-field">Select unit<select data-private-select-unit>'+selector+'</select></label>'+
 '<form data-private-save="units" data-id="'+current.id+'" class="private-editor"><div class="private-form-grid">'+unitFields.slice(0,5).map(f=>field(f,current[f[0]])).join("")+'</div><details><summary>More unit planning fields</summary><div class="private-form-grid">'+unitFields.slice(5).map(f=>field(f,current[f[0]])).join("")+'</div></details><button type="submit">Save unit changes</button></form>':
 '<p>No units yet. Create your first unit below.</p>';
 return '<p>Essential questions live on the unit; associated lessons inherit the context.</p>'+existing+
 '<details class="private-new-form"><summary>Add unit</summary><form data-private-create="units" class="private-form-grid"><label>Unit title<input name="title" required maxlength="180"></label><label>Order<input type="number" name="position" min="1" value="'+(units.length+1)+'" required></label><button type="submit">Create unit</button></form></details>';
}
function renderLessons(current){
 const options=lessons.map(l=>'<option value="'+l.id+'"'+(l.id===selectedLesson?' selected':'')+'>'+escapeHtml(l.position+' · '+l.title)+'</option>').join("");
 const unitOptions=units.map(u=>'<option value="'+u.id+'">'+escapeHtml(u.title)+'</option>').join("");
 const context=current?units.find(x=>x.id===current.unit_id):null;
 const existing=current?'<label class="private-field">Select lesson<select data-private-select-lesson>'+options+'</select></label>'+
 '<p class="private-context"><strong>Unit:</strong> '+escapeHtml(context?.title||"Unknown")+' <strong>Essential question(s):</strong> '+escapeHtml(context?.essential_questions||"Not entered")+'</p>'+
 '<form data-private-save="lessons" data-id="'+current.id+'" class="private-editor"><div class="private-form-grid">'+lessonFields.slice(0,7).map(f=>field(f,current[f[0]])).join("")+'</div><details><summary>Additional lesson planning fields</summary><div class="private-form-grid">'+lessonFields.slice(7).map(f=>field(f,current[f[0]])).join("")+'</div></details><button type="submit">Save lesson changes</button></form>':
 '<p>No lessons yet. Add a lesson to a unit below.</p>';
 const create=units.length?'<details class="private-new-form"><summary>Add lesson</summary><form data-private-create="lessons" class="private-form-grid"><label>Unit<select name="unit_id">'+unitOptions+'</select></label><label>Lesson title<input name="title" required maxlength="180"></label><label>Sequence position<input type="number" name="position" min="1" required value="'+(lessons.length+1)+'"></label><button type="submit">Create lesson</button></form></details>':'<p>Create a unit before adding lessons.</p>';
 return '<p>Lesson details and Course Sequence refer to the same saved lesson record. Blank fields are optional.</p>'+existing+create;
}
function savedCalendarRecords(){return {course,units,lessons,exceptions};}
function calendarRecords(){return sampleSession?.records||savedCalendarRecords();}
function resetBuildSample(){
 sampleSession.records=createBuildSample();sampleSession.lessonId=null;
 calendarState={view:'month',anchor:sampleSession.records.course.first_day,selected:sampleSession.records.course.first_day};
 outlookState=newOutlookState();outlookState.draft={startDate:'',unitId:null,expectedSnapshot:schedulingSnapshotToken(sampleSession.records)};
 eventDraft=null;eventPreview=null;buildReturnView=null;rememberBuildView();inspector.open=true;inspector.kind='build';
}
function enterBuildSample(){
 if(!canNavigate())return;dirty=false;
 discardOutlook(true);eventDraft=null;eventPreview=null;
 sampleSession={savedCalendarState:calendarState,savedOutlookState:outlookState,records:null,lessonId:null};resetBuildSample();renderWithFocus('#build-config-title');
}
function leaveBuildSample(){
 if(!sampleSession)return;
 calendarState=sampleSession.savedCalendarState;outlookState=sampleSession.savedOutlookState;sampleSession=null;buildReturnView=null;inspector.open=false;inspector.kind='day';
 eventDraft=null;eventPreview=null;discardOutlook(true,'Returned from the temporary sample. Your saved records remain unchanged.');
}
function renderCalendar(){
 const {records,outlook,presentation}=calendarPresentation();
 return (sampleSession?`<div class="sample-context"><strong>Temporary fictional success scenario · NOT your saved course</strong><span>12 immutable fictional lessons · not saved</span><details class="build-sample-help"><summary>Sample guide</summary>${renderBuildSampleNotice(records,null).replaceAll('build-sample-title','build-sample-guide-title')}</details></div>`:'<div class="build-sample-entry"><button type="button" data-build-sample-open>Try sample Build Schedule</button><span>Temporary fictional scenario · no saved changes</span></div>')+(outlookState.notice?`<p class="preview-notice" role="status">${escapeHtml(outlookState.notice)}<button type="button" data-outlook-dismiss-notice aria-label="Dismiss notification">×</button></p>`:'')+renderPlanningOutlook(records,outlookState,outlook,{surface:'controls'})+renderSavedCalendar(records,calendarState,{...presentation,workspace:true})+`<div class="calendar-milestones">${renderPlanningOutlook(records,outlookState,outlook,{surface:'milestones'})}</div>`;
}
function rememberBuildView(){if(!buildReturnView)buildReturnView={calendar:{...calendarState},scroll:root.querySelector?.('.private-primary')?.scrollTop||0};}
function closeBuildPreview(){
 if(buildReturnView)calendarState={...buildReturnView.calendar};
 const top=buildReturnView?.scroll;buildReturnView=null;discardOutlook(true);inspector.open=false;inspector.kind='day';renderWithFocus('[data-outlook-open]');
 if(top!==undefined&&root.querySelector?.('.private-primary'))root.querySelector('.private-primary').scrollTop=top;
}
function closeInspector(){if(!canNavigate())return;if(dirty)lastStatus={message:"",kind:"info"};dirty=false;inspector.open=false;render({primary:false});const selector=tab==='calendar'?'[data-private-calendar-day="'+calendarState?.selected+'"]':tab==='units'?'[data-private-unit="'+selectedUnit+'"]':'[data-private-lesson="'+selectedLesson+'"]';(root.querySelector?.(selector)||root.querySelector?.('[data-inspector-open]'))?.focus({preventScroll:true});}
function readBuildDraft(form){const values=new FormData(form);return {...outlookState.draft,startDate:String(values.get('startDate')||''),unitId:String(values.get('unitId')||'')||null};}
function readEventDraft(form){
 const values=new FormData(form);return {...eventDraft,...Object.fromEntries(["title","date","eventType","availability","effect","notes"].map(key=>[key,String(values.get(key)??eventDraft[key]??"")]))};
}
function closeEventPreview(){eventDraft=null;eventPreview=null;inspector.open=true;inspector.kind='day';renderWithFocus('[data-event-open=""]',{primary:false});}
function openEventPreview(id){
 if(sampleSession)return;
 if(!canNavigate())return;dirty=false;
 discardOutlook(true,'Build forecast discarded while exploring a separate event proposal.');
 const event=id?exceptions.find(e=>e.id===id):null;if(id&&!event){status("Event no longer available; reload saved data.","error");return;}
 const normalized=event?normalizeEvent(event):null;
 eventDraft={eventId:event?.id||null,title:event?.title||"",date:event?.date||calendarState.selected,eventType:event?(event.event_type??"Legacy / unspecified"):"Closure",availability:normalized?.availability||"closed",effect:normalized?.effect||"Move",notes:event?.notes||"",closedDateConstraint:normalized?.availability==="closed",expectedSnapshot:schedulingSnapshotToken(calendarRecords())};
 eventPreview=null;inspector.open=true;inspector.kind='event';renderWithFocus('#event-form-title');
}
function renderWithFocus(selector,options){const scroll=globalThis.scrollY;render(options);let target=root.querySelector(selector);if(inspector.open&&narrowInspector()&&!target?.closest('.private-inspector'))target=root.querySelector('.private-inspector h3,.private-inspector h4')||root.querySelector('[data-inspector-close]');target?.focus({preventScroll:true});if(typeof window.scrollTo==='function')window.scrollTo({top:scroll,behavior:'instant'});}
function selectCalendarDay(date){
 if(!isCalendarDate(date)||!canNavigate())return;
 calendarState.selected=date;calendarState.anchor=date;dirty=false;inspector.open=true;inspector.kind='day';
 renderWithFocus('[data-private-calendar-day="'+date+'"]');
}
root.addEventListener("keydown",e=>{
 if(e.key==='Escape'&&dirty){e.preventDefault();closeInspector();return;}
 if(e.key==='Tab'&&inspector.open&&narrowInspector()){
  const controls=[...root.querySelector('.private-inspector').querySelectorAll('button,input,select,textarea,summary,a[href],[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);
  const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }

 if(e.key==='Escape'&&tab==='calendar'&&(outlookState.draft||outlookState.result)){e.preventDefault();closeBuildPreview();return;}
 if(e.key==='Escape'&&sampleSession){e.preventDefault();leaveBuildSample();renderWithFocus('[data-build-sample-open]');return;}
 if(e.key==="Escape"&&eventDraft&&e.target.closest('.event-preview-panel')){e.preventDefault();closeEventPreview();return;}
 if(e.key==='Escape'&&inspector.open){e.preventDefault();closeInspector();return;}
 const date=e.target.dataset?.privateCalendarDay;if(!date||tab!=="calendar")return;
 const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:0,End:6};
 if(!(e.key in offsets))return;e.preventDefault();
 selectCalendarDay(addCalendarDays(e.key==="Home"||e.key==="End"?weekStart(date):date,offsets[e.key]));
});
function exportCourse(){
 if(sampleSession){status("The sample is not exportable. Return to your saved course for saved-record exports.");return;}
 if(!course || dirty){status("Save or discard changes before exporting.","error");return;}
 const json={schema:"course-planner.pilot-export.v1",exportedAt:new Date().toISOString(),course,units,lessons,calendarExceptions:exceptions};
 const blob=new Blob([JSON.stringify(json,null,2)],{type:"application/json"});
 const link=document.createElement("a"),url=URL.createObjectURL(blob);
 link.href=url;link.download="course-planner-"+course.id+".json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status("Export created from your last retrieved saved records. This is not an automated backup.","saved");
}
root.addEventListener("input",e=>{
 const buildForm=e.target.closest('[data-build-schedule-form]');
 if(buildForm&&outlookState.draft){const hadResult=!!outlookState.result;outlookState.draft=readBuildDraft(buildForm);discardOutlook(false,'Preview configuration changed. Build again to see current hypothetical dates.');if(hadResult)renderWithFocus('[data-build-schedule-form] [name="'+e.target.name+'"]');return;}
 if(!sampleSession&&e.target.closest("form[data-private-save],form[data-private-create]"))setDirty(true);
 const form=e.target.closest("[data-event-preview-form]");if(form&&eventDraft){eventDraft=readEventDraft(form);eventPreview=null;const stale=root.querySelector('[aria-labelledby="scheduling-preview-title"]');if(stale)stale.hidden=true;}
});
async function workspaceClick(e){
 const button=e.target.closest("button");if(!button)return;
 if(button.matches('[data-inspector-close]')){closeInspector();}
 else if(button.matches('[data-inspector-open]')){if(!canNavigate())return;inspector.open=true;if(outlookState.result)inspector.kind='build';else if(inspector.kind==='none')inspector.kind=tab==='calendar'?'day':'lesson';renderWithFocus('.private-inspector h3,.private-inspector h4',{primary:false});}
 else if(button.matches('[data-private-unit]')){if(!canNavigate())return;selectedUnit=button.dataset.privateUnit;dirty=false;inspector.open=true;inspector.kind='unit';renderWithFocus('[data-private-save="units"] input[name="title"]',{primary:false});}
 else if(button.matches('[data-private-add]')){if(sampleSession||!canNavigate())return;dirty=false;inspector.open=true;inspector.kind='add';inspector.table=button.dataset.privateAdd;render({primary:false});const add=root.querySelector('.private-new-form');if(add){add.open=true;add.querySelector('input')?.focus({preventScroll:true});}}
 else if(button.matches('[data-build-sample-open]')){enterBuildSample();}
 else if(button.matches('[data-build-sample-return]')){leaveBuildSample();renderWithFocus('[data-build-sample-open]');}
 else if(button.matches('[data-build-sample-reset]')){if(!sampleSession)return;resetBuildSample();renderWithFocus('#build-config-title');}
 else if(button.matches('[data-build-sample-close-lesson]')){if(!sampleSession)return;sampleSession.lessonId=null;inspector.kind=outlookState.draft?'build':'day';renderWithFocus(inspector.kind==='build'?'#build-config-title':'#saved-day-title',{primary:false});}
 else if(button.matches('[data-outlook-dismiss-notice]')){outlookState.notice='';render({detail:!dirty});}
 else if(button.matches('[data-outlook-open]')){
  if(!canNavigate())return;dirty=false;eventDraft=null;eventPreview=null;rememberBuildView();inspector.open=true;inspector.kind='build';
  outlookState.draft={startDate:'',unitId:null,expectedSnapshot:schedulingSnapshotToken(calendarRecords())};discardOutlook();renderWithFocus('#build-config-title');
 }
 else if(button.matches('[data-outlook-close]')){closeBuildPreview();}
 else if(button.matches('[data-outlook-use-focus]')){if(!outlookState.draft)return;outlookState.draft.startDate=calendarState.selected;discardOutlook();renderWithFocus('[data-build-schedule-form] [name="startDate"]');}
 else if(button.matches('[data-outlook-saved-only]')){if(!canNavigate())return;dirty=false;discardOutlook(true);outlookState.preferences={...outlookState.preferences,confirmed:true,tentative:false,milestones:false};closeBuildPreview();renderWithFocus('[data-outlook-saved-only]');}
 else if(button.matches("[data-event-open]")){openEventPreview(button.dataset.eventOpen);}
 else if(button.matches("[data-event-close]")){closeEventPreview();}
 else if(button.matches("[data-private-calendar-day]")){selectCalendarDay(button.dataset.privateCalendarDay);}
 else if(button.matches("[data-private-calendar-view]")){
  if(!canNavigate())return;calendarState.view=button.dataset.privateCalendarView;calendarState.anchor=calendarState.selected;dirty=false;
  renderWithFocus('[data-private-calendar-view="'+calendarState.view+'"]');
 }
 else if(button.matches("[data-private-calendar-period]")){
  if(!canNavigate())return;const step=Number(button.dataset.privateCalendarPeriod);
  const date=calendarState.view==="month"?shiftCalendarMonth(calendarState.anchor,step):addCalendarDays(calendarState.anchor,step*7);
  calendarState.anchor=date;calendarState.selected=date;dirty=false;
  renderWithFocus('[data-private-calendar-period="'+step+'"]');
 }
 else if(button.matches("[data-private-tab]")){if(!course||!canNavigate())return;if(sampleSession)leaveBuildSample();tab=button.dataset.privateTab;inspector.open=!narrowInspector();inspector.kind=tab==='calendar'?'day':'none';buildReturnView=null;if(tab!=="calendar"){eventDraft=null;eventPreview=null;discardOutlook(true);}dirty=false;render();}
 else if(button.matches("[data-private-lesson]")){
  if(sampleSession){if(!sampleSession.records.lessons.some(l=>l.id===button.dataset.privateLesson))return;sampleSession.lessonId=button.dataset.privateLesson;inspector.open=true;inspector.kind='lesson';renderWithFocus('#build-sample-lesson-title',{primary:false});return;}
  if(!canNavigate())return;selectedLesson=button.dataset.privateLesson;dirty=false;inspector.open=true;inspector.kind='lesson';renderWithFocus('[data-private-save="lessons"] input[name="title"]',{primary:false});}
 else if(button.matches("[data-private-export]"))exportCourse();
 else if(button.matches("[data-private-reload]")){
  if(sampleSession)leaveBuildSample();
  if(dirty && !confirm("Discard your unsaved edits and reload saved course data?"))return;
  discardOutlook(true,'Saved data reloaded. Build again to inspect a fresh forecast.');
  await openPrivateCourse(api,owner,course.id,{discardUnsaved:true});
 }
}
root.addEventListener("click",workspaceClick);
$("workspace-navigation")?.addEventListener?.("click",workspaceClick);
root.addEventListener("change",e=>{
 if(e.target.matches("[data-inspector-width]")){inspector.width=Number(e.target.value);root.querySelector(".private-frame").style.setProperty("--inspector-width",inspector.width+"px");return;}
 if(e.target.matches('[data-outlook-weeks]')){const weeks=Number(e.target.value);if([2,4,6].includes(weeks))outlookState.preferences.weeks=weeks;renderWithFocus('[data-outlook-weeks]',{detail:!dirty});return;}
 if(e.target.matches('[data-outlook-layer]')){const key=e.target.dataset.outlookLayer;if(['confirmed','tentative','milestones'].includes(key))outlookState.preferences[key]=e.target.checked;renderWithFocus('[data-outlook-layer="'+key+'"]',{detail:!dirty});return;}
 const buildForm=e.target.closest('[data-build-schedule-form]');if(buildForm&&outlookState.draft){outlookState.draft=readBuildDraft(buildForm);discardOutlook(false,'Preview configuration changed. Build again to see current hypothetical dates.');renderWithFocus('[data-build-schedule-form] [name="'+e.target.name+'"]');return;}
 const eventForm=e.target.closest("[data-event-preview-form]");
 if(eventForm&&eventDraft){
  eventDraft=readEventDraft(eventForm);eventPreview=null;
  if(e.target.name==="eventType"){const defaults=EVENT_TYPES[eventDraft.eventType];if(defaults){eventDraft.availability=defaults.availability;eventDraft.effect=defaults.effect;}}
  if(eventDraft.closedDateConstraint){eventDraft.availability="closed";eventDraft.effect="Move";}
  if(eventDraft.effect==="Keep"&&['closed','occupied'].includes(eventDraft.availability))eventDraft.effect="Move";
  if(e.target.tagName==="SELECT")renderWithFocus('[data-event-preview-form] [name="'+e.target.name+'"]');return;
 }
 if(e.target.matches("[data-private-select-unit]")){if(!canNavigate()){e.target.value=selectedUnit;return;}selectedUnit=e.target.value;dirty=false;render();}
 if(e.target.matches("[data-private-select-lesson]")){if(!canNavigate()){e.target.value=selectedLesson;return;}selectedLesson=e.target.value;dirty=false;render();}
});
root.addEventListener("submit",async e=>{
 const form=e.target.closest("form");if(!form)return;e.preventDefault();
 if(form.matches('[data-build-schedule-form]')){
  if(!outlookState.draft||tab!=='calendar')return;
  outlookState.draft=readBuildDraft(form);outlookState.result=buildSchedule(calendarRecords(),outlookState.draft);outlookState.notice='';inspector.open=true;inspector.kind='build';renderWithFocus('#build-schedule-title');return;
 }
 if(sampleSession){status("This temporary fictional scenario is read-only. Nothing was saved.");return;}
 if(form.matches("[data-event-preview-form]")){
  if(!eventDraft||tab!=="calendar")return;eventDraft=readEventDraft(form);eventPreview=previewSchedulingEvent(calendarRecords(),eventDraft);renderWithFocus('#scheduling-preview-title');return;
 }
 if(!api || !owner || !course)return;
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status("Saving to your private database…","pending");
 try{
  const table=form.dataset.privateSave||form.dataset.privateCreate;
  if(!["units","lessons"].includes(table))throw new Error("Unknown record type");
  let result;
  const submittedEditEpoch=editEpoch;
  if(form.dataset.privateSave){
   const record=(table==="units"?units:lessons).find(x=>x.id===form.dataset.id);
   if(!record)throw new Error("Record was not found.");
   const fields=table==="units"?unitFields:lessonFields;
   const patch=formValues(form,fields);
   if(!patch.title || !Number.isInteger(patch.position) || patch.position<1 || (patch.target_days!==undefined && patch.target_days!==null && (!Number.isInteger(patch.target_days)||patch.target_days<0)))throw new Error("Check the required title and numeric fields.");
   result=await api.from(table).update(patch).eq("id",record.id).eq("revision",record.revision).select("id,revision").maybeSingle();
   if(!result.error && !result.data)throw new Error("Save conflict: this record changed in another session. Your unsaved edits remain here. Copy them before reloading.");
  }else{
   const name=String(new FormData(form).get("title")||"").trim(), position=Number(new FormData(form).get("position"));
   if(!name||!Number.isInteger(position)||position<1)throw new Error("A title and positive sequence position are required.");
   const payload={course_id:course.id,title:name,position};
   if(table==="lessons"){const unitId=String(new FormData(form).get("unit_id")||"");if(!units.some(u=>u.id===unitId))throw new Error("Choose a valid unit.");payload.unit_id=unitId;}
   result=await api.from(table).insert(payload).select("id").single();
   if(!result.error && result.data){if(table==="units")selectedUnit=result.data.id;else selectedLesson=result.data.id;}
  }
  if(result.error)throw new Error(result.error.message);
  if(editEpoch!==submittedEditEpoch){
   status("Submitted changes saved, but newer unsaved edits were kept in this form. Save those separately.","pending");
   return;
  }
  dirty=false;
  const reopened=await openPrivateCourse(api,owner,course.id);
  if(reopened)status("Saved and verified by reloading your private course records.","saved");
 }catch(err){status("Save failed: "+err.message,"error");}
 finally{if(btn.isConnected)btn.disabled=false;}
});
window.addEventListener('resize',()=>{if(course)syncInspectorModality();});
window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
