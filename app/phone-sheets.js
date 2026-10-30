// Phone presentation/gestures only. All view mutations are supplied by workspace authority.
export function createPhoneSheets(adapter){
 let active=null;
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 const animate=(node,frames,duration=180)=>node.animate(frames,{duration:reduced()?0:duration,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{});
 function reset(){if(active){active.cleanup?.();active.node.remove();active=null;window.dispatchEvent(new CustomEvent('phone-views-panel',{detail:null}));}}
 function open(kind){
  if(active?.node.isConnected&&active.kind===kind){void active.close();return;}
  reset();let model=adapter.context();if(!model)return;
  if(document.activeElement?.matches('input,textarea,[contenteditable=true]'))document.activeElement.blur();
  const node=document.createElement('section');node.className='phone-sheet';node.dataset.sheetKind=kind;node.setAttribute('role','group');node.setAttribute('aria-label',kind==='views'?'Open Views':'New View');
  node.innerHTML='<button type="button" class="sheet-handle" aria-label="Drag down to dismiss sheet"><span></span></button><header><h2></h2><button type="button" data-sheet-close>Close</button></header><p class="sr-only" data-sheet-help>Hold a view card to reorder. Alternatively use Alt plus Up or Down on its button.</p><div class="phone-sheet-body"></div><p class="sr-only" role="status" data-sheet-status></p>';
  node.querySelector('h2').textContent=kind==='views'?'Open Views':'New View';const body=node.querySelector('.phone-sheet-body'),handle=node.querySelector('.sheet-handle');
  const state={node,kind,closing:false,close:async()=>{
   if(state.closing)return false;
   state.closing=true;state.cleanup?.();
   await animate(node,[{transform:getComputedStyle(node).transform},{transform:'translateY(110%)'}]);
   if(active!==state)return false;
   reset();document.querySelector(kind==='views'?'#phone-views':'#phone-new')?.focus({preventScroll:true});return true;
  }};
  node.dismiss=state.close;node.resetSheet=reset;active=state;
  let stopDrag=()=>{};state.cleanup=()=>stopDrag();
  const current=()=>active===state&&!state.closing&&node.isConnected&&model.current();
  const choose=async(action)=>{if(await state.close()&&model.current())await action();};
  function draw(focusId){
   stopDrag();body.replaceChildren();if(kind==='new'){
    for(const [id,label] of [['overview','Course summary'],['sequence','Course Sequence'],['units','Unit Planning'],['lessons','Lesson Planning'],['calendar','Calendar'],['create-unit','New Unit Plan'],['create-lesson','New Lesson Plan'],['new','Blank view']]){const b=document.createElement('button');b.type='button';b.dataset.phoneNew=id;b.textContent=label;b.addEventListener('click',()=>choose(()=>model.open(id)));body.append(b);}return;
   }
   for(const view of model.views()){
    const card=document.createElement('article');card.className='phone-view-card';card.dataset.viewId=view.id;card.classList.toggle('active',view.active);
    const select=document.createElement('button');select.type='button';select.dataset.finderTab=view.id;select.setAttribute('aria-describedby','phone-sheet-reorder-help');select.textContent=view.label+(view.dirty?' · Unsaved edits':'');if(view.active)select.setAttribute('aria-current','page');
    const preview=document.createElement('small');preview.textContent=view.preview;select.append(preview);
    const close=document.createElement('button');close.type='button';close.dataset.finderCloseTab=view.id;close.textContent='×';close.setAttribute('aria-label','Close '+view.label);
    let suppressUntil=0,timer=null,drag=null,start=null;
    select.addEventListener('click',()=>{if(performance.now()>suppressUntil)void choose(()=>model.select(view.id));});close.addEventListener('click',async()=>{
     if(!current()||node.dataset.closePending)return;
     const index=model.views().findIndex(v=>v.id===view.id),scroll=body.scrollTop;
     node.dataset.closePending='true';
     try{await model.close(view.id);}finally{
      delete node.dataset.closePending;
      if(current()){model=adapter.context();for(const b of node.querySelectorAll('[data-finder-history]'))b.disabled=Number(b.dataset.finderHistory)<0?!model.back:!model.forward;const remaining=model.views(),next=remaining.find(v=>v.id===view.id)||remaining[Math.min(index,remaining.length-1)];draw();body.scrollTop=scroll;const target=[...body.querySelectorAll('[data-finder-close-tab]')].find(b=>b.dataset.finderCloseTab===next?.id);(target||handle).focus({preventScroll:true});}
     }
    });
    select.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const list=model.views(),i=list.findIndex(v=>v.id===view.id),target=Math.max(0,Math.min(list.length-1,i+(e.key==='ArrowUp'?-1:1)));if(current()&&model.move(view.id,target)){draw(view.id);node.querySelector('[data-sheet-status]').textContent='View moved to position '+(target+1);}return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...body.querySelectorAll('[data-finder-tab]')],i=buttons.indexOf(select);buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus();}});
    card.addEventListener('touchstart',e=>{if(e.touches.length!==1||e.target.closest('[data-finder-close-tab]'))return;start={x:e.touches[0].clientX,y:e.touches[0].clientY};stopDrag=()=>{stop();drag=null;start=null;};timer=setTimeout(()=>{if(!current())return;drag={top:card.getBoundingClientRect().top,y:start.y};card.dataset.dragging='true';card.style.transition='none';},420);},{passive:true});
    let frame=null,lastTime=null,finger=null;
    const stop=()=>{clearTimeout(timer);if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=null;};
    function position(y){
     const before=new Map([...body.children].map(c=>[c,c.offsetTop]));
     const next=[...body.children].find(c=>c!==card&&y<body.getBoundingClientRect().top+c.offsetTop-body.scrollTop+c.offsetHeight/2);
     if(next)body.insertBefore(card,next);else body.append(card);
     card.style.transform='none';const top=card.getBoundingClientRect().top;
     card.style.transform=`translateY(${drag.top+y-drag.y-top}px)`;
     for(const c of body.children)if(c!==card&&before.has(c)){const delta=before.get(c)-c.offsetTop;if(delta)void animate(c,[{transform:`translateY(${delta}px)`},{transform:'none'}],140);}
    }
    function tick(time){
     frame=null;if(!drag||!current()){stop();return;}
     const r=body.getBoundingClientRect(),zone=Math.min(64,r.height/4),y=finger;
     const speed=y<r.top+zone?-Math.min(1,(r.top+zone-y)/zone):y>r.bottom-zone?Math.min(1,(y-r.bottom+zone)/zone):0;
     if(!speed){lastTime=null;return;}
     body.scrollTop+=speed*650*Math.min(32,lastTime===null?16:time-lastTime)/1000;lastTime=time;position(y);frame=requestAnimationFrame(tick);
    }
    card.addEventListener('touchmove',e=>{const t=e.touches[0];if(!t||!start)return;if(!drag){if(Math.hypot(t.clientX-start.x,t.clientY-start.y)>10)clearTimeout(timer);return;}e.preventDefault();finger=t.clientY;position(finger);if(frame===null)frame=requestAnimationFrame(tick);},{passive:false});
    const end=(e,cancel=false)=>{stop();if(drag){e.preventDefault();suppressUntil=performance.now()+350;if(current()&&!cancel&&!model.move(view.id,[...body.children].indexOf(card)))cancel=true;card.style.transition='';void animate(card,[{transform:card.style.transform},{transform:'none'}]);card.style.transform='';delete card.dataset.dragging;if(cancel)draw();}drag=null;start=null;};
    card.addEventListener('touchend',e=>end(e),{passive:false});card.addEventListener('touchcancel',e=>end(e,true),{passive:false});card.append(select,close);body.append(card);
   }
   if(focusId){const target=[...body.querySelectorAll('[data-finder-tab]')].find(b=>b.dataset.finderTab===focusId);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  node.querySelector('[data-sheet-help]').id='phone-sheet-reorder-help';node.querySelector('[data-sheet-close]').addEventListener('click',()=>state.close());node.addEventListener('cancel',()=>state.close());
  let pull=null;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;pull={id:e.pointerId,y:e.clientY,delta:0};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!pull||e.pointerId!==pull.id)return;pull.delta=Math.max(0,e.clientY-pull.y);node.style.transform=`translateY(${pull.delta}px)`;});
  const release=async e=>{if(!pull||e.pointerId!==pull.id)return;const delta=pull.delta;pull=null;if(delta>=Math.min(100,node.offsetHeight*.25)&&e.type!=='pointercancel')await state.close();else{await animate(node,[{transform:node.style.transform},{transform:'none'}]);node.style.transform='';}};
  handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);handle.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='Escape'){e.preventDefault();void state.close();}});
  if(kind==='views'){const hint=document.createElement('p');hint.className='phone-reorder-hint';hint.textContent='Touch and hold a view to rearrange.';node.querySelector('header').after(hint);const history=document.createElement('details');history.className='phone-view-history';history.innerHTML='<summary>View history</summary>';node.querySelector('header').after(history);for(const [step,label,enabled] of [[-1,'Back in view',model.back],[1,'Forward in view',model.forward]]){const b=document.createElement('button');b.type='button';b.dataset.finderHistory=step;b.textContent=label;b.disabled=!enabled;b.addEventListener('click',()=>choose(()=>model.travel(step)));history.append(b);}}
  draw();window.dispatchEvent(new CustomEvent('phone-views-panel',{detail:node}));handle.focus({preventScroll:true});void animate(node,[{transform:'translateY(110%)'},{transform:'none'}]);
 }
 return {open,reset};
}
