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

A six-digit-code option was prototyped but withdrawn from the active app because the Supabase Free project's default SMTP does not allow editing the Magic Link email template. The current app uses the original email-link flow and provides guidance to authenticate with Vercel preview protection first. Do not configure custom SMTP merely to run this test, do not retry during Supabase's rate limit, and do not disable Vercel protection. Real second-account session verification remains open.

## Verified October 26 pilot milestones and backup strategy

- Real user sign-in, cross-session persistence, two-account course read isolation, conflict-safe unsaved lesson drafts, stale revision rejection, and a transactional course restore have passed browser tests.
- A fictional 5-unit / 80-lesson / 12-exception restore succeeded; a deliberately invalid restore rolled back with no partial data.
- A separate off-database export of the 80-lesson course was checked in the designated collaboration Google Drive under `Course Planner/04 - File Backups`. It matched the saved course record structure.
- **Download all courses (ZIP backup)** now generates one per-course `course-planner-<UUID>.json` file (each independently importable), plus `backup-manifest.json` with course/record counts and SHA-256 per-file integrity digests. This runs in the signed-in browser with the existing publishable key and RLS; there are no admin keys, third-party upload endpoints or background jobs.
- The backup process checks course/child revisions again before completing a ZIP, and aborts if it detects concurrent changes. It is a best-effort multi-query snapshot, not a fully atomic PostgreSQL point-in-time snapshot. Tested ZIP structure, hashes, access identity and abort behavior in CI; **live browser download and real independent backup verification are not yet complete.**
- This is **user-initiated**, not automatic. Users must save their ZIP outside Supabase (for example to private Drive). Supabase Free does not provide downloadable managed daily database backups.
- Still needed before trusting authentic course data: real second-account unauthorized-write tests, post-download ZIP restore checks, offline/failure recovery evaluation, database scheduling integration, backup frequency and retention design, and full owner-first pilot acceptance.

## Saved calendar Phase 1 (Issue #1)

The authenticated saved workspace now has a read-only Month grid and Week/Agenda,
day details linking to the same lesson editor, and deterministic capacity/conflict
diagnostics. Saved dates, hard pins and flexible preferences remain distinct.
Archived lessons and lessons in archived units are excluded from active calendar
placements, diagnostics and pacing; full records remain in exports/backups.
Restoring a unit does not clear its lessons' individual archive flags.
`No Lesson` and `Replace Lesson` now normalize to Move; `Continue Lesson`
normalizes to Keep under CPD DEC-027. Unknown or contradictory effects remain
uncertain. Calendar does not write
schedule changes. See [implementation, exact tests and Phase 2 plan](docs/saved-calendar-phase1.md).

The dependency-free suite remains `node --test tests/*.test.mjs`. Optional browser
acceptance uses `node tests/calendar.browser.mjs` with Playwright available via
`NODE_PATH`; it uses a test client and synthetic records, not real credentials.
The optional approved stored-fictional fixture and screenshots belong only in
Git-excluded `app/reviews/`. `python3 tests/verify-demo-regression.py` (from `/app`)
runs the existing public-demo browser suite without overwriting older evidence.


## Event + Scheduling Effect previews (Phase 2A, Issue #3)

Saved Calendar provides **Add calendar event** and **Change event** proposals.
Choose the circumstance and ordinary-instruction availability, then Move or Keep.
A deterministic BEFORE → PROPOSED comparison shows complete affected date arrays,
protected commitments, capacity, blocking conflicts and soft warnings. Cancel/Close
only discards transient state. There is no scheduling Save/Apply/Confirm path;
Extend and partial-time allocation remain deferred/blocked.
When incomplete date arrays are the only baseline problem, a bounded partial
preview assesses the complete leading sequence within its saved date span. The
first incomplete lesson and later work have no proposed dates; the overall result
stays blocked. Separate counts distinguish assessed, unassessed and already
unscheduled work. Initial schedule building remains a separate future workflow.
A fully scheduled fictional 80-lesson fixture exercises successful Move/Keep
alongside incomplete-baseline regressions.

