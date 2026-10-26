import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { makeAccountBackup, zipEntries } from "../backup.js";
const td=new TextDecoder();

function zipFiles(zip) {
 const view=new DataView(zip.buffer,zip.byteOffset,zip.byteLength),files=new Map();
 let offset=0;
 while (view.getUint32(offset,true)===0x04034b50) {
  const length=view.getUint32(offset+18,true);
  const nameLength=view.getUint16(offset+26,true);
  const extraLength=view.getUint16(offset+28,true);
  const name=td.decode(zip.subarray(offset+30,offset+30+nameLength));
  const start=offset+30+nameLength+extraLength;
  files.set(name,zip.subarray(start,start+length));
  offset=start+length;
 }
 assert.equal(view.getUint32(offset,true),0x02014b50);
 return files;
}
function fakeClient({invalidLink=false,editDuringRead=false}={}) {
 const owner="55555555-5555-4555-8555-555555555555";
 const course={id:"11111111-1111-4111-8111-111111111111",owner_id:owner,name:"Test Course",revision:1,updated_at:"2026-10-26T12:00:00Z"};
 const unit={id:"22222222-2222-4222-8222-222222222222",course_id:course.id,title:"Test Unit",position:1,revision:1,updated_at:"2026-10-26T12:00:00Z"};
 const lesson={id:"33333333-3333-4333-8333-333333333333",course_id:course.id,unit_id:invalidLink?"44444444-4444-4444-8444-444444444444":unit.id,position:1,title:"Test Lesson",objective:"Bilingual ¿Qué?",revision:1,updated_at:"2026-10-26T12:00:00Z"};
 const db={courses:[course],units:[unit],lessons:[lesson],calendar_exceptions:[]};
 let checks=0;
 return {
  owner,
  auth:{async getUser(){return {data:{user:{id:owner}},error:null};}},
  from(table){
   let filter=null,fields="*";
   const builder={
    select(f){fields=f;return builder;},
    eq(field,value){filter=[field,value];return builder;},
    order(){return builder;},
    async range(start,end){
     let records=db[table].filter(x=>!filter||x[filter[0]]===filter[1]);
     records=records.sort((a,b)=>a.id.localeCompare(b.id));
     if(fields!=="*"){
      checks++;
      records=records.map(x=>Object.fromEntries(fields.split(",").map(f=>[f,x[f]])));
      if(editDuringRead && checks===3 && table==="lessons")records[0].revision=2;
     }
     return {data:records.slice(start,end+1),error:null};
    }
   };
   return builder;
  }
 };
}

test("ZIP entries use valid PK headers and preserved UTF-8 content",()=>{
 const entries=[{name:"test.json",data:'{"q":"café"}'},{name:"backup-manifest.json",data:"hello"}];
 const zip=zipEntries(entries,new Date("2026-10-26T12:00:00Z"));
 const files=zipFiles(zip);
 assert.equal(td.decode(files.get("test.json")),entries[0].data);
 assert.equal(td.decode(files.get("backup-manifest.json")),"hello");
 assert.equal(new DataView(zip.buffer).getUint32(zip.length-22,true),0x06054b50);
});
test("account backup contains restorable course JSON with SHA-256 manifest",async()=>{
 const client=fakeClient();
 const {bytes,manifest}=await makeAccountBackup(client,{id:client.owner},()=>{},webcrypto.subtle);
 const files=zipFiles(bytes);
 assert.equal(manifest.courseCount,1);
 assert.equal(files.size,2);
 const row=manifest.courses[0];
 const content=files.get(row.filename);
 const json=JSON.parse(td.decode(content));
 assert.equal(json.schema,"course-planner.pilot-export.v1");
 assert.equal(json.units.length,1);
 assert.equal(json.lessons.length,1);
 assert.equal(json.lessons[0].objective,"Bilingual ¿Qué?");
 const hash=Buffer.from(await webcrypto.subtle.digest("SHA-256",content)).toString("hex");
 assert.equal(hash,row.sha256);
 assert.deepEqual(JSON.parse(td.decode(files.get("backup-manifest.json"))).courses[0],row);
});
test("invalid lesson relationships abort backup",async()=>{
 const client=fakeClient({invalidLink:true});
 await assert.rejects(makeAccountBackup(client,{id:client.owner},()=>{},webcrypto.subtle),/Inconsistent/);
});
test("in-flight revision changes abort backup",async()=>{
 const client=fakeClient({editDuringRead:true});
 await assert.rejects(makeAccountBackup(client,{id:client.owner},()=>{},webcrypto.subtle),/edited during backup/);
});
test("backup is owner-isolated and requires verified session",async()=>{
 const client=fakeClient();
 await assert.rejects(makeAccountBackup(client,{id:"00000000-0000-4000-8000-000000000000"},()=>{},webcrypto.subtle),/Authentication changed/);
});
test("private app exposes signed-in backup control",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const auth=readFileSync(new URL("../auth.js",import.meta.url),"utf8");
 assert.match(html,/id="backup-all"/);
 assert.match(html,/id="backup-status"/);
 assert.match(auth,/makeAccountBackup\(client,exportingUser/);
 assert.match(auth,/isPrivateWorkspaceDirty\(\)/);
});
