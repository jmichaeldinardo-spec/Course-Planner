// Synthetic, touch-capable browser coverage; no hosted accounts or data.
export async function verifyMobileWorkspace(page,width,fixture,{check,click,control,out}){
 if(width<=700)return verifyPhoneFoundation(page,width,fixture,{check,click,control,out});
 const prefix='mobile-workspace-'+width;
 await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));
 await page.screenshot({path:out+'/'+prefix+'-content.png'});
 const inset=await page.locator('.private-primary').evaluate(e=>parseFloat(getComputedStyle(e).paddingLeft));
 check(prefix+' content inset',width>700||inset===16);
 for(let i=0;i<8;i++)await click(page.locator('[data-tab-new]'));
 await page.screenshot({path:out+'/'+prefix+'-tabs.png'});
 const strip=page.locator('.tab-strip');
 if(width<=700)check(prefix+' active tab and close target fit strip',await strip.evaluate(e=>{const b=e.getBoundingClientRect(),t=e.querySelector('.selected').getBoundingClientRect(),c=e.querySelector('.selected [data-tab-close]').getBoundingClientRect();return t.left>=b.left-1&&t.right<=b.right+1&&c.width>=40&&c.height>=44;}));
 if(width<=700){
  check(prefix+' touch tabs remain rendered and readable',await strip.locator('.planning-tab').evaluateAll(es=>es.every(e=>!e.hidden&&e.getBoundingClientRect().width>=Math.min(180,e.parentElement.clientWidth))));
  const before=await strip.evaluate(e=>e.scrollLeft),box=await strip.boundingBox(),cdp=await page.context().newCDPSession(page);
  // Real touch input, not a DOM scroll or synthetic click. Swipe toward older tabs.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+10,y:box.y+20}]});
  for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+10+(box.width-20)*i/8,y:box.y+20}]});await page.evaluate(()=>new Promise(requestAnimationFrame));}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(before=>document.querySelector('.tab-strip').scrollLeft<before,before);
  check(prefix+' finger swipe changes native tab scroll',await strip.evaluate(e=>e.scrollLeft)<before);
  const candidate=await strip.locator('[role=tab]').evaluateAll(es=>{const b=es[0].closest('.tab-strip').getBoundingClientRect();return es.map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.tabSelect,x:Math.max(b.left,r.left)+8,y:r.y+20,right:r.right,left:r.left};}).find(r=>r.left<b.right-20&&r.right>b.left+20);});
  await page.touchscreen.tap(candidate.x,candidate.y);
  await page.waitForFunction(id=>document.querySelector('[role=tab][aria-selected=true]').dataset.tabSelect===id,candidate.id);
  check(prefix+' revealed tab responds to touch',true);await cdp.detach();
 }else check(prefix+' desktop retains compressed one-row tabs',await strip.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await click(page.locator('[data-tab-finder]'));check(prefix+' finder stays keyboard accessible',await page.locator('.open-tabs-dialog').isVisible());await page.keyboard.press('Escape');
 await page.locator('[data-tab-new]').focus();check(prefix+' focus indicator visible',await page.locator('[data-tab-new]').evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));
 await page.locator('#sidebar-collapse').click();await click(page.locator('#workspace-navigation [data-private-tab="units"]'));
 check(prefix+' sidebar reaches Unit Planning',await page.locator('[data-private-add="units"]').count()===1);
 check(prefix+' no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}

async function verifyPhoneFoundation(page,width,fixture,{check,click,control,out}){
 const name='phone-foundation-'+width,nav=page.locator('#phone-navigate');
 await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));
 check(name+' phone strip hidden with stable existing view',await page.locator('.course-tab-toolbar').isHidden()&&await page.locator('[role=tab]').count()===1);
 const viewCount=page.locator('#phone-views .phone-view-count');
 check(name+' count starts at one',await viewCount.textContent()==='1'&&await page.locator('#phone-views').getAttribute('aria-label')==='Open Views, 1 open view');
 await nav.click();check(name+' one unambiguous Home in primary navigation',await page.locator('#workspace-navigation [data-global-home]').textContent().then(t=>t.trim()==='Home')&&await page.locator('#workspace-navigation [data-private-tab=overview]').count()===0);await click(page.locator('#phone-shell [data-private-tab=overview]'));check(name+' course summary accessible and exclusively selected',await page.locator('.private-header h1').textContent()==='Course Overview'&&await page.locator('.teacher-sidebar [data-private-tab=overview]').getAttribute('aria-pressed')==='true'&&await page.locator('[data-global-home]').getAttribute('aria-pressed')==='false');await click(page.locator('[data-global-home]'));check(name+' Home selected without summary selection',await page.locator('[data-global-home]').getAttribute('aria-pressed')==='true'&&await page.locator('.teacher-sidebar [data-private-tab=overview]').getAttribute('aria-pressed')==='false');await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));
 const position=await nav.boundingBox();
 for(let i=0;i<3;i++){await nav.click();check(name+' drawer locks background '+i,await page.locator('.teacher-workspace').evaluate(e=>e.inert));await nav.click();}
 check(name+' stationary Navigate',JSON.stringify(await nav.boundingBox())===JSON.stringify(position));
 await nav.click();await page.waitForFunction(()=>Math.abs(document.querySelector('#phone-shell .teacher-sidebar').getBoundingClientRect().x)<0.1);const beforeScroll=await page.locator('.private-primary').evaluate(e=>e.scrollTop);await page.mouse.move(width-5,400);await page.mouse.wheel(0,350);check(name+' backdrop wheel cannot scroll background',await page.locator('.private-primary').evaluate(e=>e.scrollTop)===beforeScroll&&await page.evaluate(()=>scrollY===0));await page.locator('#phone-course-toggle').click();
 check(name+' dropdown excludes current course',await page.locator('#phone-course-options [data-private-open="'+fixture.course.id+'"]').isHidden()&&await page.locator('#phone-course-options [data-private-open="'+fixture.dashboardExtra.course.id+'"]').isVisible());
 await page.keyboard.press('Escape');check(name+' Escape returns focus',await nav.evaluate(e=>e===document.activeElement));await nav.click();check(name+' dropdown reopens collapsed with disclosure cue',await page.locator('#phone-course-toggle').getAttribute('aria-expanded')==='false'&&await page.locator('#phone-course-options').isHidden()&&await page.locator('#phone-course-toggle').evaluate(e=>getComputedStyle(e,'::after').content!=='none'));await nav.click();
 await click(page.locator('#workspace-navigation [data-private-tab="lessons"]'));await click(page.locator('[data-private-lesson="'+fixture.lessons[0].id+'"]').first());
 const field=page.locator('[data-private-save="lessons"] [name=objective]');await control(field,'fill','  Phone retained draft  ');
 const id=await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select');
 await click(page.locator('#phone-shell [data-private-tab=overview]'));await page.locator('[data-unsaved-choice=cancel]').click();check(name+' summary Cancel preserves dirty view and exclusive selection',await field.inputValue()==='  Phone retained draft  '&&await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===id&&await page.locator('.teacher-sidebar [aria-current=page]').count()===1&&await page.locator('.teacher-sidebar [data-private-tab=lessons]').getAttribute('aria-pressed')==='true');
 const beforeNew=await page.locator('[role=tab]').count();await page.locator('#phone-new').click();check(name+' New sheet opens without keyboard or view creation',await page.locator('.phone-sheet [data-phone-new]').count()===8&&await page.locator('[role=tab]').count()===beforeNew&&await page.evaluate(()=>!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)));await page.locator('[data-phone-new=new]').click();await page.locator('.phone-sheet').waitFor({state:'detached'});check(name+' count updates when new view opens',await viewCount.textContent()===String(beforeNew+1));await page.locator('#phone-views').click();
 check(name+' open view retains dirty marker',await page.locator('[data-finder-tab="'+id+'"]').textContent().then(s=>s.includes('Unsaved edits')));
 await page.locator('[data-finder-tab="'+id+'"]').click();await page.locator('.phone-sheet').waitFor({state:'detached'});check(name+' view identity and raw draft restored',await field.inputValue()==='  Phone retained draft  '&&await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===id);
 const priorCount=await viewCount.textContent();
 await click(page.locator('#saved-courses [data-private-open="'+fixture.dashboardExtra.course.id+'"]'));
 check(name+' switching courses shows destination count',await viewCount.textContent()===String(await page.locator('[role=tab]').count()));
 await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));
 check(name+' switching back restores count',await viewCount.textContent()===priorCount);
 await click(page.locator('[data-global-home]'));await page.locator('#phone-views').click();await page.locator('[data-finder-tab="'+id+'"]').click();await page.locator('.phone-sheet').waitFor({state:'detached'});check(name+' Open Views resumes from Home',await field.isVisible());
 check(name+' course roundtrip preserves editor draft',await field.inputValue()==='  Phone retained draft  ');
 await page.locator('#phone-views').click();await page.locator('[data-finder-close-tab="'+id+'"]').click();await page.locator('[data-unsaved-choice=cancel]').click();await page.waitForFunction(()=>!document.querySelector('.phone-sheet').dataset.closePending);check(name+' canceled close keeps Views open',await page.locator('.phone-sheet').isVisible());await page.keyboard.press('Escape');await page.locator('.phone-sheet').waitFor({state:'detached'});
 check(name+' dirty close Cancel protects view',await field.inputValue()==='  Phone retained draft  ');
 await page.waitForFunction(()=>{const a=document.querySelector('#phone-shell .teacher-sidebar');return a.getBoundingClientRect().right<=0&&getComputedStyle(a).visibility==='hidden'&&!document.querySelector('.phone-sheet[open]');});await page.screenshot({path:out+'/'+name+'-workspace.png'});await nav.click();await page.waitForFunction(()=>Math.abs(document.querySelector('#phone-shell .teacher-sidebar').getBoundingClientRect().x)<0.1);await page.locator('#phone-shell .sidebar-brand').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+name+'-navigate.png'});
 await page.keyboard.press('Tab');check(name+' focus stays in overlay',await page.locator('#phone-shell').evaluate(e=>e.contains(document.activeElement)));
 await page.waitForFunction(()=>Math.abs(document.querySelector('#phone-shell .teacher-sidebar').getBoundingClientRect().x)<0.1);
 const sidebar=page.locator('#phone-shell .teacher-sidebar'),box=await sidebar.boundingBox(),cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:Math.min(box.width-10,230),y:140}]});
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.min(box.width-10,230)-15*i,y:140}]});await page.evaluate(()=>new Promise(requestAnimationFrame));}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 await page.waitForFunction(()=>document.querySelector('#phone-navigate').getAttribute('aria-expanded')==='false');check(name+' inside-left swipe dismisses',true);
 check(name+' single full-width scroll surface',await page.locator('.private-primary').evaluate(e=>{const r=e.getBoundingClientRect();return r.x===0&&document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;}));
 await page.locator('#phone-views').click();await page.waitForFunction(()=>{const a=document.querySelector('#phone-shell .teacher-sidebar'),d=document.querySelector('.phone-sheet'),b=d?.getBoundingClientRect(),toolbar=document.querySelector('.phone-toolbar').getBoundingClientRect();return a.getBoundingClientRect().right<=0&&getComputedStyle(a).visibility==='hidden'&&b&&b.width>0&&b.height>0&&b.x>=0&&b.right<=innerWidth&&b.y>=0&&b.bottom<=toolbar.top+1&&[[b.x+24,b.y+24],[b.right-24,b.y+24],[b.x+24,b.bottom-24],[b.right-24,b.bottom-24]].every(([x,y])=>d.contains(document.elementFromPoint(x,y)));});check(name+' settled Views panel is fully visible with Navigate offscreen',true);await page.screenshot({path:out+'/'+name+'-views.png'});await page.locator('#phone-views').click();await page.locator('.phone-sheet').waitFor({state:'detached'});check(name+' same Views control toggles closed',await page.locator('.phone-sheet').count()===0);
 await verifySheetPositions(page,width,{check,out});
 await verifyPhoneSheetGestures(page,width,{check,out});
 const active=await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select');await page.setViewportSize({width:1440,height:1000});await page.locator('#workspace-navigation [data-private-tab=overview]').waitFor({state:'visible'});check(name+' resize restores desktop with same view',await page.locator('.course-tab-toolbar').isVisible()&&await page.locator('#workspace-navigation [data-private-tab=overview]').isVisible()&&await page.locator('#workspace-navigation [data-global-home] span').textContent()==='Dashboard'&&await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===active);await page.locator('[data-tab-finder]').click();await page.locator('.open-tabs-dialog').waitFor();await page.setViewportSize({width,height:1000});await page.locator('.open-tabs-dialog').waitFor({state:'detached'});check(name+' phone breakpoint removes desktop-only picker without changing view',await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===active);await page.emulateMedia({reducedMotion:'reduce'});await nav.click();check(name+' reduced motion removes drawer transition',await page.locator('#phone-shell .teacher-sidebar').evaluate(e=>getComputedStyle(e).transitionDuration==='0s'));await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#phone-views').click();await page.evaluate(()=>{window.testSignedOut=true;window.testAuthEvent('SIGNED_OUT');});await page.locator('#auth-form').waitFor({state:'visible'});check(name+' account reset removes sheets and prior view identities',await page.locator('.phone-sheet,[role=tab]').count()===0&&await page.locator('#phone-views').isDisabled()&&await viewCount.textContent()==='');
}


