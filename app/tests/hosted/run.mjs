import {resolve} from 'node:path';
import {options,secureDirectory,privateDir,privateRead,privateWrite,fixturePath,sessionPath,launch,guard,verifySource,verifiedAccount,saveSession,ready,acquireLock} from './runtime.mjs';
import {demand,fingerprint,counts,canonical} from './safety.mjs';
import {readonlyJourney,draftJourney,openLesson,objective} from './journeys.mjs';
const report={kind:'authenticated-hosted-acceptance',startedAt:new Date().toISOString(),status:'BLOCKED',steps:[],modes:{readonly:'NOT_RUN',draft:'NOT_RUN'},integrity:{status:'NOT_CHECKED'},cleanup:'NOT_NEEDED'};
let browser,context,page,fixture,before,opts,currentStep='configuration',authenticated=false,draftStarted=false,out,blocked=[],pageErrors=0,httpFailures=0,release;
async function step(name,action){currentStep=name;try{const details=await action();report.steps.push({name,status:'PASS',...(details?{details}:{})});console.log('PASS '+name);}catch{console.error('FAIL '+name);report.steps.push({name,status:'FAIL'});throw new Error('STEP_FAILED');}}
async function newContext(){
 const c=await browser.newContext({storageState:await privateRead(sessionPath),serviceWorkers:'block',acceptDownloads:true,viewport:{width:1440,height:1000}});
 const attempts=await guard(c,opts);blocked.push(attempts);const p=await c.newPage();p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(30000);
 p.on('pageerror',()=>pageErrors++);p.on('response',r=>{if(r.status()>=400)httpFailures++;});
 p.on('dialog',d=>{if(!['B.cancel-discard-preserves-draft','B.explicit-discard'].includes(currentStep)){void d.dismiss();pageErrors++;}});
 return {context:c,page:p};
}
async function closeContext(){if(context){await saveSession(context,opts.url);await context.close();context=null;page=null;}}
async function screenshot(label){
 if(authenticated&&process.env.HOSTED_SCREENSHOTS==='1'){
  // Element-only capture excludes account UI and browser address bar. Editors are masked.
  const region=page.locator('#private-workspace');if(await region.isVisible())await region.screenshot({path:resolve(out,label+'.png'),mask:[page.locator('input,textarea,.pilot-auth')],timeout:5000});
 }
}
try{
 opts=options();report.target={url:opts.url,sha:opts.sha};await secureDirectory();release=await acquireLock();out=resolve(privateDir,'runs',new Date().toISOString().replace(/[:.]/g,'-'));await secureDirectory(out);
 fixture=await privateRead(fixturePath);await privateRead(sessionPath);browser=await launch();({context,page}=await newContext());
 await step('deployment-source',async()=>{report.sourceFilesChecked=await verifySource(context,opts);});
 await step('authenticated-account-and-four-approved-courses',async()=>{await page.goto(opts.url);await ready(page);before=await verifiedAccount(page,fixture);authenticated=true;report.integrity.before=fingerprint(before);report.counts=before.map((s,i)=>({course:i+1,...counts(s)}));});
 if(['all','readonly'].includes(opts.mode)){
  report.modes.readonly='FAIL';await readonlyJourney(page,before,step);report.modes.readonly='PASS';await screenshot('readonly');
 }
 await closeContext();
 if(['all','draft'].includes(opts.mode)){
  ({context,page}=await newContext());currentStep='B.context-identity';await page.goto(opts.url);await ready(page);demand(fingerprint(await verifiedAccount(page,fixture))===fingerprint(before),'BASELINE_DRIFT');
  draftStarted=true;report.cleanup='PENDING';report.modes.draft='FAIL';await draftJourney(page,before,fixture,step);report.modes.draft='PASS';report.cleanup='UI_DISCARD_VERIFIED';await screenshot('draft-discarded');await closeContext();
 }
 report.status='PASS';
}catch(e){
 report.status=before?'FAIL':'BLOCKED';report.failure={step:currentStep,code:e.code==='ENOENT'?'ONE_TIME_SETUP_REQUIRED':(['INVALID_ARGUMENT','INVALID_MODE','PREVIEW_URL_REQUIRED','EXACT_COMMIT_REQUIRED','DEPLOYMENT_ACCESS_BLOCKED','DEPLOYMENT_SOURCE_MISMATCH'].includes(e.message)?e.message:'CHECK_FAILED'),diagnostic:'Raw errors, URLs, headers, console text and page HTML intentionally omitted. Review this named step locally.'};
 try{await screenshot('failure');}catch{}
}finally{
 // Always destroy the draft context, then independently re-read in a fresh one.
 // No destructive cleanup or saved-data reverts are available in this harness.
 if(before){
  try{
   await closeContext();({context,page}=await newContext());currentStep='final-integrity';await page.goto(opts.url);await ready(page);
   const after=await verifiedAccount(page,fixture);report.integrity.after=fingerprint(after);
   demand(report.integrity.before===report.integrity.after,'SAVED_RECORDS_CHANGED');report.integrity.status='PASS';
   if(draftStarted){
    const s=before.find(s=>s.course.id===fixture.governmentCourseId);await openLesson(page,s.course.id,fixture.governmentLessonId);
    demand(await objective(page).inputValue()===(s.lessons[0].objective||''),'SAVED_OBJECTIVE_CHANGED');
    demand(!await page.evaluate(async()=>(await import('./private-workspace.js')).isPrivateWorkspaceDirty()),'FRESH_CONTEXT_DIRTY');
    report.cleanup=report.cleanup==='UI_DISCARD_VERIFIED'?'PASS':'CONTEXT_DISPOSED_SAVED_ORIGINAL_VERIFIED';
   }
   report.steps.push({name:'independent-final-integrity-and-clean-context',status:'PASS'});
  }catch{report.status='FAIL';report.integrity.status='UNVERIFIED';report.cleanup=draftStarted?'UNVERIFIED_STOP':'NOT_NEEDED';report.steps.push({name:'independent-final-integrity-and-clean-context',status:'FAIL'});}
 }
 try{await closeContext();}catch{report.status='FAIL';report.cleanup='UNVERIFIED_STOP';}
 await browser?.close();await release?.();
 report.blockedRequests=blocked.flat();report.pageErrorCount=pageErrors;report.httpFailureCount=httpFailures;
 if(report.blockedRequests.length||pageErrors||httpFailures)report.status='FAIL';
 report.finishedAt=new Date().toISOString();if(out)await privateWrite(resolve(out,'results.json'),report);
 console.log(canonical(report));process.exitCode=report.status==='PASS'?0:report.status==='BLOCKED'?2:1;
}
