import {directoryLessons} from './lesson-directory.js';
import {createWorkspaceTabs} from './workspace-tabs.js';
import {renderTabBar,renderLauncher,destinationNames,visibleTabIds} from './workspace-tab-view.js';
import {createWorkspaceState} from './workspace-state.js';
import {createWorkspaceNavigation} from './workspace-navigation.js';
import {syncWorkspaceShell,showWorkspaceDestination,refreshWorkspaceCourseSummary,setContinueContext} from './workspace-shell.js';
import {createBuildSample,renderBuildSampleNotice} from './build-sample.js';
import {buildSchedule,planningOutlook} from './build-schedule.js';
import {renderPlanningOutlook,defaultOutlookPreferences} from './planning-outlook-view.js';
import {EVENT_TYPES,normalizeEvent} from "./event-effects.js";
import {previewSchedulingEvent,schedulingSnapshotToken} from "./scheduling-preview.js";
import {renderSchedulingPreview} from "./scheduling-preview-view.js";
import {isCalendarDate,calendarDateLabel,addCalendarDays,shiftCalendarMonth,weekStart,todayInCourse,activeCalendarRecords} from "./calendar-model.js";
import {renderSavedCalendar} from "./calendar-view.js";
import {readCompleteCourse,makeCourseExport} from './course-snapshot.js';

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
let api=null,owner=null;
// Read-only aliases of the shared saved snapshot, rebound after reads/acknowledgements.
let course=null,units=[],lessons=[],exceptions=[];
// Current presentation; cached course contexts contain only presentation and DOM.
let selectedUnit=null,selectedLesson=null,tab="sequence";
// Dirty projects the active course drafts; epochs also protect an initial in-flight load.
let dirty=false,epoch=0,editEpoch=0;
let calendarState=null,eventDraft=null,eventPreview=null,sampleSession=null;
const newOutlookState=()=>({preferences:defaultOutlookPreferences(),draft:null,result:null,notice:''});
let outlookState=newOutlookState();
let inspector={open:false,kind:"none",width:360},buildReturnView=null,lastStatus={message:"",kind:"info"};
function discardOutlook(close=false,notice=''){outlookState.result=null;if(close)outlookState.draft=null;outlookState.notice=notice;}

