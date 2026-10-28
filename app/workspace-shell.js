import {refreshDashboardCourse} from './dashboard.js';
import {readCourseSummary,summaryLabel} from './course-summary.js';
// All presentation/context in this milestone is page-memory only, never Auth settings.
const byId=id=>document.getElementById(id);
const icons=['▤','◈','◉','✦','⌘','▥'];
let accountId=null,courses=[],currentCourse=null,currentTab=null,sample=false,destination='home';
const courseIcons=new Map(),courseSummaries=new Map(),summaryVersions=new Map();
let summaryGeneration=0;
let workspaceFocus=null;
function navigationState(){const b=byId('sidebar-collapse');if(!b)return;const expanded=matchMedia('(max-width:700px)').matches?document.body.classList.contains('mobile-nav-open'):!document.body.classList.contains('sidebar-collapsed');b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-label',expanded?'Collapse navigation':'Expand navigation');}
function syncDestination(){
 document.body.dataset.destination=destination;
 const home=byId('private-home');if(home)home.hidden=!accountId||destination!=='home';
 byId('workspace-navigation')?.querySelectorAll('button').forEach(b=>{const active=b.hasAttribute('data-global-home')?destination==='home':destination==='workspace'&&b.dataset.privateTab===currentTab;b.disabled=b.hasAttribute('data-global-home')?!accountId:!currentCourse;b.setAttribute('aria-pressed',String(active));if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 document.querySelectorAll('[data-resume-workspace]').forEach(b=>b.hidden=!currentCourse);
 document.querySelectorAll('[data-create-course]').forEach(b=>b.disabled=!accountId);
 document.body.classList.remove('mobile-nav-open');navigationState();
 window.dispatchEvent(new Event('workspace-destination'));
}
export function showWorkspaceDestination(next){if(next==='home'&&destination==='workspace')workspaceFocus=document.activeElement;destination=next==='workspace'&&currentCourse?'workspace':'home';syncDestination();if(destination==='workspace'&&workspaceFocus?.isConnected)workspaceFocus.focus({preventScroll:true});}
export function setWorkspaceAccount(id){if(accountId!==id){courseIcons.clear();courseSummaries.clear();summaryVersions.clear();summaryGeneration++;workspaceFocus=null;courses=[];currentCourse=null;currentTab=null;destination='home';}accountId=id;renderCourseEntries();syncDestination();}
export function setWorkspaceCourses(rows){courses=rows;courseSummaries.clear();summaryVersions.clear();summaryGeneration++;renderCourseEntries();}
function updateSummaryLabel(id){
 const node=byId('home-courses')?.querySelector('[data-course-summary="'+id+'"]');if(!node)return;
 const summary=courseSummaries.get(id);node.textContent=summary?.error?'Summary unavailable':summary?summaryLabel(summary):'Loading course summary…';
}
async function loadSummary(client,row,generation){
 const version=(summaryVersions.get(row.id)||0)+1;summaryVersions.set(row.id,version);let summary;
 try{summary=await readCourseSummary(client,row);}catch{summary={error:true};}
 if(generation!==summaryGeneration||version!==summaryVersions.get(row.id))return;
 courseSummaries.set(row.id,summary);updateSummaryLabel(row.id);
}
export async function refreshWorkspaceCourseSummary(client,id){
 const row=courses.find(row=>row.id===id);if(accountId&&row){void refreshDashboardCourse(client,id);await loadSummary(client,row,summaryGeneration);}
}
export async function refreshWorkspaceSummaries(client){
 const generation=summaryGeneration,queue=[...courses];
 async function worker(){while(queue.length&&generation===summaryGeneration)await loadSummary(client,queue.shift(),generation);}
 await Promise.all(Array.from({length:Math.min(3,queue.length)},worker));
}
function courseButton(row,summary=false){const b=document.createElement('button');b.type='button';b.dataset.privateOpen=row.id;b.setAttribute('aria-label','Open '+row.name);b.title=row.name;const icon=document.createElement('span');icon.className='course-icon';icon.setAttribute('aria-hidden','true');icon.textContent=courseIcons.get(row.id)||icons[0];const name=document.createElement('span');name.className='course-label';name.textContent=row.name;b.append(icon,name);if(summary){b.className='home-course-card';const facts=document.createElement('span');facts.className='course-facts';facts.dataset.courseSummary=row.id;const value=courseSummaries.get(row.id);facts.textContent=value?.error?'Summary unavailable':value?summaryLabel(value):'Loading course summary…';b.append(facts);}if(currentCourse?.id===row.id)b.setAttribute('aria-current','true');return b;}
function renderCourseEntries(){
 const list=byId('saved-courses'),home=byId('home-courses');if(!list||!home)return;
 list.replaceChildren(...courses.map(row=>{const li=document.createElement('li');li.append(courseButton(row));const edit=document.createElement('button');edit.type='button';edit.dataset.courseIcon=row.id;edit.textContent='⋯';edit.className='course-icon-edit';edit.setAttribute('aria-label','Change icon for '+row.name);edit.title='Change course icon (this session)';li.append(edit);return li;}));
 home.replaceChildren(...courses.map(row=>courseButton(row,true)));if(!courses.length)home.textContent=accountId?'No courses yet. Create your first course to begin.':'';
}
export function setContinueContext(context={}){
 const node=byId('continue-context'),fallback=byId('continue-fallback');
 if(node)node.textContent=currentCourse?[currentCourse.name,context.view||'Workspace',context.lesson||'',context.dirty?'Unsaved edits':''].filter(Boolean).join(' · '):'';
 if(fallback)fallback.hidden=!!currentCourse;
}
export function syncWorkspaceShell(course,tab,isSample=false,context={}){
 if(typeof document==='undefined')return;currentCourse=course;currentTab=tab;sample=isSample;
 document.body.classList.toggle('has-private-course',!!course);setContinueContext(context);
 const name=byId('workspace-course-name');if(name){name.textContent=course?.name||'Choose a course';name.dataset.courseId=course?.id||'';}
 const badge=byId('workspace-sample-badge');if(badge)badge.hidden=!sample;
 const auth=document.querySelector('.pilot-auth'),slot=byId(course?'settings-account-slot':'account-home');if(auth&&slot&&auth.parentElement!==slot)slot.append(auth);
 if(!course&&!byId('auth-form')?.hidden){const settings=byId('workspace-settings');if(settings?.open)settings.close();}
 renderCourseEntries();syncDestination();
}
if(typeof document!=='undefined'){
 const settings=byId('workspace-settings');
 byId('sidebar-collapse')?.addEventListener('click',()=>{if(matchMedia('(max-width:700px)').matches)document.body.classList.toggle('mobile-nav-open');else document.body.classList.toggle('sidebar-collapsed');navigationState();});
 navigationState();window.addEventListener('resize',navigationState);
 document.querySelector('[data-global-home]')?.addEventListener('click',()=>{showWorkspaceDestination('home');byId('home-title')?.focus({preventScroll:true});});
 document.querySelector('[data-resume-workspace]')?.addEventListener('click',()=>{showWorkspaceDestination('workspace');if(!workspaceFocus?.isConnected)document.querySelector('.private-primary')?.focus({preventScroll:true});});
 document.querySelectorAll('[data-workspace-settings]').forEach(b=>b.addEventListener('click',()=>{document.body.classList.remove('mobile-nav-open');navigationState();settings.showModal();}));
 document.querySelectorAll('[data-create-course]').forEach(b=>b.addEventListener('click',()=>{document.body.classList.remove('mobile-nav-open');navigationState();settings.showModal();byId('course-name').focus();}));
 document.querySelector('[data-settings-close]')?.addEventListener('click',()=>settings.close());
 for(const key of ['theme','accent'])document.querySelector('[data-appearance-'+key+']')?.addEventListener('change',e=>{document.body.dataset[key]=e.target.value;});
 const picker=document.createElement('dialog');picker.className='workspace-settings';picker.setAttribute('aria-label','Course icon');document.body.append(picker);
 byId('saved-courses')?.addEventListener('click',e=>{const edit=e.target.closest('[data-course-icon]');if(!edit)return;const id=edit.dataset.courseIcon;picker.replaceChildren();const title=document.createElement('h2');title.textContent='Course icon';const note=document.createElement('p');note.textContent='Applies for this session. Saved course records and course color stay unchanged.';picker.append(title,note);for(const [i,icon] of icons.entries()){const b=document.createElement('button');b.type='button';b.textContent=icon;b.setAttribute('aria-label','Choose icon '+(i+1));b.addEventListener('click',()=>{courseIcons.set(id,icon);picker.close();renderCourseEntries();document.querySelector('[data-course-icon="'+id+'"]')?.focus({preventScroll:true});});picker.append(b);}const close=document.createElement('button');close.textContent='Cancel';close.addEventListener('click',()=>picker.close());picker.append(close);picker.showModal();});
}
