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
async function verifyPreviewInterface(page,width,prefix,fixture){
 const original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const open=async()=>{await page.locator('[data-event-open=""]').click();};
 const fill=async(title='Fictional closure')=>{await page.locator('[data-event-preview-form] [name="title"]').fill(title);await page.locator('[data-event-preview-form] [name="date"]').fill('2026-09-15');};
 const submit=async()=>{await page.locator('[data-event-preview-form] button[type="submit"]').click();};
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
 check(prefix+' ready preview and result focus',(await page.locator('#scheduling-preview-title').innerText()).includes('Preview ready')&&await page.locator('#scheduling-preview-title').evaluate(e=>e===document.activeElement));
 check(prefix+' every downstream change disclosed',await result.locator(':scope > [data-preview-row][data-changed="true"]').count()===3);
 const second=result.locator(':scope > [data-preview-row="'+fixture.lessons[1].id+'"]');
 check(prefix+' BEFORE and PROPOSED dates visible',(await second.innerText()).includes('2026-09-15')&&(await second.innerText()).includes('2026-09-16'));
 check(prefix+' no scheduling apply action',await result.getByRole('button',{name:/^(Apply|Save|Confirm)$/}).count()===0);
 check(prefix+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await result.screenshot({path:resolve(out,prefix+'-closure-before-proposed.png')});
 await page.locator('[data-event-preview-form] [name="title"]').fill('Changed title');
 check(prefix+' edited proposal hides stale result',!(await page.locator('#scheduling-preview-title').isVisible()));
 await page.locator('[data-event-preview-form] [name="title"]').press('Escape');
 check(prefix+' Escape cancel restores entry focus',await page.locator('[data-event-open=""]').evaluate(e=>e===document.activeElement));
 check(prefix+' Cancel leaves byte-identical records',await page.evaluate(()=>JSON.stringify(window.testDb))===original);
 const exportedPromise=page.waitForEvent('download');await page.locator('[data-private-export]').click();const exported=await exportedPromise;const saved=JSON.parse(await readFile(await exported.path(),'utf8')),baseline=JSON.parse(original);
 check(prefix+' cancelled draft absent from JSON export',JSON.stringify(saved.lessons)===JSON.stringify(baseline.lessons)&&JSON.stringify(saved.calendarExceptions)===JSON.stringify(baseline.calendar_exceptions)&&JSON.stringify(saved.units)===JSON.stringify(baseline.units)&&JSON.stringify(saved.course)===JSON.stringify(baseline.courses[0]));
 await open();await fill('Fictional shortened periods');await page.locator('[name="eventType"]').selectOption('Shortened periods');
 check(prefix+' shortened default Keep',await page.locator('[name="effect"]').inputValue()==='Keep');await submit();
 await result.screenshot({path:resolve(out,prefix+'-keep-before-proposed.png')});
 check(prefix+' Keep preserves date arrays',await result.locator(':scope > [data-preview-row][data-changed="true"]').count()===0&&(await result.innerText()).includes('2026-09-15'));
 await page.locator('[name="effect"]').selectOption('Move');await submit();
 check(prefix+' same event type permits Move override',(await result.innerText()).includes('teacher override')&&await result.locator(':scope > [data-preview-row][data-changed="true"]').count()===3);
 await page.locator('[name="eventType"]').selectOption('Testing');await page.locator('[name="availability"]').selectOption('instructional');await page.locator('[name="effect"]').selectOption('Keep');await submit();
 check(prefix+' explicit instructional Testing Keep allowed',(await result.innerText()).includes('Preview ready')&&(await result.innerText()).includes('teacher override'));
 await page.locator('[name="eventType"]').selectOption('Other');await page.locator('[name="availability"]').selectOption('partial');await submit();
 check(prefix+' partial-time policy blocks preview',(await result.innerText()).includes('Blocked preview')&&(await result.innerText()).includes('Partial-day time allocation is unresolved'));
 await result.getByRole('button',{name:'Close preview',exact:true}).click();
 await open();await fill();await submit();
 // Another editor changes a dependency in the test DB; reloading must invalidate.
 await page.evaluate(()=>{window.testDb.lessons[2].protected_pin_date='2026-09-16';window.testDb.lessons[2].revision++;});
 await page.locator('[data-private-reload]').click();
 check(prefix+' reload invalidates open preview',(await result.innerText()).includes('Saved inputs changed'));
 await result.getByRole('button',{name:'Close preview',exact:true}).click();await open();await fill();await submit();
 check(prefix+' protected assessment blocks displacement',(await result.innerText()).includes('Blocked preview')&&(await result.innerText()).includes('before the next protected commitment'));
 await result.screenshot({path:resolve(out,prefix+'-protected-conflict.png')});
 await result.locator(':scope > [data-preview-row] [data-private-lesson]').first().click();
 check(prefix+' preview uses shared lesson record',await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===fixture.lessons[1].id);
 await page.locator('[name="objective"]').fill('Unsaved authoring guard probe');page.once('dialog',d=>d.dismiss());await page.locator('[data-private-tab="calendar"]').click();
 check(prefix+' authoring draft guard survives previews',await page.locator('[name="objective"]').inputValue()==='Unsaved authoring guard probe');
 page.once('dialog',d=>d.accept());await page.locator('[data-private-tab="calendar"]').click();
 await page.evaluate(({eventId,courseId})=>{window.testDb.lessons[2].protected_pin_date=null;window.testDb.lessons[2].revision++;window.testDb.calendar_exceptions.push({id:eventId,course_id:courseId,date:'2026-09-18',title:'Fictional replacement event',event_type:'Alternate activity',effect:'Replace Lesson',revision:1});},{eventId:previewId(30),courseId:fixture.course.id});
 await page.locator('[data-private-reload]').click();await page.locator('.event-list summary').click();await page.locator('.event-list [data-event-open="'+previewId(30)+'"]').click();
 check(prefix+' Change event retains raw title',await page.locator('[data-event-preview-form] [name="title"]').inputValue()==='Fictional replacement event');
 await page.locator('[name="date"]').fill('2026-09-15');await submit();
 check(prefix+' legacy replacement preview mapping',(await result.innerText()).includes('legacy default')&&(await result.innerText()).includes('Fictional replacement event'));
 check(prefix+' preview Close never performs REST or RPC writes',await page.evaluate(()=>window.testWrites.length===0));
 await result.getByRole('button',{name:'Close preview',exact:true}).click();
 check(prefix+' saved Month/Week presentation retained',await page.locator('.saved-month').count()===1);
 await page.locator('[data-private-calendar-view="week"]').click();check(prefix+' Week still usable',await page.locator('.saved-agenda>.saved-calendar-day').count()===7);
 await page.evaluate(({eventId,courseId})=>{window.testDb.calendar_exceptions=[{id:eventId,course_id:courseId,date:'2026-09-18',title:'Fictional full closure',effect:'No Lesson',event_type:'Closure',revision:1}];},{eventId:previewId(31),courseId:fixture.course.id});await page.locator('[data-private-reload]').click();await page.locator('.event-list summary').click();await page.locator('.event-list [data-event-open="'+previewId(31)+'"]').click();
 await page.locator('[name="eventType"]').selectOption('Shortened periods');check(prefix+' saved closure constraint survives type defaults',await page.locator('[name="availability"]').inputValue()==='closed'&&await page.locator('[name="effect"]').inputValue()==='Move');check(prefix+' saved closure Keep stays forbidden',await page.locator('[name="effect"] option[value="Keep"]').evaluate(e=>e.disabled));
}
async function verifyCompleteOrPartial(page,width,prefix,fixture,partial=false){
 const original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const result=page.locator('[aria-labelledby="scheduling-preview-title"]');
 const form=page.locator('[data-event-preview-form]');
 await page.locator('[data-event-open=""]').click();
 await form.locator('[name="title"]').fill('Fictional review closure');await form.locator('[name="date"]').fill(partial?'2026-09-15':'2026-09-02');
 await form.locator('button[type="submit"]').click();
 check(prefix+' Move result explicit',(await result.innerText()).includes(partial?'Partial preview — overall blocked':'Preview ready for review'));
 check(prefix+' full BEFORE comparisons',await result.locator('details').filter({hasText:'All active lesson comparisons'}).locator('[data-preview-row]').count()===fixture.lessons.length);
 check(prefix+' assessed downstream Move changes',await result.locator(':scope > [data-preview-row][data-changed="true"]').count()===(partial?1:79));
 check(prefix+' no Apply action',await result.getByRole('button',{name:/^(Apply|Save|Confirm)$/}).count()===0);
 check(prefix+' result focus',await page.locator('#scheduling-preview-title').evaluate(e=>e===document.activeElement));
 if(partial){
  check(prefix+' honest assessment totals',(await result.innerText()).includes('2 lesson(s) assessed · 2 not assessed · 1 already unscheduled'));
  check(prefix+' no dates cross unresolved horizon',(await result.innerText()).includes('ending 2026-09-16'));
  await result.locator('[data-preview-unassessed] summary').click();
  check(prefix+' unassessed saved dates disclosed',(await result.locator('[data-preview-unassessed]').innerText()).includes('Not assessed — no proposed dates'));
 }else{
  check(prefix+' eighty assessed no missing work',(await result.innerText()).includes('80 lesson(s) assessed · 0 not assessed · 0 already unscheduled'));
  check(prefix+' five units twelve saved events',(await result.innerText()).includes('5 active unit(s)')&&(await page.locator('.private-header').innerText()).includes('80 lesson(s) · 12 calendar exception(s)'));
 }
 check(prefix+' no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await result.screenshot({path:resolve(out,prefix+'-move.png')});
 await form.locator('[name="eventType"]').selectOption('Shortened periods');await form.locator('[name="availability"]').selectOption('instructional');await form.locator('[name="effect"]').selectOption('Keep');await form.locator('button[type="submit"]').click();
 check(prefix+' Keep result explicit',(await result.innerText()).includes(partial?'Partial preview — overall blocked':'Preview ready for review'));
 check(prefix+' Keep changes no dates',await result.locator(':scope > [data-preview-row][data-changed="true"]').count()===0);
 check(prefix+' Keep assessment counts',(await result.innerText()).includes(partial?'3 lesson(s) assessed · 1 not assessed':'80 lesson(s) assessed · 0 not assessed'));
 await result.screenshot({path:resolve(out,prefix+'-keep.png')});
 await result.getByRole('button',{name:'Close preview',exact:true}).click();
 check(prefix+' Cancel byte equality',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-private-export]').click();const download=await downloadPromise;const json=JSON.parse(await readFile(await download.path(),'utf8'));
 check(prefix+' JSON retains entire lesson records',JSON.stringify(json.lessons)===JSON.stringify(fixture.lessons));
 check(prefix+' no preview writes',await page.evaluate(()=>window.testWrites.length===0));
 await page.locator('[data-private-calendar-view="week"]').click();check(prefix+' Week retained',await page.locator('.saved-agenda>.saved-calendar-day').count()===7);
}
async function verifyOutlookInterface(page,width,prefix,fixture){
 let original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const open=async()=>{await page.locator('[data-outlook-open]').click();};
 const submit=async()=>{await page.locator('[data-build-schedule-form] button[type="submit"]').click();};
 const build=async()=>{await open();await page.locator('[data-outlook-use-focus]').click();await submit();};
 check(prefix+' default four-week focus horizon',await page.locator('[data-outlook-weeks]').inputValue()==='4'&&(await page.locator('.outlook-window').innerText()).includes(fixture.course.first_day));
 check(prefix+' all three textual certainty tiers',await page.locator('.outlook-legend > span').count()===3);
 await open();check(prefix+' Build configuration receives keyboard focus',await page.locator('#build-config-title').evaluate(e=>e===document.activeElement));
 check(prefix+' anchor is explicit and initially blank',await page.locator('[data-build-schedule-form] [name="startDate"]').inputValue()==='');
 await page.locator('[data-outlook-use-focus]').click();check(prefix+' Use selected date is an explicit anchor action',await page.locator('[data-build-schedule-form] [name="startDate"]').inputValue()===fixture.course.first_day);
 await submit();check(prefix+' Build result is unsaved and focused',(await page.locator('#build-schedule-title').innerText()).includes('ready to inspect')&&await page.locator('#build-schedule-title').evaluate(e=>e===document.activeElement));
 check(prefix+' whole-course capacity is always disclosed',(await page.locator('[data-build-result]').innerText()).includes('Whole-course capacity · all active units'));
 check(prefix+' near-term forecast reaches calendar',await page.locator('.saved-day-events [data-tentative-placement]').count()>0);
 check(prefix+' no writing action in prototype',await page.locator('.planning-outlook').getByRole('button',{name:/^(Apply|Save|Confirm)$/}).count()===0);
 await page.locator('.outlook-milestones summary').click();check(prefix+' estimated unit milestones visible',(await page.locator('.outlook-milestones').innerText()).includes('estimated — unsaved'));
 check(prefix+' saved protected assessment stays distinct',(await page.locator('.outlook-milestones').innerText()).includes('protected saved anchor'));
 await page.locator('.planning-outlook').screenshot({path:resolve(out,prefix+'-three-tier-proposal.png')});
 await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-month-overlay.png')});
 for(const weeks of [2,6,4]){
  await page.locator('[data-outlook-weeks]').selectOption(String(weeks));
  const end=addCalendarDays(fixture.course.first_day,weeks*7-1);
  check(prefix+' '+weeks+' week horizon is selected-date anchored',(await page.locator('.outlook-window').innerText()).includes(end));
  check(prefix+' no distant daily clutter at '+weeks+' weeks',await page.locator('.saved-calendar-day').evaluateAll((nodes,end)=>nodes.every(n=>!n.querySelector('[data-tentative-placement]')||n.querySelector('[data-private-calendar-day]').dataset.privateCalendarDay<=end),end));
 }
 const forecastDate=await page.locator('.saved-calendar-day').filter({has:page.locator('[data-tentative-placement]')}).first().locator('[data-private-calendar-day]').getAttribute('data-private-calendar-day');
 await page.locator('[data-private-calendar-day="'+forecastDate+'"]').first().click();
 check(prefix+' mobile/desktop day detail explicitly labels tentative unsaved work',(await page.locator('#saved-day-details').innerText()).includes('Tier 2 · Tentative — unsaved'));
 check(prefix+' selected forecast date retains keyboard focus',await page.locator('[data-private-calendar-day="'+forecastDate+'"]').first().evaluate(e=>e===document.activeElement));
 await page.locator('[data-outlook-layer="tentative"]').uncheck();check(prefix+' tentative layer hides reversibly',await page.locator('[data-tentative-placement]').count()===0);
 await page.locator('[data-outlook-layer="tentative"]').check();check(prefix+' tentative layer restores',await page.locator('[data-tentative-placement]').count()>0);
 await page.locator('[data-outlook-layer="confirmed"]').uncheck();check(prefix+' confirmed visibility does not rewrite its saved arrays',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 await page.locator('[data-outlook-layer="confirmed"]').check();
 await page.locator('[data-outlook-layer="milestones"]').uncheck();check(prefix+' milestone layer hides',await page.locator('.outlook-milestones').count()===0);await page.locator('[data-outlook-layer="milestones"]').check();
 await page.locator('[data-private-calendar-view="week"]').click();check(prefix+' Week supports same tentative layer',await page.locator('.saved-agenda [data-tentative-placement]').count()>0);
 const sharedId=await page.locator('.saved-day-events [data-tentative-placement] [data-private-lesson]').first().getAttribute('data-private-lesson');
 await page.locator('.saved-day-events [data-tentative-placement] [data-private-lesson]').first().click();check(prefix+' tentative link opens same saved lesson',await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===sharedId);
 await page.locator('[data-private-tab="calendar"]').click();check(prefix+' leaving Calendar discards forecast',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await page.locator('[data-private-calendar-view="month"]').click();await build();
 await page.locator('[data-build-schedule-form] [name="startDate"]').fill(addCalendarDays(await page.locator('[data-build-schedule-form] [name="startDate"]').inputValue(),1));check(prefix+' configuration edit discards old result and overlays',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await page.locator('[data-outlook-use-focus]').click();await submit();await page.locator('[data-build-schedule-form] [name="unitId"]').selectOption(fixture.units[0].id);check(prefix+' scope change invalidates whole-course forecast',await page.locator('[data-build-result]').count()===0);await submit();check(prefix+' focused unit retains whole-course capacity context',(await page.locator('[data-build-result]').innerText()).includes('Whole-course capacity · all active units'));
 const externallyChanged=JSON.parse(original);externallyChanged.units[0].revision++;original=JSON.stringify(externallyChanged);
 await page.evaluate(()=>{window.testDb.units[0].revision++;window.testAuthEvent('TOKEN_REFRESHED');});
 await page.locator('[data-build-result]').waitFor({state:'detached'});
 check(prefix+' authoritative background refresh discards stale forecast',(await page.locator('.planning-outlook').innerText()).includes('Saved inputs changed'));
 await build();await page.locator('[data-private-reload]').click();check(prefix+' reload discards all forecast state',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-build-schedule-form]').count()===0&&(await page.locator('.planning-outlook').innerText()).includes('Saved data reloaded'));
 await build();await page.locator('[data-event-open=""]').click();check(prefix+' event proposal remains separate and discards Build forecast',await page.locator('[data-event-preview-form]').count()===1&&await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await page.locator('[data-event-preview-form]').getByRole('button',{name:'Cancel proposal',exact:true}).click();await build();await page.locator('[data-outlook-saved-only]').click();
 check(prefix+' Saved-only restores confirmed layer and closes forecasts',await page.locator('[data-outlook-layer="confirmed"]').isChecked()&&!(await page.locator('[data-outlook-layer="tentative"]').isChecked())&&!(await page.locator('[data-outlook-layer="milestones"]').isChecked())&&await page.locator('[data-build-result]').count()===0);
 await open();await page.locator('[data-private-calendar-day]').first().press('Escape');check(prefix+' Escape from calendar cancels and restores Build focus',await page.locator('[data-build-schedule-form]').count()===0&&await page.locator('[data-outlook-open]').evaluate(e=>e===document.activeElement));
 check(prefix+' desktop/mobile no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(prefix+' all new controls perform zero writes',await page.evaluate(()=>window.testWrites.length===0));
 check(prefix+' controls preserve records apart from deliberate external revision',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 const downloaded=page.waitForEvent('download');await page.locator('[data-private-export]').click();const json=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));check(prefix+' export excludes hypothetical data',JSON.stringify(json.lessons)===JSON.stringify(fixture.lessons)&&JSON.stringify(json.calendarExceptions)===JSON.stringify(fixture.exceptions));
 // Switch to another owner-scoped fictional course without creating a real row.
 await page.evaluate(({id})=>{window.testDb.courses.push({...window.testDb.courses[0],id,name:'Another fictional preview course'});window.testAuthEvent('TOKEN_REFRESHED');},{id:previewId(888)});
 await page.locator('[data-private-open="'+previewId(888)+'"]').waitFor();await page.locator('[data-private-open="'+previewId(888)+'"]').click();await page.locator('[data-private-tab="calendar"]').click();
 check(prefix+' course switch has no old proposal or layer preferences',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-outlook-weeks]').inputValue()==='4'&&await page.locator('[data-outlook-layer="tentative"]').isChecked());
}
async function verifySampleInterface(page,width,prefix,fixture){
 const original=await page.evaluate(()=>JSON.stringify(window.testDb));
 const ownerHeader=await page.locator('.private-header').innerText();
 await page.locator('[data-outlook-weeks]').selectOption('6');
 const reads=await page.evaluate(()=>window.testReads.length);
 const enter=async()=>page.locator('[data-build-sample-open]').click();
 const submit=async()=>page.locator('[data-build-schedule-form] button[type="submit"]').click();
 const build=async()=>{if(!await page.locator('[data-build-schedule-form]').count())await page.locator('[data-outlook-open]').click();await page.locator('[data-outlook-use-focus]').click();await submit();};
 await enter();
 check(prefix+' sample heading focused and provenance unmistakable',await page.locator('#build-sample-title').evaluate(e=>e===document.activeElement)&&(await page.locator('#build-sample-title').innerText()).includes('NOT your saved course'));
 check(prefix+' independent sample totals',(await page.locator('.private-header').innerText()).includes('3 unit(s) · 12 lesson(s) · 3 calendar exception(s)'));
 check(prefix+' sample reset and return are touch-sized',await page.locator('[data-build-sample-reset],[data-build-sample-return]').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().height>=44)));
 check(prefix+' no authoring, export, event proposal or reload controls',await page.locator('#private-workspace [data-private-save],#private-workspace [data-private-create],#private-workspace [data-private-export],#private-workspace [data-event-open],#private-workspace [data-private-reload],#private-workspace [data-private-tab]').count()===0);
 check(prefix+' sample cannot replace active owner identity',await page.evaluate(async id=>(await import('./private-workspace.js')).activePrivateCourseId()===id,fixture.course.id));
 check(prefix+' anchor blank despite known sample date',await page.locator('[name="startDate"]').inputValue()==='');
 check(prefix+' sample preferences start independently',await page.locator('[data-outlook-weeks]').inputValue()==='4');
 await build();
 check(prefix+' successful real Build result',(await page.locator('#build-schedule-title').innerText()).includes('ready to inspect'));
 check(prefix+' four confirmed eight tentative zero unresolved',(await page.locator('[data-build-result]').innerText()).includes('4 confirmed saved lesson(s) · 8 tentative lesson(s)')&&(await page.locator('[data-build-result]').innerText()).includes('0 not assessed · 0 unplaceable'));
 check(prefix+' all twelve comparisons present',await page.locator('[data-build-row]').count()===12);
 check(prefix+' seven near-term tentative day entries',await page.locator('.saved-month .saved-day-events [data-tentative-placement]').count()===7);
 check(prefix+' closure and occupied date excluded',await page.locator('[data-private-calendar-day="2026-09-07"]').getAttribute('aria-label').then(t=>!t.includes('Tentative'))&&await page.locator('[data-private-calendar-day="2026-09-15"]').getAttribute('aria-label').then(t=>!t.includes('Tentative')));
 await page.locator('.outlook-milestones summary').click();
 const milestones=await page.locator('.outlook-milestones').innerText();
 check(prefix+' three estimated unit ranges',await page.locator('[data-milestone-unit]').evaluateAll(nodes=>nodes.length===3&&nodes.every(n=>n.textContent.includes('estimated — unsaved'))));
 check(prefix+' distant October milestone without September daily clutter',milestones.includes('2026-10-19 → 2026-10-23')&&!await page.locator('.saved-month [data-tentative-placement="sample-lesson-10"]').count());
 check(prefix+' distinct protected and estimated assessment anchors',milestones.includes('protected saved anchor')&&milestones.includes('2026-10-23'));
 await page.locator('.private-header').screenshot({path:resolve(out,prefix+'-sample-provenance.png')});
 await page.locator('.planning-outlook').screenshot({path:resolve(out,prefix+'-success-outlook.png')});
 await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-success-month.png')});
 for(const weeks of [2,6,4]){await page.locator('[data-outlook-weeks]').selectOption(String(weeks));check(prefix+' sample '+weeks+' week lens',(await page.locator('.outlook-window').innerText()).includes(addCalendarDays('2026-09-01',weeks*7-1)));}
 await page.locator('[data-private-calendar-day="2026-09-03"]').click();
 check(prefix+' tentative lesson in mobile/desktop detail',(await page.locator('#saved-day-details').innerText()).includes('Tier 2 · Tentative — unsaved')&&(await page.locator('#saved-day-details').innerText()).includes('Sample lesson 3'));
 await page.locator('.outlook-comparisons summary').click();check(prefix+' complete multi-day proposal visible',(await page.locator('[data-build-row="sample-lesson-3"]').innerText()).includes('2026-09-03, 2026-09-04'));
 await page.locator('#saved-day-details [data-private-lesson="sample-lesson-3"]').click();
 check(prefix+' same fixture lesson read-only reference',(await page.locator('.build-sample-lesson').innerText()).includes('sample-lesson-3')&&await page.locator('[data-private-save]').count()===0);
 check(prefix+' opening reference keeps forecast',await page.locator('[data-build-result]').count()===1);
 await page.locator('[data-build-sample-close-lesson]').click();
 await page.locator('[data-outlook-layer="tentative"]').uncheck();check(prefix+' sample tentative layer hides',await page.locator('[data-tentative-placement]').count()===0);await page.locator('[data-outlook-layer="tentative"]').check();
 await page.locator('[data-private-calendar-view="week"]').click();check(prefix+' Week reuses sample tentative projection',await page.locator('.saved-agenda [data-tentative-placement]').count()>0);
 await page.locator('[data-private-calendar-view="month"]').click();await page.locator('[data-private-calendar-period="1"]').click();await page.locator('[data-private-calendar-day="2026-10-19"]').click();
 check(prefix+' focus reveals four October tentative dates',await page.locator('.saved-month .saved-day-events [data-tentative-placement]').count()===4);
 check(prefix+' display focus never rewrites explicit scheduling anchor',await page.locator('[name="startDate"]').inputValue()==='2026-09-01');
 await page.locator('[data-build-sample-reset]').click();check(prefix+' Reset clears proposals and returns sample start',await page.locator('[data-build-result]').count()===0&&await page.locator('[name="startDate"]').inputValue()===''&&(await page.locator('.outlook-window').innerText()).includes('2026-09-01'));
 await build();await page.locator('[data-outlook-saved-only]').click();check(prefix+' saved-only cancels sample projections',await page.locator('[data-build-result]').count()===0&&await page.locator('[data-tentative-placement]').count()===0);
 await page.locator('[data-build-sample-reset]').click();await build();
 await page.locator('[data-build-schedule-form] [name="unitId"]').selectOption('sample-unit-1');check(prefix+' scope edit invalidates sample forecast',await page.locator('[data-build-result]').count()===0);await submit();check(prefix+' scoped sample respects whole-course unresolved dependency',(await page.locator('[data-build-result]').innerText()).includes('Whole-course capacity · all active units')&&(await page.locator('[data-build-result]').innerText()).includes('not assessed'));
 await page.locator('[data-build-sample-reset]').click();await build();
 // A stale authoring form cannot bypass the sample guard; local test DOM only.
 await page.evaluate(id=>{const f=document.createElement('form');f.dataset.privateSave='lessons';f.dataset.id=id;document.getElementById('private-workspace').append(f);f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.remove();},fixture.lessons[0].id);
 check(prefix+' stale ordinary submit explicitly blocked',(await page.locator('#private-status').innerText()).includes('read-only. Nothing was saved'));
 await page.locator('[data-build-sample-return]').click();
 check(prefix+' one-click return restores owner header and preferences',await page.locator('.private-header').innerText()===ownerHeader&&await page.locator('[data-outlook-weeks]').inputValue()==='6');
 check(prefix+' return restores owner entry focus and no sample state',await page.locator('[data-build-sample-open]').evaluate(e=>e===document.activeElement)&&await page.locator('[data-build-result],.build-sample-notice,[data-private-lesson^="sample-"]').count()===0);
 check(prefix+' sample exploration performs zero reads or writes',await page.evaluate(reads=>window.testReads.length===reads&&window.testWrites.length===0,reads));
 check(prefix+' byte-identical saved records after sample',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
 await enter();await page.locator('[data-private-calendar-day="2026-09-01"]').press('Escape');check(prefix+' first Escape cancels config but retains sample',await page.locator('.build-sample-notice').count()===1&&await page.locator('[data-build-schedule-form]').count()===0);
 await page.locator('[data-outlook-open]').press('Escape');check(prefix+' second Escape returns to saved course',await page.locator('[data-build-sample-open]').count()===1);
 await enter();await page.locator('[data-outlook-close]').first().click();check(prefix+' Cancel does not exit sample',await page.locator('.build-sample-notice').count()===1&&await page.locator('[data-build-schedule-form]').count()===0);
 await page.locator('[data-build-sample-return]').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-private-export]').click();const json=JSON.parse(await readFile(await (await downloadPromise).path(),'utf8'));check(prefix+' owner export contains no fixture data',JSON.stringify(json.lessons)===JSON.stringify(fixture.lessons)&&JSON.stringify(json.course)===JSON.stringify(fixture.course));
 await enter();await build();await page.evaluate(()=>window.testAuthEvent('TOKEN_REFRESHED'));await page.locator('.build-sample-notice').waitFor({state:'detached'});
 check(prefix+' authoritative owner reload safely exits sample',await page.locator('.private-header').innerText()===ownerHeader&&await page.locator('[data-build-result]').count()===0);
 check(prefix+' sample never fetched from database',await page.evaluate(()=>window.testReads.every(r=>r.filters.every(([,v])=>!String(v).startsWith('sample-')))&&window.testWrites.length===0));
 check(prefix+' mobile/desktop overflow-free',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 check(prefix+' owner records unchanged including after reload',await page.evaluate(original=>JSON.stringify(window.testDb)===original,original));
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
 for(const [fixtureName,fixture] of [['sample',scheduleFixture()],['preview',scheduleFixture()],['outlook',buildOutlookFixture()],['outlook-long',(()=>{const s=fullyScheduled80Fixture();s.lessons.slice(1).forEach(l=>{l.scheduled_dates=[];l.protected_pin_date=null;});return s;})()],['complete-80',fullyScheduled80Fixture()],['partial',(()=>{const s=scheduleFixture();s.lessons[3].scheduled_dates=[];return s;})()],['synthetic',synthetic],['archived',archived],...(stored?[['stored-fictional',stored]]:[])].filter(([name])=>!process.env.COURSE_PLANNER_BROWSER_FIXTURES||process.env.COURSE_PLANNER_BROWSER_FIXTURES.split(',').includes(name))){
  const expected=buildCalendarModel(fixture);
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});context.setDefaultTimeout(20000);
   console.log('Checking '+fixtureName+' at '+width+'px');
   await context.addInitScript(({fixture,probeAuth})=>{
    const snapshot=structuredClone(fixture);const owner=fixture.course.owner_id;
    const db={courses:[fixture.course],units:fixture.units,lessons:fixture.lessons,calendar_exceptions:fixture.exceptions};
    if(probeAuth)db.courses.push(...[41,42].map(n=>({...fixture.course,id:'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),name:'Fictional additional course '+n})));
    window.testHoldCourseLists=probeAuth;window.testPendingCourseLists=[];
    window.testDb=db;window.testReads=[];window.testWrites=[];window.testSnapshot=snapshot;window.rejectWrites=false;
    const client={auth:{async getSession(){return {data:{session:{user:{id:owner,email:'fictional@example.test'}}}};},async getUser(){return {data:{user:{id:owner}}};},onAuthStateChange(fn){window.testAuthEvent=fn;},async signOut(){return {};}}};
    client.from=table=>{
     const filters=[];let patch=null,columns='*',bounds=null;
     const chain={select(c='*'){columns=c;return chain;},eq(k,v){filters.push([k,v]);return chain;},order(){return chain;},range(start,end){bounds=[start,end];return chain;},update(p){patch=p;return chain;},
      async single(){const r=await run();return {...r,data:r.data?.[0]||null};},async maybeSingle(){const r=await run();return {...r,data:r.data?.[0]||null};},then(a,b){return run().then(a,b);}};
     async function run(){
      if(!patch)window.testReads.push({table,filters});
      let rows=db[table].filter(x=>filters.every(([k,v])=>x[k]===v));
      if(table==='courses')rows=rows.filter(x=>x.owner_id===owner);
      else rows=rows.filter(x=>db.courses.some(c=>c.id===x.course_id&&c.owner_id===owner));
      if(patch){window.testWrites.push({table,patch});if(window.rejectWrites)return {data:null,error:{message:'Test network failure'}};rows.forEach(x=>Object.assign(x,patch,{revision:(x.revision||1)+1}));}
      if(bounds)rows=rows.slice(bounds[0],bounds[1]+1);
      const response={data:structuredClone(rows.map(x=>columns==='*'?x:Object.fromEntries(columns.split(',').map(k=>[k,x[k]])))),error:null};
      if(window.testHoldCourseLists&&table==='courses'&&columns==='id,name,revision,updated_at')return new Promise(resolve=>window.testPendingCourseLists.push(()=>resolve(response)));
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
   await page.locator('[data-private-tab="calendar"]').click();
   await page.locator('.saved-month').waitFor();
   const prefix=`${fixtureName}-${width}`;
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
    await page.locator('[data-outlook-open]').click();await page.locator('[data-outlook-use-focus]').click();await page.locator('[data-build-schedule-form] button[type="submit"]').click();
    check(prefix+' incomplete 80-lesson Build is honest',(await page.locator('[data-build-result]').innerText()).includes('6 already unscheduled')&&(await page.locator('[data-build-result]').innerText()).includes('unresolved work'));
    check(prefix+' Build never shifts saved dates',await page.locator('[data-build-result] [data-build-row]').evaluateAll(rows=>rows.filter(r=>r.querySelector('dd').textContent!=='Unscheduled — saved').every(r=>r.querySelectorAll('dd')[0].textContent===r.querySelectorAll('dd')[1].textContent)));
    check(prefix+' impossible baseline has no fabricated overlay',await page.locator('[data-tentative-placement]').count()===0);
    await page.locator('.planning-outlook').screenshot({path:resolve(out,prefix+'-incomplete-build.png')});await page.locator('[data-outlook-close]').last().click();
   }
   await page.locator('[data-event-open=""]').click();await page.locator('[data-event-preview-form] [name="title"]').fill('Fictional 80-lesson preview probe');await page.locator('[data-event-preview-form] button[type="submit"]').click();
   check(prefix+' large-course blocked baseline is explicit',(await page.locator('#scheduling-preview-title').innerText()).includes(fixtureName==='stored-fictional'?'Partial preview — overall blocked':'Blocked preview'));
   if(fixtureName==='stored-fictional')check(prefix+' stored incomplete boundary disclosed',(await page.locator('[aria-labelledby="scheduling-preview-title"]').innerText()).includes('not assessed')) ;
   check(prefix+' preview form performs zero writes',await page.evaluate(()=>window.testWrites.length===0));
   await page.locator('[aria-labelledby="scheduling-preview-title"]').getByRole('button',{name:'Close preview',exact:true}).click();
   check(prefix+' month/weekday structure',await page.locator('.saved-weekdays span').count()===7);
   check(prefix+' persisted totals displayed',(await page.locator('.private-header').innerText()).includes('80 lesson(s) · 12 calendar exception(s)'));
   const firstDate=expected.lessons.flatMap(l=>l.scheduled_dates||[]).sort()[0]||fixture.course.first_day;
   await page.locator(`[data-private-calendar-day="${firstDate}"]`).first().click();
   check(prefix+' day detail saved stable IDs',await page.locator(`#saved-day-details [data-private-lesson="${expected.days[firstDate].lessons[0].id}"]`).count()>0);
   check(prefix+' mobile day targets and compact month',width!==390||await page.locator('.saved-month [data-private-calendar-day]').first().evaluate(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44));
   check(prefix+' month no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-month.png')});
   await page.locator('[data-private-calendar-view="week"]').click();
   await checkArchives('Agenda');
   check(prefix+' local week toggle',await page.locator('.saved-agenda>.saved-calendar-day').count()===7&&await page.locator('[data-private-tab="calendar"][aria-pressed=true]').count()===1);
   check(prefix+' agenda no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   check(prefix+' toolbar focus survives rerender',await page.locator('[data-private-calendar-view="week"]').evaluate(e=>e===document.activeElement));
   const previous=await page.locator('.saved-calendar-toolbar h3').innerText();
   await page.locator('[data-private-calendar-period="1"]').click();
   check(prefix+' next week navigation',await page.locator('.saved-calendar-toolbar h3').innerText()!==previous);
   await page.locator('[data-private-calendar-period="-1"]').click();
   const dayButton=page.locator(`[data-private-calendar-day="${firstDate}"]`).first();
   await dayButton.focus();await page.keyboard.press('ArrowRight');
   check(prefix+' keyboard date and focus',await page.locator(`[data-private-calendar-day="${addCalendarDays(firstDate,1)}"]`).first().evaluate(e=>e===document.activeElement));
   await page.locator(`[data-private-calendar-day="${firstDate}"]`).first().click();
   await page.locator('.saved-calendar-layout').screenshot({path:resolve(out,prefix+'-week.png')});
   check(prefix+' all calendar actions have zero mutations',await page.evaluate(()=>window.testWrites.length===0));
   const chosen=expected.days[firstDate].lessons[0];
   await page.locator(`#saved-day-details [data-private-lesson="${chosen.id}"]`).first().click();
   check(prefix+' same lesson editor ID',await page.locator(`[data-private-save="lessons"][data-id="${chosen.id}"]`).count()===1);
   check(prefix+' lesson editor receives focus',await page.locator('[data-private-save="lessons"] input[name="title"]').evaluate(e=>e===document.activeElement));
   await page.locator('[name="objective"]').fill('Fictional acceptance draft');
   page.once('dialog',d=>d.dismiss());await page.locator('[data-private-tab="calendar"]').click();
   check(prefix+' unsaved guard preserves draft',await page.locator('[name="objective"]').inputValue()==='Fictional acceptance draft');
   if(fixtureName==='synthetic'||fixtureName==='archived'){
    // Actual save/reopen and conflict paths, backed by the test client only.
    await page.locator('[data-private-save="lessons"] button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('private-status').textContent.includes('Saved and verified'));
    await page.locator('[data-private-reload]').click();
    check(prefix+' save/reopen',await page.locator('[name="objective"]').inputValue()==='Fictional acceptance draft');
    await page.locator('[name="objective"]').fill('Newer fictional draft');
    await page.evaluate(id=>{window.testDb.lessons.find(l=>l.id===id).revision++;},chosen.id);
    await page.locator('[data-private-save="lessons"] button[type="submit"]').click();
    await page.waitForFunction(()=>document.getElementById('private-status').textContent.includes('Save conflict'));
    check(prefix+' stale conflict preserves draft',await page.locator('[name="objective"]').inputValue()==='Newer fictional draft');
    page.once('dialog',d=>d.accept());await page.locator('[data-private-tab="calendar"]').click();
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-private-export]').click();const download=await downloadPromise;
    const json=JSON.parse(await readFile(await download.path(),'utf8'));
    check(prefix+' JSON export retains complete archived records',hiddenLessons.every(l=>JSON.stringify(json.lessons.find(x=>x.id===l.id))===JSON.stringify(l))&&fixture.units.filter(u=>u.archived_at!=null).every(u=>JSON.stringify(json.units.find(x=>x.id===u.id))===JSON.stringify(u)));
    check(prefix+' one-course export schedule/identity',json.lessons.length===80&&json.calendarExceptions.length===12&&json.lessons[0].id===fixture.lessons[0].id);
    await page.locator('#restore-details summary').click();
    await page.locator('#restore-file').setInputFiles({name:'fictional-export.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
    page.once('dialog',d=>d.accept());await page.locator('#restore-form button').click();
    await page.waitForFunction(()=>document.getElementById('restore-status').textContent.includes('Restore complete'));
    check(prefix+' import opens separate restored course',await page.evaluate(original=>window.testDb.courses.length===2&&window.testDb.courses[0].id===original,fixture.course.id));
    const zipPromise=page.waitForEvent('download');await page.locator('#backup-all').click();const zip=await zipPromise;
    const bytes=await readFile(await zip.path());check(prefix+' account ZIP browser download',bytes.readUInt32LE(0)===0x04034b50&&bytes.includes(Buffer.from('backup-manifest.json')));
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const files=[];let offset=0;
    while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+nameLength+extra;files.push({name:bytes.subarray(offset+30,offset+30+nameLength).toString(),value:JSON.parse(bytes.subarray(start,start+size).toString())});offset=start+size;}
    const originalBackup=files.find(f=>f.value.course?.id===fixture.course.id)?.value;
    check(prefix+' ZIP retains archived records',hiddenLessons.every(l=>JSON.stringify(originalBackup.lessons.find(x=>x.id===l.id))===JSON.stringify(l))&&fixture.units.filter(u=>u.archived_at!=null).every(u=>JSON.stringify(originalBackup.units.find(x=>x.id===u.id))===JSON.stringify(u)));
    if(fixtureName==='archived'){
     check(prefix+' active calendar excludes archived unscheduled work',(await page.locator('.private-content').innerText()).includes('Unscheduled lessons (0)'));
     check(prefix+' archive filtering leaves all underlying records',await page.evaluate(()=>window.testDb.lessons.length===160&&window.testDb.units.length===10));
     check(prefix+' restored copy retains lesson archive flags',await page.evaluate(()=>window.testDb.lessons.filter(l=>l.archived_at!=null).length===8));
    }
    check(prefix+' ZIP includes original and restored course',files.length===3&&files.find(f=>f.name==='backup-manifest.json').value.courseCount===2);
   }else{
    page.once('dialog',d=>d.accept());await page.locator('[data-private-tab="calendar"]').click();
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
 await page.locator('[data-event-open=""]').click();await page.locator('[data-event-preview-form] [name="title"]').fill('Fictional empty-course event');await page.locator('[data-event-preview-form] button[type="submit"]').click();
 check('empty first course preview explains missing term',(await page.locator('[aria-labelledby="scheduling-preview-title"]').innerText()).includes('Set valid inclusive term bounds'));
 check('empty preview invents no lesson placements',await page.locator('[data-preview-row]').count()===0);
 await page.locator('.private-workspace').screenshot({path:resolve(out,'empty-first-course.png')});await context.close();
 check('no uncaught browser errors',errors.length===0);
 await writeFile(resolve(out,'browser-results.json'),JSON.stringify({checks,errors,storedFixtureTested:!!stored},null,2));
 console.log(JSON.stringify({passed:checks.length,errors,storedFixtureTested:!!stored,output:out},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
