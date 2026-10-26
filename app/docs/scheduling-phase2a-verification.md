# Phase 2A implementation and verification — October 26, 2026

Issue: https://github.com/jmichaeldinardo-spec/Course-Planner/issues/3

Branch: `pilot/calendar-event-effect-preview`, created from current
`pilot/app-foundation` at `6b5c5144862be43e7fa9a60674db3c917a7eb827`.

## Implemented

- [Design and review gates](scheduling-phase2-design.md), including domain diagram,
  availability/override matrix, legacy compatibility, three annotated scenarios,
  migration alternatives and proposed 2B transaction / 2C Undo architecture.
- `event-effects.js`: DEC-027 normalization without rewriting raw saved records.
  No Lesson→closed Move; Replace Lesson→occupied Move; Continue Lesson→instructional
  Keep. Unknown subtype stays explicitly unspecified; unknown/contradictory policy
  stays blocked. Saved calendar diagnostics now use the approved mappings.
- `scheduling-preview.js`: pure, deterministic, immutable snapshot + event-intent
  preview. Returns event before/proposed/default origin, every active stable lesson
  ID/date comparison, affected IDs, commitments, eligibility/reservations/capacity,
  unmet work, hard conflicts and separate soft warnings. There is no network/client
  dependency or scheduling write path.
- Saved Calendar Add/Change event form and preview panels, retaining the existing
  Month/Week presentation and same-ID lesson editor links. Move/Keep, explicit
  availability and forbidden-effect explanations; disabled Extend; complete
  before/proposed comparisons and blocked/partial-input states. No Apply/Save/
  Confirm action. Cancel, Close, Escape and leaving Calendar discard transient state.
- Snapshot equality invalidates proposals after loaded dependencies change; draft
  form edits hide older results. Authoring dirty guards and in-flight reload
  protections remain separate. Archived lessons/units stay excluded from activity,
  while saved records/JSON/ZIPs remain intact.

No live schema migration, scheduling RPC, event/date/pin/order write, main/marketing
change, Sheet/Apps Script/CPD edit or production promotion is part of 2A.
The follow-up below fixes concurrent Auth refresh rendering; credential flow,
backup, restore, public demo assets, application HTML and config source files are
unchanged. The exact PR Auth redirect was separately approved and added.

## Automated acceptance

Node 24.22.1 supplied by the desktop runtime; no dependencies or lockfile added.
With its Node binary on PATH:

```sh
cd app && node --test tests/*.test.mjs
```

**74 tests passed, 0 failed, 0 skipped.** All 43 previous test cases are retained;
the earlier universal-uncertainty assertion for Replace/Continue was updated to
DEC-027's newly approved semantics, while unknown effects still test uncertainty.
Three additional Auth refresh regressions cover overlapping responses, sign-out/
account changes, obsolete errors and dirty authoring protection. New scheduling
cases cover the three annotated scenarios; effective legacy values and raw
metadata; defaults/permissible override; genuinely closed dates (including event-
type default changes); occupied-event contention; multi-day leap/DST/weekend
allocation; protected assessments/full pinned arrays; soft preferences; all-or-
nothing capacity shortfall; pre-existing overlaps/order/incomplete input; missing
parents, foreign/duplicate IDs, revisions/membership/content freshness; archive
scope; deterministic deep-frozen input; HTML escaping and no persistence imports.
The original persistence, owner-verification, ZIP/hash, import and conflict tests
continue to pass.

## Browser acceptance

Exact command from project root:

```sh
NODE_PATH=/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
COURSE_PLANNER_CALENDAR_FIXTURE=app/reviews/calendar-event-effect-preview/stored-current-calendar.json \
/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node app/tests/calendar.browser.mjs
```

**299 checks passed** at 1440px and 390px; **0 uncaught browser errors**. The actual
app modules are served by a loopback-only server. Only the Supabase SDK network
boundary is substituted with an owner-scoped test client; no real credentials or
sessions are read. The optional stored fixture can be omitted for synthetic-only
runs. These checks use local browser fixtures. Hosted acceptance is recorded separately below.
A controlled three-request Auth race is also exercised at both widths: startup,
INITIAL_SESSION and TOKEN_REFRESHED responses complete out of order, and each of
three courses must appear exactly once without writes.

Covered Add/Change event, type/effect defaults and permissible override, forbidden
Keep and deferred Extend, full downstream date list, stale-result hiding,
reloaded-snapshot invalidation, saved closure constraint, protected pin conflict,
keyboard/focus, no overflow, Cancel byte equality, unchanged exported arrays after
Cancel, no Apply action and zero REST/RPC writes from all preview controls. Existing
Month/Week, shared lesson IDs, unsaved authoring guard, save/reopen, stale-write
rejection, JSON restore and account ZIP tests remain included. Empty first-course
preview explains missing term and invents no placements. Archive preservation and
80-lesson/12-event blocked-baseline cases run at both widths. Fully scheduled
80-lesson Move/Keep success and bounded partial fixtures also run at both widths.

