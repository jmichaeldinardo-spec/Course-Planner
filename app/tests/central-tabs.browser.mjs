// Stage B uses the existing browser driver/owner-scoped synthetic SDK.
// This module has no runner, credentials, hosted requests or persistence adapter.
export async function verifyCentralTabs(page,width,fixture,{check,click,control,out}){
 const prefix='central-tabs-'+width,lesson=fixture.lessons[0];let downloads=0;page.on('download',()=>downloads++);
 const tabs=()=>page.locator('[role="tab"]');
 const active=()=>page.locator('[role="tab"][aria-selected="true"]');
 const activeId=()=>active().getAttribute('data-tab-select');
 const ids=()=>tabs().evaluateAll(nodes=>nodes.map(n=>n.dataset.tabSelect));
 const field=()=>page.locator('[data-private-save="lessons"] [name="objective"]');
 const saved=()=>page.evaluate(id=>window.testDb.lessons.find(l=>l.id===id).objective,lesson.id);
 const status=()=>page.locator('#private-status');
 const normal=kind=>click(page.locator('#workspace-navigation [data-private-tab="'+kind+'"]'));
 async function extra(kind){const button=page.locator('[data-sidebar-newtab="'+kind+'"]');if(!await button.isVisible())await page.locator('#sidebar-collapse').click();await click(button);}
 async function choose(value){await page.locator('[data-unsaved-choice="'+value+'"]').click();await page.locator('.unsaved-navigation').waitFor({state:'detached'});}
 async function save(){await click(page.locator('form[data-private-save] button[type="submit"]'));await status().filter({hasText:'Saved and verified'}).waitFor();}
 async function openLesson(newTab=false){await normal('lessons');await click(page.locator('[data-'+(newTab?'open-lesson-tab':'private-lesson')+'="'+lesson.id+'"]').first());}
 async function select(id){await click(page.locator('[data-tab-select="'+id+'"]'));}
 async function close(id,choice){await click(page.locator('[data-tab-close="'+id+'"]'));if(choice)await choose(choice);}
 async function blank(){await click(page.locator('[data-tab-new]'));return activeId();}
 async function create(table,title){await blank();await click(page.locator('[data-tab-create="'+table+'"]'));const f=page.locator('[data-private-create="'+table+'"]');await control(f.locator('[name="title"]'),'fill',title);return {id:await activeId(),draft:await f.getAttribute('data-draft-id')};}
 async function snapshot(name){await page.screenshot({path:out+'/'+prefix+'-'+name+'.png',fullPage:true});}
 await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));
 const decBefore=await page.evaluate(()=>JSON.stringify(window.testDb));
 await normal('units');await click(page.locator('[data-private-unit="'+fixture.units[0].id+'"]'));
 const unitView=await activeId(),connected=page.locator('.connected-lessons');
 check(prefix+' DEC101 connected membership and sequence',JSON.stringify(await connected.locator('[data-private-lesson]').evaluateAll(ns=>ns.map(n=>n.dataset.privateLesson)))===JSON.stringify(fixture.lessons.filter(l=>l.unit_id===fixture.units[0].id).sort((a,b)=>a.position-b.position).map(l=>l.id)));
 await control(page.locator('[name="essential_questions"]'),'fill','Temporary unit draft');await click(connected.locator('[data-private-lesson]').first());await choose('cancel');check(prefix+' DEC101 unit guard cancels lesson replacement',await page.locator('[name="essential_questions"]').inputValue()==='Temporary unit draft');
 await click(connected.locator('[data-open-lesson-tab]').first());check(prefix+' DEC101 explicit connected view shares canonical ID',await activeId()!==unitView&&await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===lesson.id);await close(await activeId());
 await click(connected.locator('[data-private-lesson]').first());await choose('discard');check(prefix+' DEC101 connected click replaces selected view',await activeId()===unitView&&await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===lesson.id);
 await normal('lessons');await control(page.locator('[data-lesson-unit]'),'selectOption',fixture.units[0].id);await control(page.locator('[data-lesson-search]'),'fill','lesson 2');const filterView=await activeId();
 check(prefix+' DEC101 unit plus search intersects results',await page.locator('[data-lesson-directory-results] [data-private-lesson]').count()===1);
 await extra('lessons');check(prefix+' DEC101 new directory starts with All Units',await page.locator('[data-lesson-unit]').inputValue()==='');await control(page.locator('[data-lesson-unit]'),'selectOption',fixture.units[1].id);check(prefix+' DEC101 empty unit explains no matching lessons',(await page.locator('[data-lesson-directory-results]').textContent()).includes('No matching lessons in this unit'));
 await select(filterView);check(prefix+' DEC101 independent filter and search restored',await page.locator('[data-lesson-unit]').inputValue()===fixture.units[0].id&&await page.locator('[data-lesson-search]').inputValue()==='lesson 2');
 await normal('units');await click(page.locator('[data-private-unit="'+fixture.units[1].id+'"]'));check(prefix+' DEC101 connected empty state',(await connected.textContent()).includes('No lessons in this unit yet.'));
 await page.screenshot({path:out+'/'+prefix+'-unit-refinement.png',fullPage:true});
 check(prefix+' DEC101 navigation and filters perform no writes',await page.evaluate(before=>JSON.stringify(window.testDb)===before&&window.testWrites.length===0,decBefore));
 for(const id of await ids())await close(id);
 await normal('sequence');
 let baselineSaved=lesson.objective;const original=await page.evaluate(()=>JSON.stringify(window.testDb)),first=await activeId();
 for(const kind of ['overview','units','lessons','calendar','sequence'])await normal(kind);
 check(prefix+' five sidebar destinations replace the same single view',await tabs().count()===1&&await activeId()===first);
 await extra('calendar');const calendar=await activeId();
 check(prefix+' explicit sidebar new tab selects a populated independent view',await tabs().count()===2&&calendar!==first&&await page.locator('.saved-month').count()===1);
 await blank();check(prefix+' plus creates an empty launcher and no saved row',await tabs().count()===3&&await page.locator('.new-tab-launcher').count()===1&&await page.evaluate(before=>JSON.stringify(window.testDb)===before,original));
 await snapshot('launcher');const blankId=await activeId();await active().focus();await page.keyboard.press('Delete');check(prefix+' keyboard Delete closes blank presentation without changing records',!((await ids()).includes(blankId))&&await page.evaluate(before=>JSON.stringify(window.testDb)===before,original));await select(calendar);await click(page.locator('[data-private-calendar-view="week"]'));await click(page.locator('[data-private-calendar-period="1"]'));const calendarTitle=await page.locator('.saved-calendar-toolbar h3').textContent();await select(first);await select(calendar);check(prefix+' calendar tab retains its own week position and independent history',await page.locator('.saved-agenda').count()===1&&await page.locator('.saved-calendar-toolbar h3').textContent()===calendarTitle&&await page.locator('[data-tab-history="-1"]').isDisabled());
 for(const id of await ids())await close(id);
 check(prefix+' final close leaves one blank in the same course',await tabs().count()===1&&await page.locator('.new-tab-launcher').count()===1&&await page.locator('#workspace-course-name').textContent().then(s=>s.includes(fixture.course.name)));
 await click(page.locator('[data-tab-reopen="0"]'));check(prefix+' recently closed reopens a view without creating records',await tabs().count()===2&&await page.evaluate(before=>JSON.stringify(window.testDb)===before,original));await close(await activeId());
 await openLesson();const viewA=await activeId();check(prefix+' central lesson retains Lesson Planning sidebar context',await page.locator('#workspace-navigation [data-private-tab="lessons"]').getAttribute('aria-pressed')==='true');await control(field(),'fill','Shared fictional Stage B draft');
 await extra('lessons');const directory=await activeId();await click(page.locator('[data-open-lesson-tab="'+lesson.id+'"]'));const viewB=await activeId();
 check(prefix+' duplicate populated views share one raw draft and saved ID',viewB!==viewA&&await field().inputValue()==='Shared fictional Stage B draft'&&await page.locator('[data-private-save="lessons"]').getAttribute('data-id')===lesson.id&&await saved()===baselineSaved);
 await control(field(),'fill','Shared fictional edited from duplicate');await select(viewA);
 check(prefix+' duplicate edits project into the original view',await field().inputValue()==='Shared fictional edited from duplicate');
 await save();baselineSaved='Shared fictional edited from duplicate';await select(viewB);check(prefix+' a duplicate sees the latest saved value without a competing draft',await field().inputValue()===baselineSaved&&await saved()===baselineSaved);await control(field(),'fill','Shared fictional edited from duplicate');await field().evaluate(e=>{e.focus();e.setSelectionRange(4,9);});await select(viewA);await select(viewB);check(prefix+' duplicate view restoration keeps editor caret',await field().evaluate(e=>e.selectionStart===4&&e.selectionEnd===9));await select(viewA);
 await click(page.locator('[data-inspector-close]'));
 check(prefix+' hiding inspector preserves central shared draft',await field().inputValue()==='Shared fictional edited from duplicate'&&await page.locator('.private-inspector').isHidden());
 await click(page.locator('[data-inspector-open]'));check(prefix+' reopening inspector preserves shared raw draft without a discard prompt',await field().inputValue()==='Shared fictional edited from duplicate'&&await page.locator('.unsaved-navigation').count()===0);await click(page.locator('[data-inspector-close]'));
 await page.evaluate(()=>document.querySelector('.private-primary').scrollTop=170);const pinned=await page.evaluate(()=>{const root=document.querySelector('#private-workspace').getBoundingClientRect(),bar=document.querySelector('[data-tab-host]').getBoundingClientRect(),header=document.querySelector('.private-header').getBoundingClientRect();return {root:root.top,bar:bar.top,bottom:bar.bottom,header:header.top};});check(prefix+' scrolled tabs stay flush to workspace without leaking content above '+JSON.stringify(pinned),Math.abs(pinned.root-pinned.bar)<2&&pinned.header>=pinned.bottom-1);await page.evaluate(()=>document.querySelector('.private-primary').scrollTop=0);
 await snapshot('shared-plan');await close(viewB);
 check(prefix+' closing another holder retains the shared draft without discard',await page.locator('.unsaved-navigation').count()===0&&await field().inputValue()==='Shared fictional edited from duplicate');
 await normal('overview');await choose('cancel');
 check(prefix+' cancel replacement retains view identity and raw draft',await activeId()===viewA&&await field().inputValue()==='Shared fictional edited from duplicate');
 await normal('overview');await choose('discard');await page.locator('.course-overview').waitFor();await click(page.locator('[data-tab-history="-1"]'));
 check(prefix+' discarded draft does not return through history',await field().inputValue()===baselineSaved&&await saved()===baselineSaved);
 await control(field(),'fill','Saved through navigation');await normal('sequence');await choose('save');await page.locator('.private-header h1').filter({hasText:'Course Sequence'}).waitFor();
 check(prefix+' Save and Continue writes once to the canonical record',await saved()==='Saved through navigation'&&await page.evaluate(id=>window.testDb.lessons.filter(l=>l.id===id).length===1,lesson.id));
 await click(page.locator('[data-tab-history="-1"]'));await control(field(),'fill','Rejected navigation save');await page.evaluate(()=>window.rejectWrites=true);
 await normal('overview');await choose('save');await status().filter({hasText:'Save failed'}).waitFor();
 check(prefix+' failed Save and Continue blocks replacement and keeps draft',await activeId()===viewA&&await field().inputValue()==='Rejected navigation save'&&await saved()==='Saved through navigation');
 await page.evaluate(()=>window.rejectWrites=false);await save();
 await control(field(),'fill','Conflicting fictional draft');await page.evaluate(id=>{const row=window.testDb.lessons.find(l=>l.id===id);row.revision++;row.objective='External fictional edit';},lesson.id);await click(page.locator('form[data-private-save] button[type="submit"]'));await status().filter({hasText:'Save failed'}).waitFor();
 check(prefix+' revision conflict retains raw draft and external saved content',await field().inputValue()==='Conflicting fictional draft'&&await saved()==='External fictional edit');
 await close(viewA,'cancel');check(prefix+' cancel close keeps unsaved view open',await page.locator('[data-tab-select="'+viewA+'"]').count()===1);
 await close(viewA,'discard');await select(directory);await click(page.locator('[data-private-reload]'));
 await control(page.locator('[data-lesson-search]'),'fill','lesson 2');const dirId=await activeId();
 await page.setViewportSize({width,height:420});await page.evaluate(()=>{document.querySelector('.private-primary').scrollTop=91;window.stageBDirectoryScroll=document.querySelector('.private-primary').scrollTop;window.stageBDirectory=document.querySelector('[data-lesson-search]');});
 await extra('units');const unitDirectory=await activeId();await click(page.locator('[data-private-unit="'+fixture.units[0].id+'"]').first());
 check(prefix+' individual unit plan replaces its directory in the same tab',await activeId()===unitDirectory&&await page.locator('[data-private-save="units"]').getAttribute('data-id')===fixture.units[0].id);
 await click(page.locator('[data-tab-history="-1"]'));check(prefix+' tab back returns to own unit directory',await page.locator('.private-header h1').textContent()==='Unit Planning');
 await select(dirId);
 check(prefix+' directory query DOM and scroll survive another tab history',await page.locator('[data-lesson-search]').inputValue()==='lesson 2'&&await page.evaluate(()=>document.querySelector('[data-lesson-search]')===window.stageBDirectory&&document.querySelector('.private-primary').scrollTop===window.stageBDirectoryScroll&&window.stageBDirectoryScroll>0)&&await page.locator('[data-private-lesson]').count()===1);await page.setViewportSize({width,height:1000});
 await active().focus();await page.keyboard.press('ArrowRight');check(prefix+' tab arrow keyboard selects adjacent existing view',await activeId()===unitDirectory);
 await click(page.locator('[data-tab-finder]'));await page.locator('[data-finder-search]').fill('Lesson Planning');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 check(prefix+' finder keyboard selects existing matching tab without opening one',await activeId()===dirId&&await page.locator('.open-tabs-dialog').count()===0);
 await click(page.locator('[data-tab-finder]'));await page.locator('[data-finder-search]').fill('no such fictional title');check(prefix+' finder reports no matches without exposing other course tabs',await page.locator('[data-finder-results]').textContent()==='No matching open tabs in this course.');await snapshot('finder');await page.locator('[data-finder-close]').click();
 const beforeCreate=await page.evaluate(()=>({units:window.testDb.units.length,lessons:window.testDb.lessons.length}));
 const a=await create('lessons','Fictional new lesson A'),b=await create('lessons','Fictional new lesson B'),c=await create('units','Fictional new unit C'),d=await create('units','Fictional new unit D');
 check(prefix+' simultaneous uncreated plans have distinct temporary identities and no records',new Set([a.draft,b.draft,c.draft,d.draft]).size===4&&await page.evaluate(before=>window.testDb.units.length===before.units&&window.testDb.lessons.length===before.lessons,beforeCreate));
 await snapshot('uncreated');await select(directory);await click(page.locator('[data-private-export]'));check(prefix+' inactive unsaved tabs block misleading saved-only exports',downloads===0&&(await status().textContent()).includes('Save or discard'));await select(a.id);await page.evaluate(()=>{window.testHoldWrites=true;delete window.testReleaseWrite;});await click(page.locator('[data-private-create="lessons"] button[type="submit"]'));await page.waitForFunction(()=>!!window.testReleaseWrite);
 await control(page.locator('[data-private-create="lessons"] [name="title"]'),'fill','Fictional newer lesson A');await normal('calendar');
 check(prefix+' pending create blocks tab replacement',await activeId()===a.id&&await page.locator('[data-private-create="lessons"]').count()===1&&(await status().textContent()).includes('Wait for the current save'));
 const beforeHome=await ids();await click(page.locator('[data-global-home]'));await page.locator('[data-resume-workspace]').click();
 check(prefix+' Home Continue retains pending create DOM and complete arrangement',JSON.stringify(await ids())===JSON.stringify(beforeHome)&&await page.locator('[data-private-create="lessons"] [name="title"]').inputValue()==='Fictional newer lesson A');
 await page.evaluate(()=>{window.testHoldWrites=false;window.testReleaseWrite();});await status().filter({hasText:'Submitted changes saved'}).waitFor();const canonicalA=await page.locator('[data-private-save="lessons"]').getAttribute('data-id');await save();
 await select(b.id);check(prefix+' create acknowledgement promotes only its draft and keeps the other lesson',await page.locator('[data-private-create="lessons"]').getAttribute('data-draft-id')===b.draft&&await page.locator('[name="title"]').inputValue()==='Fictional new lesson B'&&await page.evaluate(({before,id})=>window.testDb.lessons.length===before.lessons+1&&window.testDb.lessons.find(l=>l.id===id).title==='Fictional newer lesson A',{before:beforeCreate,id:canonicalA}));
 await select(c.id);await click(page.locator('[data-private-create="units"] button[type="submit"]'));await status().filter({hasText:'Saved and verified'}).waitFor();const canonicalC=await page.locator('[data-private-save="units"]').getAttribute('data-id');await select(b.id);check(prefix+' existing uncreated lesson receives newly saved unit choices',await page.locator('[name="unit_id"] option[value="'+canonicalC+'"]').count()===1);await select(d.id);
 check(prefix+' new unit save leaves second uncreated unit independent',await page.locator('[data-private-create="units"]').getAttribute('data-draft-id')===d.draft&&await page.locator('[name="title"]').inputValue()==='Fictional new unit D'&&await page.evaluate(before=>window.testDb.units.length===before.units+1,beforeCreate));
 const arranged=await ids();await click(page.locator('[data-global-home]'));await click(page.locator('#home-courses [data-private-open="'+fixture.dashboardExtra.course.id+'"]'));
 check(prefix+' switching course starts a separate arrangement',await tabs().count()===1&&!arranged.includes(await activeId()));await extra('overview');const secondIds=await ids();
 await click(page.locator('[data-global-home]'));await click(page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]'));
 check(prefix+' returning course restores tabs selection and uncreated draft',JSON.stringify(await ids())===JSON.stringify(arranged)&&await activeId()===d.id&&await page.locator('[name="title"]').inputValue()==='Fictional new unit D');
 await click(page.locator('[data-global-home]'));await click(page.locator('#home-courses [data-private-open="'+fixture.dashboardExtra.course.id+'"]'));check(prefix+' second course arrangement also preserved',JSON.stringify(await ids())===JSON.stringify(secondIds));
 await click(page.locator('[data-global-home]'));await click(page.locator('#home-courses [data-private-open="'+fixture.course.id+'"]'));await select(a.id);await control(field(),'fill','Delayed fictional old account edit');
 await page.evaluate(()=>{window.testHoldWrites=true;delete window.testReleaseWrite;});await click(page.locator('[data-private-save="lessons"] button[type="submit"]'));await page.waitForFunction(()=>!!window.testReleaseWrite);
 await page.evaluate(()=>{window.testSignedOut=true;window.testAuthEvent('SIGNED_OUT');});await page.locator('#auth-form').waitFor({state:'visible'});
 await page.evaluate(()=>{window.testOwner='73000000-0000-4000-8000-000000000002';window.testSignedOut=false;window.testAuthEvent('SIGNED_IN');});await page.waitForFunction(()=>document.querySelector('#storage-status')?.textContent==='No saved courses yet. Create your first course.');await page.evaluate(()=>{window.testHoldWrites=false;window.testReleaseWrite();});await page.waitForFunction(async()=>!(await import('./private-workspace.js')).isPrivateWorkspaceBusy());
 check(prefix+' signout account change and stale response expose no prior tabs or drafts',await tabs().count()===0&&await page.locator('#private-workspace').evaluate(e=>e.hidden&&e.childNodes.length===0)&&await page.evaluate(async()=>!(await import('./private-workspace.js')).isPrivateWorkspaceDirty()));
 await page.evaluate(owner=>{window.testOwner=owner;window.testAuthEvent('SIGNED_IN');},fixture.course.owner_id);await page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]').waitFor();await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));await tabs().first().waitFor();
 check(prefix+' returning account receives fresh single view without old draft',await tabs().count()===1&&!arranged.includes(await activeId())&&await page.evaluate(async()=>!(await import('./private-workspace.js')).isPrivateWorkspaceDirty()));
 check(prefix+' tab UI has no document horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const densityBefore=await page.evaluate(()=>JSON.stringify(window.testDb));
 for(const target of [3,6,10,40]){
  while(await tabs().count()<target)await blank();
  const geometry=await page.locator('.tab-strip').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,left:e.scrollLeft,rows:[...e.querySelectorAll('.planning-tab:not([hidden])')].map(t=>({top:t.offsetTop,width:t.getBoundingClientRect().width}))}));
  check(prefix+' DEC102 '+target+' tabs fit one row without horizontal scrolling',geometry.scroll<=geometry.width+1&&geometry.left===0&&new Set(geometry.rows.map(r=>r.top)).size===1&&geometry.rows.every(r=>r.width>=78));
  check(prefix+' DEC102 '+target+' active tab remains visible with full accessible name',await active().isVisible()&&!!await active().getAttribute('aria-label'));
  await page.screenshot({path:out+'/'+prefix+'-density-'+target+'.png',fullPage:true});
 }
 await click(page.locator('[data-tab-create="units"]'));await control(page.locator('[data-private-create="units"] [name="title"]'),'fill','Unsaved overflow marker');
 const total=await tabs().count();await click(page.locator('[data-tab-finder]'));check(prefix+' DEC102 finder retains access to every open view',await page.locator('[data-finder-tab]').count()===total);check(prefix+' DEC102 finder exposes unsaved overflow status',(await page.locator('[data-finder-results]').textContent()).includes('Unsaved overflow marker · Unsaved edits'));await page.screenshot({path:out+'/'+prefix+'-overflow-finder.png',fullPage:true});await page.locator('[data-finder-tab]').first().click();await active().focus();await page.keyboard.press('End');check(prefix+' DEC102 keyboard reaches overflowed final tab',await activeId()===(await ids()).at(-1)&&await active().isVisible());
 check(prefix+' DEC102 densities never mutate saved records',await page.evaluate(before=>JSON.stringify(window.testDb)===before,densityBefore));

}
