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
 const position=await nav.boundingBox();
 for(let i=0;i<3;i++){await nav.click();check(name+' drawer locks background '+i,await page.locator('.teacher-workspace').evaluate(e=>e.inert));await nav.click();}
 check(name+' stationary Navigate',JSON.stringify(await nav.boundingBox())===JSON.stringify(position));
 await nav.click();await page.waitForFunction(()=>Math.abs(document.querySelector('#phone-shell .teacher-sidebar').getBoundingClientRect().x)<0.1);const beforeScroll=await page.locator('.private-primary').evaluate(e=>e.scrollTop);await page.mouse.move(width-5,400);await page.mouse.wheel(0,350);check(name+' backdrop wheel cannot scroll background',await page.locator('.private-primary').evaluate(e=>e.scrollTop)===beforeScroll&&await page.evaluate(()=>scrollY===0));await page.locator('#phone-course-toggle').click();
 check(name+' dropdown excludes current course',await page.locator('#phone-course-options [data-private-open="'+fixture.course.id+'"]').isHidden()&&await page.locator('#phone-course-options [data-private-open="'+fixture.dashboardExtra.course.id+'"]').isVisible());
 await page.keyboard.press('Escape');check(name+' Escape returns focus',await nav.evaluate(e=>e===document.activeElement));
 await click(page.locator('#workspace-navigation [data-private-tab="lessons"]'));await click(page.locator('[data-private-lesson="'+fixture.lessons[0].id+'"]').first());
 const field=page.locator('[data-private-save="lessons"] [name=objective]');await control(field,'fill','  Phone retained draft  ');
 const id=await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select');
 await page.locator('#phone-new').click();await page.locator('#phone-views').click();
 check(name+' open view retains dirty marker',await page.locator('[data-finder-tab="'+id+'"]').textContent().then(s=>s.includes('Unsaved edits')));
 await page.locator('[data-finder-tab="'+id+'"]').click();check(name+' view identity and raw draft restored',await field.inputValue()==='  Phone retained draft  '&&await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===id);
 await click(page.locator('#saved-courses [data-private-open="'+fixture.dashboardExtra.course.id+'"]'));
 await click(page.locator('#saved-courses [data-private-open="'+fixture.course.id+'"]'));
 await click(page.locator('[data-global-home]'));await page.locator('#phone-views').click();await page.locator('[data-finder-tab="'+id+'"]').click();check(name+' Open Views resumes from Home',await field.isVisible());
 check(name+' course roundtrip preserves editor draft',await field.inputValue()==='  Phone retained draft  ');
 await page.locator('#phone-views').click();await page.locator('[data-finder-close-tab="'+id+'"]').click();await page.locator('[data-unsaved-choice=cancel]').click();
 check(name+' dirty close Cancel protects view',await field.inputValue()==='  Phone retained draft  ');
 await page.screenshot({path:out+'/'+name+'-workspace.png'});await nav.click();await page.waitForFunction(()=>Math.abs(document.querySelector('#phone-shell .teacher-sidebar').getBoundingClientRect().x)<0.1);await page.screenshot({path:out+'/'+name+'-navigate.png'});
 await page.keyboard.press('Tab');check(name+' focus stays in overlay',await page.locator('#phone-shell').evaluate(e=>e.contains(document.activeElement)));
 await page.waitForFunction(()=>Math.abs(document.querySelector('#phone-shell .teacher-sidebar').getBoundingClientRect().x)<0.1);
 const sidebar=page.locator('#phone-shell .teacher-sidebar'),box=await sidebar.boundingBox(),cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:Math.min(box.width-10,230),y:140}]});
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.min(box.width-10,230)-15*i,y:140}]});await page.evaluate(()=>new Promise(requestAnimationFrame));}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 await page.waitForFunction(()=>document.querySelector('#phone-navigate').getAttribute('aria-expanded')==='false');check(name+' inside-left swipe dismisses',true);
 check(name+' single full-width scroll surface',await page.locator('.private-primary').evaluate(e=>{const r=e.getBoundingClientRect();return r.x===0&&document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;}));
 await page.locator('#phone-views').click();await page.screenshot({path:out+'/'+name+'-views.png'});await page.locator('#phone-views').click();check(name+' same Views control toggles closed',await page.locator('.open-tabs-dialog').count()===0);
 const active=await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select');await page.setViewportSize({width:1440,height:1000});check(name+' resize restores desktop with same view',await page.locator('.course-tab-toolbar').isVisible()&&await page.locator('[role=tab][aria-selected=true]').getAttribute('data-tab-select')===active);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await nav.click();check(name+' reduced motion removes drawer transition',await page.locator('#phone-shell .teacher-sidebar').evaluate(e=>getComputedStyle(e).transitionDuration==='0s'));await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});
}
