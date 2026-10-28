"""Real PG17 rehearsal over a private local Unix socket. No hosted URL/DSN is accepted."""
import argparse,datetime,hashlib,json,os,re,stat,subprocess,sys,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DB='course_planner_f3_staging'
A='a0000000-0000-4000-8000-000000000001'
B='b0000000-0000-4000-8000-000000000001'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin',type=Path,required=True)
parser.add_argument('--cluster-dir',type=Path,required=True)
parser.add_argument('--initialize',action='store_true',help='Create fictional fixture in an empty, guarded local cluster')
parser.add_argument('--capture-baseline',action='store_true',help='Initial explicit baseline binding; never used by tests to accept drift')
parser.add_argument('--additional-only',action='store_true',help='Supplemental negative controls on an already remediated disposable fixture')
parser.add_argument('--output',type=Path,default=ROOT/'local-output')
args=parser.parse_args()
args.output.mkdir(exist_ok=True,parents=True)
socket=args.cluster_dir.resolve()/'socket'
if not socket.is_dir() or socket.stat().st_uid!=os.getuid() or stat.S_IMODE(socket.stat().st_mode)!=0o700:
    raise SystemExit('Requires a private, owner-only local socket directory')
if not str(socket).startswith('/private/tmp/course-planner-f3-cluster-'):
    raise SystemExit('Refusing an unrecognized cluster location')
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
env.update(PGHOST=str(socket),PGPORT='55415',PGCONNECT_TIMEOUT='3',PGAPPNAME='issue15-local-only')
checks=[];snapshots=[];failures=[];notes=[]
def run(sql,user='f3_setup',database=DB,expected_error=None):
    r=subprocess.run([str(args.pg_bin/'psql'),'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U',user,'-d',database],
        input='\\set VERBOSITY verbose\n'+sql,env=env,capture_output=True,text=True,timeout=45)
    if expected_error:
        if r.returncode==0 or expected_error not in r.stderr: raise AssertionError('Expected '+expected_error+': '+r.stderr)
        return r.stderr
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
def j(sql,**kw): return json.loads(run(sql,**kw))
def check(name,condition,**evidence):
    checks.append({'name':name,'passed':bool(condition),**evidence})
    if not condition: raise AssertionError(name)
def actor(sql,owner=None):
    if owner is None: owner=A
    return "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims="+literal(json.dumps({'sub':owner}))+";\n"+sql+"\nCOMMIT;"
def ar(sql,owner=None,**kw): return run(actor(sql,owner),user='authenticator',**kw)
def aj(sql,owner=None): return json.loads(ar(sql,owner))
def literal(s): return "'"+str(s).replace("'","''")+"'"
def uid(): return str(uuid.uuid4())
def digest(): return run((ROOT/'protected-state.sql').read_text(),user='postgres')
def counts():
    return j("""SELECT jsonb_build_array(
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a
       WHERE n.nspname='public' AND c.relname IN ('courses','units','lessons','calendar_exceptions')
       AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')),
      (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
       WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
       AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')),
      (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
       WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
       AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')));""")
def snapshot(label,wanted):
    inventory=j((ROOT/'inventory.sql').read_text(),user='postgres')
    current=counts()
    snapshots.append({'label':label,'counts':current,'protected_digest':digest(),'inventory':inventory})
    check(label+' exact phase counts',current==wanted)
    check(label+' protected metadata unchanged',digest()==baseline['protected_state_md5'])
def migration(phase,direction='up',user=None,marker=True,expected_error=None,sql=None,database=DB):
    if user is None: user='supabase_admin' if phase=='B2' else 'postgres'
    code=sql if sql is not None else (ROOT/'proposals'/f'{phase}-{direction}.sql').read_text()
    prefix="SET course_planner.issue15_target='approved-disposable-staging';\n" if marker else ''
    return run(prefix+code,user=user,database=database,expected_error=expected_error)
def denied(name,sql,owner=None,state='42501'):
    if owner is None: owner=B
    error=ar(sql,owner,expected_error=state)
    check(name,state in error,sqlstate=state)

