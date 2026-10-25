
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const root=new URL("../",import.meta.url);
const get=p=>readFileSync(new URL(p,root),"utf8");
const app=get("index.html"),auth=get("auth.js"),workspace=get("private-workspace.js"),config=get("config.js");
test("standalone modules are syntactically valid",()=>{
 assert.doesNotThrow(()=>new vm.Script(auth.replace(/^import .*$/gm,""),{filename:"auth.js"}));
 assert.doesNotThrow(()=>new vm.Script(workspace.replace(/^export /gm,""),{filename:"private-workspace.js"}));
});
test("private workspace is accessible independently of the fictional demonstration",()=>{
 assert.match(app,/id="private-workspace"/);
 assert.match(app,/id="application"/);
 assert.match(app,/data is still in development|scheduling engine is still in development/);
});
test("no privileged Supabase key embedded in browser code",()=>{
 for(const src of [auth,workspace,config]){assert.doesNotMatch(src,/sb_secret_|service_role|postgres:\\/\\//);}
 assert.match(config,/sb_publishable_/);
});
test("real writes target canonical lesson and unit tables with revision check",()=>{
 assert.match(workspace,/\.from\(table\)\.update\(patch\)/);
 assert.match(workspace,/\.eq\("revision",record\.revision\)/);
 assert.match(workspace,/\.from\("lessons"\)/);
 assert.match(workspace,/\.from\("units"\)/);
 assert.match(workspace,/essential_questions/);
});
test("failed saves preserve in-form input and report the error",()=>{
 assert.match(workspace,/status\("Save failed: "/);
 assert.match(workspace,/Your unsaved edits remain here/);
 assert.match(workspace,/beforeunload/);
});
test("private course exports all related records; demo remains explicitly unsaved",()=>{
 assert.match(workspace,/calendarExceptions:exceptions/);
 assert.match(workspace,/JSON\.stringify\(json,null,2\)/);
 assert.match(app,/fictional curriculum/);
});
