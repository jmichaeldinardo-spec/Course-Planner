import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleTabIds,renderTabBar} from '../workspace-tab-view.js';
test('DEC-102: bounded contiguous strip retains active view and order at every density',()=>{
 for(const n of [3,6,10,50])for(const width of [100,300,900])for(let active=0;active<n;active++){
 const tabs=Array.from({length:n},(_,id)=>({id,history:[{}],index:0})),before=JSON.stringify(tabs),shown=visibleTabIds(tabs,active,width);
 assert.ok(shown.has(active));assert.ok(shown.size<=Math.max(1,Math.floor((width+4)/84)));assert.equal(JSON.stringify(tabs),before);
 const html=renderTabBar(tabs,tabs[active],()=>({label:'Full fictional title',dirty:true}),shown);
 assert.ok(html.includes('aria-label="Full fictional title · Unsaved edits"'));assert.ok(html.includes('outside strip'));
 }
});