An initial driver assertion treated a disabled `<option>` as enabled; inspected
HTML had `disabled`. The final check verifies the native `option.disabled` property.
No constraint was weakened to make that test pass.

```sh
COURSE_PLANNER_REVIEW_DIR=app/reviews/calendar-event-effect-preview/hosted-acceptance/existing-demo \
python3 app/tests/verify-demo-regression.py
```

**265 existing demo checks passed**, **42 screenshots**, **0 browser errors**.
The wrapper substitutes only local port/output paths; original assertions and
marketing/demo source remain unchanged. The optional output-directory setting
preserves earlier review evidence.

```sh
git diff --check
```

Passed. There is no configured additional build, lint or typecheck command.

## Stored fictional records and read-only boundaries

The designated collaboration Google connection was verified before reading CPD
03/08 and DEC-027. No school Google account, real curriculum or student data was
accessed; no canonical documents were edited.

The user explicitly approved a fresh calendar snapshot of the existing fictional
5-unit / 80-lesson / 12-event course into the Git-excluded local review folder after
automatic approval review required specific permission. Reads used authenticated-
role RLS with the matching owner subject inside a rolled-back transaction.
No schema or saved rows changed. A post-test read confirmed unchanged record
membership, revisions and archive flags versus the approved snapshot.

Under DEC-027, the stored calendar has 93 confirmed instructional dates (the two
Continue Lesson dates are usable), 92 required lesson-days and 86 saved assignments.
Six lessons already have empty saved arrays. After the independent review, these
six incomplete baselines still block the overall proposal, while a complete
leading segment can be assessed within its original saved date span. The first
incomplete lesson and all later sequence work retain BEFORE dates and null
PROPOSED values. No initial dates are invented and no ripple crosses that horizon.
The independent fully scheduled 5-unit/80-lesson/12-event fixture demonstrates
successful Move (79 changed lessons, 89 complete lesson-days) and Keep (no date
changes), including multi-day lessons, a protected first lesson and a soft preference.
The six-unscheduled 80-lesson regression proves 15 assessed / 65 unassessed on Keep.
The smaller boundary regression proves a displaced lesson is not declared
unplaceable merely because its outcome would require crossing unknown work. No live saved scheduling,
restore or backup write was performed; those handler regressions use the test client.

Local evidence under `app/reviews/calendar-event-effect-preview/` is excluded from
Git: `browser-results.json`, `stored-current-calendar.json`,
`stored-preview-summary.json`, `stored-read-verification.json`, desktop/mobile
Move/Keep/pin-conflict captures, saved calendar captures, and existing-demo output.
These fixtures and screenshots are not uploaded with the PR.

## Remaining product review / Phase 2B handoff

The [design](scheduling-phase2-design.md) marks these as recommendations, not newly
approved product policy: one full-day slot per date, rightward ripple preserving
saved anchors, unaffected earlier multi-day slots retained, all-or-nothing lesson
allocation, entire saved arrays protected by a pin, and no auto-anchoring of
unscheduled work. Partial-time and reserved-flex allocation, replacement periods,
closure reclassification, multi-day continuity and a separate direct flexible-date
command still need decisions. Unseen remote changes require server freshness checks;
a local snapshot token is not a transactional guarantee.

The recommended 2B design adds nullable structured effect + availability while
retaining legacy compatibility; versioned v1/v2 restore must precede new-format
exports. A single owner-checked security-invoker transaction should lock the course
serialization boundary and dependencies, revalidate membership/revisions, recompute
intent with a reviewed server policy, reject tampering/staleness/conflicts, write
all event/placement changes together, and bind retries to an idempotency key/digest.
All scheduling-input writers must use the same boundary. Preserve original raw
metadata in a reviewed recovery journal when explicitly changing legacy projection.
The recovery journal must exist from the first 2B write and atomically include the
complete BEFORE/AFTER event, every changed lesson date array, revisions,
owner/course and idempotency identity/digest. A journal failure rolls back all
writes. 2C adds user-facing revision-checked Undo using that journal. Extend stays 2D.

**Please review the open assumptions and migration/RPC architecture before any
Phase 2B scheduling write implementation.** This PR authorizes none of those writes.


## Independent review correction

Review: https://github.com/jmichaeldinardo-spec/Course-Planner/pull/4#issuecomment-6424016024

The original universal incomplete-baseline expectation was deliberately replaced
with bounded leading-segment tests; all other hard blockers still block every
proposal. Five new Node cases cover boundaries, partial multi-day input, pins,
stale/invalid data, full 80-lesson success and the 80-lesson incomplete regression.
No test, fixture or UI creates missing baseline dates. Both successful and partial
browser scenarios verify Cancel byte equality, unchanged full lesson JSON exports,
no scheduling Apply action and zero mock REST/RPC writes. Full automated coverage
still includes archived records, JSON restore, ZIP/hash and authoring conflicts.
Evidence is in Git-excluded `app/reviews/calendar-event-effect-preview/review-correction/`.

