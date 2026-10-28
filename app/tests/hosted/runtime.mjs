import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {mkdir,writeFile,readFile,lstat,chmod,open,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {demand,hash,target,backend,permitted,validateSnapshots,loginRequest} from './safety.mjs';
export const app=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const privateDir=resolve(app,'reviews/hosted-acceptance');
export const sessionPath=resolve(privateDir,'session.json'),fixturePath=resolve(privateDir,'fixture.json');
export const defaultUrl='https://course-planner-app-git-codex-tab-workspac-be6823-course-planner.vercel.app/';
export const defaultSha='fc719e1dbc90ba650b1f359828736060cc687820';
export function options(){
 const args=process.argv.slice(2),opts={url:defaultUrl,sha:defaultSha,mode:'all'};
 for(let i=0;i<args.length;i+=2){demand(['--url','--sha','--mode'].includes(args[i])&&args[i+1],'INVALID_ARGUMENT');opts[args[i].slice(2)]=args[i+1];}
 opts.url=target(opts.url,opts.sha);demand(['all','readonly','draft'].includes(opts.mode),'INVALID_MODE');return opts;
}
export async function secureDirectory(path=privateDir){
 await mkdir(path,{recursive:true,mode:0o700});
 const stat=await lstat(path);demand(stat.isDirectory()&&!stat.isSymbolicLink(),'PRIVATE_DIRECTORY_REQUIRED');await chmod(path,0o700);
 for(const name of ['session.json','fixture.json']){
  demand(execFileSync('git',['check-ignore','--',resolve(privateDir,name)],{cwd:app,encoding:'utf8'}).trim().length>0,'IGNORED_STORAGE_REQUIRED');
 }
}
export async function privateWrite(path,value){
 try{const s=await lstat(path);demand(s.isFile()&&!s.isSymbolicLink(),'PRIVATE_FILE_REQUIRED');}catch(e){if(e.code!=='ENOENT')throw e;}
 await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});await chmod(path,0o600);
}
export async function privateRead(path){const s=await lstat(path);demand(s.isFile()&&!s.isSymbolicLink()&&(s.mode&0o077)===0,'PRIVATE_FILE_PERMISSIONS');return JSON.parse(await readFile(path,'utf8'));}
export function playwright(){return createRequire(import.meta.url)('playwright');}
export async function launch(headless=true){return playwright().chromium.launch({headless});}
export async function guard(context,opts,{setup=false,expectedEmail}={}){
 const blocked=[];let otpUsed=false;
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(!permitted(req.url(),req.method(),{origin:new URL(opts.url).origin,setup,otpUsed})){
   blocked.push({method:req.method(),category:u.origin===backend?'backend':'external'});await route.abort('blockedbyclient');return;
  }
  let postData;
  if(u.origin===backend&&u.pathname==='/auth/v1/otp'&&req.method()==='POST'){
   otpUsed=true;
   try{postData=JSON.stringify(loginRequest(req.postDataJSON(),expectedEmail));}catch{blocked.push({method:'POST',category:'wrong-otp-account'});await route.abort('blockedbyclient');return;}
  }
  const headers={...req.headers()};
  delete headers['x-vercel-trusted-oidc-idp-token'];
  if(postData)delete headers['content-length'];
  if(u.origin===new URL(opts.url).origin&&process.env.VERCEL_OIDC_TOKEN){
   headers['x-vercel-trusted-oidc-idp-token']=process.env.VERCEL_OIDC_TOKEN;
   // route.continue headers can survive redirects. Fetch without following one,
   // then fulfill, so a preview token can never reach a redirected origin.
   const response=await route.fetch({headers,maxRedirects:0});
   if(response.status()>=300&&response.status()<400){blocked.push({method:req.method(),category:'preview-redirect'});await route.abort('blockedbyclient');return;}
   await route.fulfill({response});return;
  }
  await route.continue({headers,...(postData?{postData}:{})});
 });
 // No app WebSocket path is needed. Service workers are blocked on context creation.
 await context.routeWebSocket('**/*',ws=>{blocked.push({method:'WEBSOCKET',category:'external'});ws.close();});
 return blocked;
}
export async function verifySource(context,opts){
 const paths=execFileSync('git',['ls-tree','-r','--name-only',opts.sha,'--','app'],{cwd:resolve(app,'..'),encoding:'utf8'}).trim().split('\n').filter(p=>/^app\/(?:[^/]+\.(?:js|css|html)|assets\/.*\.(?:js|css|svg))$/.test(p));
 demand(paths.includes('app/auth.js')&&paths.includes('app/index.html'),'SOURCE_COMMIT_UNAVAILABLE');
 for(const path of paths){
  const response=await context.request.get(new URL(path.slice(4),opts.url).href,{maxRedirects:0,headers:process.env.VERCEL_OIDC_TOKEN?{'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}:{}});
  demand(response.status()===200,'DEPLOYMENT_ACCESS_BLOCKED');
  const expected=execFileSync('git',['show',`${opts.sha}:${path}`],{cwd:app});
  demand(hash(await response.body())===hash(expected),'DEPLOYMENT_SOURCE_MISMATCH');
 }
 return paths.length;
}
// Read through the real SDK/RLS in browser memory. Tokens never cross into Node,
// reports or console. No mocking, admin client, setSession or application-state injection.
export async function readAccount(page,expectedEmail){
 return page.evaluate(async({expectedEmail,backend})=>{
  const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}=await import('./config.js');
  if(SUPABASE_URL!==backend)throw new Error('BACKEND_MISMATCH');
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
  const key='sb-'+new URL(backend).hostname.split('.')[0]+'-auth-token';
  let session;try{session=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(!session?.access_token)throw new Error('AUTH_SETUP_REQUIRED');
  const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'hosted-readonly-verifier'},global:{headers:{Authorization:'Bearer '+session.access_token}}});
  const {data,error}=await client.auth.getUser(session.access_token);
  if(error||!data.user?.id||data.user.email?.toLowerCase()!==expectedEmail.toLowerCase())throw new Error('ACCOUNT_VERIFICATION_FAILED');
  const {data:courses,error:readError,count}=await client.from('courses').select('*',{count:'exact'}).eq('owner_id',data.user.id).order('id').range(0,4);
  if(readError||count!==4||courses.length!==4)throw new Error('FOUR_COURSES_REQUIRED');
  const {readCompleteCourse}=await import('./course-snapshot.js');
  const snapshots=[];for(const course of courses)snapshots.push(await readCompleteCourse(client,data.user,course.id));
  return {accountId:data.user.id,snapshots};
 },{expectedEmail,backend});
}
export async function verifiedAccount(page,fixture){const result=await readAccount(page,fixture.email);demand(result.accountId===fixture.accountId,'ACCOUNT_MISMATCH');validateSnapshots(result.snapshots,fixture);return result.snapshots;}
export async function saveSession(context,url){
 const state=await context.storageState();const origin=new URL(url).origin,host=new URL(url).hostname;
 // Retain only this app's Supabase session and preview protection cookies. Never Vercel account cookies.
 const scoped={cookies:state.cookies.filter(c=>c.domain.replace(/^\./,'')===host),origins:state.origins.filter(o=>o.origin===origin).map(o=>({...o,localStorage:o.localStorage.filter(v=>v.name==='sb-rlyrfbvxpmmfxdpzkyia-auth-token')}))};
 await privateWrite(sessionPath,scoped);
}
export async function ready(page){await page.locator('#saved-courses [data-private-open]').nth(3).waitFor({timeout:30000});}

export async function acquireLock(){
 const path=resolve(privateDir,'active.lock');let handle;
 try{handle=await open(path,'wx',0o600);}catch{throw new Error('HARNESS_ALREADY_RUNNING_OR_STALE_LOCK');}
 await handle.writeFile(String(process.pid));
 return async()=>{await handle.close();await unlink(path);};
}