def ordinary(label,extras):
    c,u,l,e=uid(),uid(),uid(),uid()
    ar(f"""INSERT INTO public.courses(id,owner_id,name,first_day,last_day)
       VALUES ('{c}','{A}','Fictional {label}','2026-09-01','2027-06-30');
       INSERT INTO public.units(id,course_id,position,title) VALUES ('{u}','{c}',1,'Fictional unit');
       INSERT INTO public.lessons(id,course_id,unit_id,position,title,scheduled_dates)
        VALUES ('{l}','{c}','{u}',1,'Fictional lesson',ARRAY['2026-10-28'::date]);
       INSERT INTO public.calendar_exceptions(id,course_id,date,effect,event_type,title)
        VALUES ('{e}','{c}','2026-10-29','No Lesson','Closure','Fictional closure');""")
    state=aj(f"""SELECT jsonb_build_object('owner',c.owner_id,'units',(SELECT count(*) FROM units WHERE course_id=c.id),
      'lessons',(SELECT count(*) FROM lessons WHERE course_id=c.id),'events',(SELECT count(*) FROM calendar_exceptions WHERE course_id=c.id),
      'role',current_user,'super',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
      'bypass',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user))
      FROM courses c WHERE c.id='{c}';""")
    check(label+' owned create/read/reopen each table',state['owner']==A and [state[x] for x in ('units','lessons','events')]==[1,1,1])
    check(label+' application role is non-owner non-superuser without bypass',state['role']=='authenticated' and not state['super'] and not state['bypass'])
    for table,record,field,value in [('courses',c,'name','Edited fictional course'),('units',u,'title','Edited fictional unit'),('lessons',l,'title','Edited fictional lesson'),('calendar_exceptions',e,'title','Edited fictional event')]:
        before=aj(f"SELECT row_to_json(t) FROM public.{table} t WHERE id='{record}';")
        rows=aj(f"""WITH changed AS (UPDATE public.{table} SET {field}={literal(value)}
          WHERE id='{record}' AND revision={before['revision']} RETURNING *) SELECT coalesce(jsonb_agg(changed),'[]') FROM changed;""")
        check(label+' '+table+' save/revision trigger',len(rows)==1 and rows[0]['id']==record and rows[0]['revision']==before['revision']+1 and rows[0]['updated_at']!=before['updated_at'])
        stale=aj(f"""WITH changed AS (UPDATE public.{table} SET {field}='Stale fictional write'
          WHERE id='{record}' AND revision={before['revision']} RETURNING id) SELECT count(*) FROM changed;""")
        check(label+' '+table+' stale revision cannot overwrite',stale==0)
        hidden=aj(f"SELECT count(*) FROM public.{table} WHERE id='{record}';",B)
        check(label+' B cannot read A '+table,hidden==0)
        cross=aj(f"""WITH changed AS (UPDATE public.{table} SET {field}='Foreign fictional write' WHERE id='{record}' RETURNING id)
          SELECT count(*) FROM changed;""",B)
        check(label+' B cannot update A '+table,cross==0)
        check(label+' A record unchanged by B '+table,aj(f"SELECT to_jsonb({field}) FROM public.{table} WHERE id='{record}';")==value)
    denied(label+' B cannot insert A course',f"INSERT INTO courses(owner_id,name) VALUES ('{A}','Foreign owner');")
    denied(label+' B cannot insert A unit',f"INSERT INTO units(course_id,position,title) VALUES ('{c}',2,'Foreign child');")
    denied(label+' B cannot insert A lesson',f"INSERT INTO lessons(course_id,unit_id,position,title) VALUES ('{c}','{u}',2,'Foreign child');")
    denied(label+' B cannot insert A exception',f"INSERT INTO calendar_exceptions(course_id,date,effect,title) VALUES ('{c}','2026-10-29','No Lesson','Foreign child');")
    denied(label+' owner reassignment rejected',f"UPDATE courses SET owner_id='{B}' WHERE id='{c}';",A)
    bc,bu=uid(),uid()
    ar(f"INSERT INTO courses(id,owner_id,name) VALUES ('{bc}','{B}','B fictional course'); INSERT INTO units(id,course_id,position,title) VALUES ('{bu}','{bc}',1,'B unit');",B)
    denied(label+' cross-account unit reference constrained',f"INSERT INTO lessons(course_id,unit_id,position,title) VALUES ('{c}','{bu}',2,'Bad FK');",A,'23503')
    for table,record in [('courses',c),('units',u),('lessons',l)]:
        ar(f"UPDATE {table} SET archived_at='2026-10-28T00:00:00Z' WHERE id='{record}';")
        check(label+' archive identity retained '+table,aj(f"SELECT jsonb_build_array(id,archived_at IS NOT NULL) FROM {table} WHERE id='{record}';")==[record,True])
        ar(f"UPDATE {table} SET archived_at=NULL WHERE id='{record}';")
    privileges=j("""SELECT jsonb_agg(jsonb_build_object('table',c.relname,'privilege',p.v,'value',has_table_privilege('authenticated',c.oid,p.v)))
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(v)
      WHERE n.nspname='public' AND c.relname IN ('courses','units','lessons','calendar_exceptions');""")
    check(label+' effective four-privilege matrix',len(privileges)==16 and all(p['value']==extras for p in privileges))
    switch=j(actor(f"""SELECT count(*) FROM courses WHERE id='{c}';
      SET LOCAL request.jwt.claims='{{"sub":"{B}"}}';
      SELECT jsonb_build_array((SELECT count(*) FROM courses WHERE id='{c}'),(SELECT count(*) FROM courses WHERE id='{bc}'));""").replace(f"SELECT count(*) FROM courses WHERE id='{c}';",''),user='authenticator')
    check(label+' same-session A to B claims isolate records',switch==[0,1])
    signed_out=j(actor("SET LOCAL request.jwt.claims='{}'; SELECT count(*) FROM courses;"),user='authenticator')
    check(label+' cleared claims expose no courses',signed_out==0)
    deleted=aj(f"WITH gone AS (DELETE FROM courses WHERE id='{bc}' RETURNING id) SELECT count(*) FROM gone;",B)
    check(label+' B independently manages/deletes own fictional records',deleted==1)
    check(label+' A original survives B own deletion',aj(f"SELECT count(*) FROM courses WHERE id='{c}';")==1)
    run("BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM courses; ROLLBACK;",user='authenticator',expected_error='42501')
    check(label+' anon denied private tables',True)

