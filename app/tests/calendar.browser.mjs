import {dashboardFixture} from './fixtures/dashboard-scenarios.mjs';
/* Browser acceptance against the real application modules. The Supabase SDK is
 * replaced at the network boundary by a deterministic owner-scoped test client.
 * Optional stored fictional data is a user-approved, Git-excluded read fixture.
 * No real auth session or database writes are used by this harness. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildCalendarModel,addCalendarDays} from '../calendar-model.js';
import {scheduleFixture,fullyScheduled80Fixture,buildOutlookFixture,id as previewId} from './fixtures/scheduling-scenarios.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(app,process.env.COURSE_PLANNER_BROWSER_OUTPUT||'reviews/build-schedule-outlook');await mkdir(out,{recursive:true});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const course={id:id(1),owner_id:id(2),name:'Fictional Civic Systems — browser acceptance',first_day:'2026-09-01',last_day:'2027-01-29',teaching_weekdays:[1,2,3,4,5],timezone:'America/New_York',revision:1};
const units=Array.from({length:5},(_,i)=>({id:id(10+i),course_id:course.id,title:'Fictional Unit '+(i+1),position:i+1,target_days:18,revision:1}));
const lessons=Array.from({length:80},(_,i)=>({id:id(100+i),course_id:course.id,unit_id:units[Math.floor(i/16)].id,title:'Fictional lesson '+(i+1),position:i+1,lesson_type:i%8===0?'Assessment':'Content',planning_status:'Draft',duration_days:i%8===0?2:1,scheduled_dates:i>=74?[]:[addCalendarDays('2026-09-01',i),...(i%8===0?[addCalendarDays('2026-09-01',i+1)]:[])],protected_pin_date:i%14===0?addCalendarDays('2026-09-01',i):null,flexible_preference_date:i%14===1?addCalendarDays('2026-09-01',i):null,revision:1}));
const exceptions=Array.from({length:12},(_,i)=>({id:id(300+i),course_id:course.id,title:'Fictional exception '+(i+1),date:addCalendarDays('2026-09-07',i*3),effect:['No Lesson','Replace Lesson','Continue Lesson'][i%3],event_type:i%3===0?'Closure':'Special event',revision:1}));
const synthetic={course,units,lessons,exceptions};
const archived=structuredClone(synthetic),archiveDate='2026-10-26T12:00:00Z';
archived.units[4].archived_at=archiveDate;
for(const index of [8,14,15,30])archived.lessons[index].archived_at=archiveDate;
archived.lessons[14].scheduled_dates=[...archived.lessons[0].scheduled_dates];
archived.lessons[14].protected_pin_date=archived.lessons[0].scheduled_dates[0];
archived.lessons[15].flexible_preference_date=archived.lessons[0].scheduled_dates[0];
archived.lessons[30].scheduled_dates=[];
const archivedRecords=fixture=>{
 const archivedUnits=new Set(fixture.units.filter(u=>u.archived_at!=null).map(u=>u.id));
 return fixture.lessons.filter(l=>l.archived_at!=null||archivedUnits.has(l.unit_id));
};
const stored=process.env.COURSE_PLANNER_CALENDAR_FIXTURE?JSON.parse(await readFile(process.env.COURSE_PLANNER_CALENDAR_FIXTURE,'utf8')):null;
const checks=[],errors=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push({name,passed:true});};
// Open actual presentation disclosures/dismiss the narrow detail sheet before
// exercising existing behaviors. The dedicated UX scenario checks their defaults.
async function expose(locator){
 const page=locator.page();
 if(!await locator.count()&&await page.locator('.private-inspector[hidden]').count())await page.locator('[data-inspector-open]').click();
 if(await locator.count()){
  const settings=await locator.first().evaluate(e=>!!e.closest('#workspace-settings'));
  const dialog=page.locator('#workspace-settings');
  if(settings&&!await dialog.evaluate(e=>e.open)){if(await page.locator('.private-primary').evaluate(e=>e.inert))await page.locator('[data-inspector-close]').click();await page.locator('[data-workspace-settings]').click();}
  else if(!settings&&await dialog.evaluate(e=>e.open))await page.locator('[data-settings-close]').click();
  const inside=await locator.first().evaluate(e=>!!e.closest('.private-inspector'));
  if(inside&&!await page.locator('.private-inspector').isVisible())await page.locator('[data-inspector-open]').click();
  if(!inside&&await page.locator('.private-primary').evaluate(e=>e.inert)){await page.locator('[data-inspector-close]').click();if(await page.locator('.private-primary').evaluate(e=>e.inert))return false;}
 }
 const ancestors=locator.first().locator('xpath=ancestor::details');
 const count=await ancestors.count()-(await locator.first().evaluate(e=>e.tagName==='SUMMARY')?1:0);
 for(let i=0;i<count;i++){const d=ancestors.nth(i);if(!await d.evaluate(e=>e.open))await d.locator(':scope>summary').click();}
}
async function control(locator,method,...args){await expose(locator);await locator[method](...args);}
async function click(locator){if(await expose(locator)!==false)await locator.click();}
async function details(page){for(const cls of ['.outlook-more','.event-more']){const d=page.locator(cls);if(await d.count()&&!await d.evaluate(e=>e.open)){await expose(d.locator(':scope>summary'));await d.locator(':scope>summary').click();}}}
async function captureInspector(page,path){if(await page.locator('[data-outlook-inspect]').count())await click(page.locator('[data-outlook-inspect]'));else if(!await page.locator('.private-inspector').isVisible())await page.locator('[data-inspector-open]').click();await page.locator('.private-inspector').screenshot({path});}
async function formSubmit(page,selector){await expose(page.locator(selector));await page.locator(selector).click();await page.evaluate(()=>{window.testPreviewResultFocus=document.activeElement?.id;});await details(page);}
async function verifyPreviewInterface(page,width,prefix,fixture){
 const original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const open=async()=>{await click(page.locator('[data-event-open=""]'));};
 const fill=async(title='Fictional closure')=>{await control(page.locator('[data-event-preview-form] [name="title"]'),'fill',title);await control(page.locator('[data-event-preview-form] [name="date"]'),'fill','2026-09-15');};
 const submit=async()=>{await formSubmit(page,'[data-event-preview-form] button[type="submit"]');};
 const result=page.locator('[aria-labelledby="scheduling-preview-title"]');
 await open();
 check(prefix+' preview form focus',await page.locator('#event-form-title').evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Tab');check(prefix+' keyboard reaches title',await page.locator('[data-event-preview-form] [name="title"]').evaluate(e=>e===document.activeElement));
 await fill();
 check(prefix+' closure defaults to Move',await page.locator('[name="effect"]').inputValue()==='Move');
 check(prefix+' Keep forbidden on closure',await page.locator('[name="effect"] option[value="Keep"]').evaluate(e=>e.disabled));
 check(prefix+' Extend is deferred',await page.locator('[name="effect"] option[value="Extend"]').evaluate(e=>e.disabled));
 check(prefix+' event form does not dirty authoring',await page.evaluate(async()=>!(await import('./private-workspace.js')).isPrivateWorkspaceDirty()));
 await submit();
 check(prefix+' ready preview and result focus',(await page.locator('#scheduling-preview-title').innerText()).includes('Preview ready')&&await page.evaluate(()=>window.testPreviewResultFocus==='scheduling-preview-title'));
 check(prefix+' every downstream change disclosed',await result.locator(':scope > .event-more > [data-preview-row][data-changed="true"]').count()===3);
 const second=result.locator(':scope > .event-more > [data-preview-row="'+fixture.lessons[1].id+'"]');
 check(prefix+' BEFORE and PROPOSED dates visible',(await second.innerText()).includes('2026-09-15')&&(await second.innerText()).includes('2026-09-16'));
 check(prefix+' no scheduling apply action',await result.getByRole('button',{name:/^(Apply|Save|Confirm)$/}).count()===0);
 check(prefix+' collapsed course icon remains visible',await page.locator('#saved-courses .course-icon').first().isVisible());
 check(prefix+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await result.screenshot({path:resolve(out,prefix+'-closure-before-proposed.png')});
 await control(page.locator('[data-event-preview-form] [name="title"]'),'fill','Changed title');
 check(prefix+' edited proposal hides stale result',!(await page.locator('#scheduling-preview-title').isVisible()));
 await page.locator('[data-event-preview-form] [name="title"]').press('Escape');
 check(prefix+' Escape cancel restores entry focus',await page.locator('[data-event-open=""]').evaluate(e=>e===document.activeElement));
 check(prefix+' Cancel leaves byte-identical records',await page.evaluate(()=>JSON.stringify(window.testDb))===original);
 const exportedPromise=page.waitForEvent('download');await click(page.locator('[data-private-export]'));const exported=await exportedPromise;const saved=JSON.parse(await readFile(await exported.path(),'utf8')),baseline=JSON.parse(original);
 check(prefix+' cancelled draft absent from JSON export',JSON.stringify(saved.lessons)===JSON.stringify(baseline.lessons)&&JSON.stringify(saved.calendarExceptions)===JSON.stringify(baseline.calendar_exceptions)&&JSON.stringify(saved.units)===JSON.stringify(baseline.units)&&JSON.stringify(saved.course)===JSON.stringify(baseline.courses[0]));
 await open();await fill('Fictional shortened periods');await control(page.locator('[name="eventType"]'),'selectOption','Shortened periods');
 check(prefix+' shortened default Keep',await page.locator('[name="effect"]').inputValue()==='Keep');await submit();
 await result.screenshot({path:resolve(out,prefix+'-keep-before-proposed.png')});
 check(prefix+' Keep preserves date arrays',await result.locator(':scope > .event-more > [data-preview-row][data-changed="true"]').count()===0&&(await result.innerText()).includes('2026-09-15'));
 await control(page.locator('[name="effect"]'),'selectOption','Move');await submit();
 check(prefix+' same event type permits Move override',(await result.innerText()).includes('teacher override')&&await result.locator(':scope > .event-more > [data-preview-row][data-changed="true"]').count()===3);
 await control(page.locator('[name="eventType"]'),'selectOption','Testing');await control(page.locator('[name="availability"]'),'selectOption','instructional');await control(page.locator('[name="effect"]'),'selectOption','Keep');await submit();
 check(prefix+' explicit instructional Testing Keep allowed',(await result.innerText()).includes('Preview ready')&&(await result.innerText()).includes('teacher override'));
 await control(page.locator('[name="eventType"]'),'selectOption','Other');await control(page.locator('[name="availability"]'),'selectOption','partial');await submit();
 check(prefix+' partial-time policy blocks preview',(await result.innerText()).includes('Blocked preview')&&(await result.innerText()).includes('Partial-day time allocation is unresolved'));
 await click(result.getByRole('button',{name:'Close preview',exact:true}));
 await open();await fill();await submit();
 // Another editor changes a dependency in the test DB; reloading must invalidate.
 await page.evaluate(()=>{window.testDb.lessons[2].protected_pin_date='2026-09-16';window.testDb.lessons[2].revision++;});
 await click(page.locator('[data-private-reload]'));await details(page);
 check(prefix+' reload invalidates open preview',(await result.innerText()).includes('Saved inputs changed'));
 await click(result.getByRole('button',{name:'Close preview',exact:true}));await open();await fill();await submit();
 check(prefix+' protected assessment blocks displacement',(await result.innerText()).includes('Blocked preview')&&(await result.innerText()).includes('before the next protected commitment'));
 await result.screenshot({path:resolve(out,prefix+'-protected-conflict.png')});
 await click(result.locator(':scope > .event-more > [data-preview-row] [data-private-lesson]').first());
 check(prefix+' preview uses shared lesson record',await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===fixture.lessons[1].id);
 await control(page.locator('[name="objective"]'),'fill','Unsaved authoring guard probe');page.once('dialog',d=>d.dismiss());await click(page.locator('[data-private-tab="calendar"]'));
 check(prefix+' authoring draft guard survives previews',await page.locator('[name="objective"]').inputValue()==='Unsaved authoring guard probe');
 page.once('dialog',d=>d.accept());await click(page.locator('[data-private-tab="calendar"]'));
 await page.evaluate(({eventId,courseId})=>{window.testDb.lessons[2].protected_pin_date=null;window.testDb.lessons[2].revision++;window.testDb.calendar_exceptions.push({id:eventId,course_id:courseId,date:'2026-09-18',title:'Fictional replacement event',event_type:'Alternate activity',effect:'Replace Lesson',revision:1});},{eventId:previewId(30),courseId:fixture.course.id});
 await click(page.locator('[data-private-reload]'));await details(page);await click(page.locator('.event-list summary'));await click(page.locator('.event-list [data-event-open="'+previewId(30)+'"]'));
 check(prefix+' Change event retains raw title',await page.locator('[data-event-preview-form] [name="title"]').inputValue()==='Fictional replacement event');
 await control(page.locator('[name="date"]'),'fill','2026-09-15');await submit();
 check(prefix+' legacy replacement preview mapping',(await result.innerText()).includes('legacy default')&&(await result.innerText()).includes('Fictional replacement event'));
 check(prefix+' preview Close never performs REST or RPC writes',await page.evaluate(()=>window.testWrites.length===0));
 await click(result.getByRole('button',{name:'Close preview',exact:true}));
 check(prefix+' saved Month/Week presentation retained',await page.locator('.saved-month').count()===1);
 await click(page.locator('[data-private-calendar-view="week"]'));check(prefix+' Week still usable',await page.locator('.saved-agenda>.saved-calendar-day').count()===7);
 await page.evaluate(({eventId,courseId})=>{window.testDb.calendar_exceptions=[{id:eventId,course_id:courseId,date:'2026-09-18',title:'Fictional full closure',effect:'No Lesson',event_type:'Closure',revision:1}];},{eventId:previewId(31),courseId:fixture.course.id});await click(page.locator('[data-private-reload]'));await details(page);await click(page.locator('.event-list summary'));await click(page.locator('.event-list [data-event-open="'+previewId(31)+'"]'));
 await control(page.locator('[name="eventType"]'),'selectOption','Shortened periods');check(prefix+' saved closure constraint survives type defaults',await page.locator('[name="availability"]').inputValue()==='closed'&&await page.locator('[name="effect"]').inputValue()==='Move');check(prefix+' saved closure Keep stays forbidden',await page.locator('[name="effect"] option[value="Keep"]').evaluate(e=>e.disabled));
}
async function verifyCompleteOrPartial(page,width,prefix,fixture,partial=false){
 const original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const result=page.locator('[aria-labelledby="scheduling-preview-title"]');
 const form=page.locator('[data-event-preview-form]');
 await click(page.locator('[data-event-open=""]'));
 await form.locator('[name="title"]').fill('Fictional review closure');await form.locator('[name="date"]').fill(partial?'2026-09-15':'2026-09-02');
 await formSubmit(page,'[data-event-preview-form] button[type="submit"]');
 check(prefix+' Move result explicit',(await result.innerText()).includes(partial?'Partial preview — overall blocked':'Preview ready for review'));
 check(prefix+' full BEFORE comparisons',await result.locator('.event-more > details').filter({hasText:'All active lesson comparisons'}).locator('[data-preview-row]').count()===fixture.lessons.length);
 check(prefix+' assessed downstream Move changes',await result.locator(':scope > .event-more > [data-preview-row][data-changed="true"]').count()===(partial?1:79));
 check(prefix+' no Apply action',await result.getByRole('button',{name:/^(Apply|Save|Confirm)$/}).count()===0);
 check(prefix+' result focus',await page.evaluate(()=>window.testPreviewResultFocus==='scheduling-preview-title'));
 if(partial){
  check(prefix+' honest assessment totals',(await result.innerText()).includes('2 lesson(s) assessed · 2 not assessed · 1 already unscheduled'));
  check(prefix+' no dates cross unresolved horizon',(await result.innerText()).includes('ending 2026-09-16'));
  await click(result.locator('[data-preview-unassessed] summary'));
  check(prefix+' unassessed saved dates disclosed',(await result.locator('[data-preview-unassessed]').innerText()).includes('Not assessed — no proposed dates'));
 }else{
  check(prefix+' eighty assessed no missing work',(await result.innerText()).includes('80 lesson(s) assessed · 0 not assessed · 0 already unscheduled'));
  check(prefix+' five units twelve saved events',(await result.innerText()).includes('5 active unit(s)')&&(await page.locator('.private-header').innerText()).includes('80 lesson(s) · 12 calendar exception(s)'));
 }
 check(prefix+' no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await result.screenshot({path:resolve(out,prefix+'-move.png')});
 await form.locator('[name="eventType"]').selectOption('Shortened periods');await form.locator('[name="availability"]').selectOption('instructional');await form.locator('[name="effect"]').selectOption('Keep');await formSubmit(page,'[data-event-preview-form] button[type="submit"]');
 check(prefix+' Keep result explicit',(await result.innerText()).includes(partial?'Partial preview — overall blocked':'Preview ready for review'));
 check(prefix+' Keep changes no dates',await result.locator(':scope > .event-more > [data-preview-row][data-changed="true"]').count()===0);
 check(prefix+' Keep assessment counts',(await result.innerText()).includes(partial?'3 lesson(s) assessed · 1 not assessed':'80 lesson(s) assessed · 0 not assessed'));
 await result.screenshot({path:resolve(out,prefix+'-keep.png')});
 await click(result.getByRole('button',{name:'Close preview',exact:true}));
 check(prefix+' Cancel byte equality',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 const downloadPromise=page.waitForEvent('download');await click(page.locator('[data-private-export]'));const download=await downloadPromise;const json=JSON.parse(await readFile(await download.path(),'utf8'));
 check(prefix+' JSON retains entire lesson records',JSON.stringify(json.lessons)===JSON.stringify(fixture.lessons));
 check(prefix+' no preview writes',await page.evaluate(()=>window.testWrites.length===0));
 await click(page.locator('[data-private-calendar-view="week"]'));check(prefix+' Week retained',await page.locator('.saved-agenda>.saved-calendar-day').count()===7);
}
async function verifyOutlookInterface(page,width,prefix,fixture){
 await click(page.locator('.calendar-options>details>summary'));
 let original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const open=async()=>{await click(page.locator('[data-outlook-open]'));};
 const submit=async()=>{await formSubmit(page,'[data-build-schedule-form] button[type="submit"]');};
 const build=async()=>{await open();await click(page.locator('[data-outlook-use-focus]'));await submit();};
 check(prefix+' default four-week focus horizon',await page.locator('[data-outlook-weeks]').inputValue()==='4'&&(await page.locator('.outlook-window').innerText()).includes(fixture.course.first_day));
 check(prefix+' all three textual certainty tiers',await page.locator('.outlook-legend > span').count()===3);
 await open();check(prefix+' Build configuration receives keyboard focus',await page.locator('#build-config-title').evaluate(e=>e===document.activeElement));
 check(prefix+' anchor is explicit and initially blank',await page.locator('[data-build-schedule-form] [name="startDate"]').inputValue()==='');
 await click(page.locator('[data-outlook-use-focus]'));check(prefix+' Use selected date is an explicit anchor action',await page.locator('[data-build-schedule-form] [name="startDate"]').inputValue()===fixture.course.first_day);
 await submit();check(prefix+' Build result is unsaved and focused',(await page.locator('#build-schedule-title').innerText()).includes('placed; 0 need attention')&&await page.evaluate(()=>window.testPreviewResultFocus==='build-schedule-title'));
 check(prefix+' whole-course capacity is always disclosed',(await page.locator('[data-build-result]').innerText()).includes('Whole-course capacity · all active units'));
 check(prefix+' near-term forecast reaches calendar',await page.locator('.saved-day-events [data-tentative-placement]').count()>0);
 check(prefix+' no writing action in prototype',await page.locator('.planning-outlook').getByRole('button',{name:/^(Apply|Save|Confirm)$/}).count()===0);
 await click(page.locator('.outlook-milestones summary'));check(prefix+' estimated unit milestones visible',(await page.locator('.outlook-milestones').innerText()).includes('estimated — unsaved'));
 check(prefix+' saved protected assessment stays distinct',(await page.locator('.outlook-milestones').innerText()).includes('protected saved anchor'));
 await captureInspector(page,resolve(out,prefix+'-three-tier-proposal.png'));
 await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-month-overlay.png')});
 for(const weeks of [2,6,4]){
  await control(page.locator('[data-outlook-weeks]'),'selectOption',String(weeks));
  const end=addCalendarDays(fixture.course.first_day,weeks*7-1);
  check(prefix+' '+weeks+' week horizon is selected-date anchored',(await page.locator('.outlook-window').innerText()).includes(end));
  check(prefix+' no distant daily clutter at '+weeks+' weeks',await page.locator('.saved-calendar-day').evaluateAll((nodes,end)=>nodes.every(n=>!n.querySelector('[data-tentative-placement]')||n.querySelector('[data-private-calendar-day]').dataset.privateCalendarDay<=end),end));
 }
 const forecastDate=await page.locator('.saved-calendar-day').filter({has:page.locator('[data-tentative-placement]')}).first().locator('[data-private-calendar-day]').getAttribute('data-private-calendar-day');
 await click(page.locator('[data-private-calendar-day="'+forecastDate+'"]').first());
 check(prefix+' mobile/desktop day detail explicitly labels tentative unsaved work',(await page.locator('#saved-day-details').innerText()).includes('Tier 2 · Tentative — unsaved'));
 check(prefix+' selected forecast has appropriate focus',width===390?await page.locator('#saved-day-title').evaluate(e=>e===document.activeElement):await page.locator('[data-private-calendar-day="'+forecastDate+'"]').first().evaluate(e=>e===document.activeElement));
 await control(page.locator('[data-outlook-layer="tentative"]'),'uncheck',);check(prefix+' tentative layer hides reversibly',await page.locator('[data-tentative-placement]').count()===0);
 await control(page.locator('[data-outlook-layer="tentative"]'),'check',);check(prefix+' tentative layer restores',await page.locator('[data-tentative-placement]').count()>0);
 await control(page.locator('[data-outlook-layer="confirmed"]'),'uncheck',);check(prefix+' confirmed visibility does not rewrite its saved arrays',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 await control(page.locator('[data-outlook-layer="confirmed"]'),'check',);
 await control(page.locator('[data-outlook-layer="milestones"]'),'uncheck',);check(prefix+' milestone layer hides',await page.locator('.outlook-milestones').count()===0);await control(page.locator('[data-outlook-layer="milestones"]'),'check',);
 await click(page.locator('[data-private-calendar-view="week"]'));check(prefix+' Week supports same tentative layer',await page.locator('.saved-agenda [data-tentative-placement]').count()>0);
 const sharedId=await page.locator('.saved-day-events [data-tentative-placement] [data-private-lesson]').first().getAttribute('data-private-lesson');
 await click(page.locator('.saved-day-events [data-tentative-placement] [data-private-lesson]').first());check(prefix+' tentative link opens same saved lesson',await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===sharedId);
 await click(page.locator('[data-private-tab="sequence"]'));await click(page.locator('[data-private-tab="calendar"]'));check(prefix+' leaving Calendar discards forecast',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await click(page.locator('[data-private-calendar-view="month"]'));await build();
 await control(page.locator('[data-build-schedule-form] [name="startDate"]'),'fill',addCalendarDays(await page.locator('[data-build-schedule-form] [name="startDate"]').inputValue(),1));check(prefix+' configuration edit discards old result and overlays',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await click(page.locator('[data-outlook-use-focus]'));await submit();await control(page.locator('[data-build-schedule-form] [name="unitId"]'),'selectOption',fixture.units[0].id);check(prefix+' scope change invalidates whole-course forecast',await page.locator('[data-build-result]').count()===0);await submit();check(prefix+' focused unit retains whole-course capacity context',(await page.locator('[data-build-result]').innerText()).includes('Whole-course capacity · all active units'));
 const externallyChanged=JSON.parse(original);externallyChanged.units[0].revision++;original=JSON.stringify(externallyChanged);
 await page.evaluate(()=>{window.testDb.units[0].revision++;window.testAuthEvent('TOKEN_REFRESHED');});
 await page.locator('[data-build-result]').waitFor({state:'detached'});
 check(prefix+' authoritative background refresh discards stale forecast',(await page.locator('#private-workspace').innerText()).includes('Saved inputs changed'));
 await build();await click(page.locator('[data-private-reload]'));await details(page);check(prefix+' reload discards all forecast state',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-build-schedule-form]').count()===0&&(await page.locator('#private-workspace').innerText()).includes('Saved data reloaded'));
 await build();await click(page.locator('[data-private-calendar-day][aria-pressed="true"]'));await click(page.locator('[data-event-open=""]'));check(prefix+' event proposal remains separate and discards Build forecast',await page.locator('[data-event-preview-form]').count()===1&&await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await click(page.locator('[data-event-preview-form]').getByRole('button',{name:'Cancel proposal',exact:true}));await build();await click(page.locator('[data-outlook-saved-only]'));
 check(prefix+' Saved-only restores confirmed layer and closes forecasts',await page.locator('[data-outlook-layer="confirmed"]').isChecked()&&!(await page.locator('[data-outlook-layer="tentative"]').isChecked())&&!(await page.locator('[data-outlook-layer="milestones"]').isChecked())&&await page.locator('[data-build-result]').count()===0);
 await open();await page.locator('[data-private-calendar-day]').first().press('Escape');check(prefix+' Escape from calendar cancels and restores Build focus',await page.locator('[data-build-schedule-form]').count()===0&&await page.locator('[data-outlook-open]').evaluate(e=>e===document.activeElement));
 check(prefix+' desktop/mobile no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(prefix+' all new controls perform zero writes',await page.evaluate(()=>window.testWrites.length===0));
 check(prefix+' controls preserve records apart from deliberate external revision',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 const downloaded=page.waitForEvent('download');await click(page.locator('[data-private-export]'));const json=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));check(prefix+' export excludes hypothetical data',JSON.stringify(json.lessons)===JSON.stringify(fixture.lessons)&&JSON.stringify(json.calendarExceptions)===JSON.stringify(fixture.exceptions));
 // Switch to another owner-scoped fictional course without creating a real row.
 await page.evaluate(({id})=>{window.testDb.courses.push({...window.testDb.courses[0],id,name:'Another fictional preview course'});window.testAuthEvent('TOKEN_REFRESHED');},{id:previewId(888)});
 await page.locator('#saved-courses [data-private-open="'+previewId(888)+'"]').waitFor({state:'attached'});await click(page.locator('#saved-courses [data-private-open="'+previewId(888)+'"]'));await click(page.locator('[data-private-tab="calendar"]'));
 check(prefix+' course switch has no old proposal or layer preferences',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-outlook-weeks]').inputValue()==='4'&&await page.locator('[data-outlook-layer="tentative"]').isChecked());
}
async function verifySampleInterface(page,width,prefix,fixture){
 const original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const ownerHeader=await page.locator('.private-header').innerText();
 await control(page.locator('[data-outlook-weeks]'),'selectOption','6');
 const reads=await page.evaluate(()=>window.testReads.length);
 const enter=async()=>click(page.locator('[data-build-sample-open]'));
 const submit=async()=>formSubmit(page,'[data-build-schedule-form] button[type="submit"]');
 const build=async()=>{if(!await page.locator('[data-build-schedule-form]').count())await click(page.locator('[data-outlook-open]'));await click(page.locator('[data-outlook-use-focus]'));await submit();};
 await enter();
 check(prefix+' sample heading focused and provenance unmistakable',await page.locator('#build-config-title').evaluate(e=>e===document.activeElement)&&(await page.locator('.sample-context').innerText()).includes('NOT your saved course'));
 check(prefix+' independent sample totals',(await page.locator('.private-header').innerText()).includes('3 unit(s) · 12 lesson(s) · 3 calendar exception(s)'));
 check(prefix+' sample reset and return are touch-sized',await page.locator('[data-build-sample-reset],[data-build-sample-return]').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));
 check(prefix+' no authoring, export, event proposal or reload controls',await page.locator('#private-workspace [data-private-save],#private-workspace [data-private-create],#private-workspace [data-private-export],#private-workspace [data-event-open],#private-workspace [data-private-reload],#private-workspace [data-private-tab]').count()===0);
 check(prefix+' sample cannot replace active owner identity',await page.evaluate(async id=>(await import('./private-workspace.js')).activePrivateCourseId()===id,fixture.course.id));
 check(prefix+' anchor blank despite known sample date',await page.locator('[name="startDate"]').inputValue()==='');
 check(prefix+' sample preferences start independently',await page.locator('[data-outlook-weeks]').inputValue()==='4');
 await build();
 check(prefix+' successful real Build result',(await page.locator('#build-schedule-title').innerText()).includes('placed; 0 need attention'));
 check(prefix+' four confirmed eight tentative zero unresolved',(await page.locator('[data-build-result]').innerText()).includes('4 confirmed saved lesson(s) · 8 tentative lesson(s)')&&(await page.locator('[data-build-result]').innerText()).includes('0 not assessed · 0 unplaceable'));
 check(prefix+' all twelve comparisons present',await page.locator('[data-build-row]').count()===12);
 check(prefix+' seven near-term tentative day entries',await page.locator('.saved-month .saved-day-events [data-tentative-placement]').count()===7);await click(page.locator('.outlook-comparisons summary'));check(prefix+' complete multi-day proposal visible',(await page.locator('[data-build-row="sample-lesson-3"]').innerText()).includes('2026-09-03, 2026-09-04'));await click(page.locator('.outlook-comparisons summary'));
 check(prefix+' closure and occupied date excluded',await page.locator('[data-private-calendar-day="2026-09-07"]').getAttribute('aria-label').then(t=>!t.includes('Tentative'))&&await page.locator('[data-private-calendar-day="2026-09-15"]').getAttribute('aria-label').then(t=>!t.includes('Tentative')));
 await click(page.locator('.outlook-milestones summary'));
 const milestones=await page.locator('.outlook-milestones').innerText();
 check(prefix+' three estimated unit ranges',await page.locator('[data-milestone-unit]').evaluateAll(nodes=>nodes.length===3&&nodes.every(n=>n.textContent.includes('estimated — unsaved'))));
 check(prefix+' distant October milestone without September daily clutter',milestones.includes('2026-10-19 → 2026-10-23')&&!await page.locator('.saved-month [data-tentative-placement="sample-lesson-10"]').count());
 check(prefix+' distinct protected and estimated assessment anchors',milestones.includes('protected saved anchor')&&milestones.includes('2026-10-23'));
 await page.locator('.private-header').screenshot({path:resolve(out,prefix+'-sample-provenance.png')});
 await captureInspector(page,resolve(out,prefix+'-success-outlook.png'));
 await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-success-month.png')});
 for(const weeks of [2,6,4]){await control(page.locator('[data-outlook-weeks]'),'selectOption',String(weeks));check(prefix+' sample '+weeks+' week lens',(await page.locator('.outlook-window').innerText()).includes(addCalendarDays('2026-09-01',weeks*7-1)));}
 await click(page.locator('[data-private-calendar-day="2026-09-03"]'));
 check(prefix+' tentative lesson in mobile/desktop detail',(await page.locator('#saved-day-details').innerText()).includes('Tier 2 · Tentative — unsaved')&&(await page.locator('#saved-day-details').innerText()).includes('Sample lesson 3'));

 await click(page.locator('#saved-day-details [data-private-lesson="sample-lesson-3"]'));
 check(prefix+' same fixture lesson read-only reference',(await page.locator('.build-sample-lesson').innerText()).includes('sample-lesson-3')&&await page.locator('[data-private-save]').count()===0);
 check(prefix+' opening reference keeps forecast',await page.locator('[data-tentative-placement]').count()>0);
 await click(page.locator('[data-build-sample-close-lesson]'));
 await control(page.locator('[data-outlook-layer="tentative"]'),'uncheck',);check(prefix+' sample tentative layer hides',await page.locator('[data-tentative-placement]').count()===0);await control(page.locator('[data-outlook-layer="tentative"]'),'check',);
 await click(page.locator('[data-private-calendar-view="week"]'));check(prefix+' Week reuses sample tentative projection',await page.locator('.saved-agenda [data-tentative-placement]').count()>0);
 await click(page.locator('[data-private-calendar-view="month"]'));await click(page.locator('[data-private-calendar-period="1"]'));await click(page.locator('[data-private-calendar-day="2026-10-19"]'));
 check(prefix+' focus reveals four October tentative dates',await page.locator('.saved-month .saved-day-events [data-tentative-placement]').count()===4);
 await click(page.locator('[data-outlook-inspect]'));check(prefix+' display focus never rewrites explicit scheduling anchor',await page.locator('[name="startDate"]').inputValue()==='2026-09-01');
 await click(page.locator('[data-build-sample-reset]'));check(prefix+' Reset clears proposals and returns sample start',await page.locator('[data-build-result]').count()===0&&await page.locator('[name="startDate"]').inputValue()===''&&(await page.locator('.outlook-window').innerText()).includes('2026-09-01'));
 await build();await click(page.locator('[data-outlook-saved-only]'));check(prefix+' saved-only cancels sample projections',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await click(page.locator('[data-build-sample-reset]'));await build();
 await control(page.locator('[data-build-schedule-form] [name="unitId"]'),'selectOption','sample-unit-1');check(prefix+' scope edit invalidates sample forecast',await page.locator('[data-build-result]').count()===0);await submit();check(prefix+' scoped sample respects whole-course unresolved dependency',(await page.locator('[data-build-result]').innerText()).includes('Whole-course capacity · all active units')&&(await page.locator('[data-build-result]').innerText()).includes('not assessed'));
 await click(page.locator('[data-build-sample-reset]'));await build();
 // A stale authoring form cannot bypass the sample guard; local test DOM only.
 await page.evaluate(id=>{const f=document.createElement('form');f.dataset.privateSave='lessons';f.dataset.id=id;document.getElementById('private-workspace').append(f);f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.remove();},fixture.lessons[0].id);
 check(prefix+' stale ordinary submit explicitly blocked',(await page.locator('#private-status').innerText()).includes('read-only. Nothing was saved'));
 await click(page.locator('[data-build-sample-return]'));
 check(prefix+' one-click return restores owner header and preferences',await page.locator('.private-header').innerText()===ownerHeader&&await page.locator('[data-outlook-weeks]').inputValue()==='6');
 check(prefix+' return restores owner entry focus and no sample state',await page.locator('[data-build-sample-open]').evaluate(e=>e===document.activeElement)&&await page.locator('[data-build-result],.build-sample-notice,[data-private-lesson^="sample-"]').count()===0);
 check(prefix+' sample exploration performs zero reads or writes',await page.evaluate(reads=>window.testReads.length===reads&&window.testWrites.length===0,reads));
 check(prefix+' byte-identical saved records after sample',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 await enter();await page.locator('[data-private-calendar-day="2026-09-01"]').press('Escape');check(prefix+' first Escape cancels config but retains sample',await page.locator('.sample-context').count()===1&&await page.locator('[data-build-schedule-form]').count()===0);
 await page.locator('[data-outlook-open]').press('Escape');check(prefix+' second Escape returns to saved course',await page.locator('[data-build-sample-open]').count()===1);
 await enter();await click(page.locator('[data-outlook-close]').first());check(prefix+' Cancel does not exit sample',await page.locator('.sample-context').count()===1&&await page.locator('[data-build-schedule-form]').count()===0);
 await click(page.locator('[data-build-sample-return]'));
 const downloadPromise=page.waitForEvent('download');await click(page.locator('[data-private-export]'));const json=JSON.parse(await readFile(await (await downloadPromise).path(),'utf8'));check(prefix+' owner export contains no fixture data',JSON.stringify(json.lessons)===JSON.stringify(fixture.lessons)&&JSON.stringify(json.course)===JSON.stringify(fixture.course));
 await enter();await build();await page.evaluate(()=>window.testAuthEvent('TOKEN_REFRESHED'));await page.locator('.sample-context').waitFor({state:'detached'});
 check(prefix+' authoritative owner reload safely exits sample',await page.locator('.private-header').innerText()===ownerHeader&&await page.locator('[data-build-result]').count()===0);
 check(prefix+' sample never fetched from database',await page.evaluate(()=>window.testReads.every(r=>r.filters.every(([,v])=>!String(v).startsWith('sample-')))&&window.testWrites.length===0));
 check(prefix+' mobile/desktop overflow-free',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(prefix+' owner records unchanged including after reload',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
}
async function verifyUXStructure(page,width,prefix,fixture){
 const before=await page.evaluate(()=>JSON.stringify(window.testDb));
 check(prefix+' native page scroll anchoring disabled',await page.evaluate(()=>getComputedStyle(document.body).overflowAnchor==='none'));
 check(prefix+' eight persistent course destinations',await page.locator('#workspace-navigation [data-private-tab]').count()===8);
 check(prefix+' calendar quiet primary workspace',await page.locator('.private-primary [aria-label="Read-only schedule diagnostics"],[data-build-result]').count()===0);
 check(prefix+' contextual desktop pane or dismissed mobile sheet',width===390?!(await page.locator('.private-inspector').isVisible()):await page.locator('.private-inspector').isVisible());
 if(await page.locator('.private-primary').evaluate(e=>e.inert))await page.locator('[data-inspector-close]').click();await page.locator('#sidebar-collapse').click();check(prefix+' sidebar collapses with accessible destinations',await page.locator('body').evaluate((e,width)=>e.classList.contains(width===390?'mobile-nav-open':'sidebar-collapsed'),width)&&await page.getByRole('button',{name:'Calendar',exact:true}).count()===1);await page.locator('#sidebar-collapse').click();
 await page.locator('[data-workspace-settings]').click();check(prefix+' settings dialog opens',await page.locator('#workspace-settings').evaluate(e=>e.open));
 await page.locator('[data-appearance-theme]').selectOption('light');await page.locator('[data-appearance-accent]').selectOption('blue');check(prefix+' local light and accent selection',await page.locator('body').evaluate(e=>e.dataset.theme==='light'&&e.dataset.accent==='blue'));
 await page.screenshot({path:resolve(out,prefix+'-light-settings.png')});await page.locator('[data-appearance-theme]').selectOption('dark');await page.locator('[data-settings-close]').click();
 check(prefix+' canonical account forms still present exactly once',await page.locator('#auth-form').count()===1&&await page.locator('#restore-form').count()===1&&await page.locator('#backup-all').count()===1);
 await page.locator('[data-private-calendar-day="2026-09-03"]').click();
 check(prefix+' date opens inspector without replacing calendar',await page.locator('.private-inspector').isVisible()&&await page.locator('.saved-month').count()===1);
 if(width===390){check(prefix+' mobile detail is accessible modal',await page.locator('.private-inspector').getAttribute('aria-modal')==='true');await page.locator('[data-inspector-close]').click();check(prefix+' mobile dismiss returns original date focus',await page.locator('[data-private-calendar-day="2026-09-03"]').evaluate(e=>e===document.activeElement));}
 else{await page.locator('.inspector-size summary').click();await page.locator('[data-inspector-width]').fill('440');await page.locator('[data-inspector-width]').dispatchEvent('change');check(prefix+' inspector width adjustable',await page.locator('.private-frame').evaluate(e=>e.style.getPropertyValue('--inspector-width')==='440px'));await page.locator('[data-inspector-close]').click();}
 await page.locator('[data-build-sample-open]').click();
 check(prefix+' sample remains clearly separate',(await page.locator('.sample-context').innerText()).includes('NOT your saved course'));
 check(prefix+' focused Build panel in inspector',await page.locator('#build-config-title').evaluate(e=>e===document.activeElement)&&await page.locator('.private-primary [data-build-schedule-form]').count()===0);
 // Dismiss config, retain it locally, and record the unchanged central grid.
 await page.locator('[data-inspector-close]').click();
 await page.evaluate(()=>{window.uxGrid=document.querySelector('.saved-month');window.uxDate=document.querySelector('[data-private-calendar-day="2026-09-03"]');window.uxMain=document.querySelector('.private-primary');window.uxMain.scrollTop=140;window.uxScroll=window.uxMain.scrollTop;window.uxWindowScroll=scrollY;});
 await page.locator('[data-outlook-open]').click();await page.evaluate(()=>{window.uxGridTop=document.querySelector('.saved-month').getBoundingClientRect().top;});await page.locator('[data-outlook-use-focus]').click();await page.locator('[data-build-schedule-form] button[type="submit"]').click();
 check(prefix+' preview retains calendar vertical position',await page.evaluate(()=>Math.abs(document.querySelector('.saved-month').getBoundingClientRect().top-window.uxGridTop)<2));
 check(prefix+' ordinary-language positive outcome',(await page.locator('#build-schedule-title').innerText()).includes('8 lessons placed; 0 need attention'));
 check(prefix+' More details collapsed by default',await page.locator('.outlook-more').evaluate(e=>!e.open));
 check(prefix+' preview retains actual grid and date nodes',await page.evaluate(()=>window.uxGrid===document.querySelector('.saved-month')&&window.uxDate===document.querySelector('[data-private-calendar-day="2026-09-03"]')));
 check(prefix+' preview retains central and document scroll',await page.evaluate(()=>Math.abs(window.uxMain.scrollTop-window.uxScroll)<2&&scrollY===window.uxWindowScroll));
 check(prefix+' Build does not change selected date',await page.locator('[data-private-calendar-day="2026-09-01"]').getAttribute('aria-pressed')==='true');
 await page.locator('.outlook-more>summary').click();check(prefix+' detailed capacity and all comparisons available',(await page.locator('.outlook-more').innerText()).includes('11 hypothetical day assignments')&&await page.locator('[data-build-row]').count()===12);
 await page.screenshot({path:resolve(out,prefix+'-build-inspector.png')});
 await page.locator('[data-inspector-close]').click();check(prefix+' hiding inspector retains overlay',await page.locator('.saved-month [data-tentative-placement]').count()===7);
 await page.locator('.outlook-milestones>summary').click();check(prefix+' distant estimated milestone available',(await page.locator('.outlook-milestones').innerText()).includes('2026-10-19 → 2026-10-23'));
 await page.locator('[data-private-calendar-day="2026-09-03"]').click();check(prefix+' same grid survives selecting tentative day',await page.evaluate(()=>window.uxGrid===document.querySelector('.saved-month')));
 await page.locator('#saved-day-details [data-private-lesson="sample-lesson-3"]').click();check(prefix+' same-ID read-only lesson inspector',(await page.locator('.build-sample-lesson').innerText()).includes('sample-lesson-3')&&await page.locator('[data-private-save]').count()===0);
 await page.locator('[data-inspector-close]').click();await page.locator('[data-private-calendar-period="1"]').click();await page.locator('[data-private-calendar-day="2026-10-19"]').click();await page.locator('[data-inspector-close]').click();check(prefix+' explicit October focus shows distant daily proposals',await page.locator('.saved-month [data-tentative-placement]').count()===4);
 await page.locator('[data-outlook-open]').click();await page.locator('[data-outlook-close]').last().click();check(prefix+' closing preview restores prior September selection',(await page.locator('.saved-calendar-toolbar h3').innerText()).includes('September')&&await page.locator('[data-private-calendar-day="2026-09-01"]').getAttribute('aria-pressed')==='true'&&await page.locator('[data-tentative-placement]').count()===0);
 await page.locator('[data-build-sample-return]').click();
 await page.locator('[data-outlook-open]').click();await page.locator('[data-outlook-use-focus]').click();await page.locator('[data-build-schedule-form] button[type="submit"]').click();check(prefix+' complete saved baseline requires no new placements',(await page.locator('#build-schedule-title').innerText()).includes('No new placements needed'));await page.locator('[data-inspector-close]').click();
 await page.locator('[data-private-calendar-day="2026-09-03"]').click();const shared=fixture.lessons.find(l=>l.scheduled_dates.includes('2026-09-03'));
 await page.locator('#saved-day-details [data-private-lesson="'+shared.id+'"]').click();check(prefix+' real lesson editor keeps active calendar',await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===shared.id&&await page.locator('.saved-month').count()===1&&await page.locator('[data-private-tab="calendar"]').getAttribute('aria-pressed')==='true');
 await page.locator('[name="objective"]').fill('Fictional unsaved UX draft');
 if(width===1440){await page.locator('.calendar-options>details>summary').click();await page.locator('[data-outlook-weeks]').selectOption('6');check(prefix+' display lens preserves dirty lesson input',await page.locator('[name="objective"]').inputValue()==='Fictional unsaved UX draft');}
 await page.evaluate(()=>window.testAuthEvent('TOKEN_REFRESHED'));await page.waitForFunction(()=>document.getElementById('storage-status').textContent.startsWith('1 saved course'));
 check(prefix+' auth refresh preserves inspector authoring draft',await page.locator('[name="objective"]').inputValue()==='Fictional unsaved UX draft');
 page.once('dialog',d=>d.dismiss());await page.locator('[name="objective"]').press('Escape');check(prefix+' Escape honors unsaved-edit protection',await page.locator('[name="objective"]').inputValue()==='Fictional unsaved UX draft'&&await page.locator('[data-outlook-inspect]').count()===1);
 page.once('dialog',d=>d.accept());await page.locator('[name="objective"]').press('Escape');
 await page.locator('[data-private-tab="units"]').click();check(prefix+' unit workspace remains available',await page.locator('.workspace-unit-list>button').count()===5);await page.locator('[data-private-unit]').first().click();check(prefix+' unit editor is contextual',await page.locator('.private-inspector [data-private-save="units"]').count()===1&&await page.locator('.workspace-unit-list').count()===1);await page.locator('[data-inspector-close]').click();
 await page.locator('[data-private-tab="lessons"]').click();check(prefix+' lesson workspace retains canonical list',await page.locator('.private-table tbody tr').count()===80);await page.locator('[data-private-tab="sequence"]').click();check(prefix+' sequence workspace remains available',await page.locator('.private-header h1').innerText()==='Course Sequence');
 await page.locator('[data-private-tab="calendar"]').click();await page.screenshot({path:resolve(out,prefix+'-quiet-calendar.png')});check(prefix+' no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(prefix+' all UX actions zero writes and unchanged owner records',await page.evaluate(before=>window.testWrites.length===0&&JSON.stringify(window.testDb)===before,before));
 await page.locator('.legacy-demonstration>summary').click();check(prefix+' illustrative demo remains accessible separately',await page.locator('#application .cp-lesson-row').count()===10);await page.locator('#application [data-workspace="calendar"]').click();check(prefix+' illustrative calendar still works',await page.locator('#workspace-label').innerText()==='Calendar');await page.locator('.legacy-demonstration>summary').click();

 await page.locator('[data-workspace-settings]').click();await page.evaluate(()=>{window.testClient.auth.getSession=async()=>({data:{session:null}});});await page.locator('#auth-signout').click();await page.locator('#account-home #auth-form').waitFor({state:'visible'});
 check(prefix+' sign-out returns to login without a trapped settings modal',await page.locator('#private-workspace').evaluate(e=>e.hidden)&&await page.locator('#workspace-settings').evaluate(e=>!e.open));
 check(prefix+' sign-out clears navigation and sample state',await page.locator('#workspace-navigation [data-private-tab]:not(:disabled)').count()===0&&await page.locator('.sample-context').count()===0);

}
async function verifyHomeNavigation(page,width,fixture){
 const prefix='home-'+(fixture.empty?'empty-':'')+width;
 await page.locator('#private-home').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.getElementById('storage-status').textContent.includes('Loading'));
 const before=await page.evaluate(()=>JSON.stringify(window.testDb));
 check(prefix+' signed-in startup shows global Home',await page.locator('#private-home').isVisible()&&!await page.locator('#private-workspace').isVisible());
 check(prefix+' Dashboard selected on Home',await page.locator('[data-global-home]').getAttribute('aria-current')==='page');
 check(prefix+' Home course names readable',fixture.empty||await page.locator('#home-courses .course-label').first().isVisible());
 check(prefix+' immediate Dashboard divider',await page.locator('[data-global-home]').evaluate(e=>e.nextElementSibling.tagName==='HR'));
 check(prefix+' correct course destination order',(await page.locator('#workspace-navigation [data-private-tab]').evaluateAll(ns=>ns.map(n=>n.dataset.privateTab).join(',')))==='overview,sequence,units,lessons,calendar,resources,templates,archive');
 if(fixture.empty){
  check(prefix+' empty account offers create without broken resume',!await page.locator('[data-resume-workspace]').isVisible()&&(await page.locator('#home-courses').innerText()).includes('No courses'));
  await page.screenshot({path:resolve(out,prefix+'-home.png')});
  await page.locator('.courses-heading [data-create-course]').click();
  check(prefix+' plus focuses existing secure create form',await page.locator('#course-name').evaluate(e=>e===document.activeElement)&&await page.evaluate(()=>window.testWrites.length===0));
  await page.locator('#course-name').fill('Fictional new course');await page.locator('#course-form button').click();await page.locator('.private-header h2').filter({hasText:'Fictional new course'}).waitFor();
  check(prefix+' creation uses owner-scoped existing flow',await page.evaluate(()=>window.testWrites.length===1&&window.testDb.courses[0].owner_id===window.testOwner));
  await page.locator('[data-global-home]').click();check(prefix+' first course now resumable',await page.locator('[data-resume-workspace]').isVisible());return;
 }
 await page.locator('[data-resume-workspace]').click();await page.locator('[data-private-tab="calendar"]').click();
 if(await page.locator('.private-primary').evaluate(e=>e.inert))await page.locator('[data-inspector-close]').click();
 await page.evaluate(()=>{window.homeGrid=document.querySelector('.saved-month');document.querySelector('.private-primary').scrollTop=120;window.homeScroll=document.querySelector('.private-primary').scrollTop;});
 await page.locator('[data-global-home]').click();await page.screenshot({path:resolve(out,prefix+'-home.png')});
 await page.locator('[data-resume-workspace]').click();check(prefix+' Resume preserves calendar nodes and scroll',await page.evaluate(()=>window.homeGrid===document.querySelector('.saved-month')&&document.querySelector('.private-primary').scrollTop===window.homeScroll));
 await page.locator('[data-private-tab="overview"]').click();check(prefix+' derived Overview is distinct from Sequence',await page.locator('.private-header h1').innerText()==='Course Overview'&&await page.locator('.overview-counts dd').first().innerText()==='5'&&await page.locator('.private-table').count()===0);await page.screenshot({path:resolve(out,prefix+'-overview.png')});
 for(const key of ['resources','templates','archive']){await page.locator('#workspace-navigation [data-private-tab="'+key+'"]').click();check(prefix+' '+key+' honest placeholder',(await page.locator('.workspace-placeholder').innerText()).includes('Under development'));}
 await page.locator('[data-private-tab="lessons"]').click();await page.locator('[data-private-lesson]').first().click();await page.locator('[name="objective"]').fill('Unsaved Home navigation draft');
 await page.evaluate(()=>{window.homeEditor=document.querySelector('[name="objective"]');});
 // Home is always callable programmatically; mobile modal requires explicit close
 // and its existing dirty confirmation before sidebar navigation becomes available.
 if(width===390){page.once('dialog',d=>d.dismiss());await page.locator('[name="objective"]').press('Escape');check(prefix+' mobile modal retains dirty guard',await page.locator('[name="objective"]').inputValue()==='Unsaved Home navigation draft');}
 await page.locator(width===390?'[data-private-home]':'[data-global-home]').click();
 check(prefix+' Home releases hidden inspector modality',await page.locator('.teacher-sidebar').evaluate(e=>!e.inert));
 await page.evaluate(()=>window.testAuthEvent('TOKEN_REFRESHED'));await page.waitForFunction(()=>document.getElementById('storage-status').textContent.startsWith('1 saved course'));
 await page.locator('[data-resume-workspace]').click();check(prefix+' Home and auth refresh preserve exact dirty input',await page.evaluate(()=>document.querySelector('[name="objective"]')===window.homeEditor&&window.homeEditor.value==='Unsaved Home navigation draft'));
 await page.evaluate(()=>document.querySelector('[data-global-home]').click());
 const second='10000000-0000-4000-8000-000000000091';
 await page.evaluate(({second})=>{window.testDb.courses.push({...window.testDb.courses[0],id:second,name:'Fictional second course'});window.testAuthEvent('TOKEN_REFRESHED');},{second});
 await page.waitForFunction(()=>document.querySelectorAll('#saved-courses [data-private-open]').length===2);
 await page.locator('#home-courses [data-private-open="'+second+'"]').click();await page.locator('.private-header h2').filter({hasText:'Fictional second course'}).waitFor();
 check(prefix+' course switch preserves background dirty guard',await page.evaluate(async()=> (await import('./private-workspace.js')).isPrivateWorkspaceDirty()));
 await page.locator('[data-private-tab="overview"]').click();await page.locator('[data-global-home]').click();
 await page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]').click();
 check(prefix+' course restores actual dirty editor node',await page.evaluate(()=>document.querySelector('[name="objective"]')===window.homeEditor&&window.homeEditor.value==='Unsaved Home navigation draft'));
 await page.evaluate(()=>document.querySelector('[data-global-home]').click());
 await page.locator('#home-courses [data-private-open="'+second+'"]').click();check(prefix+' second course restores independent Overview',await page.locator('.private-header h1').innerText()==='Course Overview');
 await page.locator('[data-global-home]').click();await page.locator('#saved-courses [data-course-icon="'+second+'"]').click();await page.getByRole('button',{name:'Choose icon 4',exact:true}).click();
 check(prefix+' icon changes independently in both course lists',await page.locator('#home-courses [data-private-open="'+second+'"] .course-icon').innerText()==='✦');
 check(prefix+' all navigation and icons avoid record mutation',await page.evaluate(before=>{const original=JSON.parse(before);const current=structuredClone(window.testDb);current.courses=current.courses.slice(0,1);return JSON.stringify(current)===JSON.stringify(original)&&window.testWrites.length===0;},before));
 // Failed saves and unauthorized target loads must keep the current draft.
 await page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]').click();
 const denied=await page.evaluate(async()=> (await import('./private-workspace.js')).openPrivateCourse(window.testClient,{id:window.testOwner},'30000000-0000-4000-8000-000000000001',{preserveContext:true}));
 check(prefix+' denied target retains current draft and course',!denied&&await page.locator('[name="objective"]').inputValue()==='Unsaved Home navigation draft');
 await page.evaluate(()=>{window.testHoldWrites=true;window.rejectWrites=true;});
 await page.locator('[data-private-save="lessons"] button[type="submit"]').click();
 await page.waitForFunction(()=>!!window.testReleaseWrite);
 await page.locator('[data-private-home]').click();await page.locator('#home-courses [data-private-open="'+second+'"]').click();
 check(prefix+' pending save blocks course switch',await page.evaluate(async()=> (await import('./private-workspace.js')).activePrivateCourseId())===fixture.course.id);
 await page.evaluate(()=>{window.testHoldWrites=false;window.testReleaseWrite();});
 await page.waitForFunction(()=>document.getElementById('private-status').textContent.includes('Save failed'));
 await page.locator('[data-resume-workspace]').click();check(prefix+' failed save keeps exact draft',await page.locator('[name="objective"]').inputValue()==='Unsaved Home navigation draft');
 await page.evaluate(()=>{window.rejectWrites=false;});await page.locator('[data-private-home]').click();
 const toggle=page.locator('#sidebar-collapse'),box=await toggle.boundingBox();await toggle.click();const collapsed=await toggle.boundingBox();check(prefix+' toggle keeps exact position',Math.abs(box.x-collapsed.x)<1&&Math.abs(box.y-collapsed.y)<1);await toggle.click();
 await toggle.focus();await page.keyboard.press('Enter');check(prefix+' keyboard toggle works',await toggle.getAttribute('aria-expanded')===(width===390?'true':'false'));await page.keyboard.press('Enter');
 check(prefix+' collapsed course icon remains visible',await page.locator('#saved-courses .course-icon').first().isVisible());
 check(prefix+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:width===390?1440:390,height:1000});await page.setViewportSize({width,height:1000});await page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]').click();
 check(prefix+' responsive changes retain draft',await page.locator('[name="objective"]').inputValue()==='Unsaved Home navigation draft');
 await page.evaluate(()=>document.querySelector('[data-global-home]').click());
 await page.locator('[data-workspace-settings]').click();page.once('dialog',d=>d.dismiss());await page.locator('#auth-signout').click();check(prefix+' sign-out guards background drafts',await page.locator('#workspace-settings').evaluate(e=>e.open));
 await page.evaluate(()=>{window.testSignedOut=true;});page.once('dialog',d=>d.accept());await page.locator('#auth-signout').click();await page.locator('#auth-form').waitFor({state:'visible'});
 check(prefix+' sign-out clears course and draft contexts',await page.evaluate(async()=>!(await import('./private-workspace.js')).isPrivateWorkspaceDirty())&&await page.locator('#saved-courses button').count()===0);
 await page.evaluate(()=>{window.testSignedOut=false;window.testOwner='20000000-0000-4000-8000-000000000001';window.testAuthEvent('SIGNED_IN');});await page.locator('#private-home').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('storage-status').textContent.startsWith('No saved courses'));
 check(prefix+' different account has no previous courses or resume',await page.locator('#home-courses [data-private-open]').count()===0&&!await page.locator('[data-resume-workspace]').isVisible());
 await page.evaluate(owner=>{window.testOwner=owner;window.testAuthEvent('SIGNED_IN');},fixture.course.owner_id);await page.waitForFunction(()=>document.querySelectorAll('#home-courses [data-private-open]').length===2);
 check(prefix+' reauthentication returns to Home with reset session icon',await page.locator('#private-home').isVisible()&&await page.locator('#home-courses [data-private-open="'+second+'"] .course-icon').innerText()==='▤');
}
async function verifyCourseCards(page,width,fixture){
 const prefix='cards-'+width;
 await page.locator('#private-home').waitFor({state:'visible'});
 const first=page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]');
 await first.locator('.course-facts').filter({hasText:'4 active units · 60 active lessons'}).waitFor();
 const before=await page.evaluate(()=>JSON.stringify(window.testDb));
 check(prefix+' course summary is independently archive-filtered',await first.locator('.course-facts').innerText()==='4 active units · 60 active lessons');
 check(prefix+' no course-wide last-edited claim from missing or course-only timestamps',await page.locator('#home-courses time').count()===0&&!/last edited/i.test(await page.locator('#home-courses').innerText()));
 check(prefix+' single card bounded on wide and narrow displays',(await first.boundingBox()).width<=301);
 await page.screenshot({path:resolve(out,prefix+'-one-course.png')});
 const second='40000000-0000-4000-8000-000000000001',third='40000000-0000-4000-8000-000000000002';
 await page.evaluate(({second,third})=>{
  window.testDb.courses.push({...window.testDb.courses[0],id:second,name:'Fictional Environmental Science: Field Investigations, Community Research and Sustainable Futures',updated_at:'2026-10-27T14:30:00Z'},{...window.testDb.courses[0],id:third,name:'Fictional course — ready to plan',updated_at:null});
  const unit='40000000-0000-4000-8000-000000000011';
  window.testDb.units.push({id:unit,course_id:second,title:'Fieldwork',position:1,revision:1});
  window.testDb.lessons.push(...[1,2,3].map(i=>({id:'40000000-0000-4000-8000-00000000002'+i,course_id:second,unit_id:unit,title:'Field lesson '+i,position:i,revision:1})));
  window.testAuthEvent('TOKEN_REFRESHED');
 },{second,third});
 const secondCard=page.locator('#home-courses [data-private-open="'+second+'"]'),emptyCard=page.locator('#home-courses [data-private-open="'+third+'"]');
 await secondCard.locator('.course-facts').filter({hasText:'1 active unit · 3 active lessons'}).waitFor();
 await emptyCard.locator('.course-facts').filter({hasText:'0 active units · 0 active lessons'}).waitFor();
 check(prefix+' differing course summaries never reuse selected records',await first.locator('.course-facts').innerText()==='4 active units · 60 active lessons'&&await secondCard.locator('.course-facts').innerText()==='1 active unit · 3 active lessons');
 check(prefix+' long card name remains visible and wraps',await secondCard.locator('.course-label').evaluate(e=>e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1));
 check(prefix+' cards adapt without horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const a=await first.boundingBox(),b=await secondCard.boundingBox();check(prefix+' responsive card grid',width===390?b.y>a.y:Math.abs(a.y-b.y)<2);
 await page.screenshot({path:resolve(out,prefix+'-multiple-courses.png')});
 if(width===390){await page.setViewportSize({width:320,height:760});check(prefix+' 320px cards stay readable without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await secondCard.locator('.course-label').isVisible());await page.screenshot({path:resolve(out,prefix+'-320px-courses.png')});await page.setViewportSize({width,height:1000});}
 await secondCard.press('Enter');await page.locator('.private-header h2').filter({hasText:'Fictional Environmental Science'}).waitFor();
 check(prefix+' whole card is keyboard course entry',await secondCard.getAttribute('aria-current')==='true');
 await page.locator('[data-global-home]').click();await first.click();await page.locator('#workspace-navigation [data-private-tab="overview"]').click();
 check(prefix+' Overview header uses same active counts',(await page.locator('.workspace-counts').innerText()).startsWith('4 unit(s) · 60 lesson(s)'));
 check(prefix+' Overview active totals',JSON.stringify(await page.locator('.overview-counts dd').allTextContents())===JSON.stringify(['4','60','0','60']));
 check(prefix+' Overview units exclude archived unit and its children',await page.locator('.course-overview [data-private-unit]').count()===4&&!((await page.locator('.course-overview').innerText()).includes('Fictional Unit 5')));
 check(prefix+' Overview per-unit counts exclude archived lessons',(await page.locator('.course-overview .workspace-unit-list small').allTextContents())[0].startsWith('13 lessons'));
 await page.screenshot({path:resolve(out,prefix+'-archived-overview.png')});
 await page.locator('[data-private-tab="units"]').click();check(prefix+' other planning view retains its existing unfiltered records',await page.locator('.workspace-unit-list [data-private-unit]').count()===5);
 await page.locator('[data-private-unit]').first().click();await page.locator('[name="essential_questions"]').fill('Unsaved unit question during course summary refresh');
 await page.locator('[data-private-home]').click();await page.evaluate(()=>window.testAuthEvent('TOKEN_REFRESHED'));await first.locator('.course-facts').filter({hasText:'4 active units · 60 active lessons'}).waitFor();
 await secondCard.click();await page.locator('[data-global-home]').click();await first.click();
 check(prefix+' summary refresh and course switching preserve unsaved unit draft',await page.locator('[name="essential_questions"]').inputValue()==='Unsaved unit question during course summary refresh');
 check(prefix+' saved records unchanged by summaries/navigation',await page.evaluate(before=>{const current=structuredClone(window.testDb),original=JSON.parse(before);current.courses=current.courses.slice(0,1);current.units=current.units.filter(x=>x.course_id===original.courses[0].id);current.lessons=current.lessons.filter(x=>x.course_id===original.courses[0].id);return JSON.stringify(current)===JSON.stringify(original)&&window.testWrites.length===0;},before));
 await page.locator('[data-private-home]').click();
 await page.evaluate(id=>{window.testSummaryFailure=id;window.testAuthEvent('TOKEN_REFRESHED');},third);
 await emptyCard.locator('.course-facts').filter({hasText:'Summary unavailable'}).waitFor();
 check(prefix+' read failure never invents zero counts',await emptyCard.locator('.course-facts').innerText()==='Summary unavailable');
 await emptyCard.click();await page.locator('.private-header h2').filter({hasText:'Fictional course — ready to plan'}).waitFor();
 check(prefix+' unavailable summary card stays a working course entry',await emptyCard.getAttribute('aria-current')==='true');
 await page.locator('[data-global-home]').click();await first.click();check(prefix+' failed summary read preserves other course draft',await page.locator('[name="essential_questions"]').inputValue()==='Unsaved unit question during course summary refresh');
 await page.locator('[data-private-home]').click();await page.evaluate(()=>{window.testSummaryFailure=null;});
 await page.evaluate(id=>{
  const unit='40000000-0000-4000-8000-000000000099';window.testDb.units.push({id:unit,course_id:id,title:'Large course unit',position:1,revision:1});
  window.testDb.lessons.push(...Array.from({length:1201},(_,i)=>({id:'large-course-lesson-'+i,course_id:id,unit_id:unit,title:'Fictional large course lesson '+i,position:i+1,revision:1})));window.testAuthEvent('TOKEN_REFRESHED');
 },third);
 await emptyCard.locator('.course-facts').filter({hasText:'1 active unit · 1201 active lessons'}).waitFor();await emptyCard.click();
 await page.locator('.private-header h2').filter({hasText:'Fictional course — ready to plan'}).waitFor();
 await page.locator('[data-global-home]').click();await emptyCard.locator('.course-facts').filter({hasText:'1 active unit · 1201 active lessons'}).waitFor();
 check(prefix+' opening course cannot replace paginated summary with capped editor count',await emptyCard.locator('.course-facts').innerText()==='1 active unit · 1201 active lessons');
 await first.click();await page.locator('[data-private-home]').click();
 // Resolve an old account's summary after sign-out; it must not publish.
 await page.evaluate(()=>{window.testHoldSummaries=true;window.testAuthEvent('TOKEN_REFRESHED');});await page.waitForFunction(()=>window.testPendingSummaries.length>0);
 await page.evaluate(()=>{window.testSignedOut=true;window.testAuthEvent('SIGNED_OUT');});await page.locator('#auth-form').waitFor({state:'visible'});
 await page.evaluate(()=>{window.testHoldSummaries=false;window.testPendingSummaries.splice(0).forEach(resolve=>resolve());});
 check(prefix+' late summaries never restore signed-out course data',await page.locator('#home-courses [data-private-open]').count()===0&&await page.locator('#saved-courses button').count()===0);
}
async function verifyDashboard(page,width,fixture){
 const prefix='dashboard-'+width,second=fixture.dashboardExtra.course,firstLesson=fixture.lessons[0],otherLesson=fixture.dashboardExtra.lessons[1];
 const ready=()=>page.waitForFunction(()=>document.querySelector('.dashboard-load-status')?.textContent==='2 of 2 courses loaded.');
 await page.locator('#private-home').waitFor({state:'visible'});await ready();
 const before=await page.evaluate(()=>JSON.stringify(window.testDb));
 check(prefix+' two authorized courses with no foreign account labels',!(await page.locator('#private-home').innerText()).includes('Foreign private course')&&await page.locator('#home-courses button').count()===2);
 check(prefix+' Continue replaces oversized Resume and Create stays in My Courses',await page.locator('[data-resume-workspace]').innerText().then(t=>t.includes('Continue Planning')&&!t.includes('Resume Workspace'))&&!await page.locator('#private-home [data-create-course]').isVisible()&&await page.locator('.courses-heading [data-create-course]').isVisible());
 check(prefix+' separate overlapping categories and unique lesson count',await page.locator('.attention-panel .dashboard-panel-heading>span').innerText()==='7 lessons'&&await page.locator('[data-attention-group="draft"] h3>span').innerText()==='3'&&await page.locator('[data-attention-group="inProgress"] h3>span').innerText()==='3'&&await page.locator('[data-attention-group="unscheduled"] h3>span').innerText()==='3');
 const help=page.locator('.dashboard-help'),helpControl=help.locator('summary');
 check(prefix+' reading help is a native closed disclosure',await help.evaluate(e=>e.tagName==='DETAILS'&&!e.open)&&await helpControl.innerText()==='About these summaries');
 await helpControl.press('Enter');
 check(prefix+' reading help keyboard and safeguards',await help.evaluate(e=>e.open)&&await helpControl.evaluate(e=>e===document.activeElement)&&(await help.innerText()).includes('unscheduled does not mean overdue')&&(await help.innerText()).includes('Categories may overlap')&&(await help.innerText()).includes('Saved civil dates stay as recorded')&&(await help.innerText()).includes('not assumed to be one school-wide event'));
 const helpScroll=await page.evaluate(()=>scrollY);await page.evaluate(()=>window.testAuthEvent('TOKEN_REFRESHED'));await ready();
 check(prefix+' async refresh preserves help expansion focus and scroll',await help.evaluate(e=>e.open)&&await helpControl.evaluate(e=>e===document.activeElement)&&await page.evaluate(top=>Math.abs(scrollY-top)<2,helpScroll));
 await helpControl.press('Enter');
 check(prefix+' routine copy is out of primary panels',!await help.evaluate(e=>e.open)&&!(await page.locator('.attention-panel').innerText()).includes('Categories may overlap')&&!(await page.locator('.week-panel').innerText()).includes('matching names remain separate'));
 check(prefix+' neutral unscheduled explanation remains discoverable',(await help.textContent()).includes('unscheduled does not mean overdue')&&!/Needs Revision|Urgent|Overdue deadline/.test(await page.locator('.attention-panel').innerText()));
 check(prefix+' Monday Sunday saved week and no hypothetical overlays',await page.locator('[data-dashboard-day]').count()===7&&await page.locator('[data-dashboard-day]').first().getAttribute('data-dashboard-day')==='2026-10-26'&&await page.locator('[data-dashboard-day]').last().getAttribute('data-dashboard-day')==='2026-11-01'&&await page.locator('#dashboard-content [data-tentative-placement]').count()===0);
 const tuesday=page.locator('[data-dashboard-day="2026-10-27"]');check(prefix+' dense day accurate count with disclosure',await tuesday.locator('h3>span').innerText()==='15'&&await tuesday.locator('details>summary').first().isVisible());
 check(prefix+' mixed-week empty rows retain visible ordered dates',await page.locator('.dashboard-day-empty').count()===4&&await page.locator('[data-dashboard-day] time').evaluateAll(nodes=>nodes.every(n=>n.getClientRects().length>0)&&nodes.map(n=>n.dateTime).join(',')==='2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30,2026-10-31,2026-11-01'));
 check(prefix+' empty rows are compact single-line dates',await page.locator('.dashboard-day-empty').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height<=44&&Math.abs(n.querySelector('time').getBoundingClientRect().top-n.querySelector('.dashboard-empty').getBoundingClientRect().top)<4)));
 await tuesday.locator('[data-dashboard-disclosure="agenda-2026-10-27"]>summary').press('Enter');
 check(prefix+' dense disclosure retains all lessons assessments and events',await tuesday.locator('.dashboard-agenda-item:visible').count()===15&&await tuesday.locator('.assessment:visible').count()===1);
 await tuesday.locator('[data-dashboard-disclosure="agenda-2026-10-27"]>summary').press('Enter');
 if(width===390){await page.setViewportSize({width:320,height:1000});check(prefix+' 320px dates and controls stay readable without overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.locator('[data-dashboard-day] time').count()===7&&await page.locator('.dashboard-day-empty').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height<=44)));await page.screenshot({path:resolve(out,prefix+'-320px-week.png'),fullPage:true});await page.setViewportSize({width,height:1000});}
 check(prefix+' provenance preserves distinct same-title closures',await tuesday.locator('.dashboard-agenda-item.exception').count()===3&&await tuesday.locator('.uncertain').count()===1);
 check(prefix+' confirmed multiday lesson on both saved dates',await page.locator('.week-panel [data-dashboard-lesson="'+fixture.lessons[1].id+'"]').count()===2);
 await page.locator('.dashboard-data-notes>summary').click();
 check(prefix+' missing dates and uncertainty are disclosed',(await page.locator('.dashboard-data-notes').innerText()).includes('unclear lesson dates')&&(await tuesday.locator('.uncertain').innerText()).includes('constraints unclear'));
 check(prefix+' archived records absent',!(await page.locator('#dashboard-content').innerText()).includes('Archived individual lesson')&&!(await page.locator('#dashboard-content').innerText()).includes('Hidden archived-unit child'));
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(out,prefix+'-home.png'),fullPage:true});await page.locator('.week-panel').screenshot({path:resolve(out,prefix+'-week-exceptions.png')});
 const firstLink=page.locator('[data-attention-group="draft"] [data-dashboard-lesson="'+firstLesson.id+'"]');await firstLink.press('Enter');
 await page.locator('[data-private-save="lessons"][data-id="'+firstLesson.id+'"]').waitFor();
 check(prefix+' attention keyboard entry opens exact stable lesson',await page.locator('[data-private-save="lessons"] [name="title"]').inputValue()===firstLesson.title&&await page.locator('[data-private-save="lessons"] [name="title"]').evaluate(e=>e===document.activeElement));
 await page.locator('[name="objective"]').fill('Unsaved dashboard source-course draft');await page.evaluate(()=>{window.dashboardEditor=document.querySelector('[name="objective"]');window.dashboardPrimary=document.querySelector('.private-primary');window.dashboardPrimary.scrollTop=100;window.dashboardScroll=window.dashboardPrimary.scrollTop;});
 await page.locator('[data-private-home]').click();check(prefix+' Continue accurate course lesson and dirty state',(await page.locator('#continue-context').innerText()).includes(firstLesson.title)&&(await page.locator('#continue-context').innerText()).includes('Unsaved edits'));
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:resolve(out,prefix+'-continue.png')});await page.locator('[data-resume-workspace]').click();
 check(prefix+' Continue preserves actual dirty DOM and primary scroll',await page.evaluate(()=>document.querySelector('[name="objective"]')===window.dashboardEditor&&window.dashboardEditor.value==='Unsaved dashboard source-course draft'&&window.dashboardPrimary.scrollTop===window.dashboardScroll));
 await page.locator('[data-private-home]').click();
 await click(page.locator('.week-panel [data-dashboard-lesson="'+otherLesson.id+'"]').first());await page.locator('[data-private-save="lessons"][data-id="'+otherLesson.id+'"]').waitFor();
 check(prefix+' cross-course agenda opens matching lesson and unit',await page.locator('[data-private-save="lessons"] [name="title"]').inputValue()===otherLesson.title&&(await page.locator('.private-context').innerText()).includes('Community fieldwork'));
 await page.locator('[name="objective"]').fill('Unsaved destination-course draft');await page.locator('[data-private-home]').click();
 await click(page.locator('[data-attention-group="inProgress"] [data-dashboard-lesson="'+fixture.lessons[1].id+'"]').first());
 check(prefix+' different dirty target view is protected',await page.locator('#dashboard-navigation-status').innerText().then(t=>t.includes('unsaved edits'))&&await page.locator('#private-home').isVisible());
 await click(page.locator('[data-attention-group="draft"] [data-dashboard-lesson="'+firstLesson.id+'"]').first());
 check(prefix+' exact cached dirty lesson resumes without overwrite',await page.evaluate(()=>document.querySelector('[name="objective"]')===window.dashboardEditor&&window.dashboardEditor.value==='Unsaved dashboard source-course draft'));
 await page.locator('[data-private-home]').click();await click(page.locator('.week-panel [data-dashboard-lesson="'+otherLesson.id+'"]').first());
 check(prefix+' destination course draft also survives',await page.locator('[name="objective"]').inputValue()==='Unsaved destination-course draft');
 page.once('dialog',d=>d.accept());await click(page.locator('#workspace-navigation [data-private-tab="calendar"]'));
 await page.locator('[data-global-home]').click();await click(tuesday.locator('[data-dashboard-course="'+second.id+'"][data-dashboard-date]').first());await page.locator('.saved-month').waitFor();
 check(prefix+' exception link opens saved calendar date and course',await page.locator('.saved-month [data-private-calendar-day="2026-10-27"]').getAttribute('aria-pressed')==='true'&&(await page.locator('.private-header h2').innerText())===second.name);
 await page.locator('[data-global-home]').click();await page.locator('[data-dashboard-week="1"]').click();await ready();
 check(prefix+' next week has honest empty schedule',await page.locator('.dashboard-agenda-item').count()===0&&(await page.locator('.week-panel').innerText()).includes('No saved entries.'));
 check(prefix+' wholly empty week keeps seven compact rows including weekend',await page.locator('.dashboard-day-empty').count()===7&&await page.locator('.dashboard-day-empty time').evaluateAll(nodes=>nodes.every(n=>n.getClientRects().length>0)&&nodes[5].textContent.startsWith('Sat')&&nodes[6].textContent.startsWith('Sun'))&&await page.locator('.dashboard-day-empty').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height<=44)));
 if(width===390){await page.setViewportSize({width:320,height:1000});check(prefix+' 320px empty week is compact and has no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.locator('.dashboard-day-empty').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height<=44)));await page.setViewportSize({width,height:1000});}
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:resolve(out,prefix+'-empty-week.png'),fullPage:true});await page.locator('[data-dashboard-week="0"]').click();await ready();
 await page.evaluate(id=>{window.testDashboardFailCourse=id;window.testAuthEvent('TOKEN_REFRESHED');},second.id);await page.locator('.dashboard-failures').waitFor();
 check(prefix+' partial course failure does not become empty dashboard',(await page.locator('.dashboard-load-status').innerText()).includes('1 unavailable')&&await page.locator('[data-attention-group="draft"] h3>span').innerText()==='2');
 await page.evaluate(()=>{window.testDashboardFailAll=true;});await page.locator('[data-dashboard-retry]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.dashboard-failures li').length===2);
 check(prefix+' all-course failures are not an empty or endless-loading state',(await page.locator('.attention-panel').innerText()).includes('could not be loaded')&&!((await page.locator('.attention-panel').innerText()).includes('0 lessons')));
 await page.evaluate(()=>{window.testDashboardFailAll=false;window.testDashboardFailCourse=null;window.testDashboardFailEvents=true;});await page.locator('[data-dashboard-retry]').click();
 await page.waitForFunction(()=>document.querySelector('.dashboard-load-status')?.textContent.includes('some calendar events unavailable'));
 if(!await page.locator('.dashboard-data-notes').evaluate(e=>e.open))await page.locator('.dashboard-data-notes>summary').click();
 check(prefix+' partial warnings remain prominent outside reading help',await page.locator('.dashboard-load-status').isVisible()&&await page.locator('.dashboard-load-status').evaluate(e=>!e.closest('.dashboard-help'))&&await page.locator('[data-dashboard-retry]').isVisible());
 check(prefix+' event failures retain lesson agenda and truthful partial state',await page.locator('.dashboard-agenda-item.lesson').count()>0&&await page.locator('.dashboard-agenda-item.exception').count()===0&&(await page.locator('.dashboard-data-notes').innerText()).includes('calendar events unavailable'));
 await page.evaluate(()=>{window.testDashboardFailEvents=false;});await page.locator('[data-dashboard-retry]').click();await ready();
 check(prefix+' no responsive page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(prefix+' all navigation leaves saved signatures and writes unchanged',await page.evaluate(before=>JSON.stringify(window.testDb)===before&&window.testWrites.length===0,before));
 await page.evaluate(()=>{window.testHoldDashboard=true;window.testAuthEvent('TOKEN_REFRESHED');});await page.waitForFunction(()=>window.testPendingDashboard.length>0);
 check(prefix+' loading is not reported as zero lessons',(await page.locator('.attention-panel').innerText()).includes('Waiting for saved course records')&&!((await page.locator('.attention-panel').innerText()).includes('0 lessons')));
 await page.evaluate(()=>{window.testSignedOut=true;window.testAuthEvent('SIGNED_OUT');});await page.locator('#auth-form').waitFor({state:'visible'});
 await page.evaluate(()=>{window.testHoldDashboard=false;window.testPendingDashboard.splice(0).forEach(resolve=>resolve());});
 check(prefix+' stale dashboard cannot leak after sign-out',await page.locator('#dashboard-content [data-dashboard-course]').count()===0&&await page.locator('#dashboard-content').innerText()==='');
 await page.evaluate(()=>{window.testSignedOut=false;window.testOwner='60000000-0000-4000-8000-000000000002';window.testAuthEvent('SIGNED_IN');});
 await page.waitForFunction(()=>document.querySelector('.dashboard-load-status')?.textContent==='1 of 1 courses loaded.');
 check(prefix+' new account dashboard excludes prior owner',!(await page.locator('#dashboard-content').innerText()).includes('Fictional Civic Systems')&&await page.locator('#home-courses button').count()===1);
}
const server=createServer(async(req,res)=>{
 try{const path=resolve(app,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(app+'/')&&path!==app)throw Error('Invalid path');
  const content=await readFile(path===app?resolve(app,'index.html'):path);
  res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.mjs':'text/javascript'})[extname(path)]||'text/html'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 for(const [fixtureName,fixture] of [['dashboard',dashboardFixture()],['cards',archived],['home',fullyScheduled80Fixture()],['empty',{...scheduleFixture(),empty:true}],['ux',fullyScheduled80Fixture()],['sample',scheduleFixture()],['preview',scheduleFixture()],['outlook',buildOutlookFixture()],['outlook-long',(()=>{const s=fullyScheduled80Fixture();s.lessons.slice(1).forEach(l=>{l.scheduled_dates=[];l.protected_pin_date=null;});return s;})()],['complete-80',fullyScheduled80Fixture()],['partial',(()=>{const s=scheduleFixture();s.lessons[3].scheduled_dates=[];return s;})()],['synthetic',synthetic],['archived',archived],...(stored?[['stored-fictional',stored]]:[])].filter(([name])=>!process.env.COURSE_PLANNER_BROWSER_FIXTURES||process.env.COURSE_PLANNER_BROWSER_FIXTURES.split(',').includes(name))){
  const expected=buildCalendarModel(fixture);
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});context.setDefaultTimeout(20000);
   console.log('Checking '+fixtureName+' at '+width+'px');
   await context.addInitScript(({fixture,probeAuth})=>{
    const snapshot=structuredClone(fixture);let owner=fixture.course.owner_id;window.testOwner=owner;
    const db={courses:fixture.empty?[]:[fixture.course],units:fixture.empty?[]:fixture.units,lessons:fixture.empty?[]:fixture.lessons,calendar_exceptions:fixture.empty?[]:fixture.exceptions};
    if(fixture.dashboardExtra){const extra=fixture.dashboardExtra;db.courses.push(extra.course);db.units.push(...extra.units);db.lessons.push(...extra.lessons);db.calendar_exceptions.push(...extra.exceptions);db.courses.push({...fixture.course,id:'60000000-0000-4000-8000-000000000001',owner_id:'60000000-0000-4000-8000-000000000002',name:'Foreign private course'});}
    window.testHoldDashboard=false;window.testPendingDashboard=[];
    if(probeAuth)db.courses.push(...[41,42].map(n=>({...fixture.course,id:'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),name:'Fictional additional course '+n})));
    window.testHoldSummaries=false;window.testPendingSummaries=[];window.testHoldCourseLists=probeAuth;window.testPendingCourseLists=[];
    window.testDb=db;window.testReads=[];window.testWrites=[];window.testSnapshot=snapshot;window.rejectWrites=false;
    const client={auth:{async getSession(){return {data:{session:window.testSignedOut?null:{user:{id:window.testOwner,email:'fictional@example.test'}}}};},async getUser(){return {data:{user:{id:owner}}};},onAuthStateChange(fn){window.testAuthEvent=fn;},async signOut(){return {};}}};
    client.from=table=>{
     const filters=[];let patch=null,insert=null,columns='*',bounds=null;
     const chain={insert(p){insert=p;return chain;},select(c='*'){columns=c;return chain;},eq(k,v){filters.push([k,v]);return chain;},order(){return chain;},range(start,end){bounds=[start,end];return chain;},update(p){patch=p;return chain;},
      async single(){const r=await run();return {...r,data:r.data?.[0]||null};},async maybeSingle(){const r=await run();return {...r,data:r.data?.[0]||null};},then(a,b){return run().then(a,b);}};
     async function run(){
      owner=window.testOwner;
      if(!patch)window.testReads.push({table,filters});
      if(table==='courses'&&columns==='id,name,owner_id,timezone'&&(window.testDashboardFailAll||filters.some(([key,value])=>key==='id'&&value===window.testDashboardFailCourse)))return {data:null,error:{message:'Synthetic course unavailable'}};
      if(table==='calendar_exceptions'&&columns!=='*'&&window.testDashboardFailEvents)return {data:null,error:{message:'Synthetic event read failure'}};
      if(window.testSummaryFailure&&filters.some(([key,value])=>key==='course_id'&&value===window.testSummaryFailure)&&columns.includes('archived_at')&&columns!=='*')return {data:null,error:{message:'Synthetic summary read failure'}};
      if(insert){if(table!=='courses'||insert.owner_id!==owner)return {data:null,error:{message:'Access denied'}};const row={...insert,id:crypto.randomUUID(),revision:1,updated_at:new Date().toISOString()};db[table].push(row);window.testWrites.push({table,insert});return {data:[structuredClone(row)],error:null};}
      let rows=db[table].filter(x=>filters.every(([k,v])=>x[k]===v));
      if(table==='courses')rows=rows.filter(x=>x.owner_id===owner);
      else rows=rows.filter(x=>db.courses.some(c=>c.id===x.course_id&&c.owner_id===owner));
      if(patch&&window.testHoldWrites)await new Promise(resolve=>window.testReleaseWrite=resolve);
      if(patch){window.testWrites.push({table,patch});if(window.rejectWrites)return {data:null,error:{message:'Test network failure'}};rows.forEach(x=>Object.assign(x,patch,{revision:(x.revision||1)+1}));}
      if(bounds)rows=rows.slice(bounds[0],bounds[1]+1);else if(!patch)rows=rows.slice(0,1000);
      const response={data:structuredClone(rows.map(x=>columns==='*'?x:Object.fromEntries(columns.split(',').map(k=>[k,x[k]])))),error:null};
      if(window.testHoldCourseLists&&table==='courses'&&columns==='id,name,revision,updated_at')return new Promise(resolve=>window.testPendingCourseLists.push(()=>resolve(response)));
      if(window.testHoldSummaries&&['units','lessons'].includes(table)&&columns.includes('archived_at')&&columns!=='*')return new Promise(resolve=>window.testPendingSummaries.push(()=>resolve(response)));
      if(window.testHoldDashboard&&table==='courses'&&columns==='id,name,owner_id,timezone')return new Promise(resolve=>window.testPendingDashboard.push(()=>resolve(response)));
      return response;
     }return chain;
    };
    client.rpc=async(name,{p_export:json})=>{
     if(name!=='restore_course_export')throw Error('Unexpected RPC');
     const cid=crypto.randomUUID(),mapping=new Map(json.units.map(u=>[u.id,crypto.randomUUID()]));
     db.courses.push({...json.course,id:cid,owner_id:owner,name:json.course.name+' (restored)'});
     db.units.push(...json.units.map(u=>({...u,id:mapping.get(u.id),course_id:cid})));
     db.lessons.push(...json.lessons.map(l=>({...l,id:crypto.randomUUID(),course_id:cid,unit_id:mapping.get(l.unit_id)})));
     db.calendar_exceptions.push(...json.calendarExceptions.map(e=>({...e,id:crypto.randomUUID(),course_id:cid})));
     window.testWrites.push({rpc:name});return {data:cid,error:null};
    };
    window.testClient=client;
   },{fixture,probeAuth:fixtureName==='preview'});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',body:'export const createClient=()=>window.testClient;'}));
   if(fixtureName==='dashboard')await page.clock.setFixedTime(new Date('2026-10-27T14:00:00Z'));
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
   if(fixtureName==='preview'){
    await page.waitForFunction(()=>window.testPendingCourseLists.length===1);
    await page.evaluate(()=>{window.testAuthEvent('INITIAL_SESSION');window.testAuthEvent('TOKEN_REFRESHED');});
    await page.waitForFunction(()=>window.testPendingCourseLists.length===3);
    await page.evaluate(()=>{window.testHoldCourseLists=false;window.testPendingCourseLists[2]();window.testPendingCourseLists[0]();window.testPendingCourseLists[1]();});
    await page.waitForFunction(()=>document.querySelector('#storage-status').textContent.startsWith('3 saved course'));
    check('auth-'+width+' concurrent responses show three entries',await page.locator('#saved-courses [data-private-open]').count()===3);
    check('auth-'+width+' each course appears once',await page.locator('#saved-courses [data-private-open]').evaluateAll(nodes=>new Set(nodes.map(n=>n.dataset.privateOpen)).size===3));
    check('auth-'+width+' rendering performs no writes',await page.evaluate(()=>window.testWrites.length===0));
   }
   if(fixtureName==='dashboard'){await verifyDashboard(page,width,fixture);await context.close();continue;}
   if(fixtureName==='cards'){await verifyCourseCards(page,width,fixture);await context.close();continue;}
   if(['home','empty'].includes(fixtureName)){await verifyHomeNavigation(page,width,fixture);await context.close();continue;}
   await page.locator('[data-private-tab="calendar"]').click();
   await page.locator('.saved-month').waitFor();
   const prefix=`${fixtureName}-${width}`;
   if(fixtureName==='ux'){await verifyUXStructure(page,width,prefix,fixture);await context.close();continue;}
   if(fixtureName==='sample'){await verifySampleInterface(page,width,prefix,fixture);await context.close();continue;}
   if(fixtureName.startsWith('outlook')){await verifyOutlookInterface(page,width,prefix,fixture);await context.close();continue;}
   if(fixtureName==='preview'){await verifyPreviewInterface(page,width,prefix,fixture);await context.close();continue;}
   if(fixtureName==='complete-80'||fixtureName==='partial'){await verifyCompleteOrPartial(page,width,prefix,fixture,fixtureName==='partial');await context.close();continue;}
   const hiddenLessons=archivedRecords(fixture);
   async function checkArchives(view){
    const content=await page.locator('.private-content').innerHTML();
    check(prefix+' '+view+' excludes archived IDs and labels',hiddenLessons.every(l=>!content.includes(l.id)&&!content.includes(l.title)));
    check(prefix+' '+view+' excludes archived unit pacing',fixture.units.filter(u=>u.archived_at!=null).every(u=>!content.includes(u.title)));
   }
   await checkArchives('Month');
   if(fixtureName==='stored-fictional'){
    await click(page.locator('[data-outlook-open]'));await click(page.locator('[data-outlook-use-focus]'));await formSubmit(page,'[data-build-schedule-form] button[type="submit"]');
    check(prefix+' incomplete 80-lesson Build is honest',(await page.locator('[data-build-result]').innerText()).includes('6 already unscheduled')&&(await page.locator('[data-build-result]').innerText()).includes('1 unplaceable'));
    check(prefix+' Build never shifts saved dates',await page.locator('[data-build-result] [data-build-row]').evaluateAll(rows=>rows.filter(r=>r.querySelector('dd').textContent!=='Unscheduled — saved').every(r=>r.querySelectorAll('dd')[0].textContent===r.querySelectorAll('dd')[1].textContent)));
    check(prefix+' impossible baseline has no fabricated overlay',await page.locator('[data-tentative-placement]').count()===0);
    await captureInspector(page,resolve(out,prefix+'-incomplete-build.png'));await click(page.locator('[data-outlook-close]').last());
   }
   await click(page.locator('[data-event-open=""]'));await control(page.locator('[data-event-preview-form] [name="title"]'),'fill','Fictional 80-lesson preview probe');await formSubmit(page,'[data-event-preview-form] button[type="submit"]');
   check(prefix+' large-course blocked baseline is explicit',(await page.locator('#scheduling-preview-title').innerText()).includes(fixtureName==='stored-fictional'?'Partial preview — overall blocked':'Blocked preview'));
   if(fixtureName==='stored-fictional')check(prefix+' stored incomplete boundary disclosed',(await page.locator('[aria-labelledby="scheduling-preview-title"]').innerText()).includes('not assessed')) ;
   check(prefix+' preview form performs zero writes',await page.evaluate(()=>window.testWrites.length===0));
   await click(page.locator('[aria-labelledby="scheduling-preview-title"]').getByRole('button',{name:'Close preview',exact:true}));
   check(prefix+' month/weekday structure',await page.locator('.saved-weekdays span').count()===7);
   check(prefix+' persisted totals displayed',(await page.locator('.private-header').innerText()).includes('80 lesson(s) · 12 calendar exception(s)'));
   const firstDate=expected.lessons.flatMap(l=>l.scheduled_dates||[]).sort()[0]||fixture.course.first_day;
   await click(page.locator(`[data-private-calendar-day="${firstDate}"]`).first());
   check(prefix+' day detail saved stable IDs',await page.locator(`#saved-day-details [data-private-lesson="${expected.days[firstDate].lessons[0].id}"]`).count()>0);
   check(prefix+' mobile day targets and compact month',width!==390||await page.locator('.saved-month [data-private-calendar-day]').first().evaluate(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44));
   check(prefix+' month no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-month.png')});
   await click(page.locator('[data-private-calendar-view="week"]'));
   await checkArchives('Agenda');
   check(prefix+' local week toggle',await page.locator('.saved-agenda>.saved-calendar-day').count()===7&&await page.locator('[data-private-tab="calendar"][aria-pressed=true]').count()===1);
   check(prefix+' agenda no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(prefix+' toolbar focus survives rerender',await page.locator('[data-private-calendar-view="week"]').evaluate(e=>e===document.activeElement));
   const previous=await page.locator('.saved-calendar-toolbar h3').innerText();
   await click(page.locator('[data-private-calendar-period="1"]'));
   check(prefix+' next week navigation',await page.locator('.saved-calendar-toolbar h3').innerText()!==previous);
   await click(page.locator('[data-private-calendar-period="-1"]'));
   const dayButton=page.locator(`[data-private-calendar-day="${firstDate}"]`).first();
   if(await page.locator('.private-primary').evaluate(e=>e.inert))await page.locator('[data-inspector-close]').click();await dayButton.focus();await page.keyboard.press('ArrowRight');
   check(prefix+' keyboard date and focus',width===390?await page.locator('#saved-day-title').evaluate(e=>e===document.activeElement)&&await page.locator(`[data-private-calendar-day="${addCalendarDays(firstDate,1)}"]`).first().getAttribute('aria-pressed')==='true':await page.locator(`[data-private-calendar-day="${addCalendarDays(firstDate,1)}"]`).first().evaluate(e=>e===document.activeElement));
   await click(page.locator(`[data-private-calendar-day="${firstDate}"]`).first());
   await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-week.png')});
   check(prefix+' all calendar actions have zero mutations',await page.evaluate(()=>window.testWrites.length===0));
   const chosen=expected.days[firstDate].lessons[0];
   await click(page.locator(`#saved-day-details [data-private-lesson="${chosen.id}"]`).first());
   check(prefix+' same lesson editor ID',await page.locator(`[data-private-save="lessons"][data-id="${chosen.id}"]`).count()===1);
   check(prefix+' lesson editor receives focus',await page.locator('[data-private-save="lessons"] input[name="title"]').evaluate(e=>e===document.activeElement));
   await control(page.locator('[name="objective"]'),'fill','Fictional acceptance draft');
   page.once('dialog',d=>d.dismiss());await click(page.locator('[data-private-tab="calendar"]'));
   check(prefix+' unsaved guard preserves draft',await page.locator('[name="objective"]').inputValue()==='Fictional acceptance draft');
   if(fixtureName==='synthetic'||fixtureName==='archived'){
    // Actual save/reopen and conflict paths, backed by the test client only.
    await click(page.locator('[data-private-save="lessons"] button[type="submit"]'));
    await page.waitForFunction(()=>document.getElementById('private-status').textContent.includes('Saved and verified'));
    await click(page.locator('[data-private-reload]'));
    check(prefix+' save/reopen',await page.locator('[name="objective"]').inputValue()==='Fictional acceptance draft');
    await control(page.locator('[name="objective"]'),'fill','Newer fictional draft');
    await page.evaluate(id=>{window.testDb.lessons.find(l=>l.id===id).revision++;},chosen.id);
    await click(page.locator('[data-private-save="lessons"] button[type="submit"]'));
    await page.waitForFunction(()=>document.getElementById('private-status').textContent.includes('Save conflict'));
    check(prefix+' stale conflict preserves draft',await page.locator('[name="objective"]').inputValue()==='Newer fictional draft');
    page.once('dialog',d=>d.accept());await click(page.locator('[data-private-tab="calendar"]'));
    const downloadPromise=page.waitForEvent('download');await click(page.locator('[data-private-export]'));const download=await downloadPromise;
    const json=JSON.parse(await readFile(await download.path(),'utf8'));
    check(prefix+' JSON export retains complete archived records',hiddenLessons.every(l=>JSON.stringify(json.lessons.find(x=>x.id===l.id))===JSON.stringify(l))&&fixture.units.filter(u=>u.archived_at!=null).every(u=>JSON.stringify(json.units.find(x=>x.id===u.id))===JSON.stringify(u)));
    check(prefix+' one-course export schedule/identity',json.lessons.length===80&&json.calendarExceptions.length===12&&json.lessons[0].id===fixture.lessons[0].id);
    await click(page.locator('#restore-details summary'));
    await control(page.locator('#restore-file'),'setInputFiles',{name:'fictional-export.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
    page.once('dialog',d=>d.accept());await click(page.locator('#restore-form button'));
    await page.waitForFunction(()=>document.getElementById('restore-status').textContent.includes('Restore complete'));
    check(prefix+' import opens separate restored course',await page.evaluate(original=>window.testDb.courses.length===2&&window.testDb.courses[0].id===original,fixture.course.id));
    const zipPromise=page.waitForEvent('download');await click(page.locator('#backup-all'));const zip=await zipPromise;
    const bytes=await readFile(await zip.path());check(prefix+' account ZIP browser download',bytes.readUInt32LE(0)===0x04034b50&&bytes.includes(Buffer.from('backup-manifest.json')));
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const files=[];let offset=0;
    while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+nameLength+extra;files.push({name:bytes.subarray(offset+30,offset+30+nameLength).toString(),value:JSON.parse(bytes.subarray(start,start+size).toString())});offset=start+size;}
    const originalBackup=files.find(f=>f.value.course?.id===fixture.course.id)?.value;
    check(prefix+' ZIP retains archived records',hiddenLessons.every(l=>JSON.stringify(originalBackup.lessons.find(x=>x.id===l.id))===JSON.stringify(l))&&fixture.units.filter(u=>u.archived_at!=null).every(u=>JSON.stringify(originalBackup.units.find(x=>x.id===u.id))===JSON.stringify(u)));
    if(fixtureName==='archived'){
     await click(page.locator('#workspace-navigation [data-private-tab="calendar"]'));
     check(prefix+' active calendar excludes archived unscheduled work',(await page.locator('#private-workspace').textContent()).includes('Unscheduled lessons (0)'));
     check(prefix+' archive filtering leaves all underlying records',await page.evaluate(()=>window.testDb.lessons.length===160&&window.testDb.units.length===10));
     check(prefix+' restored copy retains lesson archive flags',await page.evaluate(()=>window.testDb.lessons.filter(l=>l.archived_at!=null).length===8));
    }
    check(prefix+' ZIP includes original and restored course',files.length===3&&files.find(f=>f.name==='backup-manifest.json').value.courseCount===2);
   }else{
    page.once('dialog',d=>d.accept());await click(page.locator('[data-private-tab="calendar"]'));
    check(prefix+' stored comparison did not write',await page.evaluate(()=>window.testWrites.length===0));
    check(prefix+' stored schedule facts unchanged',await page.evaluate(()=>JSON.stringify(window.testDb.lessons)===JSON.stringify(window.testSnapshot.lessons)));
   }
   await context.close();
  }
 }
 // First saved course, no dates/children: real workspace renders meaningful state.
 const context=await browser.newContext();const page=await context.newPage();
 await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',body:'export const createClient=()=>({auth:{async getSession(){return {data:{session:null}}},onAuthStateChange(){}}});'}));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
 await page.evaluate(async()=>{const {openPrivateCourse}=await import('./private-workspace.js');const c={id:'00000000-0000-4000-8000-000000000001',owner_id:'empty-owner',name:'Empty fictional first course'};const client={from(table){const b={select(){return b},eq(){return b},order(){return b},single(){return Promise.resolve({data:c})},then(r){return Promise.resolve({data:[]}).then(r)}};return b}};await openPrivateCourse(client,{id:c.owner_id},c.id);});
 await page.locator('[data-private-tab="calendar"]').click();
 check('empty first course capacity unknown',await page.getByText(/Capacity unknown until term/).count()===1);
 check('empty first course month renders',await page.locator('.saved-month-days>.saved-calendar-day').count()>=28);
 await click(page.locator('[data-event-open=""]'));await page.locator('[data-event-preview-form] [name="title"]').fill('Fictional empty-course event');await formSubmit(page,'[data-event-preview-form] button[type="submit"]');
 await details(page);
 check('empty first course preview explains missing term',(await page.locator('[aria-labelledby="scheduling-preview-title"]').innerText()).includes('Set valid inclusive term bounds'));
 check('empty preview invents no lesson placements',await page.locator('[data-preview-row]').count()===0);
 await page.locator('.private-workspace').screenshot({path:resolve(out,'empty-first-course.png')});await context.close();
 check('no uncaught browser errors',errors.length===0);
 await writeFile(resolve(out,'browser-results.json'),JSON.stringify({checks,errors,storedFixtureTested:!!stored},null,2));
 console.log(JSON.stringify({passed:checks.length,errors,storedFixtureTested:!!stored,output:out},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
