// DEC-100. Synthetic regression only; never imports or runs the hosted harness.
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir,readdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.length>1||args.some(a=>a!=='--full')){console.error('Usage: node app/tests/qa.mjs [--full]');process.exit(2);}
const full=args.includes('--full'),stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=resolve(app,'reviews/technical-qa',stamp);
execFileSync('git',['check-ignore','--',resolve(out,'summary.json')],{cwd:app,stdio:'ignore'});
await mkdir(out,{recursive:true});
const env={...process.env};
for(const key of ['COURSE_PLANNER_CALENDAR_FIXTURE','COURSE_PLANNER_BROWSER_FIXTURES','COURSE_PLANNER_BROWSER_OUTPUT','VERCEL_OIDC_TOKEN'])delete env[key];
env.COURSE_PLANNER_BROWSER_OUTPUT=out;
if(!full)env.COURSE_PLANNER_BROWSER_FIXTURES='central-tabs,teacher-refresh,synthetic,home,dashboard';
const report={kind:'synthetic-technical-regression',profile:full?'full':'smoke',status:'FAIL',startedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:app,encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{cwd:app,encoding:'utf8'}).trim(),authenticatedHosted:'NOT_RUN',uxJudgment:'RESERVED_FOR_OWNER',stages:[]};
async function run(name,argv){
 const log=createWriteStream(resolve(out,name+'.log'));const started=Date.now();let pending='';
 const result=await new Promise(resolveRun=>{
  const child=spawn(process.execPath,argv,{cwd:app,env,stdio:['ignore','pipe','pipe'],timeout:full?1200000:600000});
  const output=data=>{log.write(data);pending+=data.toString();const lines=pending.split('\n');pending=lines.pop();for(const line of lines)if(line.startsWith('Checking '))console.log('SYNTHETIC '+line.slice(9));};
  child.stdout.on('data',output);child.stderr.on('data',output);
  child.on('error',error=>{log.write(error.message+'\n');});
  child.on('close',(code,signal)=>resolveRun({name,status:code===0?'PASS':'FAIL',exitCode:code,signal,durationMs:Date.now()-started,log:name+'.log'}));
 });
 await new Promise(done=>log.end(done));report.stages.push(result);return result;
}
try{
 const files=(await readdir(resolve(app,'tests'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
 if(!files.length)throw Error('No Node tests found');
 const node=await run('node',['--test','--test-reporter=tap',...files]);
 const nodeLog=await readFile(resolve(out,node.log),'utf8');node.tests=Number(nodeLog.match(/^# tests (\d+)/m)?.[1]||0);node.passed=Number(nodeLog.match(/^# pass (\d+)/m)?.[1]||0);
 if(node.tests===0||node.passed!==node.tests)node.status='FAIL';
 console.log(`${node.status} synthetic Node: ${node.passed}/${node.tests}`);
 if(node.status==='PASS'){
  const browser=await run('browser',['tests/calendar.browser.mjs']);
  try{const detail=JSON.parse(await readFile(resolve(out,'browser-results.json'),'utf8'));browser.checks=detail.checks.length;browser.passed=detail.checks.filter(c=>c.passed).length;browser.case=detail.case;browser.cases=detail.cases?.length;browser.failure=detail.failure;if(detail.status!=='PASS'||!browser.checks||browser.passed!==browser.checks||detail.authenticatedHosted!==false)browser.status='FAIL';}catch{browser.status='FAIL';}
  console.log(`${browser.status} synthetic browser: ${browser.passed||0}/${browser.checks||0}`);
  if(browser.status==='FAIL')console.error('Reason: '+(browser.failure?.split('\n')[0]||'See browser.log'));
 }
 report.status=report.stages.length===2&&report.stages.every(s=>s.status==='PASS')?'PASS':'FAIL';
}catch(error){report.failure=error.message;}
report.finishedAt=new Date().toISOString();await writeFile(resolve(out,'summary.json'),JSON.stringify(report,null,2)+'\n');
const summary=`${report.status} — ${report.profile} synthetic technical QA\n`+report.stages.map(s=>`- ${s.status}: ${s.name} (${s.passed||0}/${s.tests||s.checks||0})${s.status==='FAIL'&&s.failure?' — '+s.failure.split('\n')[0]:''}`).join('\n')+'\nAuthenticated hosted: NOT RUN. UX/product judgment: owner.\n';
await writeFile(resolve(out,'summary.txt'),summary);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(summary+'Evidence: '+out);process.exitCode=report.status==='PASS'?0:1;
