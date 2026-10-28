
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {createWorkspaceState} from '../workspace-state.js';
import {createWorkspaceNavigation} from '../workspace-navigation.js';
import {defaultOutlookPreferences} from "../planning-outlook-view.js";
const root=new URL("../",import.meta.url);
const get=p=>readFileSync(new URL(p,root),"utf8");
const state=get("workspace-state.js");
const app=get("index.html"),auth=get("auth.js"),workspace=get("private-workspace.js"),config=get("config.js");
test("standalone modules are syntactically valid",()=>{
 assert.doesNotThrow(()=>new vm.Script(auth.replace(/^import .*$/gm,""),{filename:"auth.js"}));
 assert.doesNotThrow(()=>new vm.Script(workspace.replace(/^import .*$/gm,"").replace(/^export /gm,""),{filename:"private-workspace.js"}));
});
test("private workspace is accessible independently of the fictional demonstration",()=>{
 assert.match(app,/id="private-workspace"/);
 assert.match(app,/id="application"/);
 assert.match(app,/data is still in development|scheduling engine is still in development/);
});
test("no privileged Supabase key embedded in browser code",()=>{
 for(const src of [auth,workspace,config]){assert.doesNotMatch(src,/sb_secret_|service_role/);assert.equal(src.includes("postgres://"),false);}
 assert.match(config,/sb_publishable_/);
});
test("real writes target canonical lesson and unit tables with revision check",()=>{
 assert.match(workspace,/\.from\(table\)\.update\(patch\)/);
 assert.match(workspace,/\.eq\("revision",record\.revision\)/);
 assert.match(workspace,/readCompleteCourse\(client,user,id/);
 assert.match(workspace,/essential_questions/);
});
test("failed saves preserve in-form input and report the error",()=>{
 assert.match(workspace,/status\("Save failed: "/);
 assert.match(state,/Your unsaved edits remain here/);
 assert.match(workspace,/beforeunload/);
});
test("private course exports all related records; demo remains explicitly unsaved",()=>{
 assert.match(workspace,/makeCourseExport\(client,user,id/);
 assert.match(get('course-snapshot.js'),/calendarExceptions:exceptions/);
 assert.match(app,/fictional curriculum/);
});

test("magic link remains available with preview access guidance",()=>{
 assert.match(app,/id="auth-hint"/);
 assert.doesNotMatch(app,/id="auth-otp-form"/);
 assert.match(auth,/client\.auth\.signInWithOtp/);
 assert.doesNotMatch(auth,/client\.auth\.verifyOtp/);
});

test("unsaved drafts block background refreshes and in-flight responses",async()=>{
 const handlers={};
 const root={
  hidden:true,
  innerHTML:"",
  addEventListener(name,fn){handlers[name]=fn;},
  replaceChildren(){this.innerHTML="";},
 };
 const document={
  getElementById(id){return id==="private-workspace"?root:{dataset:{},textContent:""};},
  createElement(){return {dataset:{},append(){},remove(){}};},
 };
 const context={document,console,createWorkspaceState,createWorkspaceNavigation,defaultOutlookPreferences,readCompleteCourse:()=>delayed,confirm:()=>true,URL,Blob,FormData,setTimeout,window:{addEventListener(){}}};
 vm.createContext(context);
 const source=workspace.replace(/^import .*$/gm,"").replace(/^export /gm,"");
 vm.runInContext(source,context,{filename:"private-workspace.js"});
 const user={id:"teacher-id"};
 const record={id:"11111111-1111-4111-8111-111111111111",owner_id:user.id,name:"Test Course"};
 let finishLoad;
 const delayed=new Promise(resolve=>{finishLoad=resolve;});
 const client={
  from(table){
   const chain={
    select(){return chain;},
    eq(){return chain;},
    order(){return chain;},
    single(){return delayed;},
    then(resolve){return delayed.then(resolve);},
   };
   return chain;
  }
 };
 const loading=context.openPrivateCourse(client,user,record.id);
 // Simulate user beginning an edit while a prior automatic load is in flight.
 handlers.input({target:{closest(selector){return selector.includes("data-private-save")?{}:null;}}});
 finishLoad({data:record,error:null});
 const applied=await loading;
 assert.equal(applied,false);
 assert.equal(context.isPrivateWorkspaceDirty(),true);
 assert.equal(root.hidden,false);
 assert.equal(root.innerHTML,"<p role=\"status\">Loading your saved course…</p>");
 // A second automatic refresh must be rejected BEFORE touching visible DOM.
 const before=root.innerHTML;
 const second=await context.openPrivateCourse(client,user,record.id);
 assert.equal(second,false);
 assert.equal(root.innerHTML,before);
});
test("dirty drafts are preserved by auth refresh and require explicit discard",()=>{
 assert.match(auth,/isPrivateWorkspaceDirty\(\)/);
 assert.match(workspace,/if\(dirty && !discardUnsaved && !\(switching&&preserveContext\)\)/);
 assert.match(workspace,/editEpoch!==editAtStart/);
 assert.match(workspace,/data-private-reload/);
 assert.match(state,/Save conflict: this record changed/);
 assert.match(workspace,/\.eq\("revision",record\.revision\)/);
 assert.match(auth,/preserveContext:true/);
});

test("restore form calls transactional RPC and does not overwrite current course",()=>{
 assert.match(app,/id="restore-form"/);
 assert.match(app,/id="restore-file"/);
 assert.match(app,/Restore as new course/);
 assert.match(auth,/client\.rpc\("restore_course_export",\{p_export:json\}\)/);
 assert.match(auth,/json\.schema!=="course-planner\.pilot-export\.v1"/);
 assert.match(auth,/new Set\(json\.units\.map/);
 assert.match(auth,/Existing courses were not changed/);
 assert.doesNotMatch(auth,/\.from\("courses"\)\.upsert/);
});
