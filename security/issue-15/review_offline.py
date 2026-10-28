"""No DB connection: validate proposal scope, reproducibility and executed evidence hashes."""
from pathlib import Path
import hashlib,json,re,subprocess,sys,tempfile
root=Path(__file__).resolve().parent
checks=[]
def check(name,value):
    if not value: raise AssertionError(name)
    checks.append(name)
main=json.loads((root/'evidence/database-results.json').read_text())
extra=json.loads((root/'evidence/additional-results.json').read_text())
baseline=json.loads((root/'baseline.json').read_text())
files=sorted((root/'proposals').glob('*.sql'))
check('three independent phase proposals and matching rollbacks',len(files)==6)
for file in files:
    raw=file.read_text();sql=re.sub(r'--[^\n]*','',raw)
    check(file.name+' has explicit transaction/timeouts',sql.count('BEGIN;')==1 and sql.rstrip().endswith('COMMIT;') and 'lock_timeout' in sql and 'statement_timeout' in sql)
    check(file.name+' local DB/cluster/socket/marker interlocks',all(t in sql for t in ['course_planner_f3_staging','course_planner_issue15_disposable','inet_server_addr() IS NOT NULL','approved-disposable-staging']))
    check(file.name+' exact four privileges',len(re.findall(r'(?:GRANT|REVOKE) TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE',sql))==1)
    check(file.name+' no broad/cascading or destructive operations',not re.search(r'\b(?:GRANT|REVOKE)\s+ALL\b|\bCASCADE\b|ON\s+ALL\s+TABLES|^\s*(?:CREATE|ALTER TABLE|DROP|INSERT|UPDATE|DELETE|TRUNCATE|VACUUM|REINDEX)\b',sql,re.M))
    check(file.name+' protected digest and expected-target guards on both sides',sql.count(baseline['protected_state_md5'])==2 and sql.count('target state drifted or already changed')==2)
    check(file.name+' recorded exact execution hash in both final runs',all(r['proposals_sha256'][file.name]==hashlib.sha256(file.read_bytes()).hexdigest() for r in (main,extra)))
    if file.name.startswith('A-'):
        check(file.name+' changes only four existing tables','ALTER DEFAULT PRIVILEGES' not in sql and all('public.'+t in sql for t in ['courses','units','lessons','calendar_exceptions']))
    else:
        creator='postgres' if file.name.startswith('B1-') else 'supabase_admin'
        check(file.name+' creator/schema/default scope',f'ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA public' in sql)
    check(file.name+' forward uses RESTRICT or rollback restores plain grants',('FROM authenticated RESTRICT;' in sql if file.name.endswith('up.sql') else 'TO authenticated;' in sql and 'WITH GRANT OPTION' not in sql))
for name,result,count in [('main',main,265),('supplemental',extra,47)]:
    check(name+' all runtime controls passed',result['passed']==count and len(result['checks'])==count and all(c['passed'] for c in result['checks']) and not result['failures'])
    check(name+' never claims actual managed/hosted acceptance','NOT TESTED' in result['actual_supabase_managed_B2'] and 'BLOCKED' in result['hosted_authentication'] and not result['east_modified'])
check('full runtime checkpoint sequence',[s['counts'] for s in main['snapshot_counts']]==[[16,4,4],[0,4,4],[0,0,4],[0,0,0],[0,0,4],[0,4,4],[16,4,4],[0,4,4],[0,0,4],[0,0,0]])
check('all runtime protected digests unchanged',all(s['protected_digest']==baseline['protected_state_md5'] for r in [main,extra] for s in r['snapshot_counts']))
fidelity=json.loads((root/'evidence/fixture-fidelity.json').read_text())
check('eight fixture fidelity controls pass',len(fidelity['checks'])==8 and all(fidelity['checks'].values()))
check('actual SQL large-course sizes',[n['lesson_count'] for n in main['notes'] if 'lesson_count' in n]==[1001,1201,2000])
for name in ['post-rollout-east-read-only.sql','inventory.sql','fingerprints.sql','protected-state.sql']:
    sql=re.sub(r'--[^\n]*','',(root/name).read_text())
    check(name+' only passive catalog statements',not re.search(r'^\s*(?:DO|CALL|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE|COPY)\b',sql,re.M|re.I))
with tempfile.TemporaryDirectory(prefix='course-planner-issue15-render-') as out:
    subprocess.run([sys.executable,str(root/'render_proposals.py'),'--output-dir',out],check=True)
    check('six reviewed files reproducibly rendered',all(p.read_bytes()==(Path(out)/p.name).read_bytes() for p in files))
for path in root.rglob('*'):
    if not path.is_file() or 'local-output' in path.parts or '__pycache__' in path.parts: continue
    text=path.read_text()
    check('no credential patterns '+str(path.relative_to(root)),not re.search(r'sb_secret_[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}',text))
result={'status':'PASS offline artifact checks; separate from runtime evidence','checks':len(checks),'details':checks}
(root/'evidence/offline-review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'checks':len(checks)}))
