import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dashboardWeek,projectDashboardCourse,combineDashboard} from '../dashboard-model.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const records=(id,owner)=>({course:{id,owner_id:owner,name:id,timezone:'UTC'},units:[],lessons:[],exceptions:[]});
function harness(read){
 const context=vm.createContext({dashboardWeek,projectDashboardCourse,combineDashboard,readDashboardCourse:read,document:{getElementById(){return null;},addEventListener(){}},Intl});
 vm.runInContext(readFileSync(new URL('../dashboard.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,''),context);
 return {context,values:()=>JSON.parse(vm.runInContext('JSON.stringify([...results.values()])',context))};
}
test('late reads from another account cannot repopulate the dashboard',async()=>{
 const old=deferred(),h=harness(async(api,user,id)=>id==='old'?old.promise:records(id,user.id));
 h.context.setDashboardAccount({id:'a'});const pending=h.context.loadDashboard({}, {id:'a'},[{id:'old',name:'Old'}]);
 h.context.setDashboardAccount({id:'b'});await h.context.loadDashboard({}, {id:'b'},[{id:'new',name:'New'}]);old.resolve(records('old','a'));await pending;
 assert.deepEqual(h.values().map(v=>v.courseId),['new']);
});
test('newer per-course result wins; a failed course does not erase another course',async()=>{
 const old=deferred();let call=0;
 const h=harness(async(api,user,id)=>{if(id==='bad')throw new Error('Denied');if(call++===0)return old.promise;return records(id,user.id);});
 h.context.setDashboardAccount({id:'a'});const pending=h.context.loadDashboard({}, {id:'a'},[{id:'c',name:'Course'},{id:'bad',name:'Unavailable'}]);
 await h.context.refreshDashboardCourse({},'c');old.resolve({...records('c','a'),lessons:[{id:'unexpected-old',course_id:'c',planning_status:'Draft',scheduled_dates:[]}]});await pending;
 assert.equal(h.values().find(v=>v.courseId==='c').attention.unique,0);assert.equal(h.values().find(v=>v.courseId==='bad').error,true);
});