def probe(creator,extras,label):
    result=j(f"""BEGIN; CREATE TABLE public.f3_empty_default_probe(id integer);
      SELECT jsonb_build_object('privileges',(SELECT jsonb_agg(has_table_privilege('authenticated','public.f3_empty_default_probe',p.v))
        FROM (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(v)),
        'crud',(SELECT jsonb_agg(has_table_privilege('authenticated','public.f3_empty_default_probe',p.v)) FROM (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(v)),
        'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.f3_empty_default_probe'::regclass));
      ROLLBACK;""",user=creator)
    check(label+' '+creator+' future table has expected four flags',result['privileges']==[extras]*4)
    check(label+' '+creator+' retains expected CRUD defaults',result['crud']==([False]*4 if creator=='postgres' else [True]*4))
    notes.append({'probe':label,'creator':creator,'actual_local_rls':result['rls'],'authentication':'SQL role/JWT simulation only'})

def export_course(course,owner=None):
    return aj(f"""SELECT jsonb_build_object('schema','course-planner.pilot-export.v1','course',to_jsonb(c),
       'units',(SELECT coalesce(jsonb_agg(u ORDER BY u.id),'[]') FROM units u WHERE u.course_id=c.id),
       'lessons',(SELECT coalesce(jsonb_agg(l ORDER BY l.id),'[]') FROM lessons l WHERE l.course_id=c.id),
       'calendarExceptions',(SELECT coalesce(jsonb_agg(e ORDER BY e.id),'[]') FROM calendar_exceptions e WHERE e.course_id=c.id))
       FROM courses c WHERE c.id='{course}';""",owner)
def restore_payload(payload,owner=None):
    return aj("SELECT to_jsonb(public.restore_course_export("+literal(json.dumps(payload,ensure_ascii=False))+"::jsonb));",owner)

