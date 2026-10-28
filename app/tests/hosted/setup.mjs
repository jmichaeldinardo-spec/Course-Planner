import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {options,secureDirectory,launch,guard,verifySource,readAccount,saveSession,fixturePath,sessionPath,privateRead,privateWrite,ready,acquireLock} from './runtime.mjs';
import {demand,counts,validateSnapshots,fingerprint} from './safety.mjs';
const prompt=createInterface({input:stdin,output:stdout});let browser,release;
try{
 demand(stdin.isTTY,'INTERACTIVE_TERMINAL_REQUIRED');const opts=options();await secureDirectory();release=await acquireLock();
 let fixture;try{fixture=await privateRead(fixturePath);}catch(e){if(e.code!=='ENOENT')throw e;}
 const email=fixture?.email||(await prompt.question('Expected authorized fictional-data account email (kept locally): ')).trim();demand(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'EMAIL_REQUIRED');
 browser=await launch(false);let state;try{state=await privateRead(sessionPath);}catch(e){if(e.code!=='ENOENT')throw e;}
 const context=await browser.newContext({storageState:state,serviceWorkers:'block',acceptDownloads:false});const blocked=await guard(context,opts,{setup:true,expectedEmail:email});const page=await context.newPage();
 console.log('Use ONLY this new testing browser. Complete Vercel access there first; do not request application sign-in yet. Do not open school mail here or paste tokens into the terminal. No saves, creates, restores or sign-out.');
 await page.goto(opts.url);
 await prompt.question('After Vercel preview access is established, press Enter to verify deployment source. ');
 await verifySource(context,opts);
 console.log('Source verified. If needed, manually request ONE app sign-in email for the expected EXISTING account and open its fresh link in this same testing browser. Account creation is disabled by the setup request guard.');
 await prompt.question('After the app shows the expected signed-in account, press Enter. ');
 await ready(page);const result=await readAccount(page,email);validateSnapshots(result.snapshots);
 if(fixture){demand(fixture.accountId===result.accountId,'ACCOUNT_MISMATCH');validateSnapshots(result.snapshots,fixture);}
 else{
  console.log('Review these four course names LOCALLY. This list is not written into evidence:');
  result.snapshots.forEach((s,i)=>console.log(`${i+1}. ${s.course.name} (${s.units.length} units, ${s.lessons.length} lessons, ${s.exceptions.length} exceptions)`));
  const number=Number(await prompt.question('Number of the ORIGINAL fictional one-lesson Government course: '));const government=result.snapshots[number-1];
  demand(government&&government.lessons.length===1&&/government/i.test(government.course.name),'GOVERNMENT_SELECTION_REQUIRED');
  demand(await prompt.question('Type FICTIONAL to authorize these exact four courses for read-only and unsaved-draft testing: ')==='FICTIONAL','FICTIONAL_CONFIRMATION_REQUIRED');
  fixture={email,accountId:result.accountId,governmentCourseId:government.course.id,governmentLessonId:government.lessons[0].id,courses:result.snapshots.map(s=>({id:s.course.id,counts:counts(s)})),enrolledFingerprint:fingerprint(result.snapshots)};
  await privateWrite(fixturePath,fixture);
 }
 demand(blocked.length===0,'SETUP_BLOCKED_REQUEST');await saveSession(context,opts.url);await context.close();console.log('PASS: dedicated session and approved fixture saved privately. Run hosted acceptance next.');
}catch{console.error('BLOCKED: setup incomplete. Check the account, preview access, exact commit and fictional course selection; no raw authentication diagnostics retained.');process.exitCode=2;}
finally{prompt.close();await browser?.close();await release?.();}
