import {createHash} from 'node:crypto';
export const backend='https://rlyrfbvxpmmfxdpzkyia.supabase.co';
export function demand(ok,code){if(!ok)throw new Error(code);}
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function records(snapshot){return {course:snapshot.course,units:[...snapshot.units].sort(byId),lessons:[...snapshot.lessons].sort(byId),exceptions:[...snapshot.exceptions].sort(byId)};}
const byId=(a,b)=>a.id.localeCompare(b.id);
export const fingerprint=snapshots=>hash(canonical([...snapshots].sort((a,b)=>byId(a.course,b.course)).map(records)));
export function validateSnapshots(snapshots,fixture){
 demand(snapshots.length===4&&new Set(snapshots.map(s=>s.course.id)).size===4,'FOUR_COURSES_REQUIRED');
 if(fixture)demand(canonical(snapshots.map(s=>s.course.id).sort())===canonical(fixture.courses.map(c=>c.id).sort()),'COURSE_ALLOWLIST_MISMATCH');
 for(const s of snapshots){
  const ids=new Set(s.units.map(u=>u.id));
  demand(ids.size===s.units.length&&new Set(s.lessons.map(l=>l.id)).size===s.lessons.length,'DUPLICATE_RECORD');
  demand(s.units.every(u=>u.course_id===s.course.id)&&s.lessons.every(l=>l.course_id===s.course.id&&ids.has(l.unit_id))&&s.exceptions.every(e=>e.course_id===s.course.id),'RELATIONSHIP_MISMATCH');
  if(fixture){const f=fixture.courses.find(c=>c.id===s.course.id);demand(s.course.owner_id===fixture.accountId,'OWNER_MISMATCH');demand(canonical(counts(s))===canonical(f.counts),'FIXTURE_COUNTS_CHANGED');}
 }
}
export const counts=s=>({units:s.units.length,lessons:s.lessons.length,exceptions:s.exceptions.length});
export function target(url,sha){
 const u=new URL(url);demand(u.protocol==='https:'&&u.hostname.endsWith('.vercel.app')&&u.hostname.includes('-git-')&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/','PREVIEW_URL_REQUIRED');
 demand(/^[a-f0-9]{40}$/.test(sha),'EXACT_COMMIT_REQUIRED');return u.origin+'/';
}
// Fail closed for every application write and every RPC, including GET RPCs.
export function permitted(raw,method,{origin,setup=false,otpUsed=false}={}){
 const u=new URL(raw),read=['GET','HEAD','OPTIONS'].includes(method);
 if(u.origin===backend){
  if(u.pathname.startsWith('/rest/v1/'))return read&&/^\/rest\/v1\/(courses|units|lessons|calendar_exceptions)$/.test(u.pathname);
  if(u.pathname==='/auth/v1/user')return method==='GET';
  if(u.pathname==='/auth/v1/token')return method==='POST'&&u.searchParams.get('grant_type')==='refresh_token';
  if(setup&&u.pathname==='/auth/v1/otp')return method==='POST'&&!otpUsed;
  if(setup&&u.pathname==='/auth/v1/verify')return read;
  return false;
 }
 if(setup)return true; // Human Vercel authentication only; backend writes remain blocked above.
 return read&&[origin,'https://esm.sh'].includes(u.origin);
}
export function validateExport(json,snapshot){
 demand(json.schema==='course-planner.pilot-export.v1','EXPORT_SCHEMA');
 demand(canonical(records({course:json.course,units:json.units,lessons:json.lessons,exceptions:json.calendarExceptions}))===canonical(records(snapshot)),'EXPORT_RECORD_MISMATCH');
}

export function loginRequest(body,expectedEmail){
 demand(typeof body?.email==='string'&&body.email.toLowerCase()===expectedEmail?.toLowerCase()&&!body.phone,'OTP_ACCOUNT_MISMATCH');
 return {...body,create_user:false};
}
