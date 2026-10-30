// Shared phone-sheet presentation only: no workspace, record or persistence state.
export function createSheetPositions({node,handle,dismiss,initialSnap='compact'}){
 let snap='compact',pull=null,moved=false,animation=null,disposed=false;
 const toolbar=document.querySelector('.phone-toolbar');
 function heights(){
  const top=Math.max(node.parentElement.getBoundingClientRect().top,window.visualViewport?.offsetTop||0);
  const expanded=Math.max(0,toolbar.getBoundingClientRect().top-top-16);
  // A shared type-scaled chrome floor keeps controls usable in short viewports.
  const chrome=12.5*parseFloat(getComputedStyle(document.documentElement).fontSize);
  return {expanded,compact:Math.min(expanded,Math.max(expanded*.44,chrome))};
 }
 function cancel(){animation?.cancel();animation=null;}
 function label(){node.dataset.snap=snap;handle.setAttribute('aria-expanded',String(snap==='expanded'));handle.setAttribute('aria-label',snap==='compact'?'Expand sheet':'Return sheet to compact position');}
 function settle(next,animated=true){
  if(disposed)return;
  const from=node.getBoundingClientRect().height,transform=getComputedStyle(node).transform;
  cancel();snap=next;label();const height=heights()[snap];node.style.height=height+'px';node.style.transform='none';
  if(animated&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
   animation=node.animate([{height:from+'px',transform},{height:height+'px',transform:'none'}],{duration:180,easing:'cubic-bezier(.2,.8,.2,1)'});
   void animation.finished.catch(()=>{});
  }
 }
 function resize(){if(disposed)return;pull=null;settle(snap,false);}
 const observer=new ResizeObserver(resize);observer.observe(toolbar);
 window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
 handle.addEventListener('pointerdown',e=>{if(e.button!==0||disposed)return;const r=node.getBoundingClientRect(),transform=getComputedStyle(node).transform;cancel();for(const a of node.getAnimations())a.cancel();node.style.height=r.height+'px';node.style.transform=transform;moved=false;pull={id:e.pointerId,y:e.clientY,top:r.top,snap};handle.setPointerCapture(e.pointerId);});
 handle.addEventListener('pointermove',e=>{
  if(!pull||e.pointerId!==pull.id)return;
  const delta=e.clientY-pull.y,h=heights();moved ||= Math.abs(delta)>5;
  const desired=toolbar.getBoundingClientRect().top-pull.top-delta;
  node.style.height=Math.max(h.compact,Math.min(h.expanded,desired))+'px';node.style.transform=pull.snap==='compact'&&desired<h.compact?`translateY(${h.compact-desired}px)`:'none';
 });
 const release=e=>{
  if(!pull||e.pointerId!==pull.id)return;
  const previous=pull.snap,delta=e.clientY-pull.y;pull=null;
  if(e.type==='pointercancel'){settle(previous);return;}
  const h=heights(),threshold=Math.max(24,Math.min(80,(h.expanded-h.compact)*.2));
  if(previous==='compact'&&delta>=Math.min(100,h.compact*.25)){void dismiss();return;}
  settle(previous==='compact'&&delta<=-threshold?'expanded':previous==='expanded'&&delta>=threshold?'compact':previous);
 };
 handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);
 handle.addEventListener('click',e=>{if(disposed||(e.detail>0&&moved))return;settle(snap==='compact'?'expanded':'compact');});
 handle.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||disposed)return;e.preventDefault();if(e.key==='ArrowUp')settle('expanded');else if(snap==='expanded')settle('compact');else void dismiss();});
 settle(initialSnap,false);
 return {snapshot:()=>snap,dispose(){disposed=true;pull=null;cancel();observer.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);}};
}
