import {scheduleFixture} from './fixtures/scheduling-scenarios.mjs';

export function manualSaveFixture(){
 const f=scheduleFixture(),extra=scheduleFixture();
 extra.course={...extra.course,id:'81000000-0000-4000-8000-000000000001',name:'Second fictional reliability course'};
 extra.units=extra.units.map(u=>({...u,id:'81000000-0000-4000-8000-000000000002',course_id:extra.course.id}));
 extra.lessons=extra.lessons.map((l,i)=>({...l,id:'81000000-0000-4000-8000-'+String(i+10).padStart(12,'0'),course_id:extra.course.id,unit_id:extra.units[0].id}));
 extra.exceptions=[];f.dashboardExtra=extra;return f;
}

export async function verifyManualSave(page,width,fixture,{check,click,control,out}){
 const prefix='manual-save-'+width,lesson=fixture.lessons[0];
 const field=()=>page.locator('form[data-private-save="lessons"] [name="objective"]');
 const save=()=>click(page.locator('form[data-private-save] button[type="submit"]'));
 const phase=expected=>page.waitForFunction(expected=>document.querySelector('#manual-save-status')?.dataset.phase===expected,expected);
 const open=async(courseId=fixture.course.id,lessonId=lesson.id)=>{
  await page.evaluate(async({courseId,lessonId})=>{const w=await import('./private-workspace.js');const result=await w.openDashboardDestination(window.testClient,{id:window.testOwner},{courseId,lessonId});if(!result.ok)throw Error(result.message);},{courseId,lessonId});
  await field().waitFor();
 };
 const hold=()=>page.evaluate(()=>{window.testHoldReadback=true;delete window.testReleaseReadback;});
 const held=()=>page.waitForFunction(()=>typeof window.testReleaseReadback==='function');
 const release=()=>page.evaluate(()=>window.testReleaseReadback());
 const unchangedWrites=before=>page.evaluate(before=>window.testWrites.length===before,before);
 const writes=()=>page.evaluate(()=>window.testWrites.length);
 const reload=async()=>{const accept=d=>d.accept();page.on('dialog',accept);try{await click(page.locator('[data-private-reload]'));await page.waitForFunction(()=>document.querySelector('#private-status')?.textContent==='Loaded from private cloud storage.');}finally{page.off('dialog',accept);}};
 await page.locator('#saved-courses [data-private-open]').first().waitFor({state:'attached'});await open();
 check(prefix+' initial status is honest manual idle',await page.locator('#manual-save-message').textContent()==='Manual Save · No pending edits');
 check(prefix+' feedback font is restrained and readable',await page.locator('#manual-save-message').evaluate(e=>{const size=parseFloat(getComputedStyle(e).fontSize);return size>=13&&size<=14;}));
 await control(field(),'fill','Submitted before verification');await hold();await save();await held();await phase('verifying');
 check(prefix+' acknowledgement remains busy and guarded',await page.evaluate(async()=>(await import('./private-workspace.js')).isPrivateWorkspaceBusy()&&(await import('./private-workspace.js')).isPrivateWorkspaceDirty()));
 await control(field(),'fill','  Newer during verification  ');
 await page.evaluate(()=>{const node=document.querySelector('[name="objective"]');node.focus({preventScroll:true});node.setSelectionRange(3,8);const main=document.querySelector('.private-primary');main.scrollTop=80;window.manualCaret={node,start:node.selectionStart,end:node.selectionEnd,top:main.scrollTop};});
 await release();await phase('dirty');
 check(prefix+' newer text survives earlier confirmation',await field().inputValue()==='  Newer during verification  '&&(await page.locator('#private-status').textContent()).startsWith('Submitted changes saved'));
 check(prefix+' confirmation preserves editor focus caret selection and scroll',await page.evaluate(()=>{const s=window.manualCaret;return document.querySelector('[name="objective"]')===s.node&&document.activeElement===s.node&&s.node.selectionStart===s.start&&s.node.selectionEnd===s.end&&document.querySelector('.private-primary').scrollTop===s.top;}));
 await save();await phase('verified');check(prefix+' latest submitted version can become confirmed',await page.locator('#manual-save-message').textContent()==='All changes saved');

 // Save and Continue must stay put if newer text arrives during readback.
 await control(field(),'fill','Navigation submission');await hold();
 await click(page.locator('[data-private-tab="sequence"]'));await click(page.locator('[data-unsaved-choice="save"]'));await held();
 await control(field(),'fill','Keep after Save and Continue');await release();await phase('dirty');
 check(prefix+' Save and Continue preserves newer text and original plan',await field().inputValue()==='Keep after Save and Continue'&&await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===lesson.id&&await page.locator('.unsaved-navigation').count()===0);
 await save();await phase('verified');

 // Acknowledged writes can fail verification; retry must be reads only.
 await control(field(),'fill','Acknowledged but unverified');await page.evaluate(()=>window.testReadbackFail=true);await save();await phase('unconfirmed');
 const acknowledgedWrites=await writes();check(prefix+' failed readback remains protected',await page.evaluate(async()=>(await import('./private-workspace.js')).isPrivateWorkspaceDirty())&&await page.locator('#manual-save-retry').isVisible());
 check(prefix+' incomplete verification is not described as a failed write',await page.locator('#manual-save-message').textContent()==='Write received · Unverified'&&(await page.locator('#private-status').textContent()).startsWith('Write acknowledged; verification incomplete.')&&!(await page.locator('#private-status').textContent()).includes('Save failed:'));
 check(prefix+' explanation and Retry fit the visible header',await page.locator('#manual-save-status').evaluate(e=>[e.querySelector('span'),e.querySelector('button')].every(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=59&&r.left>=0&&r.right<=innerWidth&&(hit===n||n.contains(hit));})));
 check(prefix+' unconfirmed receipt triggers unload warning without a draft',await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}));
 await click(page.locator('[data-workspace-settings]'));page.once('dialog',d=>d.dismiss());await click(page.locator('#auth-signout'));
 check(prefix+' unconfirmed receipt guards sign-out',await page.locator('#workspace-settings').evaluate(e=>e.open)&&await page.locator('#auth-signout').isVisible());await click(page.locator('[data-settings-close]'));
 await click(page.locator('[data-private-export]'));check(prefix+' unconfirmed save blocks saved-only export',(await page.locator('#private-status').textContent()).includes('Save or discard'));
 await page.evaluate(()=>window.testReadbackFail=false);await click(page.locator('#manual-save-retry'));await phase('verified');
 check(prefix+' verification retry repeats zero writes',await unchangedWrites(acknowledgedWrites));

 // Calendar Inspector saves also retain their existing nodes and scroll.
 await click(page.locator('[data-private-tab="calendar"]'));
 await click(page.locator('[data-private-calendar-day="'+fixture.lessons[0].scheduled_dates[0]+'"]').first());
 await click(page.locator('#saved-day-details [data-private-lesson="'+lesson.id+'"]').first());
 await control(field(),'fill','Inspector confirmed text');await hold();await save();await held();
 await page.evaluate(()=>{const node=document.querySelector('[name="objective"]'),panel=document.querySelector('.private-inspector');node.focus({preventScroll:true});node.setSelectionRange(2,7);panel.scrollTop=90;window.inspectorCheck={node,start:2,end:7,top:panel.scrollTop};});
 await release();await phase('verified');
 check(prefix+' Inspector verification preserves focus selection and position',await page.evaluate(()=>{const s=window.inspectorCheck;return document.activeElement===s.node&&s.node===document.querySelector('[name="objective"]')&&s.node.selectionStart===s.start&&s.node.selectionEnd===s.end&&document.querySelector('.private-inspector').scrollTop===s.top;}));
 check(prefix+' Inspector has reachable save feedback',width>1100||await page.locator('[data-manual-save-message]').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.y>=0&&r.bottom<=innerHeight&&(hit===e||e.contains(hit));}));
 await click(page.locator('[data-inspector-close]'));

 for(const table of ['units','lessons']){
  await click(page.locator('[data-private-tab="'+table+'"]'));await click(page.locator('[data-private-add="'+table+'"]'));
  const create=page.locator('[data-private-create="'+table+'"]');await control(create.locator('[name="title"]'),'fill','Verified fictional '+table);
  await page.evaluate(()=>{window.testReadbackFail=true;window.createTitleNode=document.querySelector('[data-private-create] [name="title"]');});
  const count=await page.evaluate(table=>window.testDb[table].length,table);await click(create.locator('button[type="submit"]'));await phase('unconfirmed');
  const editor=page.locator('[data-private-save="'+table+'"]'),id=await editor.getAttribute('data-id'),beforeRetry=await writes();
  check(prefix+' '+table+' create retains acknowledged ID and original title node',!!id&&await page.evaluate(()=>document.querySelector('[data-private-save] [name="title"]')===window.createTitleNode));
  await control(editor.locator('[name="title"]'),'fill','Newer fictional '+table);await page.evaluate(()=>window.testReadbackFail=false);await click(page.locator('#manual-save-retry'));await phase('dirty');
  check(prefix+' '+table+' create read retry retains newer draft with no insert',await unchangedWrites(beforeRetry)&&await editor.locator('[name="title"]').inputValue()==='Newer fictional '+table);
  await save();await phase('verified');
  check(prefix+' '+table+' next Save updates same created ID',await page.evaluate(({table,count,id})=>window.testDb[table].length===count+1&&window.testDb[table].find(r=>r.id===id).title==='Newer fictional '+table,{table,count,id}));
 }

 await open();await control(field(),'fill','Inactive tab draft');const inactiveTab=await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab-select');
 if(width<=700)await click(page.locator('#sidebar-collapse'));
 await click(page.locator('[data-sidebar-newtab="lessons"]'));await click(page.locator('[data-open-lesson-tab="'+fixture.lessons[1].id+'"]'));
 await control(field(),'fill','Different tab saved');await save();await phase('dirty');
 check(prefix+' confirmed other tab cannot hide inactive tab draft',await page.locator('#manual-save-message').textContent()==='Unsaved changes · Use Save');
 await click(page.locator('[data-tab-select="'+inactiveTab+'"]'));check(prefix+' inactive tab raw draft remains available',await field().inputValue()==='Inactive tab draft');await save();await phase('verified');

 for(const table of ['units','lessons']){
  await click(page.locator('[data-private-tab="'+table+'"]'));await click(page.locator('[data-private-add="'+table+'"]'));
  const create=page.locator('[data-private-create="'+table+'"]');await control(create.locator('[name="title"]'),'fill','Unknown fictional '+table);
  const count=await page.evaluate(table=>window.testDb[table].length,table);await page.evaluate(()=>window.testLoseWriteResponse=true);await click(create.locator('button[type="submit"]'));await phase('unknown');
  const once=await writes();await click(create.locator('button[type="submit"]'));await phase('unknown');
  check(prefix+' '+table+' response loss never repeats the committed insert',await unchangedWrites(once)&&await page.evaluate(({table,count})=>window.testDb[table].length===count+1,{table,count})&&await page.locator('#manual-save-retry').isHidden());
  await click(page.locator('.planning-tab.selected [data-tab-close]'));await click(page.locator('[data-unsaved-choice="discard"]'));await reload();
 }

 await open();await control(field(),'fill','  Conflict raw text  ');await page.evaluate(id=>window.testDb.lessons.find(l=>l.id===id).revision++,lesson.id);await save();await phase('conflict');
 check(prefix+' revision conflict keeps exact raw text',await field().inputValue()==='  Conflict raw text  ');await reload();

 await control(field(),'fill','Inactive course draft');await click(page.locator('[data-global-home]'));
 await click(page.locator('#home-courses [data-private-open="'+fixture.dashboardExtra.course.id+'"]'));
 await open(fixture.dashboardExtra.course.id,fixture.dashboardExtra.lessons[0].id);await control(field(),'fill','Second course saved');await save();await phase('dirty');
 check(prefix+' successful other-course save cannot hide inactive draft',await page.locator('#manual-save-message').textContent()==='Unsaved changes · Use Save');
 await click(page.locator('[data-global-home]'));await click(page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]'));
 check(prefix+' inactive course text restored exactly',await field().inputValue()==='Inactive course draft');await save();await phase('idle');
 check(prefix+' discarded unknown creates do not acquire a false verified claim',await page.locator('#manual-save-message').textContent()==='Manual Save · No pending edits');

 // Same account, new generation: an old verification cannot release a new write.
 await control(field(),'fill','Old session submission');await hold();await save();await held();
 await page.evaluate(()=>{window.oldReadbackRelease=window.testReleaseReadback;window.testSignedOut=true;window.testAuthEvent('SIGNED_OUT');});await page.locator('#auth-form').waitFor({state:'visible'});
 await page.evaluate(()=>{window.testSignedOut=false;window.testAuthEvent('SIGNED_IN');});await page.locator('#saved-courses [data-private-open]').first().waitFor({state:'attached'});await open();
 await control(field(),'fill','New session submission');await page.evaluate(()=>{window.testHoldWrites=true;delete window.testReleaseWrite;});await save();await page.waitForFunction(()=>!!window.testReleaseWrite);
 await page.evaluate(()=>window.oldReadbackRelease());await phase('writing');
 check(prefix+' stale verification cannot release new-session busy state',await field().inputValue()==='New session submission'&&await page.evaluate(async()=>(await import('./private-workspace.js')).isPrivateWorkspaceBusy()));
 await page.evaluate(()=>{window.testHoldWrites=false;window.testReleaseWrite();});await phase('verified');
 check(prefix+' status is visible without horizontal document overflow',await page.locator('#manual-save-message').isVisible()&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const geometry=await page.locator('#manual-save-message').evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,clear:hit===e||e.contains(hit)};});
 check(prefix+' status remains in the viewport and unobscured '+JSON.stringify(geometry),geometry.y>=0&&geometry.bottom<=1000&&geometry.right<=width&&geometry.clear);
 await page.screenshot({path:out+'/'+prefix+'-confirmed.png'});
}
