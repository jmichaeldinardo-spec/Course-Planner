import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {demand,validateExport,canonical,hash} from './safety.mjs';
import {validateZip} from './zip.mjs';
export const objective=page=>page.locator('#private-workspace [data-private-save="lessons"] [name="objective"]');
export async function selectCourse(page,id){
 await page.locator(`#saved-courses [data-private-open="${id}"]`).click();
 await page.waitForFunction(id=>document.querySelector('#workspace-course-name')?.dataset.courseId===id,id);
 await page.locator('#private-workspace .private-header').waitFor();
}
async function tab(page,name){await page.locator(`#workspace-navigation [data-private-tab="${name}"]`).click();await page.locator(`#workspace-navigation [data-private-tab="${name}"][aria-pressed="true"]`).waitFor();}
export async function openLesson(page,courseId,lessonId){
 await selectCourse(page,courseId);await tab(page,'lessons');
 await page.locator(`#private-workspace .private-primary [data-private-lesson="${lessonId}"]`).click();
 const select=page.locator('#private-workspace [data-private-select-lesson]');
 if(!await select.isVisible())await page.locator('#private-workspace [data-inspector-open]').click();
 await select.selectOption(lessonId);
 await page.locator(`#private-workspace [data-private-save="lessons"][data-id="${lessonId}"]`).waitFor();
}
async function actions(page){const details=page.locator('#private-workspace .course-actions');if(!await details.evaluate(e=>e.open))await details.locator('summary').click();}
async function dirty(page){return page.evaluate(async()=>(await import('./private-workspace.js')).isPrivateWorkspaceDirty());}
async function homeReturn(page){await page.locator('[data-global-home]').click();await page.locator('#private-home').waitFor();await page.getByRole('button',{name:/Continue Planning/}).click();await page.locator('#private-workspace .private-header').waitFor();}
async function reloadDialog(page,accept){
 await actions(page);
 const dialog=page.waitForEvent('dialog');const clicked=page.locator('[data-private-reload]').click();
 const d=await dialog;demand(d.type()==='confirm'&&d.message()==='Discard your unsaved edits and reload saved course data?','EXPECTED_DISCARD_DIALOG');
 if(accept)await d.accept();else await d.dismiss();await clicked;
}
export async function readonlyJourney(page,snapshots,step){
 for(let i=0;i<snapshots.length;i++){
  const s=snapshots[i];
  await step(`A.course-${i+1}.switch`,async()=>{await selectCourse(page,s.course.id);await tab(page,'overview');await page.locator('#private-workspace .course-overview').waitFor();});
  await step(`A.course-${i+1}.home-continue`,async()=>{await homeReturn(page);demand(await page.locator('#workspace-course-name').getAttribute('data-course-id')===s.course.id,'CONTINUE_COURSE');await page.locator('#private-workspace .course-overview').waitFor();});
  await step(`A.course-${i+1}.sequence-relationships`,async()=>{
   await tab(page,'sequence');
   const actual=await page.locator('#private-workspace .private-primary [data-private-lesson]').evaluateAll(es=>es.map(e=>e.dataset.privateLesson).sort());
   demand(canonical(actual)===canonical(s.lessons.map(l=>l.id).sort()),'SEQUENCE_LESSON_IDS');
  });
  await step(`A.course-${i+1}.unit-lesson-planning`,async()=>{
   await tab(page,'units');
   if(s.units.length){
    await page.locator(`#private-workspace .private-primary [data-private-unit="${s.units[0].id}"]`).click();
    const select=page.locator('[data-private-select-unit]');if(!await select.isVisible())await page.locator('#private-workspace [data-inspector-open]').click();
    for(const unit of s.units){await select.selectOption(unit.id);demand(await page.locator('[data-private-save="units"] [name="title"]').inputValue()===unit.title,'UNIT_EDITOR_TITLE');}
   }
   await tab(page,'lessons');
   if(s.lessons.length){
    await page.locator(`#private-workspace .private-primary [data-private-lesson="${s.lessons[0].id}"]`).click();
    const select=page.locator('[data-private-select-lesson]');if(!await select.isVisible())await page.locator('#private-workspace [data-inspector-open]').click();
    const ids=await select.locator('option').evaluateAll(es=>es.map(e=>e.value).sort());demand(canonical(ids)===canonical(s.lessons.map(l=>l.id).sort()),'LESSON_SELECTOR_IDS');
    const lesson=s.lessons[0],unit=s.units.find(u=>u.id===lesson.unit_id);await select.selectOption(lesson.id);
    demand(await objective(page).inputValue()===(lesson.objective||''),'SAVED_OBJECTIVE');
    demand((await page.locator('.private-context').innerText()).includes(unit.title),'LESSON_UNIT_CONTEXT');
   }
   demand(!await dirty(page),'READONLY_CREATED_DRAFT');
  });
  await step(`A.course-${i+1}.calendar-month-week`,async()=>{
   await tab(page,'calendar');
   const grid=page.locator('.saved-month'),label=await grid.getAttribute('aria-label');demand(await page.locator('.saved-month-days>.saved-calendar-day').count()>=28,'MONTH_GRID');
   await page.locator('[data-private-calendar-period="1"]').click();demand(await grid.getAttribute('aria-label')!==label,'MONTH_NEXT');
   await page.locator('[data-private-calendar-period="-1"]').click();demand(await grid.getAttribute('aria-label')===label,'MONTH_PREVIOUS');
   await page.locator('[data-private-calendar-view="week"]').click();demand(await page.locator('.saved-agenda>.saved-calendar-day').count()===7,'WEEK_GRID');
   const days=()=>page.locator('.saved-agenda [data-private-calendar-day]').evaluateAll(es=>es.map(e=>e.dataset.privateCalendarDay));
   const before=await days();await page.locator('[data-private-calendar-period="1"]').click();demand(canonical(await days())!==canonical(before),'WEEK_NEXT');
   await page.locator('[data-private-calendar-period="-1"]').click();demand(canonical(await days())===canonical(before),'WEEK_PREVIOUS');
   await page.locator('[data-private-calendar-view="month"]').click();await grid.waitFor();
  });
  await step(`A.course-${i+1}.json-export`,async()=>{
   await actions(page);const pending=page.waitForEvent('download');await page.locator('[data-private-export]').click();const download=await pending;
   try{demand(!await download.failure(),'JSON_DOWNLOAD');const bytes=await readFile(await download.path());validateExport(JSON.parse(bytes.toString('utf8')),s);return {sha256:hash(bytes),bytes:bytes.length};}finally{await download.delete();}
  });
 }
 await step('A.zip-export',async()=>{
  await page.locator('[data-workspace-settings]').click();const pending=page.waitForEvent('download');await page.locator('#backup-all').click();const download=await pending;
  let details;try{demand(!await download.failure(),'ZIP_DOWNLOAD');details=validateZip(await readFile(await download.path()),snapshots);}finally{await download.delete();}
  await page.locator('[data-settings-close]').click();return details;
 });
}
export async function draftJourney(page,snapshots,fixture,step){
 const s=snapshots.find(s=>s.course.id===fixture.governmentCourseId),lesson=s?.lessons[0];
 demand(s&&s.lessons.length===1&&lesson.id===fixture.governmentLessonId,'ONE_LESSON_GOVERNMENT_REQUIRED');
 const original=lesson.objective||'',marker='[HOSTED-DRAFT-'+randomUUID()+']',draft=original+'\n'+marker;
 const exact=async()=>demand(await objective(page).inputValue()===draft&&await dirty(page),'DRAFT_NOT_PRESERVED');
 await step('B.open-original-lesson',async()=>{await openLesson(page,s.course.id,lesson.id);demand(await objective(page).inputValue()===original&&!await dirty(page),'ORIGINAL_EDITOR_MISMATCH');});
 await step('B.unsaved-home-return',async()=>{await objective(page).fill(draft);await exact();await homeReturn(page);await exact();});
 await step('B.unsaved-course-return',async()=>{await selectCourse(page,snapshots.find(other=>other.course.id!==s.course.id).course.id);await selectCourse(page,s.course.id);await exact();});
 await step('B.cancel-discard-preserves-draft',async()=>{await reloadDialog(page,false);await exact();});
 await step('B.explicit-discard',async()=>{
  await reloadDialog(page,true);
  await page.waitForFunction(async()=>!(await import('./private-workspace.js')).isPrivateWorkspaceDirty());
  await openLesson(page,s.course.id,lesson.id);demand(await objective(page).inputValue()===original&&!await dirty(page),'DRAFT_CLEANUP_FAILED');
  await homeReturn(page);demand(await objective(page).inputValue()===original&&!await dirty(page),'DRAFT_REAPPEARED');
 });
 return {courseId:s.course.id,lessonId:lesson.id,original};
}
