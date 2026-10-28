import {setDashboardAccount,beginDashboardRefresh,setDashboardError,loadDashboard,dashboardNavigationStatus} from './dashboard.js';
import {setWorkspaceAccount,setWorkspaceCourses,refreshWorkspaceSummaries,showWorkspaceDestination} from "./workspace-shell.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { openPrivateCourse, clearPrivateWorkspace, activePrivateCourseId, isPrivateWorkspaceBusy, isPrivateWorkspaceDirty, openDashboardDestination } from "./private-workspace.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { makeAccountBackup } from "./backup.js";
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const byId=id=>document.getElementById(id);
const authStatus=byId("auth-status"), storageStatus=byId("storage-status"), authForm=byId("auth-form"),courseForm=byId("course-form"), signout=byId("auth-signout"),list=byId("saved-courses"),restoreDetails=byId("restore-details"),restoreForm=byId("restore-form"),restoreStatus=byId("restore-status"),backupButton=byId("backup-all"),backupStatus=byId("backup-status");
let user=null,refreshEpoch=0;
async function refresh(){
 // Startup, INITIAL_SESSION and token/focus events may overlap. Only the latest
 // refresh may publish a session, course list or automatic workspace selection.
 const call=++refreshEpoch;
 try{
 const {data:{session},error}=await client.auth.getSession();
 if(call!==refreshEpoch)return;
 const currentUser=session?.user||null;
 if(user?.id!==currentUser?.id){
  // Account-bound form drafts and selected restore files must not follow the
  // next user. Same-account token refreshes keep their unfinished inputs.
  authForm.reset();courseForm.reset();restoreForm.reset();
  restoreStatus.textContent="";backupStatus.textContent="";
  if(user&&currentUser)clearPrivateWorkspace();setWorkspaceAccount(currentUser?.id||null);
 }
 user=currentUser;setDashboardAccount(user);
 authStatus.textContent=error?"Unable to check sign-in: "+error.message:user?"Signed in: "+user.email:"Not signed in";
 authForm.hidden=!!user;byId("auth-hint").hidden=!!user;signout.hidden=!user;courseForm.hidden=!user;restoreDetails.hidden=!user;backupButton.hidden=!user;list.replaceChildren();setWorkspaceCourses([]);
 if(!user){clearPrivateWorkspace();storageStatus.textContent="Sign in to access private saved courses. The interactive demonstration below does not save changes.";return;}
 beginDashboardRefresh();storageStatus.textContent="Loading private courses…";
 const {data,error:readError}=await client.from("courses").select("id,name,revision,updated_at").order("updated_at",{ascending:false});
 if(call!==refreshEpoch)return;
 if(readError){setDashboardError();storageStatus.textContent="Could not load courses: "+readError.message;return;}
 storageStatus.textContent=data.length?data.length+" saved course(s).":"No saved courses yet. Create your first course.";
 setWorkspaceCourses(data);
 void refreshWorkspaceSummaries(client);void loadDashboard(client,currentUser,data);
 const prior=activePrivateCourseId();const toOpen=data.find(x=>x.id===prior)?.id||data[0]?.id;
 if(toOpen){if(!isPrivateWorkspaceDirty())await openPrivateCourse(client,currentUser,toOpen);}else clearPrivateWorkspace();
 }catch(err){if(call===refreshEpoch)authStatus.textContent="Sign-in check failed: "+err.message;}
}
async function selectCourse(event){const b=event.target.closest("[data-private-open]");if(!b||!user)return;if(b.dataset.privateOpen===activePrivateCourseId()){showWorkspaceDestination("workspace");return;}const selectedUser=user;try{const ok=await openPrivateCourse(client,selectedUser,b.dataset.privateOpen,{preserveContext:true});if(ok&&user?.id===selectedUser.id)showWorkspaceDestination("workspace");}catch(err){storageStatus.textContent="Could not open course: "+err.message;}}
list.addEventListener("click",selectCourse);
byId("home-courses").addEventListener("click",selectCourse);
byId('dashboard-content').addEventListener('click',async event=>{
 if(event.target.closest('[data-dashboard-retry]')){await refresh();return;}
 const b=event.target.closest('[data-dashboard-course]');if(!b||!user)return;
 const selectedUser=user;b.disabled=true;dashboardNavigationStatus('Opening saved planning…');
 try{const result=await openDashboardDestination(client,selectedUser,{courseId:b.dataset.dashboardCourse,lessonId:b.dataset.dashboardLesson||null,date:b.dataset.dashboardDate||null});if(user?.id===selectedUser.id)dashboardNavigationStatus(result.ok?'':result.message);}catch{if(user?.id===selectedUser.id)dashboardNavigationStatus('Could not open this saved item. Your workspace was preserved.');}
 finally{if(b.isConnected)b.disabled=false;}
});
authForm.addEventListener("submit",async e=>{e.preventDefault();const btn=authForm.querySelector("button");btn.disabled=true;authStatus.textContent="Requesting sign-in email…";const email=byId("auth-email").value.trim();const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error){authStatus.textContent=/rate limit/i.test(error.message)?"Supabase email rate limit reached. Do not retry immediately; wait for the limit to reset.": "Sign-in email failed: "+error.message;}else{authStatus.textContent="Check your email for a sign-in link. Open it once in this same browser after authorizing Vercel preview access."; }btn.disabled=false;});
signout.addEventListener("click",async()=>{if(isPrivateWorkspaceDirty()&&!confirm("You have unsaved edits. Sign out without saving?"))return;signout.disabled=true;const {error}=await client.auth.signOut();if(error)authStatus.textContent="Sign-out failed: "+error.message;await refresh();signout.disabled=false;});
courseForm.addEventListener("submit",async e=>{
 e.preventDefault();if(!user)return;
 if(isPrivateWorkspaceBusy()){storageStatus.textContent="Wait for the current save to finish before creating a course.";return;}
 const creatingUser=user,btn=courseForm.querySelector("button"),name=byId("course-name").value.trim();if(!name)return;
 btn.disabled=true;storageStatus.textContent="Saving course…";
 try{
  const {data,error}=await client.from("courses").insert({owner_id:creatingUser.id,name}).select("id").single();
  if(user?.id!==creatingUser.id)return;
  if(error){storageStatus.textContent="Save failed: "+error.message;return;}
  courseForm.reset();await refresh();if(user?.id!==creatingUser.id)return;
  if(await openPrivateCourse(client,creatingUser,data.id,{preserveContext:true})){byId("workspace-settings").close();showWorkspaceDestination("workspace");}
 }catch(err){if(user?.id===creatingUser.id)storageStatus.textContent="Save failed: "+err.message;}
 finally{btn.disabled=false;}
});


