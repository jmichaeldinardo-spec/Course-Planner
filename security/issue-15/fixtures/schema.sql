-- LOCAL FICTIONAL SCHEMA ONLY. Derived from October 28 catalog definitions; no teacher rows.
DO $guard$ BEGIN
 IF current_user <> 'f3_setup' OR current_database() <> 'course_planner_f3_staging'
    OR current_setting('cluster_name') <> 'course_planner_issue15_disposable'
    OR inet_server_addr() IS NOT NULL THEN RAISE EXCEPTION 'Not the isolated local fixture'; END IF;
END $guard$;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
ALTER TABLE auth.users OWNER TO supabase_auth_admin;
-- Minimal fixture-only dependency for the postgres-owned course owner FK.
GRANT REFERENCES(id) ON auth.users TO postgres;
SET ROLE supabase_auth_admin;
CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS E'\n  select \n  coalesce(\n    nullif(current_setting(''request.jwt.claim.sub'', true), ''''),\n    (nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''sub'')\n  )::uuid\n';
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC, dashboard_user;
RESET ROLE;
GRANT USAGE ON SCHEMA auth TO "authenticated";
GRANT USAGE ON SCHEMA auth TO "anon";
GRANT USAGE ON SCHEMA auth TO postgres;
SET ROLE postgres;
CREATE TABLE public."courses" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "owner_id" uuid NOT NULL,
 "name" text NOT NULL,
 "school_year" text,
 "first_day" date,
 "last_day" date,
 "timezone" text DEFAULT 'America/New_York'::text NOT NULL,
 "teaching_weekdays" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5] NOT NULL,
 "notes" text,
 "archived_at" timestamp with time zone,
 "revision" bigint DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."units" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "course_id" uuid NOT NULL,
 "position" integer NOT NULL,
 "title" text NOT NULL,
 "target_days" integer,
 "purpose" text,
 "essential_questions" text,
 "enduring_understandings" text,
 "priority_standards" text,
 "learning_outcomes" text,
 "culminating_assessment" text,
 "formative_evidence" text,
 "key_vocabulary" text,
 "prerequisite_knowledge" text,
 "misconceptions" text,
 "differentiation" text,
 "core_resources" text,
 "notes" text,
 "archived_at" timestamp with time zone,
 "revision" bigint DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."lessons" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "course_id" uuid NOT NULL,
 "unit_id" uuid NOT NULL,
 "source_lesson_id" text,
 "position" integer NOT NULL,
 "title" text NOT NULL,
 "planning_status" text DEFAULT 'Draft'::text NOT NULL,
 "lesson_type" text DEFAULT 'Content'::text NOT NULL,
 "chapter" text,
 "pages" text,
 "section" text,
 "objective" text,
 "standards" text,
 "guiding_questions" text,
 "evidence_source" text,
 "key_vocabulary" text,
 "resources_links" text,
 "materials" text,
 "differentiation" text,
 "assessment" text,
 "homework" text,
 "notes" text,
 "textbook_map_item" text,
 "duration_days" integer DEFAULT 1 NOT NULL,
 "protected_pin_date" date,
 "flexible_preference_date" date,
 "scheduled_dates" date[] DEFAULT '{}'::date[] NOT NULL,
 "archived_at" timestamp with time zone,
 "revision" bigint DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."calendar_exceptions" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "course_id" uuid NOT NULL,
 "date" date NOT NULL,
 "effect" text NOT NULL,
 "event_type" text NOT NULL,
 "title" text NOT NULL,
 "notes" text,
 "revision" bigint DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_course_id_source_lesson_id_key" UNIQUE (course_id, source_lesson_id);
ALTER TABLE public."units" ADD CONSTRAINT "units_course_id_id_key" UNIQUE (course_id, id);
ALTER TABLE public."calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_pkey" PRIMARY KEY (id);
ALTER TABLE public."courses" ADD CONSTRAINT "courses_pkey" PRIMARY KEY (id);
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_pkey" PRIMARY KEY (id);
ALTER TABLE public."units" ADD CONSTRAINT "units_pkey" PRIMARY KEY (id);
ALTER TABLE public."calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_effect_check" CHECK ((effect = ANY (ARRAY['No Lesson'::text, 'Replace Lesson'::text, 'Continue Lesson'::text])));
ALTER TABLE public."calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_title_check" CHECK ((length(btrim(title)) > 0));
ALTER TABLE public."courses" ADD CONSTRAINT "course_date_order" CHECK (((first_day IS NULL) OR (last_day IS NULL) OR (first_day <= last_day)));
ALTER TABLE public."courses" ADD CONSTRAINT "course_weekdays_valid" CHECK (((teaching_weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]) AND ((cardinality(teaching_weekdays) >= 1) AND (cardinality(teaching_weekdays) <= 7))));
ALTER TABLE public."courses" ADD CONSTRAINT "courses_name_check" CHECK ((length(btrim(name)) > 0));
ALTER TABLE public."lessons" ADD CONSTRAINT "lesson_pin_preference_exclusive" CHECK (((protected_pin_date IS NULL) OR (flexible_preference_date IS NULL)));
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_duration_days_check" CHECK (((duration_days >= 1) AND (duration_days <= 366)));
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_position_check" CHECK (("position" > 0));
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_title_check" CHECK ((length(btrim(title)) > 0));
ALTER TABLE public."units" ADD CONSTRAINT "units_position_check" CHECK (("position" > 0));
ALTER TABLE public."units" ADD CONSTRAINT "units_target_days_check" CHECK (((target_days IS NULL) OR (target_days >= 0)));
ALTER TABLE public."units" ADD CONSTRAINT "units_title_check" CHECK ((length(btrim(title)) > 0));
ALTER TABLE public."calendar_exceptions" ADD CONSTRAINT "calendar_exceptions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public."courses" ADD CONSTRAINT "courses_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."lessons" ADD CONSTRAINT "lesson_same_course_unit" FOREIGN KEY (course_id, unit_id) REFERENCES units(course_id, id) ON DELETE CASCADE;
ALTER TABLE public."lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public."units" ADD CONSTRAINT "units_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE public."courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."calendar_exceptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exceptions_delete_own" ON public."calendar_exceptions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = calendar_exceptions.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "exceptions_insert_own" ON public."calendar_exceptions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = calendar_exceptions.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "exceptions_select_own" ON public."calendar_exceptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = calendar_exceptions.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "exceptions_update_own" ON public."calendar_exceptions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = calendar_exceptions.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = calendar_exceptions.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "courses_delete_own" ON public."courses" FOR DELETE TO "authenticated" USING ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "courses_insert_own" ON public."courses" FOR INSERT TO "authenticated" WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "courses_select_own" ON public."courses" FOR SELECT TO "authenticated" USING ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "courses_update_own" ON public."courses" FOR UPDATE TO "authenticated" USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "lessons_delete_own" ON public."lessons" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "lessons_insert_own" ON public."lessons" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "lessons_select_own" ON public."lessons" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "lessons_update_own" ON public."lessons" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "units_delete_own" ON public."units" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = units.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "units_insert_own" ON public."units" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = units.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "units_select_own" ON public."units" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = units.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "units_update_own" ON public."units" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = units.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = units.course_id) AND (c.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE OR REPLACE FUNCTION public.course_planner_touch_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$function$
;
REVOKE EXECUTE ON FUNCTION public.course_planner_touch_record() FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.restore_course_export(p_export jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_owner uuid := auth.uid();
  v_source_course_id uuid;
  v_new_course_id uuid;
  v_old_unit_id uuid;
  v_old_lesson_id uuid;
  v_new_unit_id uuid;
  v_unit_map jsonb := '{}'::jsonb;
  v_seen_lessons jsonb := '{}'::jsonb;
  v_source jsonb;
  v_record jsonb;
  v_course_name text;
  v_old_unit_key text;
begin
  if v_owner is null then
    raise exception 'Sign in before restoring a course';
  end if;

  if p_export is null or jsonb_typeof(p_export) <> 'object'
     or p_export ->> 'schema' is distinct from 'course-planner.pilot-export.v1'
     or jsonb_typeof(p_export -> 'course') <> 'object'
     or jsonb_typeof(p_export -> 'units') <> 'array'
     or jsonb_typeof(p_export -> 'lessons') <> 'array'
     or jsonb_typeof(p_export -> 'calendarExceptions') <> 'array' then
    raise exception 'Unsupported or invalid Course Planner export';
  end if;
  if length(p_export::text) > 6000000
     or jsonb_array_length(p_export -> 'units') > 200
     or jsonb_array_length(p_export -> 'lessons') > 2000
     or jsonb_array_length(p_export -> 'calendarExceptions') > 1000 then
    raise exception 'The course export exceeds the pilot import limits';
  end if;

  v_source := p_export -> 'course';
  v_source_course_id := (v_source ->> 'id')::uuid;
  v_course_name := btrim(coalesce(v_source ->> 'name',''));
  if length(v_course_name) not between 1 and 200 then
    raise exception 'Exported course name is invalid';
  end if;

  insert into public.courses (
    owner_id, name, school_year, first_day, last_day, timezone,
    teaching_weekdays, notes, archived_at
  ) values (
    v_owner, v_course_name || ' (restored)',
    v_source ->> 'school_year',
    (v_source ->> 'first_day')::date,
    (v_source ->> 'last_day')::date,
    coalesce(nullif(v_source ->> 'timezone',''),'America/New_York'),
    coalesce(
      (select array_agg(v.value::integer order by v.ordinality)
       from jsonb_array_elements_text(v_source -> 'teaching_weekdays')
            with ordinality as v(value, ordinality)),
      array[1,2,3,4,5]::integer[]
    ),
    v_source ->> 'notes',
    (v_source ->> 'archived_at')::timestamptz
  )
  returning id into v_new_course_id;

  for v_record in select value from jsonb_array_elements(p_export -> 'units') as items(value) loop
    if jsonb_typeof(v_record) <> 'object' then
      raise exception 'Invalid unit record in course export';
    end if;
    v_old_unit_id := (v_record ->> 'id')::uuid;
    if (v_record ->> 'course_id')::uuid <> v_source_course_id
       or v_unit_map ? (v_old_unit_id::text) then
      raise exception 'Unit has duplicate ID or invalid course reference';
    end if;

    insert into public.units (
      course_id, position, title, target_days, purpose, essential_questions,
      enduring_understandings, priority_standards, learning_outcomes,
      culminating_assessment, formative_evidence, key_vocabulary,
      prerequisite_knowledge, misconceptions, differentiation,
      core_resources, notes, archived_at
    ) values (
      v_new_course_id,
      (v_record ->> 'position')::integer,
      v_record ->> 'title',
      (v_record ->> 'target_days')::integer,
      v_record ->> 'purpose',
      v_record ->> 'essential_questions',
      v_record ->> 'enduring_understandings',
      v_record ->> 'priority_standards',
      v_record ->> 'learning_outcomes',
      v_record ->> 'culminating_assessment',
      v_record ->> 'formative_evidence',
      v_record ->> 'key_vocabulary',
      v_record ->> 'prerequisite_knowledge',
      v_record ->> 'misconceptions',
      v_record ->> 'differentiation',
      v_record ->> 'core_resources',
      v_record ->> 'notes',
      (v_record ->> 'archived_at')::timestamptz
    ) returning id into v_new_unit_id;
    v_unit_map := v_unit_map || jsonb_build_object(v_old_unit_id::text, v_new_unit_id::text);
  end loop;

  for v_record in select value from jsonb_array_elements(p_export -> 'lessons') as items(value) loop
    if jsonb_typeof(v_record) <> 'object' then
      raise exception 'Invalid lesson record in course export';
    end if;
    v_old_lesson_id := (v_record ->> 'id')::uuid;
    v_old_unit_key := ((v_record ->> 'unit_id')::uuid)::text;
    if (v_record ->> 'course_id')::uuid <> v_source_course_id
       or not (v_unit_map ? v_old_unit_key)
       or v_seen_lessons ? (v_old_lesson_id::text) then
      raise exception 'Lesson has duplicate ID or invalid course/unit reference';
    end if;
    v_seen_lessons := v_seen_lessons || jsonb_build_object(v_old_lesson_id::text, true);
    insert into public.lessons (
      course_id, unit_id, source_lesson_id, position, title, planning_status,
      lesson_type, chapter, pages, section, objective, standards,
      guiding_questions, evidence_source, key_vocabulary, resources_links,
      materials, differentiation, assessment, homework, notes,
      textbook_map_item, duration_days, protected_pin_date,
      flexible_preference_date, scheduled_dates, archived_at
    ) values (
      v_new_course_id,
      (v_unit_map ->> v_old_unit_key)::uuid,
      v_record ->> 'source_lesson_id',
      (v_record ->> 'position')::integer,
      v_record ->> 'title',
      coalesce(v_record ->> 'planning_status','Draft'),
      coalesce(v_record ->> 'lesson_type','Content'),
      v_record ->> 'chapter',
      v_record ->> 'pages',
      v_record ->> 'section',
      v_record ->> 'objective',
      v_record ->> 'standards',
      v_record ->> 'guiding_questions',
      v_record ->> 'evidence_source',
      v_record ->> 'key_vocabulary',
      v_record ->> 'resources_links',
      v_record ->> 'materials',
      v_record ->> 'differentiation',
      v_record ->> 'assessment',
      v_record ->> 'homework',
      v_record ->> 'notes',
      v_record ->> 'textbook_map_item',
      coalesce((v_record ->> 'duration_days')::integer, 1),
      (v_record ->> 'protected_pin_date')::date,
      (v_record ->> 'flexible_preference_date')::date,
      coalesce(
        (select array_agg(v.value::date order by v.ordinality)
         from jsonb_array_elements_text(v_record -> 'scheduled_dates')
              with ordinality as v(value, ordinality)),
        '{}'::date[]
      ),
      (v_record ->> 'archived_at')::timestamptz
    );
  end loop;

  for v_record in select value from jsonb_array_elements(p_export -> 'calendarExceptions') as items(value) loop
    if jsonb_typeof(v_record) <> 'object'
       or (v_record ->> 'course_id')::uuid <> v_source_course_id then
      raise exception 'Invalid calendar exception or course reference';
    end if;
    insert into public.calendar_exceptions (
      course_id, date, effect, event_type, title, notes
    ) values (
      v_new_course_id,
      (v_record ->> 'date')::date,
      v_record ->> 'effect',
      v_record ->> 'event_type',
      v_record ->> 'title',
      v_record ->> 'notes'
    );
  end loop;

  return v_new_course_id;
end;
$function$
;
REVOKE EXECUTE ON FUNCTION public.restore_course_export(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_course_export(jsonb) TO authenticated;
CREATE TRIGGER courses_touch BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION course_planner_touch_record();
CREATE TRIGGER units_touch BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION course_planner_touch_record();
CREATE TRIGGER lessons_touch BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION course_planner_touch_record();
CREATE TRIGGER exceptions_touch BEFORE UPDATE ON public.calendar_exceptions FOR EACH ROW EXECUTE FUNCTION course_planner_touch_record();
GRANT INSERT ON TABLE public."courses" TO "postgres";
GRANT SELECT ON TABLE public."courses" TO "postgres";
GRANT UPDATE ON TABLE public."courses" TO "postgres";
GRANT DELETE ON TABLE public."courses" TO "postgres";
GRANT TRUNCATE ON TABLE public."courses" TO "postgres";
GRANT REFERENCES ON TABLE public."courses" TO "postgres";
GRANT TRIGGER ON TABLE public."courses" TO "postgres";
GRANT MAINTAIN ON TABLE public."courses" TO "postgres";
GRANT INSERT ON TABLE public."courses" TO "authenticated";
GRANT SELECT ON TABLE public."courses" TO "authenticated";
GRANT UPDATE ON TABLE public."courses" TO "authenticated";
GRANT DELETE ON TABLE public."courses" TO "authenticated";
GRANT TRUNCATE ON TABLE public."courses" TO "authenticated";
GRANT REFERENCES ON TABLE public."courses" TO "authenticated";
GRANT TRIGGER ON TABLE public."courses" TO "authenticated";
GRANT MAINTAIN ON TABLE public."courses" TO "authenticated";
GRANT TRUNCATE ON TABLE public."courses" TO "service_role";
GRANT REFERENCES ON TABLE public."courses" TO "service_role";
GRANT TRIGGER ON TABLE public."courses" TO "service_role";
GRANT MAINTAIN ON TABLE public."courses" TO "service_role";
GRANT INSERT ON TABLE public."units" TO "postgres";
GRANT SELECT ON TABLE public."units" TO "postgres";
GRANT UPDATE ON TABLE public."units" TO "postgres";
GRANT DELETE ON TABLE public."units" TO "postgres";
GRANT TRUNCATE ON TABLE public."units" TO "postgres";
GRANT REFERENCES ON TABLE public."units" TO "postgres";
GRANT TRIGGER ON TABLE public."units" TO "postgres";
GRANT MAINTAIN ON TABLE public."units" TO "postgres";
GRANT INSERT ON TABLE public."units" TO "authenticated";
GRANT SELECT ON TABLE public."units" TO "authenticated";
GRANT UPDATE ON TABLE public."units" TO "authenticated";
GRANT DELETE ON TABLE public."units" TO "authenticated";
GRANT TRUNCATE ON TABLE public."units" TO "authenticated";
GRANT REFERENCES ON TABLE public."units" TO "authenticated";
GRANT TRIGGER ON TABLE public."units" TO "authenticated";
GRANT MAINTAIN ON TABLE public."units" TO "authenticated";
GRANT TRUNCATE ON TABLE public."units" TO "service_role";
GRANT REFERENCES ON TABLE public."units" TO "service_role";
GRANT TRIGGER ON TABLE public."units" TO "service_role";
GRANT MAINTAIN ON TABLE public."units" TO "service_role";
GRANT INSERT ON TABLE public."lessons" TO "postgres";
GRANT SELECT ON TABLE public."lessons" TO "postgres";
GRANT UPDATE ON TABLE public."lessons" TO "postgres";
GRANT DELETE ON TABLE public."lessons" TO "postgres";
GRANT TRUNCATE ON TABLE public."lessons" TO "postgres";
GRANT REFERENCES ON TABLE public."lessons" TO "postgres";
GRANT TRIGGER ON TABLE public."lessons" TO "postgres";
GRANT MAINTAIN ON TABLE public."lessons" TO "postgres";
GRANT INSERT ON TABLE public."lessons" TO "authenticated";
GRANT SELECT ON TABLE public."lessons" TO "authenticated";
GRANT UPDATE ON TABLE public."lessons" TO "authenticated";
GRANT DELETE ON TABLE public."lessons" TO "authenticated";
GRANT TRUNCATE ON TABLE public."lessons" TO "authenticated";
GRANT REFERENCES ON TABLE public."lessons" TO "authenticated";
GRANT TRIGGER ON TABLE public."lessons" TO "authenticated";
GRANT MAINTAIN ON TABLE public."lessons" TO "authenticated";
GRANT TRUNCATE ON TABLE public."lessons" TO "service_role";
GRANT REFERENCES ON TABLE public."lessons" TO "service_role";
GRANT TRIGGER ON TABLE public."lessons" TO "service_role";
GRANT MAINTAIN ON TABLE public."lessons" TO "service_role";
GRANT INSERT ON TABLE public."calendar_exceptions" TO "postgres";
GRANT SELECT ON TABLE public."calendar_exceptions" TO "postgres";
GRANT UPDATE ON TABLE public."calendar_exceptions" TO "postgres";
GRANT DELETE ON TABLE public."calendar_exceptions" TO "postgres";
GRANT TRUNCATE ON TABLE public."calendar_exceptions" TO "postgres";
GRANT REFERENCES ON TABLE public."calendar_exceptions" TO "postgres";
GRANT TRIGGER ON TABLE public."calendar_exceptions" TO "postgres";
GRANT MAINTAIN ON TABLE public."calendar_exceptions" TO "postgres";
GRANT INSERT ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT SELECT ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT UPDATE ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT DELETE ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT TRUNCATE ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT REFERENCES ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT TRIGGER ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT MAINTAIN ON TABLE public."calendar_exceptions" TO "authenticated";
GRANT TRUNCATE ON TABLE public."calendar_exceptions" TO "service_role";
GRANT REFERENCES ON TABLE public."calendar_exceptions" TO "service_role";
GRANT TRIGGER ON TABLE public."calendar_exceptions" TO "service_role";
GRANT MAINTAIN ON TABLE public."calendar_exceptions" TO "service_role";
RESET ROLE;
SET ROLE supabase_admin;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable();
RESET ROLE;
SET ROLE postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT INSERT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRIGGER ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT MAINTAIN ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRIGGER ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRIGGER ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRIGGER ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT MAINTAIN ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";
RESET ROLE;
SET ROLE supabase_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT INSERT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT DELETE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT REFERENCES ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRIGGER ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT MAINTAIN ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT INSERT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT DELETE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT REFERENCES ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRIGGER ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT INSERT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT DELETE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT REFERENCES ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRIGGER ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT INSERT ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT UPDATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT DELETE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT REFERENCES ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRIGGER ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT MAINTAIN ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "service_role";
RESET ROLE;
INSERT INTO auth.users(id) VALUES ('a0000000-0000-4000-8000-000000000001'),('b0000000-0000-4000-8000-000000000001');
