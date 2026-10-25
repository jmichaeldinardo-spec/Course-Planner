import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const byId=id=>document.getElementById(id);
const authStatus=byId("auth-status"), storageStatus=byId("storage-status"), authForm=byId("auth-form"),courseForm=byId("course-form"), signout=byId("auth-signout"),list=byId("saved-courses");
let user=null;
async function refresh(){
 const {data:{session},error}=await client.auth.getSession();user=session?.user||null;
 authStatus.textContent=error?"Unable to check sign-in: "+error.message:user?"Signed in: "+user.email:"Not signed in";
 authForm.hidden=!!user;signout.hidden=!user;courseForm.hidden=!user;list.replaceChildren();
 if(!user){storageStatus.textContent="Sign in to access private saved courses. The interactive demonstration below does not save changes.";return;}
 storageStatus.textContent="Loading private courses…";
 const {data,error:readError}=await client.from("courses").select("id,name,revision,updated_at").order("updated_at",{ascending:false});
 if(readError){storageStatus.textContent="Could not load courses: "+readError.message;return;}
 storageStatus.textContent=data.length?data.length+" saved course(s). The demonstration below remains separate and temporary.":"No saved courses yet. Create one to test cloud persistence.";
 for(const row of data){const li=document.createElement("li");li.textContent=row.name+" · revision "+row.revision+" · saved "+new Date(row.updated_at).toLocaleString();list.append(li);}
}
authForm.addEventListener("submit",async e=>{e.preventDefault();const btn=authForm.querySelector("button");btn.disabled=true;authStatus.textContent="Requesting email sign-in link…";const email=byId("auth-email").value.trim();const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});authStatus.textContent=error?"Sign-in link failed: "+error.message:"Check your email for the sign-in link.";btn.disabled=false;});
signout.addEventListener("click",async()=>{signout.disabled=true;const {error}=await client.auth.signOut();if(error)authStatus.textContent="Sign-out failed: "+error.message;await refresh();signout.disabled=false;});
courseForm.addEventListener("submit",async e=>{e.preventDefault();if(!user)return;const btn=courseForm.querySelector("button"),name=byId("course-name").value.trim();if(!name)return;btn.disabled=true;storageStatus.textContent="Saving course…";const {error}=await client.from("courses").insert({owner_id:user.id,name});if(error)storageStatus.textContent="Save failed: "+error.message;else{courseForm.reset();await refresh();}btn.disabled=false;});
client.auth.onAuthStateChange(()=>{setTimeout(()=>refresh().catch(err=>{authStatus.textContent="Sign-in check failed: "+err.message;}),0)});
refresh().catch(err=>{authStatus.textContent="Sign-in check failed: "+err.message;});
