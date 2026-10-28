// Presentation preferences are local to this page, never account/Auth settings.
function navigationState(){if(typeof document==='undefined')return;const b=document.getElementById('sidebar-collapse');if(!b)return;const expanded=matchMedia('(max-width:700px)').matches?document.body.classList.contains('mobile-nav-open'):!document.body.classList.contains('sidebar-collapsed');b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-label',expanded?'Collapse navigation':'Expand navigation');}
export function syncWorkspaceShell(course,tab,sample=false){
 if(typeof document==='undefined')return;
 const body=document.body,nav=document.getElementById('workspace-navigation');
 body?.classList.toggle('has-private-course',!!course);body?.classList.remove('mobile-nav-open');navigationState();if(!course){const sidebar=document.querySelector('.teacher-sidebar');if(sidebar)sidebar.inert=false;}
 nav?.querySelectorAll('[data-private-tab]').forEach(b=>{b.disabled=!course;b.setAttribute('aria-pressed',String(b.dataset.privateTab===tab));if(b.dataset.privateTab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 const name=document.getElementById('workspace-course-name');if(name){if(name.dataset.courseId!==course?.id){const menu=name.closest('details');if(menu)menu.open=false;}name.textContent=course?.name||'Choose a course';name.dataset.courseId=course?.id||'';}
 const badge=document.getElementById('workspace-sample-badge');if(badge)badge.hidden=!sample;
 // Move the existing account node; its auth handlers and identity remain intact.
 const auth=document.querySelector('.pilot-auth'),slot=document.getElementById(course?'settings-account-slot':'account-home');
 if(auth&&slot&&auth.parentElement!==slot)slot.append(auth);
 if(!course&&!document.getElementById('auth-form')?.hidden){const settings=document.getElementById('workspace-settings');if(settings?.open)settings.close();}
}
if(typeof document!=='undefined'){
 const sidebar=document.getElementById('sidebar-collapse'),settings=document.getElementById('workspace-settings');
 sidebar?.addEventListener('click',()=>{if(matchMedia('(max-width:700px)').matches)document.body.classList.toggle('mobile-nav-open');else document.body.classList.toggle('sidebar-collapsed');navigationState();document.querySelector('.course-switcher').open=false;});
 navigationState();window.addEventListener('resize',navigationState);
 document.querySelectorAll('[data-workspace-settings]').forEach(b=>b.addEventListener('click',()=>{document.body.classList.remove('mobile-nav-open');navigationState();settings.showModal();}));
 document.querySelector('[data-settings-close]')?.addEventListener('click',()=>settings.close());
 for(const key of ['theme','accent'])document.querySelector('[data-appearance-'+key+']')?.addEventListener('change',e=>{document.body.dataset[key]=e.target.value;});
}
