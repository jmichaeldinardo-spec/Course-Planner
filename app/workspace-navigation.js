// Navigation policy is separate from curriculum, DOM, and future tab instances.
// Home and course switches retain drafts; replacing an editor requires consent.
export function createWorkspaceNavigation({hasDraft,isSaving,discard,confirmDiscard}){
 let sequence=0,destination=null;
 return {
  transition(target,apply=()=>{}){
   const preserve=target.kind==='home'||target.kind==='resume'||target.kind==='course'||target.kind==='tab';
   if(isSaving()&&target.kind!=='home'&&target.kind!=='resume')return {ok:false,reason:'saving'};
   if(!preserve&&hasDraft(target.courseId,target)){
    if(!confirmDiscard(target))return {ok:false,reason:'cancelled'};
    if(discard(target.courseId,target)===false)return {ok:false,reason:'saving'};
   }
   destination=Object.freeze({...target,viewId:target.viewId??'primary'});sequence++;
   apply(destination);return {ok:true};
  },
  begin(){return ++sequence;},
  isCurrent:token=>token===sequence,
  reset(){sequence++;destination=null;},
  destination:()=>destination
 };
}
