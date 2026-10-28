/* Complete saved-course reads through the signed-in RLS client. No alternate
 * editable store. Two verified read passes detect observed concurrent changes;
 * this is not a server-side transaction or a lock against later edits. */
export const COURSE_READ_LIMITS=Object.freeze({units:200,lessons:2000,calendar_exceptions:1000});
const PAGE_SIZE=100;
const checkCurrent=isCurrent=>{if(!isCurrent())throw new Error('Read canceled because the account, workspace or unsaved edits changed.');};
const version=row=>[row.id,row.course_id,row.unit_id,row.revision,row.updated_at];
function validRecord(row){return row&&typeof row.id==='string'&&row.id.length>0&&Number.isSafeInteger(row.revision)&&row.revision>0;}

async function readRows(client,table,courseId,columns,isCurrent){
 const rows=[];let total=null,lastId=null;
 do{
  checkCurrent(isCurrent);
  const start=rows.length,end=start+PAGE_SIZE-1;
  const {data,error,count}=await client.from(table).select(columns,{count:'exact'}).eq('course_id',courseId).order('id').range(start,end);
  checkCurrent(isCurrent);
  if(error)throw new Error('Could not read complete '+table+': '+error.message);
  if(!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)throw new Error('Cannot verify the complete '+table+' count. No partial records were accepted.');
  if(count>COURSE_READ_LIMITS[table])throw new Error(table+' exceeds the pilot limit of '+COURSE_READ_LIMITS[table]+'. No partial records were accepted.');
  if(total!==null&&count!==total)throw new Error('Saved '+table+' changed during the read. Retry when editing has stopped.');
  total=count;
  if(data.length!==Math.min(PAGE_SIZE,total-start))throw new Error('Incomplete '+table+' page. No partial records were accepted.');
  for(const row of data){
   if(!validRecord(row)||row.course_id!==courseId||lastId!==null&&row.id<=lastId)throw new Error('Invalid, duplicate or out-of-order '+table+' records.');
   lastId=row.id;rows.push(row);
  }
 }while(rows.length<total);
 return rows;
}
async function readCourse(client,user,id,isCurrent){
 checkCurrent(isCurrent);
 const {data,error}=await client.from('courses').select('*').eq('id',id).eq('owner_id',user.id).single();
 checkCurrent(isCurrent);
 if(error||!validRecord(data)||data.id!==id||data.owner_id!==user.id)throw new Error('Course access could not be verified for this account.');
 return data;
}
function validateLinks(units,lessons){const ids=new Set(units.map(u=>u.id));if(lessons.some(l=>!ids.has(l.unit_id)))throw new Error('Incomplete course/unit/lesson relationships. No partial records were accepted.');}
const signature=rows=>JSON.stringify(rows.map(version));
const byPosition=(a,b)=>(a.position??0)-(b.position??0)||(a.id<b.id?-1:a.id>b.id?1:0);

export async function readCompleteCourse(client,user,id,{isCurrent=()=>true}={}){
 if(!user?.id)throw new Error('Sign in before reading a saved course.');
 const course=await readCourse(client,user,id,isCurrent);
 const tables=Object.keys(COURSE_READ_LIMITS);
 const [units,lessons,exceptions]=await Promise.all(tables.map(table=>readRows(client,table,id,'*',isCurrent)));
 validateLinks(units,lessons);
 const checked=await Promise.all(tables.map(table=>readRows(client,table,id,table==='lessons'?'id,course_id,unit_id,revision,updated_at':'id,course_id,revision,updated_at',isCurrent)));
 validateLinks(checked[0],checked[1]);
 const courseCheck=await readCourse(client,user,id,isCurrent);
 if(JSON.stringify(course)!==JSON.stringify(courseCheck)||[units,lessons,exceptions].some((rows,i)=>signature(rows)!==signature(checked[i])))throw new Error('Saved records changed during the read. Retry when editing has stopped.');
 checkCurrent(isCurrent);
 return {course,units:units.sort(byPosition),lessons:lessons.sort(byPosition),exceptions:exceptions.sort((a,b)=>String(a.date).localeCompare(String(b.date))||byPosition(a,b))};
}

async function verifyUser(client,user,isCurrent){
 checkCurrent(isCurrent);
 const {data,error}=await client.auth.getUser();
 checkCurrent(isCurrent);
 if(error||data?.user?.id!==user.id)throw new Error('Authentication changed. No export was created.');
}
export async function makeCourseExport(client,user,id,{isCurrent=()=>true}={}){
 if(!user?.id)throw new Error('Sign in before exporting a saved course.');
 await verifyUser(client,user,isCurrent);
 const {course,units,lessons,exceptions}=await readCompleteCourse(client,user,id,{isCurrent});
 await verifyUser(client,user,isCurrent);
 const json={schema:'course-planner.pilot-export.v1',exportedAt:new Date().toISOString(),course,units,lessons,calendarExceptions:exceptions};
 const text=JSON.stringify(json,null,2);
 if(new TextEncoder().encode(text).length>6000000)throw new Error('Course export exceeds the 6 MB restore limit. No file was created.');
 checkCurrent(isCurrent);
 return {json,text};
}
