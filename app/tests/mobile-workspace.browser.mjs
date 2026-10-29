// Synthetic, touch-capable browser coverage; no hosted accounts or data.
export async function verifyMobileWorkspace(page,width,fixture,{check,click,out}){
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
