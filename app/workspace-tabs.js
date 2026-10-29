// Presentation only. Canonical rows, curriculum drafts and writes stay in workspace-state.
export function createWorkspaceTabs(){
 let account=null,generation=0,serial=0;
 const courses=new Map();
 const uid=type=>`${type}-${generation}-${++serial}`;
 const copy=value=>structuredClone(value);
 const entry=destination=>({id:uid('entry'),destination:copy(destination)});
 function ensure(courseId,initial={kind:'sequence'}){
  if(!account)throw Error('A signed-in workspace account is required.');
  if(!courses.has(courseId)){const tab={id:uid('view'),history:[entry(initial)],index:0};courses.set(courseId,{tabs:[tab],selected:tab.id,closed:[]});}
  return courses.get(courseId);
 }
 const active=courseId=>{const c=ensure(courseId);return c.tabs.find(t=>t.id===c.selected);};
 const current=tab=>tab.history[tab.index];
 const valid=(courseId,destination)=>{if(destination.courseId&&destination.courseId!==courseId)throw Error('Cross-course tabs are outside this workspace.');};
 return {
  setAccount(id){if(id===account)return;account=id;generation++;serial=0;courses.clear();},
  ensure,
  active,
  current:courseId=>current(active(courseId)),
  list:courseId=>ensure(courseId).tabs,
  newDraftId:()=>uid('draft'),
  open(courseId,destination={kind:'new'}){valid(courseId,destination);const c=ensure(courseId),tab={id:uid('view'),history:[entry(destination)],index:0};c.tabs.push(tab);c.selected=tab.id;return tab;},
  select(courseId,id){const c=ensure(courseId);if(!c.tabs.some(t=>t.id===id))return false;c.selected=id;return true;},
  navigate(courseId,destination){valid(courseId,destination);const tab=active(courseId);if(JSON.stringify(current(tab).destination)===JSON.stringify(destination))return current(tab);tab.history.splice(tab.index+1);tab.history.push(entry(destination));if(tab.history.length>50)tab.history.shift();tab.index=tab.history.length-1;return current(tab);},
  travel(courseId,step){const tab=active(courseId),index=tab.index+step;if(index<0||index>=tab.history.length)return false;tab.index=index;return true;},
  close(courseId,id){const c=ensure(courseId),index=c.tabs.findIndex(t=>t.id===id);if(index<0)return false;const [tab]=c.tabs.splice(index,1);c.closed.unshift(copy(tab));c.closed.length=Math.min(c.closed.length,10);if(!c.tabs.length){const blank={id:uid('view'),history:[entry({kind:'new'})],index:0};c.tabs.push(blank);}if(c.selected===id)c.selected=c.tabs[Math.min(index,c.tabs.length-1)].id;return true;},
  closed:courseId=>ensure(courseId).closed,
  reopen(courseId,index){const c=ensure(courseId),tab=c.closed.splice(index,1)[0];if(!tab)return false;tab.id=uid('view');tab.history=tab.history.map(e=>({...e,id:uid('entry')}));c.tabs.push(tab);c.selected=tab.id;return true;},
  promote(courseId,table,draftId,recordId){const c=ensure(courseId),changed=[];for(const tab of c.tabs)for(const e of tab.history)if(e.destination.table===table&&e.destination.draftId===draftId){e.destination={kind:table==='units'?'unit-plan':'lesson-plan',table,recordId};changed.push(e.id);}return changed;},
  entries:courseId=>ensure(courseId).tabs.flatMap(t=>t.history)
 };
}
