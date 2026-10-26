import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { openPrivateCourse, clearPrivateWorkspace, activePrivateCourseId, isPrivateWorkspaceDirty } from "./private-workspace.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const byId=id=>document.getElementById(id);
const authStatus=byId("auth-status"), storageStatus=byId("storage-status"), authForm=byId("auth-form"),courseForm=byId("course-form"), signout=byId("auth-signout"),list=byId("saved-courses"),otpDetails=byId("auth-otp-details"),otpForm=byId("auth-otp-form");
let user=null;
async function refresh(){
 const {data:{session},error}=await client.auth.getSession();user=session?.user||null;
 authStatus.textContent=error?"Unable to check sign-in: "+error.message:user?"Signed in: "+user.email:"Not signed in";
 authForm.hidden=!!user;otpDetails.hidden=!!user;signout.hidden=!user;courseForm.hidden=!user;list.replaceChildren();
 if(!user){clearPrivateWorkspace();storageStatus.textContent="Sign in to access private saved courses. The interactive demonstration below does not save changes.";return;}
 storageStatus.textContent="Loading private courses…";
 const {data,error:readError}=await client.from("courses").select("id,name,revision,updated_at").order("updated_at",{ascending:false});
 if(readError){storageStatus.textContent="Could not load courses: "+readError.message;return;}
 storageStatus.textContent=data.length?data.length+" saved course(s). The demonstration below remains separate and temporary.":"No saved courses yet. Create one to test cloud persistence.";
 for(const row of data){const li=document.createElement("li"),b=document.createElement("button");b.type="button";b.dataset.privateOpen=row.id;b.textContent="Open "+row.name;li.append(b,document.createTextNode(" · saved "+new Date(row.updated_at).toLocaleString()));list.append(li);}
 const prior=activePrivateCourseId();const toOpen=data.find(x=>x.id===prior)?.id||data[0]?.id;
 if(toOpen){if(!isPrivateWorkspaceDirty())await openPrivateCourse(client,user,toOpen);}else clearPrivateWorkspace();
}
list.addEventListener("click",event=>{const b=event.target.closest("[data-private-open]");if(b&&user){if(isPrivateWorkspaceDirty()&&!confirm("Discard unsaved changes and switch courses?"))return;openPrivateCourse(client,user,b.dataset.privateOpen).catch(err=>{storageStatus.textContent="Could not open course: "+err.message;});}});
authForm.addEventListener("submit",async e=>{e.preventDefault();const btn=authForm.querySelector("button");btn.disabled=true;authStatus.textContent="Requesting sign-in email…";const email=byId("auth-email").value.trim();const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error){authStatus.textContent=/rate limit/i.test(error.message)?"Supabase email rate limit reached. Do not retry immediately; wait for the limit to reset.": "Sign-in email failed: "+error.message;}else{byId("auth-otp-email").value=email;authStatus.textContent="Check your email. If the message contains a six-digit code, expand the code verification form below. If it contains a link, open it in this same browser profile."; }btn.disabled=false;});
otpForm.addEventListener("submit",async e=>{
 e.preventDefault();
 const btn=otpForm.querySelector('button[type="submit"]');
 const email=byId("auth-otp-email").value.trim();
 const token=byId("auth-otp-code").value.trim();
 if(!/^[0-9]{6}$/.test(token)){authStatus.textContent="Enter exactly six digits from a Supabase sign-in email.";return;}
 btn.disabled=true;
 authStatus.textContent="Verifying sign-in code…";
 try{
  const {data,error}=await client.auth.verifyOtp({email,token,type:"email"});
  if(error){authStatus.textContent="Code verification failed: "+error.message;return;}
  if(!data?.session){authStatus.textContent="Code was accepted, but no session was returned. Check the sign-in email and try again only with a fresh code.";return;}
  otpForm.reset();
  otpDetails.open=false;
  await refresh();
 }catch(err){authStatus.textContent="Code verification failed: "+err.message;}
 finally{btn.disabled=false;}
});
signout.addEventListener("click",async()=>{if(isPrivateWorkspaceDirty()&&!confirm("You have unsaved edits. Sign out without saving?"))return;signout.disabled=true;const {error}=await client.auth.signOut();if(error)authStatus.textContent="Sign-out failed: "+error.message;await refresh();signout.disabled=false;});
courseForm.addEventListener("submit",async e=>{e.preventDefault();if(!user)return;const btn=courseForm.querySelector("button"),name=byId("course-name").value.trim();if(!name)return;btn.disabled=true;storageStatus.textContent="Saving course…";const {data,error}=await client.from("courses").insert({owner_id:user.id,name}).select("id").single();if(error)storageStatus.textContent="Save failed: "+error.message;else{courseForm.reset();await refresh();await openPrivateCourse(client,user,data.id);}btn.disabled=false;});
client.auth.onAuthStateChange(()=>{setTimeout(()=>refresh().catch(err=>{authStatus.textContent="Sign-in check failed: "+err.message;}),0)});
refresh().catch(err=>{authStatus.textContent="Sign-in check failed: "+err.message;});