### Hosted signed-in acceptance — completed October 26

Tested application head: `85532363eac27e27dadef79bef02fc088e2f5f53`.
GitHub `app-tests` and Vercel `course-planner-app` checks succeeded on this head.
The later report-only commit does not change application code.

URL: https://course-planner-app-git-pilot-calendar-eve-018d2d-course-planner.vercel.app/ .
The user completed sign-in on the exact PR origin using the designated
collaboration account. Acceptance reused that existing browser session; no new
email was requested and no authentication tokens were read or copied. The prior
rate-limit/redirect acceptance blocker is resolved. With explicit user approval,
the exact PR redirect had been added and verified after a dashboard reload; the
foundation Site URL and both prior redirect entries were preserved without a
wildcard. No Auth configuration was changed during this acceptance run.

**21 hosted checks passed**, **0 captured browser errors**:

- Exact PR origin remains signed in after reload; Saved courses reports three
  courses and renders three distinct course IDs, once each, across two reloads.
- Closure forbids Keep and Extend remains disabled. Preview panels expose no
  scheduling Apply/Save/Confirm action.
- Instructional Keep on Sep 10 assesses 15 complete leading lessons with unchanged
  dates, preserves all 80 BEFORE rows and explicitly leaves 65 unassessed. Six
  lessons remain already unscheduled. The overall proposal remains blocked.
- Closure Move on Sep 22 discloses seven changed lessons and 14 assessed / 66
  unassessed. The two-day lesson retains its complete proposed array (Oct 1–2).
  The last lesson before the unresolved baseline is not assessed when its ripple
  would cross Oct 2; no date is invented for that lesson or any later work.
- The protected Sep 15 lesson retains its saved date. A closure on that date
  reports a blocked commitment without moving the pin. Soft preferences remain
  distinct from protected dates.
- Editing the transient proposal hides the previous result. Close, Cancel and
  Escape discard the proposal; Cancel/Escape restore the Add event focus.
- The preview opens the same saved lesson ID in Lesson Planning without editing.
  Legacy Change retains title/notes, normalizes No Lesson to closed Move and
  discloses the raw BEFORE effect. Closing returns to the original saved Sep 22
  placement. Month/Week, seven-day Week layout, keyboard date focus and desktop
  overflow checks pass.

The actual stored course is intentionally incomplete. Hosted results therefore
exercise bounded partial and protected-conflict outcomes, not a fictitious full
80-lesson success. The fully scheduled 80-lesson success remains a local synthetic
fixture; it was not restored into Supabase.

SELECT-only owner-scoped READ ONLY transactions with ROLLBACK before and after
acceptance returned identical full-record signatures for all **3 courses, 7 units,
82 lessons and 12 calendar events** visible to the owner. No saved records were
created, edited, deleted, restored or scheduled. These checks cover public course
records; the normal existing Auth session may refresh through the SDK.

Evidence is Git-excluded under
`app/reviews/calendar-event-effect-preview/hosted-acceptance/`:
`browser-results.json` (299 local checks), `hosted-browser-results.json` (21 hosted
checks), `hosted-read-verification.json`, Keep/Move/protected-conflict/Week/course-list
screenshots and the existing-demo output. Captures contain no authentication tokens.

### Saved-course duplicate rendering correction

Startup refresh and multiple Auth notifications could overlap. Each invocation
cleared the list before awaiting the course read, then appended its response.
Three completions therefore rendered nine entries while each reported a count of
three. This was a browser rendering race, not evidence of duplicate database rows.

`auth.js` now uses a monotonic refresh generation checked after both session and
course reads. Only the latest invocation can publish its session/list/status or
start automatic workspace selection; its list replaces all children atomically.
Obsolete responses and errors are ignored. The captured current user is used for
automatic opening, while existing workspace epochs and dirty guards remain active.
The Auth subscription still defers asynchronous work out of its callback.

Three behavioral VM tests execute the real Auth module with delayed read responses.
Against the previous source all three fail: nine rendered entries, old records
reappearing after sign-out, and an obsolete network error replacing a newer signed-in
status. Against the fix all pass. Two real-app browser race scenarios, one at each
viewport, add six checks. Full suite totals are 74 Node / 299 app browser / 265 demo.
No change to credentials, sign-in email behavior, database records, schema or
scheduling policy was needed.

PR #4 remains draft against `pilot/app-foundation`. No Phase 2B, merge or deployment
promotion was performed. The existing product questions for initial scheduling,
pin-span semantics, multi-day gaps/continuity and partial/period allocation remain
review gates before scheduling writes.
