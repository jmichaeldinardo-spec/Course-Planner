// Page-memory curriculum state. View IDs never identify or create saved records.
// No browser storage or database client belongs in this module.
const immutable = value => {
 const copy=structuredClone(value);
 const freeze=object=>{if(object&&typeof object==='object'){Object.values(object).forEach(freeze);Object.freeze(object);}return object;};
 return freeze(copy);
};
const key=ref=>JSON.stringify([ref.accountId,ref.generation,ref.courseId,ref.table,ref.recordId,ref.recordId?null:ref.draftId]);
const tables={units:'units',lessons:'lessons',calendar_exceptions:'exceptions'};
export function createWorkspaceState(){
 let accountId=null,generation=0,pending=null,serial=0;
 const courses=new Map(),drafts=new Map(),reads=new Map(),operations=new Map(),listeners=new Set();
 const current=token=>token.generation===generation&&token.accountId===accountId;
 const notify=()=>listeners.forEach(listener=>listener());
 const operation=ref=>[...operations.values()].find(op=>key(op.ref)===key(ref)||key(op.originalRef)===key(ref))??null;
 const unresolved=op=>!op.dismissed&&['writing','acknowledged','verifying','unconfirmed','unknown'].includes(op.phase);
 const hasUnresolved=courseId=>[...operations.values()].some(op=>(courseId===undefined||op.ref.courseId===courseId)&&unresolved(op));
 const active=op=>current(op.ref)&&operations.get(op.id)?.id===op.id;
 const replace=(op,changes)=>{const next=immutable({...op,...changes});operations.set(op.id,next);notify();return next;};
 const record=ref=>current(ref)?courses.get(ref.courseId)?.[tables[ref.table]]?.find(row=>row.id===ref.recordId)??null:null;
 const reference=(courseId,table,recordId=null,draftId=null)=>{
  if(!tables[table])throw new Error('Unknown curriculum record type.');
  return Object.freeze({accountId,generation,courseId,table,recordId,draftId:recordId?null:draftId||`draft-${generation}-${++serial}`});
 };
 function edit(ref,values){
  if(!current(ref)||!accountId||!courses.has(ref.courseId))throw new Error('This workspace reference has expired.');
  if(['id','owner_id','course_id','revision'].some(name=>Object.hasOwn(values,name)))throw new Error('Drafts cannot change saved record identities or revisions.');
  const id=key(ref),previous=drafts.get(id);
  const draft=immutable({ref,values:{...previous?.values,...values},version:++serial,baseRevision:previous?.baseRevision??record(ref)?.revision??null,error:null});
  drafts.set(id,draft);notify();return draft;
 }
 function discardRecord(ref){
  const op=operation(ref);if(pending&&op?.id===pending.id)return false;
  drafts.delete(key(op?.ref??ref));
  // Explicitly abandoning local work cannot undo a write. Keep an unknown-create
  // tombstone so returning through history can never submit that identity again.
  if(op)replace(op,{dismissed:true});else notify();return true;
 }
 async function verify(receipt,read){
  let op=operations.get(receipt.id);
  if(!op||!current(receipt.ref)||!active(op)||op.revision!==receipt.revision)return {current:false};
  if(!['acknowledged','unconfirmed'].includes(op.phase))throw Error('This operation cannot be verified again.');
  if(pending&&pending.id!==op.id)throw Error('Wait for the current save to finish.');
  const attempt={id:op.id,attempt:++serial},before=courses.get(op.ref.courseId);pending=attempt;
  op=replace(op,{phase:'verifying',error:null,dismissed:false});
  const isCurrent=()=>active(op)&&pending===attempt&&record(op.ref)?.revision===op.revision;
  try{
   const snapshot=await read({isCurrent,ref:op.ref});
   if(!isCurrent())return {current:false};
   const row=snapshot?.[tables[op.ref.table]]?.find(row=>row.id===op.ref.recordId);
   if(snapshot?.course?.id!==op.ref.courseId||snapshot.course.owner_id!==accountId||!row||row.course_id!==op.ref.courseId||row.revision!==op.revision||Object.entries(op.patch).some(([k,v])=>JSON.stringify(row[k]??null)!==JSON.stringify(v??null)))throw Error('Save was acknowledged but its readback could not be verified. Check saved data before retrying.');
   replace(op,{phase:'verified',error:null});
   // Never publish a whole-course read over newer drafts or another snapshot.
   if(courses.get(op.ref.courseId)===before&&![...drafts.values()].some(d=>d.ref.courseId===op.ref.courseId)&&!hasUnresolved(op.ref.courseId))courses.set(op.ref.courseId,immutable(snapshot));
   return {current:true,ref:op.ref,newerEdits:drafts.has(key(op.ref))};
  }catch(error){
   if(!active(op)||pending!==attempt)return {current:false};
   replace(op,{phase:'unconfirmed',error:error.message});throw error;
  }finally{if(pending===attempt){pending=null;notify();}}
 }
 return {
  setAccount(id){if(id===accountId)return;accountId=id;generation++;courses.clear();drafts.clear();reads.clear();operations.clear();pending=null;notify();},
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  reject(ref,message){
   if(!current(ref)||pending)return;
   const prior=operation(ref);if(prior&&prior.phase!=='verified')return;
   if(prior)operations.delete(prior.id);
   const draft=drafts.get(key(ref));if(!draft)return;
   const op=immutable({id:++serial,ref,originalRef:ref,version:draft.version,phase:'rejected',error:message});operations.set(op.id,op);notify();
  },
  operation,
  hasUnresolved,
  needsAttention:ref=>!!drafts.get(key(operation(ref)?.ref??ref))||!!operation(ref)&&unresolved(operation(ref)),
  summary(){
   const all=[...operations.values()],problems=all.filter(op=>!op.dismissed&&['unconfirmed','unknown','rejected','conflict'].includes(op.phase)),busy=pending&&operations.get(pending.id);
   return {phase:busy?(busy.phase==='writing'?'writing':'verifying'):problems[0]?.phase??(drafts.size?'dirty':all.some(op=>['unknown','unconfirmed'].includes(op.phase))?'idle':all.some(op=>op.phase==='verified')?'verified':'idle'),dirtyCount:drafts.size,unresolvedCount:all.filter(unresolved).length,retry:!pending?problems.find(op=>op.phase==='unconfirmed')??null:null};
  },
  verify,
  account:()=>accountId,
  reference,
  isCurrent:current,
  discardRecord,
  beginRead(courseId){const token={accountId,generation,courseId,request:++serial};reads.set(courseId,token);return token;},
  publish(token,snapshot){
   if(!current(token)||reads.get(token.courseId)!==token)return false;
   if(snapshot.course.id!==token.courseId||snapshot.course.owner_id!==accountId)throw new Error('Course ownership mismatch.');
   // A background read cannot silently rebase a dirty editor onto someone else's revision.
   if([...drafts.values()].some(d=>d.ref.courseId===token.courseId)||hasUnresolved(token.courseId))return false;
   courses.set(token.courseId,immutable(snapshot));
   // After explicit discard, a complete fresh read establishes the next base for
   // an existing record. Unidentified create tombstones still cannot be retried.
   for(const op of operations.values())if(op.ref.courseId===token.courseId&&op.dismissed&&['unknown','unconfirmed'].includes(op.phase)&&op.ref.recordId)operations.delete(op.id);
   notify();return true;
  },
  snapshot:courseId=>courses.get(courseId)??null,
  record,
  draft:ref=>drafts.get(key(ref))??null,
  editing:ref=>({...record(ref),...drafts.get(key(ref))?.values}),
  edit,
  hasDraft:courseId=>[...drafts.values()].some(d=>courseId===undefined||d.ref.courseId===courseId),
  discard(courseId){if(pending&&operations.get(pending.id)?.ref.courseId===courseId)return false;for(const d of [...drafts.values()])if(d.ref.courseId===courseId)discardRecord(d.ref);for(const op of operations.values())if(op.ref.courseId===courseId&&!op.dismissed)replace(op,{dismissed:true});notify();return true;},
  isSaving:()=>!!pending,
  async save(ref,patch,write){
   if(pending)throw new Error('Wait for the current save to finish.');
   if(!current(ref)||!accountId||!courses.has(ref.courseId))throw new Error('This workspace reference has expired.');
   const prior=operation(ref);
   if(prior&&['unknown','unconfirmed','acknowledged'].includes(prior.phase)){
    if(prior.dismissed)replace(prior,{dismissed:false});
    throw Error(prior.phase==='unknown'?'Save outcome unknown. This write may already have succeeded. Do not submit it again; check saved records before explicitly discarding local work.':'Verify the acknowledged save before submitting another write.');
   }
   const draft=drafts.get(key(ref))??edit(ref,{}),submitted=immutable(patch);
   const saved=record(ref);
   if(ref.recordId&&!saved)throw new Error('Record was not found.');
   if(prior)operations.delete(prior.id);
   let token=immutable({id:++serial,ref,originalRef:ref,version:draft.version,raw:draft.values,patch:submitted,baseRevision:draft.baseRevision,phase:'writing',error:null});operations.set(token.id,token);pending=token;notify();
   try{
    const result=await write({patch:submitted,record:saved?{...saved,revision:draft.baseRevision}:null});
    if(!active(token)||pending!==token)return {current:false};
    if(result.error){
     // Database/auth rejections prove no accepted write. Fetch errors, timeouts,
     // and gateway failures do not. Never turn an unknown outcome into a retry.
     const rejected=/^(?:[0-9A-Z]{5}|PGRST\d+)$/.test(result.error.code||'')||[400,401,403,404,409,422].includes(result.status);
     const next=replace(token,{phase:rejected?'rejected':'unknown',error:result.error.message});pending=next;token=next;throw new Error(result.error.message);
    }
    if(!result.data){const next=replace(token,{phase:ref.recordId?'conflict':'unknown'});pending=next;token=next;throw new Error('Save conflict: this record changed or access is unavailable. Your unsaved edits remain here. Copy them before reloading.');}
    const row=result.data;
    if(!row.id||ref.recordId&&row.id!==ref.recordId||!Number.isSafeInteger(row.revision)||row.revision<1||saved&&row.revision<=draft.baseRevision)throw new Error('Save acknowledgement could not be verified. Reload saved records before retrying.');
    const nextRef=reference(ref.courseId,ref.table,row.id),snapshot=courses.get(ref.courseId),table=tables[ref.table];
    const next={...saved,...submitted,...row};
    courses.set(ref.courseId,immutable({...snapshot,[table]:ref.recordId?snapshot[table].map(r=>r.id===ref.recordId?next:r):[...snapshot[table],next]}));
    const latest=drafts.get(key(ref)),newerEdits=latest?.version!==token.version;
    drafts.delete(key(ref));
    if(newerEdits&&latest)drafts.set(key(nextRef),immutable({...latest,ref:nextRef,baseRevision:row.revision,error:null}));
    const acknowledged=replace(token,{ref:nextRef,revision:row.revision,phase:'acknowledged'});pending=acknowledged;token=acknowledged;
    return {current:true,ref:nextRef,newerEdits,receipt:acknowledged};
   }catch(error){
    if(!active(token)||pending!==token)return {current:false};
    replace(token,{phase:token.phase==='writing'?'unknown':token.phase,error:error.message});
    const latest=drafts.get(key(ref));if(latest)drafts.set(key(ref),immutable({...latest,error:error.message}));
    throw error;
   }finally{if(pending===token&&token.phase!=='acknowledged'){pending=null;notify();}}
  }
 };
}
