-- READ ONLY. Before/after evidence, not an assertion of authenticated runtime safety.
SELECT current_database(),current_setting('server_version'),current_user,session_user,
  (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS executor_superuser,
  pg_has_role(current_user,'supabase_admin','MEMBER') AS executor_member_managed;

SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,
  p.privilege,has_table_privilege('authenticated',c.oid,p.privilege) AS authenticated_effective,
  has_table_privilege('anon',c.oid,p.privilege) AS anon_effective,
  has_any_column_privilege('authenticated',c.oid,'REFERENCES') AS authenticated_column_references
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
WHERE n.nspname='public' AND c.relname IN ('courses','units','lessons','calendar_exceptions')
ORDER BY c.relname,p.privilege;

-- Both scopes must be inspected: a schema revoke cannot cancel a global grant.
SELECT r.creator,s.scope,p.privilege,
  EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole=r.creator::regrole AND d.defaclobjtype='r'
      AND d.defaclnamespace=CASE WHEN s.scope='(global)' THEN 0 ELSE 'public'::regnamespace::oid END
      AND a.grantee IN (0,'authenticated'::regrole::oid) AND a.privilege_type=p.privilege
  ) AS authenticated_or_public_default_grant
FROM (VALUES ('postgres'),('supabase_admin')) r(creator)
CROSS JOIN (VALUES ('(global)'),('public')) s(scope)
CROSS JOIN (VALUES ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(privilege)
ORDER BY 1,2,3;

SELECT p.oid::regprocedure AS signature,p.prosecdef,p.proconfig,p.proacl,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute
FROM pg_proc p WHERE p.oid IN ('public.restore_course_export(jsonb)'::regprocedure,
  'public.course_planner_touch_record()'::regprocedure,'auth.uid()'::regprocedure);

-- Expected tuple counts: baseline 16/4/4; after A 0/4/4;
-- after A+B1 0/0/4; after A+B1+B2 0/0/0. Rollbacks reverse their own column only.
SELECT
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE n.nspname='public'
  AND c.relname IN ('courses','units','lessons','calendar_exceptions')
  AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) AS phase_a,
 (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole='postgres'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
  AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) AS phase_b1,
 (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace AND d.defaclobjtype='r'
  AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) AS phase_b2;
