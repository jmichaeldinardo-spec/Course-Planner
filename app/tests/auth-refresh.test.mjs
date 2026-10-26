import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../auth.js',import.meta.url),'utf8').replace(/^import .*$/gm,'');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(setImmediate);
const teacher={id:'fictional-owner',email:'fictional@example.test'};
const session=user=>({data:{session:user?{user}:null},error:null});
const rows=label=>Array.from({length:3},(_,i)=>({id:label+'-'+i,name:label+' '+i,updated_at:'2026-10-26T12:00:00Z',revision:1}));
function harness(){
 const elements=new Map(),queries=[],opens=[],timers=[];let listener,dirty=false,sessionRead=()=>Promise.resolve(session(teacher)),clears=0;
 const node=()=>({dataset:{},children:[],textContent:'',hidden:false,addEventListener(){},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id);},createElement:node,createTextNode:text=>({textContent:text})};
 const client={auth:{getSession:()=>sessionRead(),onAuthStateChange(fn){listener=fn;}},from(table){assert.equal(table,'courses');return {select(){return this;},order(){const request=deferred();queries.push(request);return request.promise;}};}};
 const context=vm.createContext({document,createClient:()=>client,SUPABASE_URL:'test',SUPABASE_PUBLISHABLE_KEY:'test',openPrivateCourse:async(api,user,id)=>opens.push({user:user.id,id}),clearPrivateWorkspace:()=>clears++,activePrivateCourseId:()=>null,isPrivateWorkspaceDirty:()=>dirty,setTimeout:fn=>timers.push(fn)});
 vm.runInContext(source,context,{filename:'auth.js'});
 return {elements,queries,opens,context,notify(){listener();timers.splice(0).forEach(fn=>fn());},setSessionRead(fn){sessionRead=fn;},setDirty(value){dirty=value;},get clears(){return clears;},ids(){return elements.get('saved-courses').children.map(li=>li.children[0].dataset.privateOpen);}};
}
test('overlapping startup/auth refreshes render three courses once and ignore older results',async()=>{
 const h=harness();await tick();h.notify();await tick();h.notify();await tick();assert.equal(h.queries.length,3);
 h.queries[2].resolve({data:rows('latest'),error:null});await tick();
 h.queries[0].resolve({data:rows('obsolete'),error:null});h.queries[1].resolve({data:rows('older'),error:null});await tick();
 assert.deepEqual(h.ids(),rows('latest').map(r=>r.id));assert.match(h.elements.get('storage-status').textContent,/^3 saved course/);assert.deepEqual(h.opens,[{user:teacher.id,id:'latest-0'}]);
});
test('sign-out and a newer account prevent old session/list responses from restoring old courses',async()=>{
 const h=harness();await tick();h.setSessionRead(()=>Promise.resolve(session(null)));h.notify();await tick();
 h.queries[0].resolve({data:rows('old-owner'),error:null});await tick();assert.deepEqual(h.ids(),[]);assert.equal(h.opens.length,0);assert.equal(h.clears,1);assert.equal(h.elements.get('auth-status').textContent,'Not signed in');
 const delayed=deferred();h.setSessionRead(()=>delayed.promise);const oldRefresh=h.context.refresh();
 const other={id:'other-owner',email:'other@example.test'};h.setSessionRead(()=>Promise.resolve(session(other)));h.notify();await tick();h.queries[1].resolve({data:rows('other'),error:null});await tick();
 delayed.resolve(session(teacher));await oldRefresh;
 assert.deepEqual(h.ids(),rows('other').map(r=>r.id));assert.deepEqual(h.opens,[{user:other.id,id:'other-0'}]);assert.match(h.elements.get('auth-status').textContent,/other@example.test/);assert.equal(h.queries.length,2);
});
test('stale failures cannot overwrite latest status and auth refresh preserves dirty authoring',async()=>{
 const h=harness();await tick();h.setDirty(true);h.notify();await tick();h.queries[1].resolve({data:rows('current'),error:null});await tick();h.queries[0].reject(new Error('obsolete network error'));await tick();
 assert.deepEqual(h.ids(),rows('current').map(r=>r.id));assert.equal(h.opens.length,0);assert.match(h.elements.get('storage-status').textContent,/^3 saved course/);assert.match(h.elements.get('auth-status').textContent,/^Signed in/);
 h.notify();await tick();h.queries[2].resolve({data:null,error:{message:'Current list unavailable'}});await tick();assert.deepEqual(h.ids(),[]);assert.match(h.elements.get('storage-status').textContent,/Current list unavailable/);
});
