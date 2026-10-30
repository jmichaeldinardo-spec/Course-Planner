import test from 'node:test';
import assert from 'node:assert/strict';
import {isDismissGesture} from '../mobile-shell.js';
test('phone drawer dismissal requires a substantial leftward, axis-stable gesture',()=>{
 const start={x:180,y:240};
 assert.equal(isDismissGesture(start,{x:100,y:250}),true);
 for(const end of [{x:260,y:240},{x:150,y:240},{x:90,y:320}])assert.equal(isDismissGesture(start,end),false);
});