async function verifyPhoneSheetGestures(page,width,{check,out}){
 const prefix='phone-sheets-'+width,toolbar=await page.locator('.phone-toolbar').boundingBox();
 await page.locator('#phone-new').click();await page.waitForFunction(()=>document.querySelector('.phone-sheet').getAnimations().length===0);
 check(prefix+' New keeps toolbar stationary and avoids editable focus',JSON.stringify(await page.locator('.phone-toolbar').boundingBox())===JSON.stringify(toolbar)&&await page.evaluate(()=>!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)));
 await page.screenshot({path:out+'/'+prefix+'-new.png'});
 const handle=page.locator('.sheet-handle'),box=await handle.boundingBox(),sheet=page.locator('.phone-sheet'),original=await sheet.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+10);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+45,{steps:4});
 check(prefix+' sheet follows handle during drag',(await sheet.boundingBox()).y-original.y>25);check(prefix+' toolbar stays above the sheet during finger motion',await page.locator('.phone-toolbar').evaluate(e=>[...e.querySelectorAll('button')].every(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})));if(width===390)await page.screenshot({path:out+'/'+prefix+'-handle-follow.png'});await page.mouse.up();
 await page.waitForFunction(()=>{const e=document.querySelector('.phone-sheet');return e&&e.getAnimations().length===0&&getComputedStyle(e).transform==='none';});
 check(prefix+' short pull snaps back without dismissal',Math.abs((await sheet.boundingBox()).y-original.y)<1);
 await page.mouse.move(box.x+box.width/2,box.y+10);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+160,{steps:6});await page.mouse.up();await sheet.waitFor({state:'detached'});
 check(prefix+' long pull dismisses and unlocks background',await page.locator('.teacher-workspace').evaluate(e=>!e.inert));
 await page.locator('#phone-views').click();await page.waitForFunction(()=>document.querySelector('.phone-sheet').getAnimations().length===0);
 const ids=()=>page.locator('.phone-view-card').evaluateAll(es=>es.map(e=>e.dataset.viewId));const before=await ids();
 const first=page.locator('.phone-view-card').first(),second=page.locator('.phone-view-card').nth(1),a=await first.boundingBox(),b=await second.boundingBox();
 const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+40,y:a.y+25}]});
 await page.locator('[data-dragging=true]').waitFor();await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+40,y:b.y+b.height-5}]});
 check(prefix+' held card follows finger',await page.locator('[data-dragging=true]').evaluate(e=>e.style.transform!==''));if(width===390)await page.screenshot({path:out+'/'+prefix+'-card-follow.png'});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 await page.locator('#phone-views').click();await page.locator('.phone-sheet').waitFor({state:'detached'});await page.locator('#phone-views').click();await page.waitForFunction(()=>document.querySelector('.phone-sheet').getAnimations().length===0);
 check(prefix+' touch reorder persists stable view IDs',(await ids())[0]===before[1]&&JSON.stringify((await ids()).slice().sort())===JSON.stringify(before.slice().sort()));
 await page.locator('[data-finder-tab="'+before[0]+'"]').focus();await page.keyboard.press('Alt+ArrowUp');check(prefix+' accessible reorder uses same authority',(await ids())[0]===before[0]);
 check(prefix+' discoverability caption',await page.locator('.phone-reorder-hint').textContent()==='Touch and hold a view to rearrange.');
 const records=await page.evaluate(()=>JSON.stringify(window.testDb));const dirtyId=before[0];await page.locator('[data-finder-close-tab="'+dirtyId+'"]').click();await page.locator('.unsaved-navigation').waitFor();await page.setViewportSize({width:1440,height:1000});await sheet.waitFor({state:'detached'});await page.setViewportSize({width,height:1000});await sheet.waitFor({state:'visible'});await page.locator('[data-unsaved-choice=cancel]').click();await page.locator('.unsaved-navigation').waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('.phone-sheet').dataset.closePending);
 check(prefix+' dirty close Cancel preserves sheet and draft',(await ids()).includes(dirtyId)&&await page.locator('.phone-sheet').isVisible());
 await page.keyboard.press('Escape');await sheet.waitFor({state:'detached'});
 for(let i=0;i<12;i++){await page.locator('#phone-new').click();await page.locator('[data-phone-new=new]').click();await sheet.waitFor({state:'detached'});}
 await page.locator('#phone-views').click();await page.waitForFunction(()=>document.querySelector('.phone-sheet').getAnimations().length===0);
 check(prefix+' overflowing Views retains common compact height',Math.abs((await sheet.boundingBox()).height-original.height)<1);const order=await ids(),list=page.locator('.phone-sheet-body'),bounds=await list.boundingBox(),background=await page.locator('.private-primary').evaluate(e=>e.scrollTop),bar=await page.locator('.phone-toolbar').boundingBox();
 const touch=await page.context().newCDPSession(page),top=await page.locator('.phone-view-card').first().boundingBox();
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:top.x+40,y:top.y+25}]});await page.locator('[data-dragging=true]').waitFor();await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:top.x+40,y:bounds.y+bounds.height-5}]});
 await page.waitForFunction(id=>document.querySelector('.phone-view-card:last-child')?.dataset.viewId===id,order[0]);
 check(prefix+' drag auto-scroll reaches final item',await list.evaluate(e=>e.scrollTop>0));
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:top.x+40,y:bounds.y+bounds.height/2}]});const stopped=await list.evaluate(e=>e.scrollTop);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check(prefix+' leaving edge stops auto-scroll',await list.evaluate(e=>e.scrollTop)===stopped);
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:top.x+40,y:bounds.y+5}]});await page.waitForFunction(id=>document.querySelector('.phone-view-card:first-child')?.dataset.viewId===id,order[0]);
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();const released=await list.evaluate(e=>e.scrollTop);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));check(prefix+' release stops auto-scroll',await list.evaluate(e=>e.scrollTop)===released);
 check(prefix+' reverse edge drag reaches first without moving background or toolbar',await page.locator('.private-primary').evaluate(e=>e.scrollTop)===background&&JSON.stringify(await page.locator('.phone-toolbar').boundingBox())===JSON.stringify(bar));
 await page.locator('[data-finder-tab]').first().focus();await page.keyboard.press('Alt+ArrowDown');const selected=await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select');const shared=await ids();await page.setViewportSize({width:1440,height:1000});await sheet.waitFor({state:'detached'});check(prefix+' desktop shares reordered IDs',JSON.stringify(await page.locator('[role=tab]').evaluateAll(es=>es.map(e=>e.dataset.tabSelect)))===JSON.stringify(shared)&&await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===selected);await page.setViewportSize({width,height:1000});await sheet.waitFor({state:'visible'});
 for(let i=0;i<3;i++){const last=(await ids()).at(-1);await page.locator('[data-finder-close-tab="'+last+'"]').click();await page.waitForFunction(id=>![...document.querySelectorAll('.phone-view-card')].some(e=>e.dataset.viewId===id),last);}
 check(prefix+' closing views updates toolbar count',await page.locator('.phone-view-count').textContent()===String(await page.locator('[role=tab]').count()));
 check(prefix+' closing views never deletes curriculum records',await page.evaluate(s=>JSON.stringify(window.testDb)===s,records));check(prefix+' repeated close stays open and retains dirty view',await page.locator('.phone-sheet').isVisible()&&(await ids()).includes(dirtyId));
 await page.screenshot({path:out+'/'+prefix+'-views.png'});await page.keyboard.press('Escape');await page.locator('.phone-sheet').waitFor({state:'detached'});
}

