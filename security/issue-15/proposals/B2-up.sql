-- ISSUE #15 LOCAL STAGING PROPOSAL — NOT A REGISTERED OR EAST MIGRATION.
-- Phase B2, up; four privileges only. No automatic deployment.
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
 IF current_database() <> 'course_planner_f3_staging'
    OR current_setting('course_planner.issue15_target',true) IS DISTINCT FROM 'approved-disposable-staging'
    OR current_setting('cluster_name') <> 'course_planner_issue15_disposable'
    OR inet_server_addr() IS NOT NULL THEN
   RAISE EXCEPTION 'Review-only: requires approved disposable staging target; East is not authorized';
 END IF;
 IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
   RAISE EXCEPTION 'Requires reviewed PostgreSQL 17 baseline';
 END IF;
 IF current_user <> 'supabase_admin' OR session_user <> 'supabase_admin'
    OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN
   RAISE EXCEPTION 'B2 requires independently approved managed executor, no role elevation';
 END IF;
 IF (SELECT md5(jsonb_build_object(
 'roles',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls
   FROM pg_roles WHERE rolname IN ('postgres','supabase_admin','authenticated','anon','service_role','authenticator') ORDER BY rolname)x),
 'memberships',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT pg_get_userbyid(member) AS member,pg_get_userbyid(roleid) AS role,
     pg_get_userbyid(grantor) AS grantor,admin_option,inherit_option,set_option
   FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('authenticated','anon','authenticator'))
   ORDER BY 1,2,3)x),
 'role_paths',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT rolname,pg_has_role('authenticated',oid,'MEMBER') AS member,
     pg_has_role('authenticated',oid,'USAGE') AS inherited,pg_has_role('authenticated',oid,'SET') AS can_set
   FROM pg_roles WHERE rolname='authenticated' OR pg_has_role('authenticated',oid,'MEMBER') ORDER BY rolname)x),
 'schema_access',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT r.rolname,n.nspname,has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,
     has_schema_privilege(r.oid,n.oid,'CREATE') AS create_objects
   FROM pg_roles r CROSS JOIN pg_namespace n
   WHERE r.rolname IN ('authenticated','anon','authenticator') AND n.nspname IN ('public','auth') ORDER BY 1,2)x),
 'database_access',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT rolname,has_database_privilege(oid,current_database(),'CONNECT') AS connect,
     has_database_privilege(oid,current_database(),'CREATE') AS create_objects,
     has_database_privilege(oid,current_database(),'TEMP') AS temporary
   FROM pg_roles WHERE rolname IN ('authenticated','anon') ORDER BY rolname)x),
 'tables',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY c.relname)x),
 'columns',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,at.attnum,at.attname,format_type(at.atttypid,at.atttypmod) AS type,
     at.attnotnull,at.attidentity,at.attgenerated,at.attisdropped,
     pg_get_expr(d.adbin,d.adrelid) AS default_expression
   FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN pg_attrdef d ON d.adrelid=at.attrelid AND d.adnum=at.attnum
   WHERE n.nspname='public' AND at.attnum>0 AND c.relkind IN ('r','p','v','m') ORDER BY 1,2)x),
 'table_acls',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,pg_get_userbyid(a.grantor) AS grantor,
     CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
     a.privilege_type,a.is_grantable
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
     AND NOT (c.relname IN ('courses','units','lessons','calendar_exceptions') AND c.relkind='r'
       AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))
   ORDER BY 1,2,3,4,5)x),
 'column_acls',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,at.attname,pg_get_userbyid(a.grantor) AS grantor,
     CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
   FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE n.nspname='public' ORDER BY 1,2,3,4,5,6)x),
 'defaults',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT pg_get_userbyid(d.defaclrole) AS creator,
     CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname END AS schema,
     d.defaclobjtype,pg_get_userbyid(a.grantor) AS grantor,
     CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
   FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE (d.defaclnamespace=0 OR n.nspname='public')
     AND NOT (d.defaclrole IN ('postgres'::regrole,'supabase_admin'::regrole) AND n.nspname='public'
       AND d.defaclobjtype='r' AND a.grantee='authenticated'::regrole
       AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))
   ORDER BY 1,2,3,4,5,6,7)x),
 'policies',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname)x),
 'functions',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT n.nspname,p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,
     p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) AS definition,
     (SELECT jsonb_agg(to_jsonb(y)) FROM (SELECT pg_get_userbyid(a.grantor) AS grantor,
       CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
       FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a ORDER BY 1,2,3,4)y) AS acl
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' OR p.oid='auth.uid()'::regprocedure ORDER BY 1,2)x),
 'triggers',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
   JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname)x),
 'constraints',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT conrelid::regclass::text AS relation,conname,pg_get_constraintdef(oid) AS definition
   FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2)x),
 'event_triggers',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT evtname,evtenabled,evtfoid::regprocedure::text AS function FROM pg_event_trigger ORDER BY evtname)x)
)::text) AS protected_state_md5) IS DISTINCT FROM '500f02effde858e6d3beff80c5aa0a6c' THEN
   RAISE EXCEPTION 'Protected metadata/ACL drift: stop and obtain a fresh reviewed baseline';
 END IF;
 IF (SELECT count(*) FROM (SELECT a.* FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace
        AND d.defaclobjtype='r' AND a.grantee='authenticated'::regrole
        AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) target) <> 4 THEN
   RAISE EXCEPTION 'Phase B2 target state drifted or already changed; stop';
 END IF;
 IF (SELECT count(*) FROM (SELECT a.* FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace
        AND d.defaclobjtype='r' AND a.grantee='authenticated'::regrole
        AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) target
      WHERE grantor='supabase_admin'::regrole AND NOT is_grantable) <> 4 THEN
   RAISE EXCEPTION 'Unexpected grantor/grant option; stop';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace=0 AND d.defaclobjtype='r'
     AND a.grantee IN (0,'authenticated'::regrole::oid)
     AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
 ) THEN RAISE EXCEPTION 'Global defaults cannot be cancelled by schema revoke; stop'; END IF;