See [design, migration/RPC recommendations and review gates](docs/scheduling-phase2-design.md)
and [test evidence/limits](docs/scheduling-phase2a-verification.md). Scheduling
writes and schema changes require a separate reviewed Phase 2B implementation.

## Build Schedule and three-tier outlook (Phase 2A.5, Issue #5)

Calendar & Exceptions now offers an experimental **Planning outlook**: confirmed
saved placements, optional near-term tentative overlays and distant milestone
summaries. **Build Schedule** requires an explicit start and proposes dates only
for wholly unscheduled lessons; all saved placements stay fixed. Review complete
BEFORE → PROPOSED arrays and whole-course capacity without writing anything.
Choose 2/4/6 calendar weeks from the selected date, toggle layers, or use
**Saved-only view** to discard the forecast. Unknown work stays not assessed or
cannot estimate. No Apply/Save/Confirm action, new storage or schema is introduced.
See [how to try it, working policies and verification](docs/build-schedule-outlook.md).


For hands-on positive review, choose **Try sample Build Schedule** inside the
saved calendar. This temporary, immutable 12-lesson fictional scenario uses the
same engine and interface entirely in memory. Choose **Use selected date
(2026-09-01)** → **Preview Build Schedule**: expect 4 confirmed fixture lessons,
8 tentative lessons, and estimated unit ranges through October 23. No sample
lesson editing, export, persistence or event-authoring path exists. **Return to
your saved course** restores the original calendar and preferences in one click.
The existing saved 80-lesson constrained course remains a separate comparison;
see the guide for exact steps and expected blocked results.


## UX Structure v0.1

The private app now uses a persistent sidebar, primary planning pane and contextual
inspector. Build/event configuration and detailed analyses live in the inspector;
calendar and canonical planning lists stay in place. Narrow screens use a
dismissible detail sheet. Settings offers local dark/light and accent choices;
course export/reload is under Course actions, with account backup/restore in
Settings. See [the structure, behavior and updated testing guide](docs/ux-structure-v01.md).
Scheduling engines, saved-record policies and persistence boundaries are unchanged.

## Home and sidebar navigation — Issue #8

Signed-in startup opens global Home. Resume Workspace reveals the retained editor;
Course Overview summarizes the selected course's saved records. Resources,
Templates and Archive open feature-specific Under development views. My Courses
and `+` use the existing owner-scoped load/create flows. Home, per-course drafts,
selection, inspector, scroll and icon choices are page-memory only. Save before
closing/reloading; sign-out clears contexts after the existing dirty warning.
Stage B central tabs are described below; groups/splits and persistent icon metadata remain separately reviewed work.
See [reconciliation, acceptance evidence and limits](docs/home-navigation.md).

## Dashboard v0.2 — Issue #10 / DEC-094

Home adds read-only cross-course Needs Attention (real saved statuses, separate
neutral unscheduled facts) and a Mon–Sun This Week agenda of saved dates/events.
Continue Planning retains the editor; compact course cards remain secondary.
See [data/time semantics, draft protection and acceptance evidence](docs/dashboard-v02.md).

## Practical technical regression — DEC-100

From the repository root, run `node app/tests/qa.mjs` for the existing Node suite
plus synthetic desktop/mobile browser smoke checks. Use `--full` for the complete
browser matrix. No sign-in or saved-course access is required. See the
[coverage inventory, one-time tooling setup, evidence and limits](docs/technical-qa-dec100.md).
Automated PASS/FAIL covers mechanical behavior; UX and product-design judgment
remain with the owner. Hosted PR #18 stays optional pending isolated test accounts
and disposable hosted fixtures.

## Stage B — central planning tabs

One course can now retain multiple planning views in a single central pane.
Ordinary sidebar clicks replace the selected tab; adjacent ↗ actions open another
view. Duplicate Lesson Plans share the existing saved record and unsaved draft.
Home/Continue and course switching preserve page-memory arrangements; Save remains
manual. See [architecture, keyboard controls, testing and owner review steps](docs/stage-b-central-tabs.md).