function status(message,kind="info"){lastStatus={message,kind};const e=$("private-status");if(e){e.textContent=message;e.dataset.kind=kind;e.classList?.toggle('sr-only',kind!=='error');}const note=root.querySelector?.('[data-inspector-status]');if(note){note.textContent=message;note.dataset.kind=kind;note.hidden=!['error','pending'].includes(kind)&&!message.startsWith('Saved and verified');}}
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
const workspaceState=createWorkspaceState();
const workspaceTabs=createWorkspaceTabs();
const navigation=createWorkspaceNavigation({
 hasDraft:(_id,target)=>target?.scope==='view'?!!target.ref&&!target.keepDraft&&!!workspaceState.draft(target.ref):dirty||workspaceState.hasDraft(course?.id),isSaving:()=>workspaceState.isSaving(),
 confirmDiscard:target=>target.choice==='discard'||confirm(target.kind==='reload'?"Discard your unsaved edits and reload saved course data?":"Your current changes are not saved. Discard them?"),
 discard:(id,target)=>{if(target?.scope==='view'&&target.ref){if(!workspaceState.discardRecord(target.ref))return false;syncDirty();return true;}if(!workspaceState.discard(id))return false;dirty=false;lastStatus={message:"",kind:"info"};return true;}
});
function canNavigate(target={}){const ref=currentReference();return navigation.transition({kind:'replace',courseId:course?.id,scope:'view',ref,keepDraft:course&&target.kind!=='reload'&&otherHolder(ref,workspaceTabs.active(course.id).id),...target}).ok;}
function formReference(form){return workspaceState.reference(course.id,form.dataset.privateSave||form.dataset.privateCreate,form.dataset.privateSave?form.dataset.id:null,form.dataset.draftId||destination()?.draftId||`legacy-${workspaceTabs.active(course.id).id}`);}
function rememberForm(form){
 const values=Object.fromEntries(new FormData(form));workspaceState.edit(formReference(form),values);return values;
}
function bindSavedRecords(id){({course,units,lessons,exceptions}=workspaceState.snapshot(id));syncDirty();}
function projectDrafts(){
 // Cached views receive current canonical choices before raw drafts are projected.
 for(const select of root.querySelectorAll?.('[data-lesson-unit],[data-private-select-unit],[data-private-select-lesson],form[data-private-create="lessons"] [name="unit_id"]')||[]){
  const list=select.matches('[data-private-select-lesson]')?lessons:units,value=select.value;
  const filtering=select.matches('[data-lesson-unit]');const options=(filtering?'<option value="">All Units</option>':'')+list.map(row=>`<option value="${escapeHtml(row.id)}">${escapeHtml(row.title)}${filtering&&row.archived_at?' (Archived)':''}</option>`).join('');
  if(select.innerHTML!==options){select.innerHTML=options;if(list.some(row=>row.id===value))select.value=value;}
 }
 for(const form of root.querySelectorAll?.('form[data-private-save],form[data-private-create]')||[]){
  const ref=formReference(form),values=workspaceState.editing(ref);
  if(!ref.recordId&&!workspaceState.draft(ref))form.reset();
  for(const [name,value] of Object.entries(values)){const input=form.elements.namedItem(name);if(input&&input.value!==String(value??''))input.value=value??'';}
  const context=form.previousElementSibling;if(ref.table==='lessons'&&ref.recordId&&context?.matches('.private-context')){const unit=units.find(u=>u.id===values.unit_id);context.innerHTML='<strong>Unit:</strong> '+escapeHtml(unit?.title||'Unknown')+' <strong>Essential question(s):</strong> '+escapeHtml(unit?.essential_questions||'Not entered');}
 }
}
// Stage B presentation adapter. Cached DOM is a projection, never draft authority.
const tabViews=new Map(),editorFocus=new WeakMap();
let directoryQuery='',directoryUnit='';
const destination=()=>course?workspaceTabs.current(course.id).destination:null;
function destinationRef(d){
 if(!course||!d?.table)return null;
 if(d.recordId)return workspaceState.reference(course.id,d.table,d.recordId);
 if(d.draftId)return workspaceState.reference(course.id,d.table,null,d.draftId);
 return null;
}
function currentReference(){
 if(!course)return null;
 const direct=destinationRef(destination());if(direct)return direct;
 if(inspector.kind==='lesson'&&selectedLesson&&!sampleSession)return workspaceState.reference(course.id,'lessons',selectedLesson);
 if(inspector.kind==='unit'&&selectedUnit)return workspaceState.reference(course.id,'units',selectedUnit);
 return null;
}
function sameReference(a,b){return !!a&&!!b&&a.accountId===b.accountId&&a.generation===b.generation&&a.courseId===b.courseId&&a.table===b.table&&a.recordId===b.recordId&&(a.recordId||a.draftId===b.draftId);}
function referenceForTab(t){
 const e=t.history[t.index],direct=destinationRef(e.destination);if(direct)return direct;
 if(t.id===workspaceTabs.active(course.id).id)return currentReference();
 const s=tabViews.get(e.id)?.state;
 if(s?.inspector.kind==='lesson'&&s.selectedLesson&&!s.sampleSession)return workspaceState.reference(course.id,'lessons',s.selectedLesson);
 if(s?.inspector.kind==='unit'&&s.selectedUnit)return workspaceState.reference(course.id,'units',s.selectedUnit);
 return t.id===workspaceTabs.active(course.id).id?currentReference():null;
}
function otherHolder(ref,except){return !!ref&&workspaceTabs.list(course.id).some(t=>t.id!==except&&sameReference(referenceForTab(t),ref));}
function syncDirty(){if(course)dirty=!!workspaceState.draft(currentReference()||{});}
function tabLabel(t){
 const d=t.history[t.index].destination,ref=destinationRef(d),row=ref?workspaceState.editing(ref):null;
 const name=row?.title||destinationNames[d.kind]||'Planning view';
 const duplicates=d.recordId?workspaceTabs.list(course.id).filter(x=>{const o=x.history[x.index].destination;return o.table===d.table&&o.recordId===d.recordId;}):[];
 const duplicateIndex=duplicates.findIndex(x=>x.id===t.id);
 const suffix=duplicates.length>1&&duplicateIndex>=0?` · View ${duplicateIndex+1}`:'';
 return {label:name+suffix,dirty:!!workspaceState.draft(ref||referenceForTab(t)||{}),search:[name,destinationNames[d.kind],units.find(u=>u.id===row?.unit_id)?.title,course.name].filter(Boolean).join(' ')};
}
let tabResizeObserver=null;
function renderTabs(){
 const host=root.querySelector?.('[data-tab-host]');if(!host||!course)return;
 const active=workspaceTabs.active(course.id),tabs=workspaceTabs.list(course.id);
 const width=host.querySelector('.tab-strip')?.clientWidth;
 host.innerHTML=renderTabBar(tabs,active,tabLabel,width?visibleTabIds(tabs,active.id,width,narrowInspector()?100:80):undefined);
 const panel=root.querySelector('.private-primary');panel.id='planning-tab-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+active.id);panel.dataset.viewId=active.id;
 if(typeof ResizeObserver!=='undefined'){
  tabResizeObserver?.disconnect();let previous=host.querySelector('.tab-strip').clientWidth;
  tabResizeObserver=new ResizeObserver(()=>{const next=host.querySelector('.tab-strip')?.clientWidth;if(next&&next!==previous){previous=next;renderTabs();}});tabResizeObserver.observe(panel);
 }
 // Measure again after controls are laid out; no scroll position or record state.
 const track=host.querySelector('.tab-strip'),shown=visibleTabIds(tabs,active.id,track.clientWidth,narrowInspector()?100:80);
 for(const element of track.children)element.hidden=!shown.has(element.querySelector('[data-tab-select]').dataset.tabSelect);
 const finder=host.querySelector('[data-tab-finder]'),hidden=tabs.length-shown.size;
 finder.setAttribute('aria-label',`Find Open Tabs: ${tabs.length} total, ${hidden} outside strip`);finder.title=`${hidden} tabs outside strip — find all open tabs`;finder.innerHTML='<span>Open Tabs</span> '+(hidden?'+'+hidden:'⌄');
}
function pruneTabViews(){const ids=new Set(workspaceTabs.entries(course.id).map(e=>e.id));for(const [id,ctx] of tabViews)if(ctx.state.courseId===course.id&&!ids.has(id))tabViews.delete(id);}
function stashTab(){if(course&&root.querySelector?.('.private-primary'))tabViews.set(workspaceTabs.current(course.id).id,captureContext());}
function applyDestination(d){
 tab=d.kind;directoryQuery='';directoryUnit='';selectedLesson=d.kind==='lesson-plan'?d.recordId:selectedLesson;selectedUnit=d.kind==='unit-plan'?d.recordId:selectedUnit;
 calendarState={view:'month',anchor:d.date||course.first_day||todayInCourse(course.timezone),selected:d.date||course.first_day||todayInCourse(course.timezone)};
 eventDraft=null;eventPreview=null;sampleSession=null;outlookState=newOutlookState();buildReturnView=null;lastStatus={message:'',kind:'info'};
 inspector={open:false,kind:tab==='lesson-plan'?'lesson':tab==='unit-plan'?'unit':tab==='calendar'?'day':'none',width:inspector.width||360};
 syncDirty();
}
function restoreTab({focus=true}={}){
 const e=workspaceTabs.current(course.id),cached=tabViews.get(e.id);
 if(cached){
  restoreContext(cached);
  const content=root.querySelector('.private-content');
  if(['overview','sequence','units'].includes(tab))patchWorkspaceContent(content,tab==='overview'?renderOverview():tab==='units'?renderUnitList():renderSequence(),false);
  else if(tab==='unit-plan'){const connected=content.querySelector('.connected-lessons');if(connected)connected.outerHTML=renderConnectedLessons(e.destination.recordId);}
  else if(tab==='lessons'){const results=content.querySelector('[data-lesson-directory-results]');if(results)results.innerHTML=renderLessonResults();}
  const display=calendarRecords(),counts=tab==='overview'?{...activeCalendarRecords(display),exceptions:display.exceptions}:display;root.querySelector('.workspace-counts').textContent=`${counts.units.length} unit(s) · ${counts.lessons.length} lesson(s) · ${counts.exceptions.length} calendar exception(s)`;
  projectDrafts();renderTabs();
 }
 else{root.replaceChildren();applyDestination(e.destination);render();const main=root.querySelector('.private-primary');main.scrollTop=0;}
 syncDirty();
 if(cached?.focus?.node?.isConnected&&cached.focus.node.getClientRects().length){try{cached.focus.node.focus({preventScroll:true});if(cached.focus.start!==null)cached.focus.node.setSelectionRange?.(cached.focus.start,cached.focus.end);}catch{}}
 else if(focus)root.querySelector('.private-primary')?.focus({preventScroll:true});
 if(e.destination.table){const ref=destinationRef(e.destination),draft=workspaceState.draft(ref);if(draft?.error)status('Save failed: '+draft.error,'error');else if(draft)status('Unsaved changes — select Save to store them.','pending');else if(lastStatus.kind==='error'||lastStatus.kind==='pending')status('Saved record loaded.','saved');}
}
function dirtyChoice(label){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='workspace-settings unsaved-navigation';dialog.setAttribute('aria-labelledby','unsaved-navigation-title');
  dialog.innerHTML=`<h2 id="unsaved-navigation-title">Unsaved changes</h2><p>Keep your changes to ${escapeHtml(label)} before leaving this view?</p><div class="unsaved-actions"><button type="button" data-unsaved-choice="save">Save and Continue</button><button type="button" data-unsaved-choice="discard">Discard Changes</button><button type="button" data-unsaved-choice="cancel">Cancel</button></div>`;
  let done=false;const finish=choice=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(choice);};
  dialog.addEventListener('close',()=>finish('cancel'));
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-unsaved-choice]');if(b)finish(b.dataset.unsavedChoice);});dialog.addEventListener('cancel',e=>{e.preventDefault();finish('cancel');});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-unsaved-choice="cancel"]').focus();
 });
}
async function leaveView(t,{reload=false}={}){
 if(workspaceState.isSaving()){status('Wait for the current save to finish before changing views.','pending');return false;}
 const ref=referenceForTab(t),keepDraft=!reload&&otherHolder(ref,t.id),leavingCourse=course.id,leavingAccount=owner.id;
 let choice;
 if(ref&&workspaceState.draft(ref)&&!keepDraft){choice=await dirtyChoice(workspaceState.editing(ref).title||tabLabel(t).label);if(choice==='cancel'||course?.id!==leavingCourse||owner?.id!==leavingAccount||!workspaceState.isCurrent(ref))return false;if(choice==='save'&&!await saveRecord(ref))return false;}
 return navigation.transition({kind:reload?'reload':'replace',courseId:course.id,scope:'view',ref,keepDraft,choice}).ok;
}
async function navigateTab(d,{newTab=false}={}){
 if(!course)return false;
 if(workspaceState.isSaving()){status('Wait for the current save to finish before changing views.','pending');return false;}
 const active=workspaceTabs.active(course.id);
 if(!newTab&&JSON.stringify(destination())===JSON.stringify(d)){showWorkspaceDestination('workspace');return true;}
 if(!newTab&&!await leaveView(active))return false;
 stashTab();epoch++;
 if(d.kind==='create-unit'||d.kind==='create-lesson')d={...d,table:d.kind==='create-unit'?'units':'lessons',draftId:workspaceTabs.newDraftId()};
 if(newTab)workspaceTabs.open(course.id,d);else workspaceTabs.navigate(course.id,d);
 pruneTabViews();showWorkspaceDestination('workspace');restoreTab();return true;
}
function selectTab(id){
 if(workspaceState.isSaving()){status('Wait for the current save to finish before changing views.','pending');return false;}
 if(id===workspaceTabs.active(course.id).id)return true;
 stashTab();epoch++;if(!workspaceTabs.select(course.id,id))return false;restoreTab();return true;
}
async function closeTab(id){
 const t=workspaceTabs.list(course.id).find(t=>t.id===id);if(!t||!await leaveView(t))return false;
 stashTab();for(const e of t.history)tabViews.delete(e.id);epoch++;workspaceTabs.close(course.id,id);restoreTab();return true;
}
async function travelTab(step){
 const t=workspaceTabs.active(course.id);if(t.index+step<0||t.index+step>=t.history.length||!await leaveView(t))return false;
 stashTab();epoch++;workspaceTabs.travel(course.id,step);restoreTab();return true;
}
function openTabFinder(){
 const dialog=document.createElement('dialog');dialog.className='workspace-settings open-tabs-dialog';dialog.setAttribute('aria-labelledby','open-tabs-title');
 dialog.innerHTML='<div class="settings-heading"><h2 id="open-tabs-title">Open Tabs</h2><button type="button" data-finder-close>Close</button></div><p>All open views in this course. Select a view to bring it into the tab strip.</p><label>Find an open view<input type="search" data-finder-search placeholder="Title, unit or view type"></label><div data-finder-results></div>';
 const draw=()=>{const query=dialog.querySelector('input').value.toLocaleLowerCase(),list=workspaceTabs.list(course.id).filter(t=>tabLabel(t).search.toLocaleLowerCase().includes(query));dialog.querySelector('[data-finder-results]').innerHTML=list.map(t=>`<div class="finder-row"><button type="button" data-finder-tab="${t.id}">${escapeHtml(tabLabel(t).label)}${tabLabel(t).dirty?' · Unsaved edits':''}</button><button type="button" data-finder-close-tab="${t.id}" aria-label="Close ${escapeHtml(tabLabel(t).label)}">×</button></div>`).join('')||'<p>No matching open tabs in this course.</p>';};
 const close=()=>{dialog.close();dialog.remove();root.querySelector('[data-tab-finder]')?.focus({preventScroll:true});};
 dialog.addEventListener('input',draw);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.hasAttribute('data-finder-close'))close();else if(b?.dataset.finderCloseTab){const id=b.dataset.finderCloseTab;close();void closeTab(id);}else if(b?.dataset.finderTab){const id=b.dataset.finderTab;close();selectTab(id);root.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});}});
 dialog.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const buttons=[...dialog.querySelectorAll('[data-finder-tab]')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1)+buttons.length)%buttons.length]?.focus();});
 document.body.append(dialog);draw();dialog.showModal();dialog.querySelector('input').focus();
}
function renderLessonDirectory(){
 return `<section class="lesson-directory"><label>Unit<select data-lesson-unit><option value="">All Units</option>${units.map(u=>`<option value="${escapeHtml(u.id)}" ${directoryUnit===u.id?'selected':''}>${escapeHtml(u.title)}${u.archived_at?' (Archived)':''}</option>`).join('')}</select></label><label>Find a lesson<input type="search" data-lesson-search value="${escapeHtml(directoryQuery)}" placeholder="Search titles, units or status"></label><div data-lesson-directory-results>${renderLessonResults()}</div></section>`;
}
function lessonRows(list){return list.map(l=>`<article class="planning-directory-row"><button type="button" data-private-lesson="${l.id}"><strong>${escapeHtml(l.title)}</strong><small>${escapeHtml(units.find(u=>u.id===l.unit_id)?.title)} · ${escapeHtml(l.planning_status||'No status')}${l.archived_at||units.find(u=>u.id===l.unit_id)?.archived_at?' · Archived':''}</small></button><button type="button" data-open-lesson-tab="${l.id}" aria-label="Open ${escapeHtml(l.title)} in New Tab" title="Open in New Tab">↗</button></article>`).join('');}
function renderLessonResults(){return lessonRows(directoryLessons(lessons,units,{unitId:directoryUnit,query:directoryQuery}))||'<p>No matching lessons'+(directoryUnit?' in this unit':'')+'.</p>';}
function renderConnectedLessons(unitId){return '<section class="connected-lessons" aria-labelledby="connected-lessons-title"><h3 id="connected-lessons-title">Lessons in This Unit</h3>'+ (lessonRows(directoryLessons(lessons,units,{unitId}))||'<p>No lessons in this unit yet.</p>')+'</section>';}
function renderIndividualPlan(){
 const d=destination(),creating=d.kind.startsWith('create-'),row=d.table==='units'?units.find(u=>u.id===d.recordId):lessons.find(l=>l.id===d.recordId);
 if(!creating&&!row)return '<section class="workspace-placeholder"><h3>This plan is unavailable</h3><p>It may have been removed or become inaccessible. Your other tabs remain open.</p><button type="button" data-tab-destination="'+(d.table==='units'?'units':'lessons')+'">Open planning directory</button></section>';
 return '<section class="central-plan">'+(d.table==='units'?renderUnits(row||null):renderLessons(row||null))+(d.kind==='unit-plan'?renderConnectedLessons(d.recordId):'')+'</section>';
}