def large_restore(size):
    course=uid();units=[{'id':uid(),'course_id':course,'position':i+1,'title':f'Fictional unit {i}','target_days':10,
       'notes':'Fictional café note','archived_at':'2026-10-28T00:00:00Z' if i==2 else None} for i in range(200)]
    lessons=[{'id':uid(),'course_id':course,'unit_id':units[i%200]['id'],'position':i+1,'title':f'Fictional lesson {i}',
       'objective':'Fictional learning objective','source_lesson_id':f'fictional-{i}','planning_status':'Draft','lesson_type':'Content','duration_days':1,
       'scheduled_dates':['2026-10-28'],'protected_pin_date':'2026-10-28' if i==4 else None,
       'archived_at':'2026-10-28T00:00:00Z' if i==1000 else None} for i in range(size)]
    events=[{'id':uid(),'course_id':course,'date':'2026-10-29','effect':'No Lesson','event_type':'Closure',
       'title':f'Fictional event {i}','notes':'Fictional recovery evidence'} for i in range(601)]
    payload={'schema':'course-planner.pilot-export.v1','course':{'id':course,'name':f'Fictional {size} lessons','first_day':'2026-09-01',
       'last_day':'2027-06-30','timezone':'America/New_York','teaching_weekdays':[1,2,3,4,5],'notes':'Fictional Unicode café',
       'archived_at':'2026-10-28T00:00:00Z'},'units':units,'lessons':lessons,'calendarExceptions':events}
    saved_id=restore_payload(payload);saved=export_course(saved_id)
    check(str(size)+' real SQL restore/export complete counts',[len(saved[x]) for x in ('units','lessons','calendarExceptions')]==[200,size,601])
    check(str(size)+' real SQL restore owner and fresh stable identities',saved['course']['owner_id']==A and saved_id!=course and not ({x['id'] for x in saved['units']} & {x['id'] for x in units}))
    check(str(size)+' exported lesson IDs unique',len({x['id'] for x in saved['lessons']})==size)
    check(str(size)+' archived records preserved',saved['course']['archived_at'] is not None and sum(x['archived_at'] is not None for x in saved['units'])==1 and sum(x['archived_at'] is not None for x in saved['lessons'])==1)
    copy_id=restore_payload(saved);copy=export_course(copy_id)
    # Compare every saved authored/default field, replacing only intentional new IDs/timestamps/revisions/name suffix.
    def normalize(payload):
        unit_positions={u['id']:u['position'] for u in payload['units']}
        ignored={'id','course_id','unit_id','owner_id','created_at','updated_at','revision'}
        def rows(key):
            result=[]
            for row in payload[key]:
                item={k:v for k,v in row.items() if k not in ignored}
                if 'unit_id' in row: item['unit_position']=unit_positions[row['unit_id']]
                result.append(item)
            return sorted(result,key=lambda x:json.dumps(x,sort_keys=True))
        return [rows(key) for key in ('units','lessons','calendarExceptions')]
    check(str(size)+' real second restore retains all saved child fields/relationships',normalize(saved)==normalize(copy))
    check(str(size)+' restore remaps every child ID',not any({r['id'] for r in saved[key]} & {r['id'] for r in copy[key]} for key in ('units','lessons','calendarExceptions')))
    bcopy=restore_payload(saved,B);check(str(size)+' B restore is independent B-owned copy',export_course(bcopy,B)['course']['owner_id']==B and aj(f"SELECT count(*) FROM courses WHERE id='{bcopy}';")==0)
    before=aj("SELECT count(*) FROM courses;");invalid=json.loads(json.dumps(saved));invalid['lessons'][-1]['unit_id']=uid()
    ar("SELECT public.restore_course_export("+literal(json.dumps(invalid))+"::jsonb);",expected_error='P0001')
    check(str(size)+' failed restore is atomic',aj("SELECT count(*) FROM courses;")==before)
    notes.append({'lesson_count':size,'units':200,'exceptions':601,'real_postgresql_restore':True,
       'export_kind':'SQL JSON serialization, not hosted UI export','json_sha256':hashlib.sha256(json.dumps(saved,sort_keys=True).encode()).hexdigest()})

