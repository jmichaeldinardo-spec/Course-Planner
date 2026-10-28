-- READ ONLY. MD5 values are drift detectors, not security signatures.
select
 md5(pg_get_functiondef('public.restore_course_export(jsonb)'::regprocedure)) as restore_definition_md5,
 md5((select jsonb_agg(to_jsonb(x))::text from (select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname)x)) as policies_md5,
 md5((select jsonb_agg(to_jsonb(x))::text from (select c.relname,t.tgenabled,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname)x)) as triggers_md5,
 md5((select jsonb_agg(to_jsonb(x))::text from (select conrelid::regclass::text as relation,conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text,conname)x)) as constraints_md5;
