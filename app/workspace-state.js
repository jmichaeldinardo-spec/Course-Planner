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
 const courses=new Map(),drafts=new Map(),reads=new Map();
 const current=token=>token.generation===generation&&token.accountId===accountId;
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
  drafts.set(id,draft);return draft;
 }
 return {
  setAccount(id){if(id===accountId)return;accountId=id;generation++;courses.clear();drafts.clear();reads.clear();pending=null;},
  account:()=>accountId,
  reference,
  isCurrent:current,
  discardRecord(ref){if(pending&&key(pending.ref)===key(ref))return false;drafts.delete(key(ref));return true;},
  beginRead(courseId){const token={accountId,generation,courseId,request:++serial};reads.set(courseId,token);return token;},
  publish(token,snapshot){
   if(!current(token)||reads.get(token.courseId)!==token)return false;
   if(snapshot.course.id!==token.courseId||snapshot.course.owner_id!==accountId)throw new Error('Course ownership mismatch.');
   // A background read cannot silently rebase a dirty editor onto someone else's revision.
   if([...drafts.values()].some(d=>d.ref.courseId===token.courseId))return false;
   courses.set(token.courseId,immutable(snapshot));return true;
  },
  snapshot:courseId=>courses.get(courseId)??null,
  record,
  draft:ref=>drafts.get(key(ref))??null,
  editing:ref=>({...record(ref),...drafts.get(key(ref))?.values}),
  edit,
  hasDraft:courseId=>[...drafts.values()].some(d=>courseId===undefined||d.ref.courseId===courseId),
  discard(courseId){if(pending?.ref.courseId===courseId)return false;for(const [id,d] of drafts)if(d.ref.courseId===courseId)drafts.delete(id);return true;},
  isSaving:()=>!!pending,
  async save(ref,patch,write){
   if(pending)throw new Error('Wait for the current save to finish.');
   if(!current(ref)||!accountId||!courses.has(ref.courseId))throw new Error('This workspace reference has expired.');
   const draft=drafts.get(key(ref))??edit(ref,{}),submitted=immutable(patch);
   const saved=record(ref);
   if(ref.recordId&&!saved)throw new Error('Record was not found.');
   const token={accountId,generation,ref,version:draft.version};pending=token;
   try{
    const result=await write({patch:submitted,record:saved?{...saved,revision:draft.baseRevision}:null});
    if(!current(token)||pending!==token)return {current:false};
    if(result.error)throw new Error(result.error.message);
    if(!result.data)throw new Error('Save conflict: this record changed in another session. Your unsaved edits remain here. Copy them before reloading.');
    const row=result.data;
    if(!row.id||ref.recordId&&row.id!==ref.recordId||!Number.isInteger(row.revision))throw new Error('Save acknowledgement could not be verified. Reload saved records before retrying.');
    const nextRef=reference(ref.courseId,ref.table,row.id),snapshot=courses.get(ref.courseId),table=tables[ref.table];
    const next={...saved,...submitted,...row};
    courses.set(ref.courseId,immutable({...snapshot,[table]:ref.recordId?snapshot[table].map(r=>r.id===ref.recordId?next:r):[...snapshot[table],next]}));
    const latest=drafts.get(key(ref)),newerEdits=latest?.version!==token.version;
    drafts.delete(key(ref));
    if(newerEdits&&latest)drafts.set(key(nextRef),immutable({...latest,ref:nextRef,baseRevision:row.revision,error:null}));
    return {current:true,ref:nextRef,newerEdits};
   }catch(error){
    if(!current(token)||pending!==token)return {current:false};
    const latest=drafts.get(key(ref));if(latest)drafts.set(key(ref),immutable({...latest,error:error.message}));
    throw error;
   }finally{if(pending===token)pending=null;}
  }
 };
}