function setDirty(next){dirty=next;if(next){editEpoch++;status("Unsaved changes — select Save to store them.","pending");}}
const courseContexts=new Map();
function publishContinueContext(){setContinueContext({view:sampleSession?'Temporary Build Schedule sample':destinationNames[tab],lesson:inspector.kind==='lesson'&&!sampleSession?lessons.find(l=>l.id===selectedLesson)?.title:null,dirty:dirty||workspaceState.hasDraft(course?.id)});}
let dashboardNavigation=0;
export async function openDashboardDestination(client,user,{courseId,lessonId=null,date=null}){
 if(workspaceState.isSaving())return {ok:false,message:'Wait for the current save to finish, then try again.'};
 if(!uuidRE.test(courseId)||lessonId&&!uuidRE.test(lessonId)||date&&!isCalendarDate(date))return {ok:false,message:'This saved planning link is unavailable.'};
 const target=courseId===course?.id?{dirty,selectedLesson,inspector}:courseContexts.has(courseId)?{...courseContexts.get(courseId).state,dirty:workspaceState.hasDraft(courseId)}:null;
 const exactDraft=target?.dirty&&lessonId===target.selectedLesson&&target.inspector.kind==='lesson'&&!date;
 if(target?.dirty&&!exactDraft)return {ok:false,message:'That course has unsaved edits in another view. Continue its workspace and save or explicitly discard the draft before opening this item.'};
 const request=++dashboardNavigation;
 if(courseId===course?.id&&exactDraft){
  const {data,error}=await client.from('courses').select('id,owner_id').eq('id',courseId).eq('owner_id',user.id).single();
  if(request!==dashboardNavigation||error||!data||data.owner_id!==user.id||owner?.id!==user.id||course?.id!==courseId)return {ok:false,message:'Course access could not be verified.'};
  showWorkspaceDestination('workspace');publishContinueContext();return {ok:true};
 }
 const ok=await openPrivateCourse(client,user,courseId,{preserveContext:true});
 if(!ok||request!==dashboardNavigation||owner?.id!==user.id)return {ok:false,message:'The saved item could not be opened. Your current work was preserved.'};
 if(lessonId&&!lessons.some(l=>l.id===lessonId))return {ok:false,message:'This lesson is no longer in the saved course. Reload its workspace to check.'};
 const opened=await navigateTab(lessonId?{kind:'lesson-plan',table:'lessons',recordId:lessonId}:date?{kind:'calendar',date}:{kind:'overview'});
 if(opened){publishContinueContext();root.querySelector(lessonId?'[data-private-save="lessons"] [name="title"]':date?'[data-private-calendar-day="'+date+'"]':'.private-primary')?.focus({preventScroll:true});}
 return {ok:opened,message:opened?'':'Unsaved edits were preserved.'};
}
function captureContext(){
 const state={directoryQuery,directoryUnit,courseId:course.id,selectedUnit,selectedLesson,tab,calendarState,eventDraft,eventPreview,sampleSession,outlookState,inspector:{...inspector},buildReturnView,lastStatus};
 const scroll=[...root.querySelectorAll('.private-primary,.private-inspector')].map(node=>[node,node.scrollTop,node.scrollLeft]);
 const node=document.activeElement,remembered=editorFocus.get(root.querySelector('.private-primary'));const focus=node?.matches?.('input,textarea,select')&&root.contains?.(node)?{node,start:node.selectionStart??null,end:node.selectionEnd??null}:remembered||null;
 return {state,nodes:[...root.childNodes],scroll,focus};
}
function restoreContext(context){
 ({directoryQuery,directoryUnit,selectedUnit,selectedLesson,tab,calendarState,eventDraft,eventPreview,sampleSession,outlookState,inspector,buildReturnView,lastStatus}=context.state);
 inspector={...inspector,open:false};
 bindSavedRecords(context.state.courseId);
 root.replaceChildren(...context.nodes);root.hidden=false;root.querySelector('.private-inspector').hidden=true;
 syncWorkspaceShell(course,sampleSession?'calendar':tab,!!sampleSession);syncInspectorModality();
 for(const [node,top,left] of context.scroll){node.scrollTop=top;node.scrollLeft=left;}
}
root.addEventListener('focusout',e=>{if(!e.target.matches?.('input,textarea,select'))return;const main=root.querySelector('.private-primary');if(main)editorFocus.set(main,{node:e.target,start:e.target.selectionStart??null,end:e.target.selectionEnd??null});});
function reset(){tabResizeObserver?.disconnect();tab='sequence';selectedUnit=null;selectedLesson=null;directoryQuery='';directoryUnit='';workspaceTabs.setAccount(null);tabViews.clear();document.querySelector?.('.unsaved-navigation')?.close();document.querySelector?.('.unsaved-navigation')?.remove();document.querySelector?.('.open-tabs-dialog')?.remove();workspaceState.setAccount(null);navigation.reset();dashboardNavigation++;courseContexts.clear();syncWorkspaceShell(null,null);inspector={open:false,kind:"none",width:360};buildReturnView=null;sampleSession=null;epoch++;editEpoch++;api=null;owner=null;course=null;units=[];lessons=[];exceptions=[];calendarState=null;eventDraft=null;eventPreview=null;outlookState=newOutlookState();dirty=false;root.hidden=true;root.replaceChildren();}
export function clearPrivateWorkspace(){reset();}
export function activePrivateCourseId(){return course?.id??null;}
export function isPrivateWorkspaceBusy(){return workspaceState.isSaving();}
export function isPrivateWorkspaceDirty(){return dirty||workspaceState.hasDraft();}
export async function openPrivateCourse(client,user,id,{discardUnsaved=false,preserveContext=false}={}){
 if(workspaceState.account()&&workspaceState.account()!==user.id)reset();
 workspaceState.setAccount(user.id);workspaceTabs.setAccount(user.id);
 if(workspaceState.isSaving()){status("Wait for the current save to finish before changing courses.","pending");return false;}
 const switching=!!course&&course.id!==id;
 if(!uuidRE.test(id))throw new Error("Invalid course ID.");
 // Never replace a teacher's unsubmitted form. The auth client can refresh in
 // another browser tab at any time, including while this request is in flight.
 if(dirty && !discardUnsaved && !(switching&&preserveContext)){
  status("Unsaved changes preserved. Save or explicitly discard before loading newer records.","pending");
  return false;
 }
 if(dirty && discardUnsaved){workspaceState.discard(course?.id);dirty=false;editEpoch++;}
 if(sampleSession&&!switching){leaveBuildSample();render();}
 const call=++epoch,editAtStart=editEpoch,readToken=workspaceState.beginRead(id);
 root.hidden=false;
 const sameCourse=course?.id===id;
 if(sameCourse)status("Checking saved records…");
 else if(!course)root.innerHTML='<p role="status">Loading your saved course…</p>';
 let records,readError;
 try{records=await readCompleteCourse(client,user,id,{isCurrent:()=>call===epoch&&editEpoch===editAtStart&&(!dirty||switching&&preserveContext)});}catch(err){readError=err;}
 if(call!==epoch)return false;
 // An edit made after the request started must take priority over its reply.
 if((dirty&&!(switching&&preserveContext)) || editEpoch!==editAtStart){
  status("Unsaved changes preserved. The saved version can be reloaded after you save or discard your draft.","pending");
  return false;
 }
 if(readError){const message=(sameCourse?'Reload failed; current editor preserved: ':'Unable to open private course: ')+readError.message;if(!course)root.innerHTML='<p role="alert">'+escapeHtml(message)+'</p>';status(message,'error');const notice=$('storage-status');if(notice)notice.textContent=message;return false;}
 if(!navigation.transition({kind:'course',courseId:id}).ok)return false;
 // Home and Dashboard keep their own metadata projections of these saved records.
 void refreshWorkspaceCourseSummary(client,id);
 // Cache only after the target passes the same authenticated owner-scoped read.
 api=client;owner=user;
 if(switching&&preserveContext){stashTab();courseContexts.set(course.id,captureContext());}
 const previous=preserveContext?courseContexts.get(id):null;
 if(previous){courseContexts.delete(id);bindSavedRecords(id);restoreTab({focus:false});status(dirty?"Unsaved course draft restored. Save to store it.":"Workspace restored. Reload saved data to check for newer records.",dirty?"pending":"info");return true;}
 if(switching){root.replaceChildren();dirty=false;selectedUnit=null;selectedLesson=null;tab="sequence";sampleSession=null;}
 const nextRecords=records;
 if(!sameCourse)outlookState=newOutlookState();
 else if((outlookState.result||outlookState.draft)&&schedulingSnapshotToken(nextRecords)!==schedulingSnapshotToken(calendarRecords()))discardOutlook(true,'Saved inputs changed. The old Build forecast was discarded; build again.');
 if(!workspaceState.publish(readToken,records)){status('Other open plans have unsaved edits. Save or discard them before reloading saved course data.','pending');return false;}
 bindSavedRecords(id);
 if(!sameCourse){eventDraft=null;eventPreview=null;inspector.open=false;inspector.kind="none";buildReturnView=null;}
 if(sameCourse&&eventDraft&&eventPreview)eventPreview=previewSchedulingEvent({course,units,lessons,exceptions},eventDraft);
 if(!sameCourse||!calendarState){
  const initial=isCalendarDate(course.first_day)?course.first_day:activeCalendarRecords({course,units,lessons}).lessons.flatMap(l=>l.scheduled_dates||[]).filter(isCalendarDate).sort()[0]||todayInCourse(course.timezone);
  calendarState={view:"month",anchor:initial,selected:initial};
 }
 if(!units.some(x=>x.id===selectedUnit))selectedUnit=units[0]?.id||null;
 if(!lessons.some(x=>x.id===selectedLesson))selectedLesson=lessons[0]?.id||null;
 syncDirty();render();
 status("Loaded from private cloud storage.","saved");
 return true;
}
function render({primary=true,detail=true}={}){
 if(!course)return;
 if(tab!=='calendar')inspector.open=false;
 const display=calendarRecords(),view=sampleSession?'calendar':tab;
 syncWorkspaceShell(course,view,!!sampleSession);
 root.setAttribute?.('aria-label',sampleSession?'Temporary fictional Build Schedule scenario':'Saved curriculum planning');
 const title=destinationNames[view]||'Planning view';
 const summaryView=['new','overview','resources','templates','archive'].includes(view);
 const counts=view==='overview'?{...activeCalendarRecords(display),exceptions:display.exceptions}:display;
 const action=summaryView||['unit-plan','lesson-plan','create-unit','create-lesson'].includes(view)?'':view==='calendar'?'<button type="button" data-outlook-open class="workspace-primary-action">Build Schedule</button>':`<button type="button" data-private-add="${['units','unit-plan','create-unit'].includes(view)?'units':'lessons'}" class="workspace-primary-action">Add ${['units','unit-plan','create-unit'].includes(view)?'unit':'lesson'}</button>`;
 const header=`<header class="private-header"><div><p class="private-kicker">${sampleSession?'FICTIONAL SUCCESS SCENARIO · IN MEMORY · NOT SAVED':'SAVED WORKSPACE · PRIVATE ACCOUNT'}</p><h2>${escapeHtml(display.course.name)}</h2><h1>${title}</h1><p class="workspace-counts">${counts.units.length} unit(s) · ${counts.lessons.length} lesson(s) · ${counts.exceptions.length} calendar exception(s)</p></div><div class="workspace-toolbar">${action}${view==='calendar'?`<button type="button" data-inspector-open ${outlookState.result?'data-outlook-inspect':''} aria-label="${outlookState.result?'Review preview':'Show inspector'}">${outlookState.result?'Review preview':'Inspector'}</button>`:''}${sampleSession?'<button type="button" data-build-sample-reset>Reset sample</button><button type="button" data-build-sample-return>Return to your saved course</button>':'<details class="course-actions"><summary>Course actions</summary><button data-private-export type="button">Export course JSON</button><button type="button" data-private-reload>Reload saved data</button></details>'}</div></header>`;
 const content=view==='new'?renderLauncher(workspaceTabs.closed(course.id).map(t=>tabLabel(t).label)):['unit-plan','lesson-plan','create-unit','create-lesson'].includes(view)?renderIndividualPlan():view==='lessons'?renderLessonDirectory():view==='overview'?renderOverview():['resources','templates','archive'].includes(view)?renderPlaceholder(view):view==='calendar'?renderCalendar():view==='units'?renderUnitList():renderSequence();
 const aside=`<div class="inspector-heading"><span>${inspector.kind==='lesson'?'Lesson details':inspector.kind==='unit'?'Unit details':inspector.kind==='build'?'Build Schedule':inspector.kind==='event'?'Calendar event':'Details'}</span><button type="button" data-private-home>Home</button><button type="button" data-inspector-close aria-label="Close inspector">×</button></div><details class="inspector-size"><summary>Inspector size</summary><label>Width<input type="range" data-inspector-width min="280" max="520" step="20" value="${inspector.width}" aria-label="Inspector width"></label></details><p data-inspector-status data-kind="${lastStatus.kind}" ${['error','pending'].includes(lastStatus.kind)?'':'hidden'}>${escapeHtml(lastStatus.message)}</p><div class="private-inspector-body">${renderInspector()}</div>`;
 const main=root.querySelector?.('.private-primary'),panel=root.querySelector?.('.private-inspector');
 if(!main){root.innerHTML=`<div class="private-frame" style="--inspector-width:${inspector.width}px"><section class="private-primary" tabindex="-1" aria-label="Primary planning workspace"><div class="course-tab-toolbar" data-tab-host></div>${header}<p id="private-status" class="sr-only" role="status" aria-live="polite"></p><div class="private-content">${content}</div></section><aside class="private-inspector" aria-label="Contextual inspector" ${inspector.open?'':'hidden'}>${aside}</aside></div>`;}
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
 projectDrafts();syncDirty();renderTabs();syncInspectorModality();
}
function narrowInspector(){return typeof matchMedia==='function'&&matchMedia('(max-width:1100px)').matches;}
function syncInspectorModality(){
 const panel=root.querySelector?.('.private-inspector'),main=root.querySelector?.('.private-primary');if(!panel)return;
 const modal=inspector.open&&narrowInspector()&&document.body?.dataset.destination!=='home';main.inert=modal;
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
function renderOverview(){
 const active=activeCalendarRecords({course,units,lessons});
 const ready=active.lessons.filter(l=>l.planning_status==='Ready').length;
 const scheduled=active.lessons.filter(l=>l.scheduled_dates?.length).length;
 return `<section class="course-overview"><p>A summary of this course's saved records.</p><dl class="overview-counts"><div><dt>Active units</dt><dd>${active.units.length}</dd></div><div><dt>Active lessons</dt><dd>${active.lessons.length}</dd></div><div><dt>Ready</dt><dd>${ready}</dd></div><div><dt>With saved dates</dt><dd>${scheduled}</dd></div></dl><p>${escapeHtml(isCalendarDate(course.first_day)?calendarDateLabel(course.first_day,{year:'numeric',month:'short',day:'numeric'}):'Start date not set')} – ${escapeHtml(isCalendarDate(course.last_day)?calendarDateLabel(course.last_day,{year:'numeric',month:'short',day:'numeric'}):'End date not set')}</p><h3>Units</h3>${renderUnitList(active)}<div class="overview-links"><button type="button" data-private-tab="sequence">Course Sequence</button><button type="button" data-private-tab="lessons">Lesson Planning</button><button type="button" data-private-tab="calendar">Calendar</button></div></section>`;
}
function renderPlaceholder(view){const descriptions={resources:'Course resource management is coming later. Existing lesson resource references remain available in Lesson Planning.',templates:'Saved template management is coming later. Your existing lesson content stays available in Lesson Planning.',archive:'Archive browsing and recovery are coming later. Archived records remain included in course exports and account backups.'};return `<section class="workspace-placeholder"><h3>Under development</h3><p>${descriptions[view]}</p></section>`;}
function renderUnitList(records={units,lessons}){return `<div class="workspace-unit-list">${records.units.map(u=>`<div class="planning-directory-row"><button type="button" data-private-unit="${escapeHtml(u.id)}"><span class="unit-marker" style="--unit-marker:var(--unit-${(units.indexOf(u)%5)+1})" aria-hidden="true"></span><span><strong>${escapeHtml(u.title)}</strong><small>${records.lessons.filter(l=>l.unit_id===u.id).length} lessons · ${escapeHtml(u.essential_questions||'No essential question yet')}</small></span></button><button type="button" data-open-unit-tab="${u.id}" aria-label="Open ${escapeHtml(u.title)} in New Tab">↗</button></div>`).join('')||'<p>No units yet. Add your first unit.</p>'}</div>`;}
function calendarPresentation(){const records=calendarRecords(),outlook=planningOutlook(records,outlookState.result,{focusDate:calendarState.selected,weeks:outlookState.preferences.weeks});return {records,outlook,presentation:{confirmed:outlookState.preferences.confirmed,byDate:outlookState.preferences.tentative?outlook.byDate:{},allowEventPreview:!sampleSession}};}
function renderInspector(){
 if(['unit-plan','lesson-plan','create-unit','create-lesson'].includes(tab)){const d=destination(),ref=destinationRef(d),row=workspaceState.editing(ref);return `<section class="plan-context"><h3>${escapeHtml(row.title||destinationNames[tab])}</h3><p>${escapeHtml(course.name)}</p><p>${d.table==='lessons'?escapeHtml(units.find(u=>u.id===(row.unit_id||lessons.find(l=>l.id===d.recordId)?.unit_id))?.title||'Choose a unit in the plan'):'Unit context'}</p><p>Edit this plan in the central workspace. Your changes are kept while you switch tabs; select Save to store them.</p></section>`;}

 if(inspector.kind==='build'){const {records,outlook}=calendarPresentation();return renderPlanningOutlook(records,outlookState,outlook,{surface:'inspector'});}
 if(inspector.kind==='lesson')return sampleSession?renderBuildSampleNotice(sampleSession.records,sampleSession.lessonId):lessons.some(l=>l.id===selectedLesson)?renderLessons(lessons.find(l=>l.id===selectedLesson)):'<p>This selected lesson is unavailable. Reload its directory to check saved records.</p>';
 if(inspector.kind==='unit')return units.some(u=>u.id===selectedUnit)?renderUnits(units.find(u=>u.id===selectedUnit)):'<p>This selected unit is unavailable.</p>';
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
 lessons.map(x=>'<tr><td>'+x.position+'</td><td>'+escapeHtml(units.find(u=>u.id===x.unit_id)?.title||"")+'</td><td><button data-private-lesson="'+x.id+'">'+escapeHtml(x.title)+'</button><button type="button" data-open-lesson-tab="'+x.id+'" aria-label="Open '+escapeHtml(x.title)+' in New Tab">↗</button></td><td>'+escapeHtml(x.planning_status)+'</td><td>'+escapeHtml((x.scheduled_dates||[]).join(", ")||"Unscheduled")+'</td></tr>').join("")+
 '</tbody></table></div>':'<p>No saved lessons yet. Add a unit, then add lessons.</p>')+
 '';
}
function renderUnits(current){
 if(current)current=workspaceState.editing(workspaceState.reference(course.id,'units',current.id));
 const selector=units.map(u=>'<option value="'+u.id+'"'+(u.id===selectedUnit?' selected':'')+'>'+escapeHtml(u.position+' · '+u.title)+'</option>').join("");
 const existing=current?'<label class="private-field">Select unit<select data-private-select-unit>'+selector+'</select></label>'+
 '<form data-private-save="units" data-id="'+current.id+'" class="private-editor"><div class="private-form-grid">'+unitFields.slice(0,5).map(f=>field(f,current[f[0]])).join("")+'</div><details><summary>More unit planning fields</summary><div class="private-form-grid">'+unitFields.slice(5).map(f=>field(f,current[f[0]])).join("")+'</div></details><button type="submit">Save unit changes</button></form>':
 '<p>No units yet. Create your first unit below.</p>';
 return '<p>Essential questions live on the unit; associated lessons inherit the context.</p>'+(current?existing:
 '<details open class="private-new-form"><summary>Add unit</summary><form data-draft-id="'+escapeHtml(destination()?.draftId||'')+'" data-private-create="units" class="private-form-grid"><label>Unit title<input name="title" required maxlength="180"></label><label>Order<input type="number" name="position" min="1" value="'+(units.length+1)+'" required></label><button type="submit">Create unit</button></form></details>');
}
function renderLessons(current){
 if(current)current=workspaceState.editing(workspaceState.reference(course.id,'lessons',current.id));
 const options=lessons.map(l=>'<option value="'+l.id+'"'+(l.id===selectedLesson?' selected':'')+'>'+escapeHtml(l.position+' · '+l.title)+'</option>').join("");
 const unitOptions=units.map(u=>'<option value="'+u.id+'">'+escapeHtml(u.title)+'</option>').join("");
 const context=current?units.find(x=>x.id===current.unit_id):null;
 const existing=current?'<label class="private-field">Select lesson<select data-private-select-lesson>'+options+'</select></label>'+
 '<p class="private-context"><strong>Unit:</strong> '+escapeHtml(context?.title||"Unknown")+' <strong>Essential question(s):</strong> '+escapeHtml(context?.essential_questions||"Not entered")+'</p>'+
 '<form data-private-save="lessons" data-id="'+current.id+'" class="private-editor"><div class="private-form-grid">'+lessonFields.slice(0,7).map(f=>field(f,current[f[0]])).join("")+'</div><details><summary>Additional lesson planning fields</summary><div class="private-form-grid">'+lessonFields.slice(7).map(f=>field(f,current[f[0]])).join("")+'</div></details><button type="submit">Save lesson changes</button></form>':
 '<p>No lessons yet. Add a lesson to a unit below.</p>';
 const create=units.length?'<details open class="private-new-form"><summary>Add lesson</summary><form data-draft-id="'+escapeHtml(destination()?.draftId||'')+'" data-private-create="lessons" class="private-form-grid"><label>Unit<select name="unit_id">'+unitOptions+'</select></label><label>Lesson title<input name="title" required maxlength="180"></label><label>Sequence position<input type="number" name="position" min="1" required value="'+(lessons.length+1)+'"></label><button type="submit">Create lesson</button></form></details>':'<p>Create a unit before adding lessons.</p>';
 return '<p>Lesson details and Course Sequence refer to the same saved lesson record. Blank fields are optional.</p>'+(current?existing:create);
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
function closeInspector(){inspector.open=false;render({primary:false});const selector=tab==='calendar'?'[data-private-calendar-day="'+calendarState?.selected+'"]':tab==='units'?'[data-private-unit="'+selectedUnit+'"]':'[data-private-lesson="'+selectedLesson+'"]';(root.querySelector?.(selector)||root.querySelector?.('[data-inspector-open]'))?.focus({preventScroll:true});}
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
 const tabButton=e.target.closest?.('[role="tab"]');
 if(tabButton&&['ArrowLeft','ArrowRight','Home','End','Delete'].includes(e.key)){
  e.preventDefault();const list=workspaceTabs.list(course.id),index=list.findIndex(t=>t.id===tabButton.dataset.tabSelect);
  if(e.key==='Delete'){void closeTab(tabButton.dataset.tabSelect).then(()=>root.querySelector('[aria-selected="true"]')?.focus({preventScroll:true}));return;}
  const next=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowRight'?1:list.length-1))%list.length;
  if(selectTab(list[next].id))root.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});return;
 }

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
let exportRequest=0;
async function exportCourse(){
 if(sampleSession){status("The sample is not exportable. Return to your saved course for saved-record exports.");return;}
 if(!course || workspaceState.hasDraft(course.id)||workspaceState.isSaving()){status("Save or discard changes before exporting.","error");return;}
 const client=api,user=owner,id=course.id,request=++exportRequest,readEpoch=epoch,editAtStart=editEpoch,button=root.querySelector('[data-private-export]');
 const isCurrent=()=>request===exportRequest&&epoch===readEpoch&&editEpoch===editAtStart&&owner?.id===user.id&&course?.id===id&&!dirty&&!workspaceState.isSaving()&&!sampleSession;
 if(button)button.disabled=true;status('Verifying a complete saved course export…');
 try{
 const {json,text}=await makeCourseExport(client,user,id,{isCurrent});
 if(!isCurrent())throw new Error('Workspace changed. No export was created.');
 const blob=new Blob([text],{type:"application/json"});
 const link=document.createElement("a"),url=URL.createObjectURL(blob);
 try{link.href=url;link.download="course-planner-"+id+".json";document.body.append(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 status('Verified saved export: '+json.units.length+' units · '+json.lessons.length+' lessons · '+json.calendarExceptions.length+' calendar exceptions.','saved');
 }catch(err){if(owner?.id===user.id&&course?.id===id)status('Export failed: '+err.message+' No file was created.','error');}
 finally{if(button)button.disabled=false;}
}
root.addEventListener("input",e=>{
 if(e.target.matches?.('[data-lesson-search]')){directoryQuery=e.target.value;root.querySelector('[data-lesson-directory-results]').innerHTML=renderLessonResults();return;}
 const buildForm=e.target.closest('[data-build-schedule-form]');
 if(buildForm&&outlookState.draft){const hadResult=!!outlookState.result;outlookState.draft=readBuildDraft(buildForm);discardOutlook(false,'Preview configuration changed. Build again to see current hypothetical dates.');if(hadResult)renderWithFocus('[data-build-schedule-form] [name="'+e.target.name+'"]');return;}
 const editor=!sampleSession&&e.target.closest("form[data-private-save],form[data-private-create]");
 if(editor){if(course)rememberForm(editor);setDirty(true);renderTabs();if(course)publishContinueContext();}
 const form=e.target.closest("[data-event-preview-form]");if(form&&eventDraft){eventDraft=readEventDraft(form);eventPreview=null;const stale=root.querySelector('[aria-labelledby="scheduling-preview-title"]');if(stale)stale.hidden=true;}
});
async function workspaceClick(e){
 const button=e.target.closest("button");if(!button)return;
 if(button.matches("[data-private-home]")){showWorkspaceDestination("home");$("home-title")?.focus({preventScroll:true});return;}
 if(button.matches('[data-inspector-close]')){closeInspector();return;}
 if(button.hasAttribute('data-tab-new')){await navigateTab({kind:'new'},{newTab:true});return;}
 if(button.dataset.tabSelect){selectTab(button.dataset.tabSelect);return;}
 if(button.dataset.tabClose){await closeTab(button.dataset.tabClose);return;}
 if(button.dataset.tabHistory){await travelTab(Number(button.dataset.tabHistory));return;}
 if(button.hasAttribute('data-tab-finder')){openTabFinder();return;}
 if(button.dataset.sidebarNewtab){await navigateTab({kind:button.dataset.sidebarNewtab},{newTab:true});return;}
 if(button.dataset.tabDestination){await navigateTab({kind:button.dataset.tabDestination});return;}
 if(button.dataset.tabCreate){await navigateTab({kind:button.dataset.tabCreate==='units'?'create-unit':'create-lesson'});return;}
 if(button.hasAttribute('data-tab-reopen')){if(workspaceState.isSaving())return;stashTab();workspaceTabs.reopen(course.id,Number(button.dataset.tabReopen));restoreTab();return;}
 if(button.dataset.openLessonTab){await navigateTab({kind:'lesson-plan',table:'lessons',recordId:button.dataset.openLessonTab},{newTab:true});return;}
 if(button.dataset.openUnitTab){await navigateTab({kind:'unit-plan',table:'units',recordId:button.dataset.openUnitTab},{newTab:true});return;}
 if(button.dataset.privateTab){await navigateTab({kind:button.dataset.privateTab});return;}
 if(button.dataset.privateUnit){await navigateTab({kind:'unit-plan',table:'units',recordId:button.dataset.privateUnit});return;}
 if(button.dataset.privateLesson&&!sampleSession&&tab!=='calendar'){await navigateTab({kind:'lesson-plan',table:'lessons',recordId:button.dataset.privateLesson});return;}
 if(button.dataset.privateAdd){await navigateTab({kind:button.dataset.privateAdd==='units'?'create-unit':'create-lesson'},{newTab:true});return;}
 if(workspaceState.isSaving()){status("Wait for the current save to finish before changing views.","pending");return;}
 if(button.matches('[data-inspector-open]')){if(tab!=='calendar')return;inspector.open=true;if(outlookState.result)inspector.kind='build';else if(inspector.kind==='none')inspector.kind=tab==='calendar'?'day':'none';renderWithFocus('.private-inspector h3,.private-inspector h4',{primary:false});}
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
 else if(button.matches("[data-private-lesson]")){
  if(sampleSession){if(!sampleSession.records.lessons.some(l=>l.id===button.dataset.privateLesson))return;sampleSession.lessonId=button.dataset.privateLesson;inspector.open=true;inspector.kind='lesson';renderWithFocus('#build-sample-lesson-title',{primary:false});return;}
  if(!canNavigate({table:'lessons',recordId:button.dataset.privateLesson}))return;selectedLesson=button.dataset.privateLesson;dirty=false;inspector.open=true;inspector.kind='lesson';renderWithFocus('[data-private-save="lessons"] input[name="title"]',{primary:false});}
 else if(button.matches("[data-private-export]"))exportCourse();
 else if(button.matches("[data-private-reload]")){
  if(sampleSession)leaveBuildSample();
  if(!canNavigate({kind:'reload'}))return;
  discardOutlook(true,'Saved data reloaded. Build again to inspect a fresh forecast.');
  await openPrivateCourse(api,owner,course.id,{discardUnsaved:true});
 }
}
root.addEventListener("click",workspaceClick);
$("workspace-navigation")?.addEventListener?.("click",workspaceClick);
root.addEventListener("change",e=>{
 if(e.target.matches('[data-lesson-unit]')){directoryUnit=e.target.value;root.querySelector('[data-lesson-directory-results]').innerHTML=renderLessonResults();return;}
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
 if(e.target.matches('[data-private-select-unit]')){void navigateTab({kind:'unit-plan',table:'units',recordId:e.target.value}).then(ok=>{if(!ok&&e.target.isConnected)e.target.value=selectedUnit;});}
 if(e.target.matches('[data-private-select-lesson]')){void navigateTab({kind:'lesson-plan',table:'lessons',recordId:e.target.value}).then(ok=>{if(!ok&&e.target.isConnected)e.target.value=selectedLesson;});}
});
async function saveRecord(ref){
 if(!api||!owner||!course||workspaceState.isSaving())return false;
 const client=api,savingUser=owner,savingOwner=owner.id,savingCourse=ref.courseId,table=ref.table;
 try{
  if(!['units','lessons'].includes(table))throw Error('Unknown record type');
  const values=workspaceState.editing(ref),fields=table==='units'?unitFields:lessonFields;
  let patch;
  if(ref.recordId){
   patch=Object.fromEntries(fields.map(([name,,type])=>{const raw=String(values[name]??'').trim();return [name,type==='number'?(raw===''?null:Number(raw)):(raw||null)];}));
   if(!patch.title||!Number.isInteger(patch.position)||patch.position<1||patch.target_days!==undefined&&patch.target_days!==null&&(!Number.isInteger(patch.target_days)||patch.target_days<0))throw Error('Check the required title and numeric fields.');
  }else{
   patch={course_id:savingCourse,title:String(values.title||'').trim(),position:Number(values.position)};
   if(!patch.title||!Number.isInteger(patch.position)||patch.position<1)throw Error('A title and positive sequence position are required.');
   if(table==='lessons'){const unitId=String(values.unit_id||'');if(!workspaceState.snapshot(savingCourse).units.some(u=>u.id===unitId))throw Error('Choose a valid unit.');patch.unit_id=unitId;}
  }
  status('Saving to your private database…','pending');
  const saved=await workspaceState.save(ref,patch,({patch,record})=>record
   ?client.from(table).update(patch).eq('id',record.id).eq("revision",record.revision).select('id,revision').maybeSingle()
   :client.from(table).insert(patch).select('id,revision').single());
  if(!saved.current||owner?.id!==savingOwner)return false;
  if(!ref.recordId){for(const id of workspaceTabs.promote(savingCourse,table,ref.draftId,saved.ref.recordId))tabViews.delete(id);}
  if(course?.id===savingCourse){bindSavedRecords(savingCourse);if(!ref.recordId&&sameReference(currentReference(),saved.ref)){applyDestination(destination());render();}else{syncDirty();renderTabs();}}
  if(saved.newerEdits){status('Submitted changes saved, but newer unsaved edits were kept in this form. Save those separately.','pending');return false;}
  const revision=workspaceState.record(saved.ref)?.revision;
  const isCurrent=()=>workspaceState.isCurrent(saved.ref)&&owner?.id===savingOwner&&workspaceState.record(saved.ref)?.revision===revision;
  const records=await readCompleteCourse(client,savingUser,savingCourse,{isCurrent});
  const verified=records[table].find(r=>r.id===saved.ref.recordId);
  if(!verified||verified.revision!==revision||Object.entries(patch).some(([k,v])=>JSON.stringify(verified[k]??null)!==JSON.stringify(v??null)))throw Error('Save was acknowledged but its readback could not be verified. Check saved data before retrying.');
  if(!isCurrent())return false;
  if(!workspaceState.hasDraft(savingCourse))workspaceState.publish(workspaceState.beginRead(savingCourse),records);
  if(course?.id===savingCourse){bindSavedRecords(savingCourse);if(sameReference(currentReference(),saved.ref)){render();status('Saved and verified by reloading your private course records.','saved');}else renderTabs();}
  void refreshWorkspaceCourseSummary(client,savingCourse);return true;
 }catch(error){if(owner?.id===savingOwner&&course?.id===savingCourse){syncDirty();status("Save failed: "+error.message,"error");renderTabs();}return false;}
}

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
 if(!form.dataset.privateSave&&!form.dataset.privateCreate)return;
 if(!api||!owner||!course||workspaceState.isSaving())return;
 const button=form.querySelector('button[type="submit"]');button.disabled=true;
 const ref=formReference(form);rememberForm(form);dirty=true;
 try{await saveRecord(ref);}finally{if(button.isConnected)button.disabled=false;}

});
window.addEventListener('workspace-destination',()=>{if(course){navigation.transition({kind:document.body?.dataset.destination==='home'?'home':'resume',courseId:course.id});syncInspectorModality();publishContinueContext();}});
window.addEventListener('resize',()=>{if(course)syncInspectorModality();});
window.addEventListener("beforeunload",event=>{if(isPrivateWorkspaceDirty()){event.preventDefault();event.returnValue="";}});
