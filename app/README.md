# Course Planner — authentication and persistence integration (in progress)

This branch adds Supabase passwordless sign-in and a private saved-course list. It is a **partial vertical slice**, not full Course Planner persistence: the existing fictional Course Sequence, Unit Planning, Lesson Planning, and Calendar demonstration is still in-memory and resets on reload. Only newly created course *names* are saved to the database.

Supabase project: pzipmantttlsbakzrsrm; only a publishable browser key is used. RLS on all tables is mandatory. No school data or teacher records have been imported.

**Before login can work**, configure Supabase Auth URL Configuration with the deployed app URL as an allowed redirect URL, and review the Site URL, OTP settings, and email delivery limits. This is a prerequisite for testing email sign-in. Do not disable RLS or place service_role credentials in the client.

**Verification gates:** live email sign-in, create saved course, close/reopen on another browser, verify unauthorized users cannot read it, then integrate real units/lessons and calendar with save/recovery, exports and backups. Do not retire the spreadsheet yet.

The marketing website is not modified. Do not merge this branch to main or import real curriculum before the gates pass.
