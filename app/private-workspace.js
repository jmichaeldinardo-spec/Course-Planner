
/* Private Course Planner vertical slice: real, owner-isolated Supabase records.
 * The fictional preview remains separate and is NEVER a source of persisted data. */
const $ = id => document.getElementById(id);
const root = $("private-workspace");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const uuidRE = /^[0-9a-f-]{36}$/i;
const unitFields = [
 ["title","Unit title","text"],["position","Unit order","number"],
 ["target_days","Target days","number"],["essential_questions","Essential question(s)","textarea"],
 ["purpose","Purpose / rationale","textarea"],["enduring_understandings","Enduring understandings","textarea"],
 ["priority_standards","Priority standards","textarea"],["learning_outcomes","Learning outcomes","textarea"],
 ["culminating_assessment","Culminating assessment","textarea"],["formative_evidence","Other evidence","textarea"],
 ["key_vocabulary","Key vocabulary","textarea"],["prerequisite_knowledge","Prerequisites","textarea"],
 ["misconceptions","Common misconceptions","textarea"],["differentiation","Differentiation","textarea"],
 ["core_resources","Core resources","textarea"],["notes","Unit notes","textarea"]
];
const lessonFields = [
 ["title","Lesson title","text"],["position","Sequence position","number"],
 ["planning_status","Planning status","select",["Draft","In Progress","Ready"]],
 ["lesson_type","Lesson type","text"],["objective","Learning objective","textarea"],
 ["guiding_questions","Guiding question(s)","textarea"],["key_vocabulary","Vocabulary","textarea"],
 ["standards","Standards","textarea"],["chapter","Textbook chapter","text"],
 ["pages","Textbook pages","text"],["section","Textbook section","text"],
 ["evidence_source","Evidence / source","textarea"],["materials","Materials","textarea"],
 ["resources_links","Resource references","textarea"],["differentiation","Differentiation","textarea"],
 ["assessment","Assessment","textarea"],["homework","Homework","textarea"],["notes","Lesson notes","textarea"],
 ["textbook_map_item","Textbook map item","text"]
];
let api=null, owner=null, course=null, units=[],lessons=[],exceptions=[],selectedUnit=null,selectedLesson=null,tab="sequence",dirty=false,epoch=0;
function status(message,kind="info"){const e=$("private-status");if(e){e.textContent=message;e.dataset.kind=kind;}}
function field([name,label,type,options],value){
 const text=escapeHtml(value??"");
 if(type==="select")return '<label class="private-field">'+escapeHtml(label)+'<select name="'+name+'">'+options.map(x=>'<option value="'+escapeHtml(x)+'"'+(x===value?' selected':'')+'>'+escapeHtml(x)+'</option>').join("")+'</select></label>';
 if(type==="textarea")return '<label class="private-field">'+escapeHtml(label)+'<textarea name="'+name+'" rows="3">'+text+'</textarea></label>';
 const required=(name==="title"||name==="position")?" required":"";
 const min=type==="number"?" min="+(name==="target_days"?"0":"1"):"";
 return '<label class="private-field">'+escapeHtml(label)+'<input type="'+type+'" name="'+name+'" value="'+text+'"'+min+required+'></label>';
}
function formValues(form,fields){const f=new FormData(form),out={};
 for(const [key,,type] of fields){const raw=String(f.get(key)??"").trim();out[key]=type==="number"?(raw===""?null:Number(raw)):(raw===""?null:raw);}
 return out;
}
function canNavigate(){return !dirty || confirm("Your current changes are not saved. Discard them?");}
function setDirty(next){dirty=next;if(next)status("Unsaved changes — select Save to store them.","pending");}
function reset(){epoch++;api=null;owner=null;course=null;units=[];lessons=[];exceptions=[];dirty=false;root.hidden=true;root.replaceChildren();}
export function clearPrivateWorkspace(){reset();}
export function activePrivateCourseId(){return course?.id??null;}
export async function openPrivateCourse(client,user,id){
 if(!uuidRE.test(id))throw new Error("Invalid course ID.");
 const call=++epoch;api=client;owner=user;root.hidden=false;root.innerHTML='<p role="status">Loading your saved course…</p>';
 const [c,u,l,e]=await Promise.all([
  api.from("courses").select("*").eq("id",id).single(),
  api.from("units").select("*").eq("course_id",id).order("position"),
  api.from("lessons").select("*").eq("course_id",id).order("position"),
  api.from("calendar_exceptions").select("*").eq("course_id",id).order("date")
 ]);
 if(call!==epoch)return;
 const firstError=[c.error,u.error,l.error,e.error].find(Boolean);
 if(firstError){root.replaceChildren();root.textContent="Unable to open private course: "+firstError.message;return;}
 if(!c.data || c.data.owner_id!==user.id){root.textContent="Course unavailable for this account.";return;}
 course=c.data;units=u.data||[];lessons=l.data||[];exceptions=e.data||[];
 if(!units.some(x=>x.id===selectedUnit))selectedUnit=units[0]?.id||null;
 if(!lessons.some(x=>x.id===selectedLesson))selectedLesson=lessons[0]?.id||null;
 dirty=false;render();
 status("Loaded from private cloud storage.","saved");
}
function render(){
 if(!course)return;
 const currentUnit=units.find(x=>x.id===selectedUnit);
 const currentLesson=lessons.find(x=>x.id===selectedLesson);
 const nav=[["sequence","Course Sequence"],["units","Unit Planning"],["lessons","Lesson Planning"],["calendar","Calendar & Exceptions"]]
  .map(([k,name])=>'<button type="button" data-private-tab="'+k+'" aria-pressed="'+(tab===k)+'">'+name+'</button>').join("");
 root.innerHTML='<div class="private-header"><div><p class="private-kicker">SAVED WORKSPACE · PRIVATE ACCOUNT</p><h2>'+escapeHtml(course.name)+'</h2><p>'+units.length+' unit(s) · '+lessons.length+' lesson(s) · '+exceptions.length+' calendar exception(s)</p></div><button data-private-export type="button">Export course JSON</button></div>'+
 '<nav class="private-nav" aria-label="Private planning workspaces">'+nav+'</nav>'+
 '<p id="private-status" role="status" aria-live="polite">Loaded from private cloud storage.</p>'+
 '<div class="private-content">'+(tab==="sequence"?renderSequence():tab==="units"?renderUnits(currentUnit):tab==="lessons"?renderLessons(currentLesson):renderCalendar())+'</div>';
}
function renderSequence(){
 return '<p>One authoritative list of saved lessons. Select a lesson to edit its shared record.</p>'+
 (lessons.length?'<div class="private-table-wrap"><table class="private-table"><thead><tr><th>Sequence</th><th>Unit</th><th>Lesson</th><th>Status</th><th>Scheduled</th></tr></thead><tbody>'+
 lessons.map(x=>'<tr><td>'+x.position+'</td><td>'+escapeHtml(units.find(u=>u.id===x.unit_id)?.title||"")+'</td><td><button data-private-lesson="'+x.id+'">'+escapeHtml(x.title)+'</button></td><td>'+escapeHtml(x.planning_status)+'</td><td>'+escapeHtml((x.scheduled_dates||[]).join(", ")||"Unscheduled")+'</td></tr>').join("")+
 '</tbody></table></div>':'<p>No saved lessons yet. Add a unit, then add lessons.</p>')+
 '<p class="private-warning">Scheduling is not automatic yet. Existing saved dates are displayed, not recalculated.</p>';
}
function renderUnits(current){
 const selector=units.map(u=>'<option value="'+u.id+'"'+(u.id===selectedUnit?' selected':'')+'>'+escapeHtml(u.position+' · '+u.title)+'</option>').join("");
 const existing=current?'<label class="private-field">Select unit<select data-private-select-unit>'+selector+'</select></label>'+
 '<form data-private-save="units" data-id="'+current.id+'" class="private-editor"><div class="private-form-grid">'+unitFields.slice(0,5).map(f=>field(f,current[f[0]])).join("")+'</div><details><summary>More unit planning fields</summary><div class="private-form-grid">'+unitFields.slice(5).map(f=>field(f,current[f[0]])).join("")+'</div></details><button type="submit">Save unit changes</button></form>':
 '<p>No units yet. Create your first unit below.</p>';
 return '<p>Essential questions live on the unit; associated lessons inherit the context.</p>'+existing+
 '<details class="private-new-form"><summary>Add unit</summary><form data-private-create="units" class="private-form-grid"><label>Unit title<input name="title" required maxlength="180"></label><label>Order<input type="number" name="position" min="1" value="'+(units.length+1)+'" required></label><button type="submit">Create unit</button></form></details>';
}
function renderLessons(current){
 const options=lessons.map(l=>'<option value="'+l.id+'"'+(l.id===selectedLesson?' selected':'')+'>'+escapeHtml(l.position+' · '+l.title)+'</option>').join("");
 const unitOptions=units.map(u=>'<option value="'+u.id+'">'+escapeHtml(u.title)+'</option>').join("");
 const context=current?units.find(x=>x.id===current.unit_id):null;
 const existing=current?'<label class="private-field">Select lesson<select data-private-select-lesson>'+options+'</select></label>'+
 '<p class="private-context"><strong>Unit:</strong> '+escapeHtml(context?.title||"Unknown")+' <strong>Essential question(s):</strong> '+escapeHtml(context?.essential_questions||"Not entered")+'</p>'+
 '<form data-private-save="lessons" data-id="'+current.id+'" class="private-editor"><div class="private-form-grid">'+lessonFields.slice(0,7).map(f=>field(f,current[f[0]])).join("")+'</div><details><summary>Additional lesson planning fields</summary><div class="private-form-grid">'+lessonFields.slice(7).map(f=>field(f,current[f[0]])).join("")+'</div></details><button type="submit">Save lesson changes</button></form>':
 '<p>No lessons yet. Add a lesson to a unit below.</p>';
 const create=units.length?'<details class="private-new-form"><summary>Add lesson</summary><form data-private-create="lessons" class="private-form-grid"><label>Unit<select name="unit_id">'+unitOptions+'</select></label><label>Lesson title<input name="title" required maxlength="180"></label><label>Sequence position<input type="number" name="position" min="1" required value="'+(lessons.length+1)+'"></label><button type="submit">Create lesson</button></form></details>':'<p>Create a unit before adding lessons.</p>';
 return '<p>Lesson details and Course Sequence refer to the same saved lesson record. Blank fields are optional.</p>'+existing+create;
}
function renderCalendar(){
 return '<p class="private-warning">Read-only scheduling checkpoint: dates and exceptions are stored, but calculating instructional days, previews, pin conflicts and atomic moves is not implemented yet. Do not rely on this screen for scheduling decisions.</p>'+
 '<h3>Stored lesson dates</h3><ul>'+lessons.map(l=>'<li>'+escapeHtml(l.title)+': '+escapeHtml((l.scheduled_dates||[]).join(", ")||"Unscheduled")+'</li>').join("")+'</ul>'+
 '<h3>Stored calendar exceptions</h3>'+(exceptions.length?'<ul>'+exceptions.map(e=>'<li>'+escapeHtml(e.date+" · "+e.title+" · "+e.effect)+'</li>').join("")+'</ul>':'<p>No exceptions saved yet.</p>');
}
function exportCourse(){
 if(!course || dirty){status("Save or discard changes before exporting.","error");return;}
 const json={schema:"course-planner.pilot-export.v1",exportedAt:new Date().toISOString(),course,units,lessons,calendarExceptions:exceptions};
 const blob=new Blob([JSON.stringify(json,null,2)],{type:"application/json"});
 const link=document.createElement("a"),url=URL.createObjectURL(blob);
 link.href=url;link.download="course-planner-"+course.id+".json";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 status("Export created from your last retrieved saved records. This is not an automated backup.","saved");
}
root.addEventListener("input",e=>{if(e.target.closest("form[data-private-save]"))setDirty(true);});
root.addEventListener("click",async e=>{
 const button=e.target.closest("button");if(!button)return;
 if(button.matches("[data-private-tab]")){if(!canNavigate())return;tab=button.dataset.privateTab;dirty=false;render();}
 else if(button.matches("[data-private-lesson]")){if(!canNavigate())return;selectedLesson=button.dataset.privateLesson;tab="lessons";dirty=false;render();}
 else if(button.matches("[data-private-export]"))exportCourse();
});
root.addEventListener("change",e=>{
 if(e.target.matches("[data-private-select-unit]")){if(!canNavigate()){e.target.value=selectedUnit;return;}selectedUnit=e.target.value;dirty=false;render();}
 if(e.target.matches("[data-private-select-lesson]")){if(!canNavigate()){e.target.value=selectedLesson;return;}selectedLesson=e.target.value;dirty=false;render();}
});
root.addEventListener("submit",async e=>{
 const form=e.target.closest("form");if(!form)return;e.preventDefault();
 if(!api || !owner || !course)return;
 const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status("Saving to your private database…","pending");
 try{
  const table=form.dataset.privateSave||form.dataset.privateCreate;
  if(!["units","lessons"].includes(table))throw new Error("Unknown record type");
  let result;
  if(form.dataset.privateSave){
   const record=(table==="units"?units:lessons).find(x=>x.id===form.dataset.id);
   if(!record)throw new Error("Record was not found.");
   const fields=table==="units"?unitFields:lessonFields;
   const patch=formValues(form,fields);
   if(!patch.title || !Number.isInteger(patch.position) || patch.position<1 || (patch.target_days!==undefined && patch.target_days!==null && (!Number.isInteger(patch.target_days)||patch.target_days<0)))throw new Error("Check the required title and numeric fields.");
   result=await api.from(table).update(patch).eq("id",record.id).eq("revision",record.revision).select("id,revision").maybeSingle();
   if(!result.error && !result.data)throw new Error("Save conflict: this record changed in another session. Your unsaved edits remain here. Copy them before reloading.");
  }else{
   const name=String(new FormData(form).get("title")||"").trim(), position=Number(new FormData(form).get("position"));
   if(!name||!Number.isInteger(position)||position<1)throw new Error("A title and positive sequence position are required.");
   const payload={course_id:course.id,title:name,position};
   if(table==="lessons"){const unitId=String(new FormData(form).get("unit_id")||"");if(!units.some(u=>u.id===unitId))throw new Error("Choose a valid unit.");payload.unit_id=unitId;}
   result=await api.from(table).insert(payload).select("id").single();
   if(!result.error && result.data){if(table==="units")selectedUnit=result.data.id;else selectedLesson=result.data.id;}
  }
  if(result.error)throw new Error(result.error.message);
  await openPrivateCourse(api,owner,course.id);
  status("Saved and verified by reloading your private course records.","saved");
 }catch(err){status("Save failed: "+err.message,"error");}
 finally{if(btn.isConnected)btn.disabled=false;}
});
window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
