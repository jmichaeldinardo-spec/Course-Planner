# Course Planner — private web application (pilot development)

This independent application is deployed from the `pilot/app-foundation` branch to a **separate Vercel project** rooted at `/app`. The existing marketing website remains on `main` and is unaffected.

## Implemented in the development preview

- Supabase Auth passwordless email-link sign-in and sign-out
- Owner-isolated Supabase `courses`, `units`, `lessons` and `calendar_exceptions` tables
- Create saved courses, add units and lessons, edit unit and lesson content, view saved sequence and read-only scheduling records
- Shared saved lesson/units data across the private editor's planning screens
- Explicit Save, database re-read, optimistic revision checks for record conflicts, unsaved-edit navigation/unload warnings, error messages
- Download a JSON snapshot containing the saved course, units, lessons, and calendar exceptions
- The existing **fictional interactive demonstration** remains separate, in-memory and unsaved
- GitHub CI runs `cd app && node --test tests/*.test.mjs` using the app tests

The browser uses only a public `sb_publishable_` Supabase client key, not a service-role key. Supabase project: `rlyrfbvxpmmfxdpzkyia` (`course-planner-east`, `us-east-1`). Four DB tables have owner-based RLS; the East project security advisor reports zero findings. The original Oregon project is retained temporarily as a rollback reference with no accounts or course records. **Real-user isolation has not yet been independently verified.**

## Important: this is not yet ready for authentic daily planning

- The **new East Supabase project's** Auth Site URL and allowed redirect URLs need to be configured for the dedicated app development preview before email sign-in is tested. The old project's redirect configuration does not transfer.
- No real sign-in, saved-record round trip, cross-device reload, dual-account RLS or recovery test has passed.
- The authenticated planning forms are functional *in code* but have not been browser-tested; the earlier static fictional demo remains unchanged.
- Scheduling re-computation and transactional closure/pin previews are **not** integrated with the private database. Private Calendar is explicitly read-only.
- Automatic backups and tested restores have not been established; JSON export is user-initiated, not a backup service.
- No teacher accounts, school/student data, or Government/Economics curriculum have been imported.
- Do not use real curriculum until security, persistence and backup/recovery gates pass.

## Verification plan

1. In **course-planner-east** → Authentication → URL Configuration, set Site URL and add exact authorized redirect URL `https://course-planner-app-git-pilot-app-foundation-course-planner.vercel.app/` for the selected Vercel app preview. Avoid wildcard production redirects.
2. Test a newly created teacher account with email OTP/magic link; create, save, sign out, sign back in, reload the same course on another browser.
3. Test editing a unit Essential Question and a lesson objective, checking the shared record in Sequence / Unit / Lesson views; test failed network and concurrent update conflict.
4. Test two independent accounts cannot read or alter each other's courses and children, using RLS access attempts. Verify account/session logout behavior.
5. Add validated scheduling, private export/backup and restore; import canonical Government course (five units, 74 stable source Lesson IDs) only then.
6. Run browser acceptance and mobile accessibility regression checks; promotion to the dedicated app project's production alias requires review. Do not alter the marketing project.

Run local static tests: `cd app && node --test tests/*.test.mjs`.
Run local server: `python3 -m http.server 8000` from the repo root, then open `/app/`.

## Email sign-in diagnostics (October 25, 2026)

The first shared-project account completed email login and persistent course/unit/lesson save-reopen. A second account confirmed its email in Supabase, but the browser returned unsigned-in after the protected Vercel preview interrupted the redirect. Supabase logs show a 429 email send limit followed by re-used/expired one-time confirmation tokens.

The development app now includes optional **six-digit email OTP verification** beside the existing magic-link method. **Important:** the email-code form only works if the Supabase project's **Authentication → Email Templates → Magic Link** template is configured to send a plain `{{ .Token }}` code instead of a confirmation link. Until the template is changed, continue using the link method for already-working sessions; do not attempt to enter a link as a code. The project-level email sending rate limit still applies, and code-entry does not bypass it. Never weaken Vercel preview protection or log user OTPs. Login and independent-account isolation are still unverified in the browser.
