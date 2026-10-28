import {demand,hash,validateExport,counts,canonical} from './safety.mjs';
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Independent reader for the app's uncompressed UTF-8 ZIP format. Never extracts paths.
export function unzip(bytes){
 demand(bytes.length>=22&&bytes.length<=30000000,'ZIP_SIZE');
 const end=bytes.length-22;
 demand(bytes.readUInt32LE(end)===0x06054b50&&bytes.readUInt16LE(end+20)===0&&bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0,'ZIP_END');
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
 demand(count===bytes.readUInt16LE(end+8)&&start+size===end,'ZIP_DIRECTORY');
 const files=new Map();let cursor=start,localEnd=0;
 for(let i=0;i<count;i++){
  demand(cursor+46<=end&&bytes.readUInt32LE(cursor)===0x02014b50,'ZIP_CENTRAL');
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),crc=bytes.readUInt32LE(cursor+16),length=bytes.readUInt32LE(cursor+20),raw=bytes.readUInt32LE(cursor+24),n=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42);
  demand(flags===0x800&&method===0&&length===raw&&offset===localEnd&&cursor+46+n+extra+comment<=end,'ZIP_FORMAT');
  const name=bytes.subarray(cursor+46,cursor+46+n).toString('utf8');
  demand(/^(backup-manifest|course-planner-[a-f0-9-]{36})\.json$/.test(name)&&!files.has(name),'ZIP_FILENAME');
  demand(offset+30<=start&&bytes.readUInt32LE(offset)===0x04034b50,'ZIP_LOCAL');
  const localN=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28),dataStart=offset+30+localN+localExtra;
  demand(dataStart+length<=start&&bytes.readUInt16LE(offset+6)===flags&&bytes.readUInt16LE(offset+8)===method&&bytes.readUInt32LE(offset+14)===crc&&bytes.readUInt32LE(offset+18)===length&&bytes.readUInt32LE(offset+22)===raw&&bytes.subarray(offset+30,offset+30+localN).toString('utf8')===name,'ZIP_LOCAL_MISMATCH');
  const data=bytes.subarray(dataStart,dataStart+length);demand(crc32(data)===crc,'ZIP_CRC');files.set(name,data);localEnd=dataStart+length;cursor+=46+n+extra+comment;
 }
 demand(cursor===end&&localEnd===start,'ZIP_TRAILING_DATA');return files;
}
export function validateZip(bytes,snapshots){
 const files=unzip(bytes),manifest=JSON.parse(files.get('backup-manifest.json')?.toString()||'null');
 demand(manifest?.schema==='course-planner.account-backup-manifest.v1'&&manifest.courseCount===4&&manifest.courses.length===4&&files.size===5,'ZIP_MANIFEST');
 const seen=new Set();
 for(const entry of manifest.courses){
  const s=snapshots.find(s=>s.course.id===entry.courseId),file=files.get(entry.filename);
  demand(s&&entry.courseName===s.course.name&&!seen.has(entry.courseId)&&entry.filename===`course-planner-${entry.courseId}.json`&&file&&hash(file)===entry.sha256,'ZIP_HASH_OR_ID');seen.add(entry.courseId);
  validateExport(JSON.parse(file.toString()),s);
  demand(canonical(entry.counts)===canonical({units:counts(s).units,lessons:counts(s).lessons,calendarExceptions:counts(s).exceptions}),'ZIP_COUNTS');
 }
 return {files:files.size,sha256:hash(bytes)};
}
