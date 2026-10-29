import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryLessons} from '../lesson-directory.js';
test('DEC-101: unit membership, sequence and combined search are immutable presentation filters',()=>{
 const units=[{id:'a',title:'Civics'},{id:'b',title:'Economics'}],rows=[{id:'2',unit_id:'a',position:2,title:'Debate',planning_status:'Ready'},{id:'3',unit_id:'b',position:1,title:'Debate'},{id:'1',unit_id:'a',position:1,title:'Rights',archived_at:'2026-01-01'}];
 const before=JSON.stringify(rows);
 assert.deepEqual(directoryLessons(rows,units,{unitId:'a'}).map(l=>l.id),['1','2']);
 assert.deepEqual(directoryLessons(rows,units,{unitId:'a',query:' READY '}).map(l=>l.id),['2']);
 assert.equal(directoryLessons(rows,units,{unitId:'empty'}).length,0);
 assert.equal(directoryLessons(rows,units,{unitId:'b',query:'Rights'}).length,0);
 assert.equal(directoryLessons(rows,units).length,3);assert.equal(JSON.stringify(rows),before);
});