backupButton.addEventListener("click",async()=>{
 if(!user)return;
 if(isPrivateWorkspaceDirty()){
  backupStatus.textContent="Save or discard unsaved changes before backing up.";
  return;
 }
 const exportingUser=user;
 backupButton.disabled=true;
 backupStatus.textContent="Preparing a private account backup…";
 try{
  const {bytes,manifest}=await makeAccountBackup(client,exportingUser,message=>{
   backupStatus.textContent=message;
  });
  if(!user||user.id!==exportingUser.id)throw new Error("Account changed during export; backup canceled.");
  const name="course-planner-account-backup-"+new Date().toISOString().slice(0,10)+".zip";
  const blob=new Blob([bytes],{type:"application/zip"});
  const downloadUrl=URL.createObjectURL(blob);
  const link=document.createElement("a");
  try{
   link.href=downloadUrl;link.download=name;
   document.body.append(link);link.click();
  }finally{
   link.remove();setTimeout(()=>URL.revokeObjectURL(downloadUrl),60000);
  }
  const lessons=manifest.courses.reduce((sum,item)=>sum+item.counts.lessons,0);
  backupStatus.textContent="Backup downloaded: "+manifest.courseCount+" course(s), "+lessons+" lessons. Check that the ZIP appears in Downloads, then copy it to private storage outside Supabase.";
 }catch(err){
  backupStatus.textContent="Backup failed: "+err.message+" No ZIP was downloaded.";
 }finally{backupButton.disabled=false;}
});

restoreForm.addEventListener("submit",async e=>{
 e.preventDefault();
 if(!user)return;
 if(isPrivateWorkspaceDirty()){restoreStatus.textContent="Save or discard unsaved edits before restoring.";return;}
 const restoringUser=user;
 const file=byId("restore-file").files?.[0];
 if(!file)return;
 const button=restoreForm.querySelector('button[type="submit"]');
 button.disabled=true;restoreStatus.textContent="Validating course export…";
 try{
  if(file.size>6000000)throw new Error("Export exceeds the 6 MB pilot limit.");
  const json=JSON.parse(await file.text());
  if(!json||json.schema!=="course-planner.pilot-export.v1"||
     !json.course||!Array.isArray(json.units)||!Array.isArray(json.lessons)||
     !Array.isArray(json.calendarExceptions))throw new Error("Unsupported Course Planner export format.");
  if(json.units.length>200||json.lessons.length>2000||json.calendarExceptions.length>1000)throw new Error("Export exceeds pilot size limits.");
  const ids=new Set(json.units.map(u=>u?.id));
  if(ids.size!==json.units.length||
     json.units.some(u=>u?.course_id!==json.course.id)||
     json.lessons.some(l=>l?.course_id!==json.course.id||!ids.has(l?.unit_id))||
     json.calendarExceptions.some(x=>x?.course_id!==json.course.id))
     throw new Error("Export contains invalid unit, lesson or exception relationships.");
  if(!confirm('Create a separate restored copy of "'+String(json.course.name||"Untitled")+'"? Your current courses will not be overwritten.')){restoreStatus.textContent="Restore canceled.";return;}
  if(user?.id!==restoringUser.id)throw new Error("Account changed; restore canceled.");
  restoreStatus.textContent="Restoring course atomically…";
  const {data,error}=await client.rpc("restore_course_export",{p_export:json});
  if(user?.id!==restoringUser.id)return;
  if(error)throw new Error(error.message);
  if(!data)throw new Error("No restored course ID was returned.");
  restoreForm.reset();
  restoreStatus.textContent="Restored a separate course successfully. Opening it…";
  await refresh();
  if(user?.id!==restoringUser.id)return;
  if(await openPrivateCourse(client,restoringUser,data,{discardUnsaved:false,preserveContext:true})){byId("workspace-settings").close();showWorkspaceDestination("workspace");}
  restoreStatus.textContent="Restore complete. Opened the newly restored course.";
 }catch(err){restoreStatus.textContent="Restore failed: "+err.message+". Existing courses were not changed.";}
 finally{button.disabled=false;}
});
client.auth.onAuthStateChange(()=>{setTimeout(()=>refresh(),0)});
refresh();
