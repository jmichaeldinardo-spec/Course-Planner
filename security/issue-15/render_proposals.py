"""Offline proposal renderer only. Never connects to a database or runs SQL."""
from pathlib import Path
import argparse,json

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--evidence',type=Path,default=ROOT / 'baseline.json')
parser.add_argument('--output-dir',type=Path,default=ROOT / 'proposals')
args = parser.parse_args()
if args.evidence.resolve() != (ROOT / 'baseline.json').resolve() and args.output_dir.resolve() == (ROOT / 'proposals').resolve():
    parser.error('A staging baseline requires a separate output directory; preserve East review proposals')
EVIDENCE = json.loads(args.evidence.read_text())
PRIVS = "'TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'"
LIST = 'TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'
TABLES = "'courses','units','lessons','calendar_exceptions'"
NAMED = 'public.courses, public.units, public.lessons, public.calendar_exceptions'
manifest = (ROOT / 'protected-state.sql').read_text()
manifest = manifest[manifest.index('SELECT md5('):].rstrip().removesuffix(';')
digest = EVIDENCE['protected_state_md5']

def protected_guard():
    return f""" IF ({manifest}) IS DISTINCT FROM '{digest}' THEN
   RAISE EXCEPTION 'Protected metadata/ACL drift: stop and obtain a fresh reviewed baseline';
 END IF;
"""

def target_guard(phase, present):
    if phase == 'A':
        query = f"""SELECT a.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE n.nspname='public' AND c.relname IN ({TABLES}) AND c.relkind='r'
        AND a.grantee='authenticated'::regrole AND a.privilege_type IN ({PRIVS})"""
        creator, count = 'postgres', 16
    else:
        creator = 'postgres' if phase == 'B1' else 'supabase_admin'
        count = 4
        query = f"""SELECT a.* FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole='{creator}'::regrole AND d.defaclnamespace='public'::regnamespace
        AND d.defaclobjtype='r' AND a.grantee='authenticated'::regrole
        AND a.privilege_type IN ({PRIVS})"""
    result = f""" IF (SELECT count(*) FROM ({query}) target) <> {count if present else 0} THEN
   RAISE EXCEPTION 'Phase {phase} target state drifted or already changed; stop';
 END IF;
"""
    if present:
        result += f""" IF (SELECT count(*) FROM ({query}) target
      WHERE grantor='{creator}'::regrole AND NOT is_grantable) <> {count} THEN
   RAISE EXCEPTION 'Unexpected grantor/grant option; stop';
 END IF;
"""
    if phase == 'A':
        result += f""" IF EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) p(privilege)
   WHERE n.nspname='public' AND c.relname IN ({TABLES})
     AND NOT has_table_privilege('authenticated',c.oid,p.privilege)
 ) THEN RAISE EXCEPTION 'Required CRUD changed'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
   WHERE n.nspname='public' AND c.relname IN ({TABLES})
     AND has_table_privilege('authenticated',c.oid,p.privilege) IS DISTINCT FROM {'true' if present else 'false'}
 ) THEN RAISE EXCEPTION 'Effective four-privilege result differs'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ({TABLES})
     AND has_any_column_privilege('authenticated',c.oid,'REFERENCES') IS DISTINCT FROM {'true' if present else 'false'}
 ) THEN RAISE EXCEPTION 'Effective column REFERENCES differs'; END IF;
"""
    else:
        result += f""" IF EXISTS (
   SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole='{creator}'::regrole AND d.defaclnamespace=0 AND d.defaclobjtype='r'
     AND a.grantee IN (0,'authenticated'::regrole::oid)
     AND a.privilege_type IN ({PRIVS})
 ) THEN RAISE EXCEPTION 'Global defaults cannot be cancelled by schema revoke; stop'; END IF;
"""
    return result

def executor_guard(phase):
    if phase == 'B2':
        return """ IF current_user <> 'supabase_admin' OR session_user <> 'supabase_admin'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN
   RAISE EXCEPTION 'B2 requires independently approved managed executor, no role elevation';
 END IF;
"""
    return """ IF current_user <> 'postgres' OR session_user <> 'postgres'
    OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN
   RAISE EXCEPTION 'A/B1 must run as the reviewed non-superuser postgres executor';
 END IF;
"""

for phase in ('A','B1','B2'):
    for rollback in (False, True):
        direction = 'rollback' if rollback else 'up'
        # These proposals cannot run against East's postgres database.
        guard = """ IF current_database() <> 'course_planner_f3_staging'
    OR current_setting('course_planner.issue15_target',true) IS DISTINCT FROM 'approved-disposable-staging'
    OR current_setting('cluster_name') <> 'course_planner_issue15_disposable'
    OR inet_server_addr() IS NOT NULL THEN
   RAISE EXCEPTION 'Review-only: requires approved disposable staging target; East is not authorized';
 END IF;
 IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
   RAISE EXCEPTION 'Requires reviewed PostgreSQL 17 baseline';
 END IF;
""" + executor_guard(phase)
        text = f"""-- ISSUE #15 LOCAL STAGING PROPOSAL — NOT A REGISTERED OR EAST MIGRATION.
-- Phase {phase}, {direction}; four privileges only. No automatic deployment.
-- Staging DB identity interlock is intentional. B2 uses a LOCAL SIMULATED managed role.
-- No Course Planner East authorization; actual managed-role execution remains unverified.
-- East/hosted binding requires a separately approved, re-reviewed artifact and fresh baseline.
-- Run only with a fail-on-error single-session runner after owner approval.
-- Rollback deliberately reopens the original privilege risk; requires approval too.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
DO $preflight$
BEGIN
{guard}{protected_guard()}{target_guard(phase, not rollback)}END
$preflight$;
"""
        action = f"GRANT {LIST}" if rollback else f"REVOKE {LIST}"
        if phase == 'A':
            text += f"{action} ON TABLE {NAMED}\n  {'TO' if rollback else 'FROM'} authenticated{' RESTRICT' if not rollback else ''};\n"
        else:
            creator = 'postgres' if phase == 'B1' else 'supabase_admin'
            text += f"ALTER DEFAULT PRIVILEGES FOR ROLE {creator} IN SCHEMA public\n  {action} ON TABLES {'TO' if rollback else 'FROM'} authenticated{' RESTRICT' if not rollback else ''};\n"
        text += f"""DO $postcheck$
BEGIN
{protected_guard()}{target_guard(phase, rollback)}END
$postcheck$;
COMMIT;
"""
        dest = args.output_dir / f'{phase}-{direction}.sql'
        dest.parent.mkdir(exist_ok=True,parents=True)
        dest.write_text(text)
