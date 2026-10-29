import base64, hashlib, json, os, socket, struct, subprocess, tempfile, time, urllib.request
from pathlib import Path

class CDP:
    def __init__(self, url):
        from urllib.parse import urlparse
        u=urlparse(url)
        self.s=socket.create_connection((u.hostname,u.port),timeout=15)
        key=base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        response=b''
        while not response.endswith(b'\r\n\r\n'): response+=self.s.recv(1)
        assert response.startswith(b'HTTP/1.1 101 '),response
        self.seq=0; self.events=[]
    def read(self,n):
        b=b''
        while len(b)<n:
            part=self.s.recv(n-len(b))
            if not part: raise RuntimeError('Chrome connection closed')
            b+=part
        return b
    def call(self,method,params=None):
        self.seq+=1
        data=json.dumps({'id':self.seq,'method':method,'params':params or {}}).encode()
        n=len(data); header=bytes([129])
        header+=bytes([128+n]) if n<126 else bytes([254])+struct.pack('!H',n) if n<65536 else bytes([255])+struct.pack('!Q',n)
        mask=os.urandom(4)
        self.s.sendall(header+mask+bytes(v^mask[i%4] for i,v in enumerate(data)))
        while True:
            a,b=self.read(2); length=b&127
            if length==126: length=struct.unpack('!H',self.read(2))[0]
            elif length==127: length=struct.unpack('!Q',self.read(8))[0]
            payload=self.read(length)
            if a&15==8: raise RuntimeError('Websocket closed')
            msg=json.loads(payload)
            if 'method' in msg: self.events.append(msg)
            if msg.get('id')==self.seq:
                if 'error' in msg: raise RuntimeError(msg['error'])
                return msg.get('result',{})