// Actual handle geometry/observable animation state, never fixed capture delays.
async function verifySheetPositions(page,width,{check,out}){
 const prefix='sheet-positions-'+width,bar=page.locator('.phone-toolbar'),count=await page.locator('.phone-view-count').textContent();let compactHeight;
 for(const kind of ['new','views']){
  const toolbar=await bar.boundingBox();await page.locator('#phone-'+kind).click();const sheet=page.locator('.phone-sheet'),handle=page.locator('.sheet-handle');
  const settled=async snap=>{await page.waitForFunction(s=>{const n=document.querySelector('.phone-sheet');return n?.dataset.snap===s&&n.getAnimations().every(a=>a.playState==='finished')&&getComputedStyle(n).transform==='none';},snap);};
  const drag=async delta=>{const r=await handle.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+10);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+10+delta,{steps:5});};
  await settled('compact');const initial=await sheet.boundingBox();
  if(compactHeight===undefined)compactHeight=initial.height;
  check(prefix+' '+kind+' common compact below midpoint',Math.abs(initial.height-compactHeight)<1&&initial.y>500&&initial.height<500&&Math.abs(initial.y+initial.height-toolbar.y)<1);
  check(prefix+' '+kind+' no keyboard focus',await page.evaluate(()=>!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)));
  await page.screenshot({path:out+'/'+prefix+'-'+kind+'-compact.png'});
  await drag(-140);check(prefix+' '+kind+' upward finger following',(await sheet.boundingBox()).height>initial.height+100&&Math.abs((await sheet.boundingBox()).y+(await sheet.boundingBox()).height-toolbar.y)<1);await page.mouse.up();await settled('expanded');const expanded=await sheet.boundingBox();
  check(prefix+' '+kind+' expanded stable',expanded.height>initial.height+150&&await handle.getAttribute('aria-expanded')==='true');await page.screenshot({path:out+'/'+prefix+'-'+kind+'-expanded.png'});
  await drag(35);await page.mouse.up();await settled('expanded');check(prefix+' '+kind+' short expanded pull snaps back',Math.abs((await sheet.boundingBox()).height-expanded.height)<1);
  await drag(140);await page.mouse.up();await settled('compact');check(prefix+' '+kind+' downward returns compact',Math.abs((await sheet.boundingBox()).height-initial.height)<1);
  await drag(35);await page.mouse.up();await settled('compact');check(prefix+' '+kind+' short compact pull snaps back',Math.abs((await sheet.boundingBox()).y-initial.y)<1);
  await handle.focus();await page.keyboard.press('ArrowUp');await settled('expanded');const ids=await page.locator('[role=tab]').evaluateAll(es=>es.map(e=>e.dataset.tabSelect));
  await page.setViewportSize({width:Math.min(650,width+150),height:400});await settled('expanded');check(prefix+' '+kind+' viewport resize preserves state and views',await sheet.evaluate(e=>e.getBoundingClientRect().top>=0&&e.getBoundingClientRect().bottom<=document.querySelector('.phone-toolbar').getBoundingClientRect().top+1)&&JSON.stringify(await page.locator('[role=tab]').evaluateAll(es=>es.map(e=>e.dataset.tabSelect)))===JSON.stringify(ids));
  await page.setViewportSize({width:1440,height:1000});await sheet.waitFor({state:'detached'});await page.setViewportSize({width,height:1000});await settled('expanded');check(prefix+' '+kind+' breakpoint roundtrip restores expanded without duplicating views',JSON.stringify(await page.locator('[role=tab]').evaluateAll(es=>es.map(e=>e.dataset.tabSelect)))===JSON.stringify(ids));await page.keyboard.press('ArrowDown');await settled('compact');
  await handle.press('Enter');await settled('expanded');await handle.press('Space');await settled('compact');check(prefix+' '+kind+' keyboard toggle and toolbar/count intact',JSON.stringify(await bar.boundingBox())===JSON.stringify(toolbar)&&await page.locator('.phone-view-count').textContent()===count);
  const touch=await page.context().newCDPSession(page),r=await handle.boundingBox();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+10}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width/2,y:r.y-80}]});await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await touch.detach();await settled('compact');check(prefix+' '+kind+' canceled touch returns to prior position',Math.abs((await sheet.boundingBox()).height-initial.height)<1);
  await page.emulateMedia({reducedMotion:'reduce'});await handle.press('ArrowUp');check(prefix+' '+kind+' reduced motion avoids snap animation',await sheet.evaluate(e=>e.dataset.snap==='expanded'&&e.getAnimations().length===0));await handle.press('ArrowDown');await page.emulateMedia({reducedMotion:'no-preference'});
  await drag(150);await page.mouse.up();await sheet.waitFor({state:'detached'});check(prefix+' '+kind+' compact dismisses and unlocks background',await page.locator('.teacher-workspace').evaluate(e=>!e.inert));
 }
}