END
$preflight$;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated RESTRICT;
DO $postcheck$
BEGIN
 IF (SELECT md5(jsonb_build_object(
 'roles',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls
   FROM pg_roles WHERE rolname IN ('postgres','supabase_admin','authenticated','anon','service_role','authenticator') ORDER BY rolname)x),
 'memberships',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT pg_get_userbyid(member) AS member,pg_get_userbyid(roleid) AS role,
     pg_get_userbyid(grantor) AS grantor,admin_option,inherit_option,set_option
   FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('authenticated','anon','authenticator'))
   ORDER BY 1,2,3)x),
 'role_paths',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT rolname,pg_has_role('authenticated',oid,'MEMBER') AS member,
     pg_has_role('authenticated',oid,'USAGE') AS inherited,pg_has_role('authenticated',oid,'SET') AS can_set
   FROM pg_roles WHERE rolname='authenticated' OR pg_has_role('authenticated',oid,'MEMBER') ORDER BY rolname)x),
 'schema_access',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT r.rolname,n.nspname,has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,
     has_schema_privilege(r.oid,n.oid,'CREATE') AS create_objects
   FROM pg_roles r CROSS JOIN pg_namespace n
   WHERE r.rolname IN ('authenticated','anon','authenticator') AND n.nspname IN ('public','auth') ORDER BY 1,2)x),
 'database_access',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT rolname,has_database_privilege(oid,current_database(),'CONNECT') AS connect,
     has_database_privilege(oid,current_database(),'CREATE') AS create_objects,
     has_database_privilege(oid,current_database(),'TEMP') AS temporary
   FROM pg_roles WHERE rolname IN ('authenticated','anon') ORDER BY rolname)x),
 'tables',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY c.relname)x),
 'columns',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,at.attnum,at.attname,format_type(at.atttypid,at.atttypmod) AS type,
     at.attnotnull,at.attidentity,at.attgenerated,at.attisdropped,
     pg_get_expr(d.adbin,d.adrelid) AS default_expression
   FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN pg_attrdef d ON d.adrelid=at.attrelid AND d.adnum=at.attnum
   WHERE n.nspname='public' AND at.attnum>0 AND c.relkind IN ('r','p','v','m') ORDER BY 1,2)x),
 'table_acls',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,pg_get_userbyid(a.grantor) AS grantor,
     CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
     a.privilege_type,a.is_grantable
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
     AND NOT (c.relname IN ('courses','units','lessons','calendar_exceptions') AND c.relkind='r'
       AND a.grantee='authenticated'::regrole AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))
   ORDER BY 1,2,3,4,5)x),
 'column_acls',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,at.attname,pg_get_userbyid(a.grantor) AS grantor,
     CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
   FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE n.nspname='public' ORDER BY 1,2,3,4,5,6)x),
 'defaults',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT pg_get_userbyid(d.defaclrole) AS creator,
     CASE WHEN d.defaclnamespace=0 THEN '(global)' ELSE n.nspname END AS schema,
     d.defaclobjtype,pg_get_userbyid(a.grantor) AS grantor,
     CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
   FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE (d.defaclnamespace=0 OR n.nspname='public')
     AND NOT (d.defaclrole IN ('postgres'::regrole,'supabase_admin'::regrole) AND n.nspname='public'
       AND d.defaclobjtype='r' AND a.grantee='authenticated'::regrole
       AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'))
   ORDER BY 1,2,3,4,5,6,7)x),
 'policies',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname)x),
 'functions',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT n.nspname,p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,
     p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) AS definition,
     (SELECT jsonb_agg(to_jsonb(y)) FROM (SELECT pg_get_userbyid(a.grantor) AS grantor,
       CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
       FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a ORDER BY 1,2,3,4)y) AS acl
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' OR p.oid='auth.uid()'::regprocedure ORDER BY 1,2)x),
 'triggers',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT c.relname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
   JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname)x),
 'constraints',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT conrelid::regclass::text AS relation,conname,pg_get_constraintdef(oid) AS definition
   FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2)x),
 'event_triggers',(SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT evtname,evtenabled,evtfoid::regprocedure::text AS function FROM pg_event_trigger ORDER BY evtname)x)
)::text) AS protected_state_md5) IS DISTINCT FROM '500f02effde858e6d3beff80c5aa0a6c' THEN
   RAISE EXCEPTION 'Protected metadata/ACL drift: stop and obtain a fresh reviewed baseline';
 END IF;
 IF (SELECT count(*) FROM (SELECT a.* FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
      WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace='public'::regnamespace
        AND d.defaclobjtype='r' AND a.grantee='authenticated'::regrole
        AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) target) <> 0 THEN
   RAISE EXCEPTION 'Phase B2 target state drifted or already changed; stop';
 END IF;
 IF EXISTS (
   SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole='supabase_admin'::regrole AND d.defaclnamespace=0 AND d.defaclobjtype='r'
     AND a.grantee IN (0,'authenticated'::regrole::oid)
     AND a.privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
 ) THEN RAISE EXCEPTION 'Global defaults cannot be cancelled by schema revoke; stop'; END IF;
END
$postcheck$;
COMMIT;