import traceback
out=Path(__file__).resolve().parents[1]/'docs/reviews/interactive-demo-2026-10-20'
out.mkdir(parents=True,exist_ok=True)
checks=[];captures=[]
profile=tempfile.mkdtemp(prefix='course-verify-')
chrome=subprocess.Popen(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    portfile=Path(profile)/'DevToolsActivePort'
    for _ in range(100):
        if portfile.exists():break
        time.sleep(.1)
    port=int(portfile.read_text().splitlines()[0]);tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
    c=CDP(next(t['webSocketDebuggerUrl'] for t in tabs if t['type']=='page'))
    for domain in ['Page','Runtime','Log','Network']:c.call(domain+'.enable')
    def ev(expr):
        r=c.call('Runtime.evaluate',{'expression':expr,'returnByValue':True,'awaitPromise':True})
        if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
        return r['result'].get('value')
    def click(selector):
        sel=json.dumps(selector)
        # An earlier smooth anchor scroll can resume after scrollIntoView('instant'),
        # moving the target between mouse-down and mouse-up. Settle it first,
        # then settle our own scroll and verify the actual pointer hit target.
        p=ev(f'''(async()=>{{
            const e=document.querySelector({sel});if(!e)throw Error('Missing '+{sel});
            async function settle(){{
                const deadline=performance.now()+3000;let previous=null,stable=0;
                while(performance.now()<deadline){{
                    await new Promise(requestAnimationFrame);
                    const r=e.getBoundingClientRect(),position=[scrollX,scrollY,r.x,r.y,r.width,r.height];
                    stable=previous&&position.every((v,i)=>Math.abs(v-previous[i])<0.1)?stable+1:0;
                    if(stable>=3)return;
                    previous=position;
                }}
                throw Error('Click target did not settle: '+{sel});
            }}
            await settle();e.scrollIntoView({{block:'center',behavior:'instant'}});await settle();
            const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
            if(!r.width||!r.height||!e.contains(document.elementFromPoint(x,y)))throw Error('Click target is obscured: '+{sel});
            return {{x,y}};
        }})()''')
        for kind in ['mousePressed','mouseReleased']:
            c.call('Input.dispatchMouseEvent',{'type':kind,'x':p['x'],'y':p['y'],'button':'left','clickCount':1})
        time.sleep(.06)
    def change(selector,value,event='change'):
        ev(f'''(()=>{{const e=document.querySelector({json.dumps(selector)});e.value={json.dumps(value)};e.dispatchEvent(new Event({json.dumps(event)},{{bubbles:true}}));}})()''')
        time.sleep(.05)
    def check(number,name,expr):
        passed=ev(expr) if isinstance(expr,str) else bool(expr)
        checks.append({'width':width,'acceptance':number,'name':name,'passed':passed})
        assert passed,f'Acceptance {number}: {name}'
    def reload():
        c.call('Page.navigate',{'url':'http://127.0.0.1:8000/'})
        for _ in range(100):
            if ev("document.readyState==='complete'&&document.querySelectorAll('.cp-lesson-row').length===10"):break
            time.sleep(.1)
        assert ev("document.readyState==='complete'&&document.querySelectorAll('.cp-lesson-row').length===10"), 'Local page failed to initialize'
        time.sleep(.1)
    def shot(name,target='#application',viewport=False):
        if viewport:
            params={'format':'png'}
        else:
            ev("window.scrollTo({top:0,behavior:'instant'})")
            if target is None:
                size=c.call('Page.getLayoutMetrics')['cssContentSize'];box={'x':0,'y':0,'width':width,'height':size['height']}
            else:
                box=ev(f'''(()=>{{const r=document.querySelector({json.dumps(target)}).getBoundingClientRect();return {{x:Math.max(0,Math.floor(r.x)-2),y:Math.max(0,Math.floor(r.y)-2),width:Math.min(innerWidth-Math.max(0,Math.floor(r.x)-2),Math.ceil(r.width)+4),height:Math.ceil(r.height)+4}}}})()''')
            params={'format':'png','captureBeyondViewport':True,'clip':dict(box,scale=1)}
        data=base64.b64decode(c.call('Page.captureScreenshot',params)['data'])
        path=out/folder/f'{prefix}-{name}.png';path.parent.mkdir(exist_ok=True);path.write_bytes(data)
        dims=struct.unpack('!II',data[16:24]);captures.append({'file':str(path.relative_to(out)),'pixels':dims,'viewport':width})
        check(1,'No horizontal overflow in '+name,"document.documentElement.scrollWidth===innerWidth && document.querySelector('#workspace-content').scrollWidth<=document.querySelector('#workspace-content').clientWidth+1")
    def state_dates():return ev('JSON.stringify({rows:course.lessons.map(l=>({id:l.id,dates:l.dates,pinned:l.pinned,preference:l.preference})),rules:course.rules})')
    for width,folder,prefix in [(1440,'Desktop','desktop'),(390,'Mobile','mobile')]:
        c.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1000 if width==1440 else 844,'deviceScaleFactor':1,'mobile':width==390})
        reload()
        check(1,'All three local assets return HTTP 200',"performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).length===3&&performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')).every(r=>r.responseStatus===200)")
        for anchor in ['#product','#how-it-works','#customization']:
            click(f'.site-nav a[href="{anchor}"]');check(1,'Anchor '+anchor,f'location.hash==={json.dumps(anchor)}')
        check(2,'Default all-unit course-wide table, no lesson-detail interface',"state.workspace==='sequence'&&state.sequenceView==='table'&&state.unitFilter==='all'&&document.querySelectorAll('.cp-lesson-row').length===10&&!document.querySelector('[data-lesson-id]')")
        check(13,'Exactly two later lessons start In Progress; Ready and Draft remain',"course.lessons.filter(l=>l.status==='In Progress').map(l=>l.id).join() === 'lesson-laws,lesson-executive'&&course.lessons.some(l=>l.status==='Ready')&&course.lessons.some(l=>l.status==='Draft')")
        check(13,'Default counts and pacing reconcile',"document.getElementById('course-counts').textContent==='3 units · 10 lessons · 1 assessment'&&course.units.reduce((sum,u)=>sum+u.targetDays,0)===12&&unitLessons('unit-constitution').length===4&&planningStats(unitById('unit-constitution')).days===5&&planningStats(unitById('unit-constitution')).variance==='On target'")
        shot('01-full-page',None);shot('02-course-sequence-table');shot('18-landing-page-hero','#top')
        check(1,'Platform-neutral connected-planning copy',"!document.documentElement.outerHTML.toLowerCase().includes('standalone')&&document.querySelector('.hero-description').textContent.includes('before confirming a move')")
        if width==390:
            ev("document.querySelector('#application').scrollIntoView({block:'start',behavior:'instant'})")
            visible_rows=ev("(()=>{const stage=document.querySelector('#workspace-content').getBoundingClientRect();return [...document.querySelectorAll('.cp-lesson-row')].filter(e=>{const r=e.getBoundingClientRect();return r.top>=stage.top&&r.bottom<=Math.min(stage.bottom,innerHeight)}).length})()")
            check(2,'At least two complete lesson records visible on initial mobile demo',visible_rows>=2)
            check(3,'Compact mobile rows keep type, status and dates visible',"[...document.querySelectorAll('.cp-lesson-row td')].every(e=>getComputedStyle(e).display!=='none')")
            check(3,'Mobile filter, title, status touch targets remain at least 44px',"[...document.querySelectorAll('.cp-unit-filters button,.cp-lesson-row .cp-link,.cp-lesson-row select')].every(e=>e.getBoundingClientRect().height>=44)")
            (out/'mobile-initial-visibility.json').write_text(json.dumps({'viewport':[390,844],'completeLessonRowsVisible':visible_rows},indent=2))

        click('[data-filter="unit-constitution"]');check(3,'Table unit filter gives four matching stable IDs',"document.querySelectorAll('.cp-lesson-row').length===4&&[...document.querySelectorAll('.cp-lesson-row')].every(r=>lessonById(r.dataset.recordId).unitId==='unit-constitution')")
        tableids=ev("[...document.querySelectorAll('.cp-lesson-row')].map(r=>r.dataset.recordId)")
        click('[data-sequence-view="board"]');check(3,'Board uses same unit filter and records',tableids==ev("[...document.querySelectorAll('.cp-board-lesson')].map(r=>r.dataset.recordId)"))
        check(12,'Board stays inside Course Sequence',"state.workspace==='sequence'&&document.querySelector('[data-workspace][aria-pressed=true]').dataset.workspace==='sequence'")
        click('[data-filter="unit-constitution"]');check(3,'Selecting unit filter again restores all units',"document.querySelectorAll('.cp-board-lesson').length===10&&state.unitFilter==='all'")
        shot('03-course-sequence-board')
        change('#sequence-search','Ratification','input');check(3,'Search affects Board',"document.querySelectorAll('.cp-board-lesson').length===1")
        click('[data-sequence-view="table"]');check(3,'Search also affects Table',"document.querySelectorAll('.cp-lesson-row').length===1")
        change('#sequence-search','','input')
        prior_dates=state_dates();change('[data-status="lesson-principles"]','In Progress')
        check(3,'Inline status updates shared record without schedule changes',ev("lessonById('lesson-principles').status==='In Progress'") and state_dates()==prior_dates)
        click('[data-open-lesson="lesson-principles"]');check(4,'Lesson Planning is a distinct module layout',"state.workspace==='lesson'&&!!document.querySelector('[data-lesson-id="+'"lesson-principles"'+"]')&&document.querySelectorAll('.cp-module').length===6&&!document.querySelector('.cp-table')")
        check(3,'Status edit follows the stable lesson ID',"document.querySelector('.cp-meta').textContent.includes('In Progress')")
        click('#demo-back');check(12,'Back restores Course Sequence and edits',"state.workspace==='sequence'&&document.querySelector('[data-status="+'"lesson-principles"'+"]').value==='In Progress'")
        click('[data-open-unit="unit-constitution"]')
        for uid in ['unit-foundations','unit-constitution','unit-branches']:
            change('#unit-selector',uid)
            check(5,'Selected unit title is the prominent heading '+uid,"document.querySelector('.cp-unit-overview h5').textContent===currentUnit().title")
            check(5,'Unit-owned fields match '+uid,"[...document.querySelectorAll('[data-unit-field]')].every(e=>String(unitById(e.dataset.owner)[e.dataset.unitField])===e.value)&&document.querySelectorAll('.cp-connected li').length===unitLessons(currentUnit().id).length")
        change('#unit-selector','unit-constitution')
        ev('stage.scrollTop=0');shot('15-unit-overview-collapsed')
        click('[data-section="unit-constitution:purpose"] summary');click('[data-section="unit-constitution:outcomes"] summary')
        check(5,'Unit sections expand independently',"document.querySelector('[data-section="+'"unit-constitution:purpose"'+"]').open&&document.querySelector('[data-section="+'"unit-constitution:outcomes"'+"]').open")
        prior_dates=state_dates();change('[data-unit-field="targetDays"]','6')
        check(5,'Target days updates variance without rescheduling',ev("document.querySelector('.cp-stats').textContent.includes('1 day under target')") and state_dates()==prior_dates)
        change('[data-unit-field="targetDays"]','5')
        change('[data-unit-field="question"]','How can constitutional rules protect people and limit power?')
        ev('stage.scrollTop=0');shot('04-unit-planning')
        click('[data-open-lesson="lesson-framework"]')
        check(6,'Unit EQ inherited live, Guiding Question owned by lesson',"document.querySelector('.cp-inherited p').textContent===unitById(currentLesson().unitId).question&&document.querySelector('[data-lesson-field="+'"guidingQuestion"'+"]').value===currentLesson().guidingQuestion")
        for lid in ev('course.lessons.map(l=>l.id)'):
            change('#lesson-selector',lid)
            check(6,'Correct stable lesson and fields '+lid,"document.querySelector('[data-lesson-id]').dataset.lessonId===currentLesson().id&&document.querySelector('[data-lesson-field="+'"objective"'+"]').value===currentLesson().objective&&document.querySelector('.cp-inherited p').textContent===unitById(currentLesson().unitId).question")
        change('#lesson-selector','lesson-principles');click('[data-lesson-step="1"]');check(6,'Next lesson',"state.lessonId==='lesson-september-11-stories'")
        click('[data-lesson-step="-1"]');check(6,'Previous lesson',"state.lessonId==='lesson-principles'")
        click('[data-section="lesson-principles:assessment"] summary');check(6,'Lesson modules expand independently',"document.querySelector('[data-section="+'"lesson-principles:goals"'+"]').open&&document.querySelector('[data-section="+'"lesson-principles:assessment"'+"]').open")
        ev('stage.scrollTop=0');shot('05-lesson-planning')
        ev("document.querySelector('[data-section=\"lesson-principles:goals\"]').scrollIntoView({block:'start',behavior:'instant'})");shot('16-lesson-modules-close-up')
        change('[data-lesson-field="objective"]','Apply constitutional principles to a fictional community decision.')
        check(6,'Lesson editing updates the same shared record',"currentLesson().objective==='Apply constitutional principles to a fictional community decision.'")
        before_fields=ev('JSON.stringify(currentLesson())')
        click('[data-template-options]');click('[data-template-preview="discussion"]');shot('06-template-change-preview',viewport=True)
        click('[data-cancel]');check(10,'Cancel template leaves all data intact',before_fields==ev('JSON.stringify(currentLesson())'))
        click('[data-template-options]');click('[data-template-preview="discussion"]');click('[data-confirm]')
        old=json.loads(before_fields);new=ev('({...currentLesson(),templateOverride:null})')
        check(10,'Template changes presentation without losing any field',old==new)
        check(10,'Differentiation retained under collapsed section',"document.querySelector('[data-lesson-field="+'"differentiation"'+"]').value===currentLesson().differentiation&&!!document.querySelector('[data-section="+'"lesson-principles:retained"'+"]')")
        click('[data-section="lesson-principles:goals"] summary');click('[data-section="lesson-principles:retained"] summary')
        ev('stage.scrollTop=0');shot('07-lesson-template-retained-content')
        change('#course-template','discussion');check(10,'Course default does not restructure existing lessons',"course.defaultTemplate==='discussion'&&course.lessons.every(l=>l.baseTemplate==='connected')")
        click('[data-section="lesson-principles:materials"] summary');check(11,'Materials are illustrative text, no live resource links',"document.querySelectorAll('.cp-materials a').length===0&&document.querySelector('.cp-materials').textContent.includes('no file attached')")
        click('[data-workspace="calendar"]');check(7,'Calendar is a real September month grid',"state.calendarView==='month'&&document.querySelectorAll('.cp-day').length===35&&document.querySelectorAll('.cp-day')[2].dataset.day==='2026-09-01'")
        for day,kind in [('2026-09-04','Flex day'),('2026-09-07','Closure'),('2026-09-11','Special Lesson'),('2026-09-14','Assessment'),('2026-09-17','Instructional exception')]:
            click(f'[data-day="{day}"]');check(7,'Calendar day shows '+kind,f'document.querySelector(".cp-day-detail").textContent.includes({json.dumps(kind)})')
        click('[data-day="2026-09-11"]');check(7,'Pinned special lesson visible',"document.querySelector('.cp-day-detail').textContent.includes('Pinned')")
        shot('17-calendar-selected-day-detail')
        ev('stage.scrollTop=0');shot('08-calendar-month')
        click('.cp-day-detail [data-open-lesson]');check(6,'Calendar opens same special lesson',"state.lessonId==='lesson-september-11-stories'&&state.workspace==='lesson'")
        click('[data-workspace="calendar"]');click('[data-calendar-view="week"]');check(7,'Week has seven dates and stays Calendar',"state.workspace==='calendar'&&document.querySelectorAll('.cp-agenda-day').length===7")
        shot('09-calendar-week')
        click('[data-period="1"]');check(7,'Next week navigates coherently',"state.day==='2026-09-18'")
        click('[data-period="-1"]');click('[data-calendar-view="month"]');click('[data-period="1"]');check(7,'Next month October',"state.month==='2026-10'&&document.querySelector('.cp-calendar-nav h5').textContent==='October 2026'")
        click('[data-period="-1"]')
        before=state_dates();click('[data-schedule="flexible"]')
        check(8,'Flexible preview shows three consistent baseline changes',"state.pending.affected.length===3&&state.pending.rows.find(r=>r.id==='lesson-laws').dates[0]==='2026-09-16'&&state.pending.rows.find(r=>r.id==='lesson-executive').dates[0]==='2026-09-18'&&state.pending.rows.find(r=>r.id==='lesson-courts').dates[0]==='2026-09-21'&&state.pending.conflicts.length===0")
        check(8,'Independent scenario baseline and replacement explicitly disclosed',"dialog.textContent.includes('Independent example')&&dialog.textContent.includes('Confirm replaces any earlier demo pin')&&document.querySelector('.cp-constraint').textContent.includes('Stories of September 11, 2001')")
        check(8,'Modal has no horizontal overflow and readable date type',"dialog.scrollWidth<=dialog.clientWidth+1&&parseFloat(getComputedStyle(document.querySelector('.cp-date-comparison b')).fontSize)>=18&&document.querySelector('[data-confirm]').getBoundingClientRect().height>=44")
        check(8,'Schedule dialog begins at its heading',"dialog.scrollTop===0&&document.activeElement.id==='dialog-title'")
        shot('10-flexible-schedule-preview',viewport=True)
        ev('dialog.scrollTop=dialog.scrollHeight');shot('19-schedule-protected-constraints',viewport=True)
        click('[data-cancel]');check(8,'Cancel leaves all schedule fields and rules unchanged',state_dates()==before)
        # Required ordinary journey, without reload or manual state repair.
        for action, dates, pinned in [('flexible',['2026-09-16','2026-09-18','2026-09-21'],False),('pin',['2026-09-16','2026-09-18','2026-09-21'],True),('recalculate',['2026-09-18','2026-09-21','2026-09-22'],False)]:
            saved=ev('JSON.stringify(course)')
            click(f'[data-schedule="{action}"]')
            check(8,'Opening '+action+' is pure',saved==ev('JSON.stringify(course)'))
            check(9,action+' has no inherited demo conflict',"state.pending.conflicts.length===0&&!document.querySelector('[data-confirm]').disabled")
            if action=='pin':shot('12-pin-to-date-preview',viewport=True)
            if action=='recalculate':shot('20-closure-recalculation-preview',viewport=True)
            click('[data-confirm]')
            check(9,action+' confirms correct ordered dates',ev("['lesson-laws','lesson-executive','lesson-courts'].map(id=>lessonById(id).dates[0])")==dates and ev("lessonById('lesson-laws').pinned")==pinned)
            check(9,action+' preserves September 11 pin and September 14 assessment',"lessonById('lesson-september-11-stories').pinned&&lessonById('lesson-september-11-stories').dates[0]==='2026-09-11'&&lessonById('lesson-ratification').dates[0]==='2026-09-14'&&lessonById('lesson-ratification').type==='Assessment'")
            check(13,action+' never schedules instruction on unavailable days',"course.lessons.every(l=>l.dates.every(d=>![0,6].includes(asDate(d).getUTCDay())&&!course.rules.some(r=>r.date===d&&r.unavailable)))&&course.lessons.every((l,i)=>i===0||l.dates[0]>course.lessons[i-1].dates.at(-1))")
        check(9,'Closure has priority on September 16',"course.rules.some(r=>r.type==='Closure'&&r.date==='2026-09-16')&&dayEvents('2026-09-16').every(e=>e.kind==='rule')")
        check(8,'Scheduling keeps authored fields and template',"lessonById('lesson-principles').objective==='Apply constitutional principles to a fictional community decision.'&&lessonById('lesson-principles').templateOverride==='discussion'")
        shot('11-calendar-after-flexible-recalculation')
        click('[data-day="2026-09-11"]')
        check(7,'September 11 selects special lesson and protected pin',"document.querySelector('.cp-day-detail').textContent.includes('Stories of September 11, 2001')&&document.querySelector('.cp-day-detail').textContent.includes('Pinned')")
        click('.cp-day-detail [data-open-lesson]')
        check(6,'Remembrance lesson opens meaningful planning content',"currentLesson().id==='lesson-september-11-stories'&&['objective','guidingQuestion','activities','assessment'].every(f=>currentLesson()[f].length>60)&&document.querySelector('[data-lesson-field=objective]').value===currentLesson().objective")
        click('[data-section="lesson-september-11-stories:activities"] summary');click('[data-section="lesson-september-11-stories:assessment"] summary')
        shot('21-remembrance-lesson')
        click('[data-workspace="sequence"]');change('#sequence-search','September 11','input')
        check(3,'Special lesson identity and pin agree in Table',"document.querySelectorAll('.cp-lesson-row').length===1&&document.querySelector('[data-record-id]').dataset.recordId==='lesson-september-11-stories'&&document.querySelector('[data-record-id]').textContent.includes('Pinned')")
        change('#sequence-search','','input')
        for view in ['table','board']:
            click(f'[data-sequence-view="{view}"]')
            for lid in ['lesson-laws','lesson-executive']:
                check(3,'Default In Progress status in '+view+' '+lid,f'document.querySelector(\'[data-status="{lid}"]\').value==="In Progress"')
        for lid in ['lesson-laws','lesson-executive']:
            click(f'[data-open-lesson="{lid}"]')
            check(6,'In Progress shared with Lesson Planning '+lid,"document.querySelector('.cp-meta').textContent.includes('In Progress')")
            click('[data-workspace="sequence"]')
        change('[data-status="lesson-laws"]','Draft')
        click('[data-sequence-view="table"]');check(3,'Status remains editable across layouts',"document.querySelector('[data-status=lesson-laws]').value==='Draft'")
        click('[data-open-lesson="lesson-laws"]');check(6,'Edited status follows into Lesson Planning',"document.querySelector('.cp-meta').textContent.includes('Draft')")
        click('[data-workspace="calendar"]')
        # Repetition and a different order must be independent too.
        for action in ['pin','recalculate','recalculate','flexible','pin','flexible']:
            click(f'[data-schedule="{action}"]')
            check(9,'Repeated independent '+action+' remains confirmable',"state.pending.conflicts.length===0&&!document.querySelector('[data-confirm]').disabled")
            click('[data-confirm]')
        # Deliberate protected-pin conflict against the underlying scheduling engine.
        ev("var protectedFixture=structuredClone(scheduleBaseline); protectedFixture.rows.find(r=>r.id==='lesson-laws').pinned=true; protectedFixture.rows.find(r=>r.id==='lesson-laws').dates=['2026-09-16'];")
        before=ev('JSON.stringify(course)')
        ev("showSchedule('recalculate',protectedFixture)")
        check(9,'Deliberate closure conflict cannot overwrite pin',"state.pending.conflicts.length===1&&document.querySelector('[data-confirm]').disabled&&state.pending.rows.find(r=>r.id==='lesson-laws').pinned&&state.pending.rows.find(r=>r.id==='lesson-laws').dates[0]==='2026-09-16'&&state.pending.rules.some(r=>r.type==='Closure'&&r.date==='2026-09-16')")
        check(9,'Blocking conflicts have a distinct section',"!!document.querySelector('.cp-conflict-section')&&document.querySelector('.cp-conflict-section').textContent.includes('Resolve before confirming')")
        check(9,'Pure engine preserves its pinned input',"protectedFixture.rows.find(r=>r.id==='lesson-laws').pinned&&protectedFixture.rows.find(r=>r.id==='lesson-laws').dates[0]==='2026-09-16'")
        shot('13-pin-conflict-preview',viewport=True)
        ev("document.querySelector('[data-confirm]').click()")
        check(9,'Disabled confirm leaves all records and rules intact',before==ev('JSON.stringify(course)'))
        click('[data-cancel]');check(8,'Conflict cancel preserves records and rules',before==ev('JSON.stringify(course)'))
        reload();change('#course-template','discussion');change('#color-unit','unit-constitution');click('[data-color="pink"]');shot('14-customization','#customization')
        check(10,'Color updates shared unit record',"unitById('unit-constitution').color==='pink'")
        check(12,'Only four workspaces, local toggles absent from Unit Planning',"document.querySelectorAll('[data-workspace]').length===4")
        click('[data-workspace="unit"]');check(12,'No global view switch in Unit Planning',"!document.querySelector('[data-sequence-view]')&&!document.querySelector('[data-calendar-view]')")
        check(13,'Ten unique IDs; three units; 11 instructional days',"new Set(course.lessons.map(l=>l.id)).size===10&&new Set(course.units.map(u=>u.id)).size===3&&course.lessons.flatMap(l=>l.dates).length===11&&course.lessons.filter(l=>l.type==='Assessment').length===1")
        check(13,'All September 2026 sample dates and weekday formatting reconcile',"course.lessons.every(l=>l.dates.every(d=>d.startsWith('2026-09-')))&&fullDate('2026-09-01')==='Tuesday, September 1, 2026'&&fullDate('2026-09-11')==='Friday, September 11, 2026'")
        check(14,'No storage or external resource requests',"localStorage.length===0&&sessionStorage.length===0&&performance.getEntriesByType('resource').every(r=>r.name.startsWith('http://127.0.0.1:8000/')||r.name.startsWith('data:'))")
        ev("document.querySelector('[data-workspace=\"lesson\"]').focus()")
        for kind in ['keyDown','keyUp']:c.call('Input.dispatchKeyEvent',{'type':kind,'key':'Enter','code':'Enter','windowsVirtualKeyCode':13,**({'text':'\r','unmodifiedText':'\r'} if kind=='keyDown' else {})})
        check(12,'Keyboard Enter activates workspace',"state.workspace==='lesson'")
        ev("document.querySelector('.cp-module summary').focus()")
        was_open=ev("document.querySelector('.cp-module').open")
        for kind in ['keyDown','keyUp']:c.call('Input.dispatchKeyEvent',{'type':kind,'key':'Enter','code':'Enter','windowsVirtualKeyCode':13,**({'text':'\r','unmodifiedText':'\r'} if kind=='keyDown' else {})})
        time.sleep(.05)
        check(6,'Keyboard toggles native lesson module',was_open!=ev("document.querySelector('.cp-module').open"))
        click('[data-template-options]')
        for kind in ['keyDown','keyUp']:c.call('Input.dispatchKeyEvent',{'type':kind,'key':'Escape','code':'Escape','windowsVirtualKeyCode':27})
        time.sleep(.05)
        check(10,'Escape cancels dialog without applying',"!dialog.open&&state.pending===null")
        print('Completed desktop/mobile checks:',width,flush=True)
    errors=[e for e in c.events if e['method']=='Runtime.exceptionThrown' or (e['method']=='Log.entryAdded' and e['params']['entry']['level']=='error')]
    assert not errors,errors
    evidence={'checks':checks,'screenshots':captures,'browserErrors':errors,'date':'2026-10-20'}
    (out/'verification-evidence.json').write_text(json.dumps(evidence,indent=2))
    print('PASS',len(checks),'checks;',len(captures),'screenshots;',len(errors),'browser errors',flush=True)
except Exception:
    traceback.print_exc()
    (out/'partial-checks.json').write_text(json.dumps(checks,indent=2))
    try:
        print('Browser state',ev("document.querySelector('#workspace-content').innerText.slice(0,1500)"),flush=True)
        (out/'failure.png').write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['data']))
    except Exception:pass
    raise
finally:
    chrome.terminate()
    try:chrome.wait(timeout=10)
    except subprocess.TimeoutExpired:chrome.kill()