try:
    identity=j("""SELECT jsonb_build_object('version',current_setting('server_version'),'cluster',current_setting('cluster_name'),
      'socket_only',inet_server_addr() IS NULL,'data',current_setting('data_directory'),'user',current_user);""",database='postgres')
    if not (identity['version'].startswith('17.') and identity['cluster']=='course_planner_issue15_disposable' and identity['socket_only']
        and Path(identity['data']).resolve()==(args.cluster_dir/'data').resolve() and identity['user']=='f3_setup'):
        raise SystemExit('Refusing a non-disposable or hosted database')
    if args.initialize:
        run((ROOT/'fixtures/bootstrap.sql').read_text(),database='postgres')
        run((ROOT/'fixtures/schema.sql').read_text())
    if args.capture_baseline:
        if (ROOT/'baseline.json').exists(): raise SystemExit('Will not overwrite the reviewed baseline')
        baseline={'protected_state_md5':digest(),'postgresql_version':identity['version'],
          'environment':'local isolated PG17; B2 simulated; Auth minimal fixture',
          'east_source_date':'2026-10-28 BEFORE October 30 rollout',
          'differences':['Only ensure_rls event trigger; six platform event triggers omitted.',
            'auth.users contains only UUID primary key, with two fictional identities.',
            'authenticator memberships granted by f3_setup rather than postgres; options reproduced.',
            'No Supabase services, SMTP, OAuth or actual authentication sessions.']}
        (ROOT/'baseline.json').write_text(json.dumps(baseline,indent=2)+'\n')
        print(json.dumps(baseline,indent=2));sys.exit(0)
    baseline=json.loads((ROOT/'baseline.json').read_text())
    check('initial protected baseline matches',digest()==baseline['protected_state_md5'])
    if args.additional_only:
        snapshot('supplemental start remediated',[0,0,0])
        run("ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLES FROM authenticated RESTRICT;",user='postgres',expected_error='42501')
        check('standard PG17 itself refuses postgres altering managed defaults',True,sqlstate='42501')
        run("BEGIN; CREATE ROLE f3_inherited_probe NOLOGIN; GRANT MAINTAIN ON TABLE public.courses TO f3_inherited_probe; GRANT f3_inherited_probe TO authenticated; COMMIT;")
        try:
            check('inherited privilege negative control is effective',j("SELECT to_jsonb(has_table_privilege('authenticated','public.courses','MAINTAIN'));"))
            migration('A','rollback',expected_error='P0001');check('rollback blocks inherited privilege drift',True)
        finally:
            run("REVOKE f3_inherited_probe FROM authenticated; REVOKE MAINTAIN ON TABLE public.courses FROM f3_inherited_probe RESTRICT; DROP ROLE f3_inherited_probe;")
        check('inherited probe cleaned up without widening target grants',not j("SELECT to_jsonb(has_table_privilege('authenticated','public.courses','MAINTAIN'));"))
        run("ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE SELECT ON TABLES FROM authenticated RESTRICT;",user='supabase_admin')
        try:
            migration('B2','rollback',expected_error='P0001');check('rollback blocks non-target future CRUD drift',True)
        finally:
            run("ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;",user='supabase_admin')
        # Symmetric ordinary operations: B performs every owned write, A supplies the foreign identity.
        A,B=B,A
        ordinary('B as primary after remediation',False)
        A,B=B,A
        snapshot('supplemental end remediated',[0,0,0])
        sys.exit(0)
    snapshot('before',[16,4,4])
    ordinary('before',True)
    probe('postgres',True,'before');probe('supabase_admin',True,'before')
    migration('A',marker=False,expected_error='P0001');check('missing marker blocked',True)
    migration('A',database='postgres',expected_error='P0001');check('wrong database blocked',True)
    migration('A',user='supabase_admin',expected_error='P0001');check('superuser cannot substitute for A executor',True)
    migration('B2',user='postgres',expected_error='P0001');check('ordinary postgres cannot execute B2',True)
    for phase in ('A','B1','B2'):
        migration(phase,'rollback',expected_error='P0001');check(phase+' premature rollback blocked',True)
    run("GRANT MAINTAIN ON TABLE public.lessons TO authenticated WITH GRANT OPTION;",user='postgres')
    migration('A',expected_error='P0001');check('grant-option drift blocked',True)
    run("REVOKE GRANT OPTION FOR MAINTAIN ON TABLE public.lessons FROM authenticated RESTRICT;",user='postgres')
    atomic=(ROOT/'proposals/A-up.sql').read_text().replace('DO $postcheck$\nBEGIN',"DO $postcheck$\nBEGIN\n RAISE EXCEPTION 'Injected post-revoke failure';")
    migration('A',sql=atomic,expected_error='Injected post-revoke failure')
    check('post-revoke failure atomically rolls back A',counts()==[16,4,4] and digest()==baseline['protected_state_md5'])
    migration('A');snapshot('after A',[0,4,4]);ordinary('after A',False)
    migration('A',expected_error='P0001');check('repeat A blocked',True)
    run("GRANT REFERENCES(id) ON TABLE public.lessons TO authenticated;",user='postgres')
    migration('A','rollback',expected_error='P0001');check('rollback stops on column privilege drift',True)
    run("REVOKE REFERENCES(id) ON TABLE public.lessons FROM authenticated RESTRICT;",user='postgres')
    run("ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT MAINTAIN ON TABLES TO PUBLIC;",user='postgres')
    migration('B1',expected_error='P0001');check('global PUBLIC default grant drift blocked',True)
    run("ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE MAINTAIN ON TABLES FROM PUBLIC RESTRICT;",user='postgres')
    # Published October 30 postgres/public CRUD change is already a no-op in this fixture.
    run("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM anon,authenticated,service_role RESTRICT;",user='postgres')
    check('published postgres CRUD-default removal does not close four-privilege gap',counts()==[0,4,4] and digest()==baseline['protected_state_md5'])
    migration('B1');snapshot('after B1',[0,0,4])
    probe('postgres',False,'after B1');probe('supabase_admin',True,'after B1')
    migration('B1',expected_error='P0001');check('repeat B1 blocked',True)
    migration('B2');snapshot('after simulated B2',[0,0,0])
    probe('postgres',False,'after all');probe('supabase_admin',False,'after all')
    migration('B2',expected_error='P0001');check('repeat simulated B2 blocked',True)
    ordinary('after all',False)
    for size in (1001,1201,2000): large_restore(size)
    for phase,wanted in [('B2',[0,0,4]),('B1',[0,4,4]),('A',[16,4,4])]:
        migration(phase,'rollback');snapshot(phase+' rollback',wanted)
        migration(phase,'rollback',expected_error='P0001');check(phase+' repeated rollback blocked',True)
    ordinary('after rollback',True)
    probe('postgres',True,'after rollback');probe('supabase_admin',True,'after rollback')
    for phase,wanted in [('A',[0,4,4]),('B1',[0,0,4]),('B2',[0,0,0])]:
        migration(phase);snapshot(phase+' final reapply',wanted)
    ordinary('final remediated',False)
    check('final protected state still matches',digest()==baseline['protected_state_md5'])
except Exception as error:
    failures.append({'type':type(error).__name__,'message':str(error)})
    raise
finally:
    if not args.capture_baseline:
        result={'environment':'REAL LOCAL PostgreSQL 17; SQL role/JWT authentication simulation; B2 LOCAL SIMULATION',
          'timestamp_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks,'failures':failures,
          'passed':sum(c['passed'] for c in checks),'snapshot_counts':[{k:v for k,v in s.items() if k!='inventory'} for s in snapshots],
          'notes':notes,'east_modified':False,'hosted_authentication':'NOT TESTED / independent sessions BLOCKED',
          'actual_supabase_managed_B2':'NOT TESTED / supported executor required',
          'proposals_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'proposals').glob('*.sql'))}}
        name=('additional-results.json' if args.additional_only else 'results.json') if not failures else 'failed-'+datetime.datetime.now().strftime('%H%M%S')+'.json'
        (args.output/name).write_text(json.dumps(result,indent=2)+'\n')
        (args.output/('additional-snapshots.json' if args.additional_only else 'snapshots.json')).write_text(json.dumps(snapshots,indent=2)+'\n')
        print(json.dumps({k:result[k] for k in ('environment','passed','failures','snapshot_counts')},indent=2))
