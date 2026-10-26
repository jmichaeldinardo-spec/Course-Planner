# Saved calendar Phase 1 — implementation and verification

Issue: https://github.com/jmichaeldinardo-spec/Course-Planner/issues/1

Feature branch: `pilot/saved-calendar-phase1`, forked from the fetched
`pilot/app-foundation` commit `f9c4473cfc220b700d60a893f6f1a40a9a9b5ab0`.

## Before and after

Before: private Calendar listed saved lesson dates and exceptions as flat text.
After: the same authenticated course query feeds a read-only Month grid and
Week/Agenda, selected-day details, stable-ID links to Lesson Planning, saved
multi-day placements, types/status/unit labels, distinct pins/preferences,
unscheduled records, unit pacing references and dated diagnostics. Mobile Month
uses counts and commitment markers; selecting a date reveals full records.

No alternative lesson collection is maintained. `calendar-model.js` produces
immutable projections of the canonical records; `calendar-view.js` renders them.
`private-workspace.js` retains only calendar presentation state (view/anchor/day).
The existing dirty-form navigation guard protects transitions, and focus is
restored after calendar rerenders and lesson navigation.

No auth, RLS, schema, saved-record query, import/restore RPC, backup implementation,
root marketing assets, hosting configuration, main branch, Sheet, Apps Script or
canonical product document was changed. Existing content editing is retained.
Calendar controls issue no writes and never modify schedule inputs or order.

## Rules and explicit limits

Read the complete issue, application, live table columns/check constraints,
CPD tab 03, earlier product specification, demonstration and the linked canonical
Apps Script reference before implementation. Drive identity was verified as the
designated collaboration account; no school account/data was used.

- Database DATE values are civil dates. UTC date arithmetic and formatting avoid
  browser timezone and DST shifts; the course timezone selects today's navigation
  date only when no saved initial date exists. That fallback is not a placement.
- `teaching_weekdays` uses ISO Monday=1 through Sunday=7, confirmed by the DB check.
  Term bounds are inclusive. Missing/invalid inputs produce unknown capacity.
  Date enumeration is bounded to ten years and reports unsupported larger terms.
- `No Lesson` blocks normal instructional capacity. The references define closures
  and full instructional blocks, but do not specify exact `Replace Lesson` or
  `Continue Lesson` allocation/continuation behavior. Those effects, missing or
  unknown effects are displayed verbatim, flagged uncertain, and excluded from
  **confirmed** capacity. They are not silently treated as either closures or
  ordinary teaching days. Phase 2 must resolve their exact semantics.
- Active saved placements remain visible, even outside term, on closures or with
  overlaps. Pins/preference markers without placements do not create saved events.
- Diagnostics cover invalid/duplicate/incomplete dates, duration, missing unit
  links, unavailable saved dates, closure/nonteaching/out-of-term pin collisions,
  pin/saved-date mismatches, unmet soft preferences, saved sequence inversions, same-date overcapacity,
  total capacity shortfall and bounded ordered feasibility.
- Feasibility assumes one lesson-day per confirmed instructional date, canonical
  lesson order, hard pins as start commitments, and multi-day lessons consuming
  successive eligible instructional days. It excludes uncertain dates, does not
  reserve soft preferences, and returns no proposed placement dates. It is a
  deterministic lower-bound capacity check, not a complete scheduling engine.
  Unknown lesson durations disable feasibility. A failure is conditional on these
  assumptions; the UI explains that resolving unknown effects may change it.
- Unit targets compare pacing only. They never trigger a recalculation or write.
- Calendar activity requires a lesson's `archived_at` to be null/absent and its
  same-course unit not to be archived. Archived units are omitted from pacing;
  all their lessons are excluded even if the lessons' own flags remain null.
  This applies before dates, pins/preferences, demand, unscheduled/incomplete work,
  order/overlap warnings, feasibility and pacing are derived. Calendar's initial
  date fallback also uses active lessons only.
- Archive filtering is a read-only projection. The saved collections, stable IDs,
  archive flags, dates, pins, preferences, unit relationships, revision checks,
  editor recovery access, course JSON and account ZIP contents remain intact.
  Restoring a unit makes only its non-archived lessons eligible again; it does not
  unarchive lessons individually. Missing parents remain visible diagnostic errors.
  Course-level exception records retain their existing availability effects.

## Verification — October 26, 2026

Commands run from the project root unless otherwise indicated. The desktop bundle
supplies Node 24.22.1 and Playwright; no dependency or lockfile was added to the app.
For reproducibility, make Node available on PATH and set NODE_PATH to the installed
Playwright directory when running the standalone browser harness.

```sh
cd app && node --test tests/*.test.mjs
```

43 tests passed, zero failures. Includes existing auth/source contracts, unsaved
async refresh guards, revision-write checks, restore/export contracts, ZIP structure,
SHA-256 manifests, ownership checks and concurrent-backup abort tests. New pure
coverage includes leap/nonleap February, complete week layout, ISO weekdays, term
endpoints, DST transitions across three host zones, closures, uncertain exceptions,
one/multi-day durations, duplicate/overlapping/missing dates, pins vs preferences,
ordered constraints, insufficient capacity, deterministic results, immutability,
cross-course filtering, HTML escaping, empty state and 80/12 scale. Archive
regressions cover a dated/pinned archived lesson sharing a live lesson's date,
archived unscheduled/invalid/preferred records, archived units with non-archived
children, recovery without changing child flags, null/absent archive flags,
filtered Month/Agenda/detail labels and preserved archived backup records.

```sh
NODE_PATH=/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
COURSE_PLANNER_CALENDAR_FIXTURE=app/reviews/saved-calendar-phase1/stored-fictional-calendar.json \
/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node app/tests/calendar.browser.mjs
```

153 browser checks passed at 1440px and 390px, zero uncaught browser errors.
Checks cover real application modules, scoped Month/Week toggle, period navigation,
day detail and IDs, keyboard arrows/focus, minimum mobile date-button size,
page overflow, lesson editor ID/focus, unsaved navigation rejection, save/reopen,
stale revision rejection, JSON download/import to a separate course, ZIP download
with original/restored course entries, and empty first-course state. The archive
fixture checks omitted lesson IDs/labels and unit pacing in Month and Agenda,
excluded unscheduled work, and complete archived-record retention through JSON,
separate-course restore and ZIP backup. Calendar
navigation was asserted to perform zero mutations. Playwright and local loopback
server require the desktop sandbox's execution permission.

The browser harness substitutes the SDK at its network boundary with a deterministic
owner-scoped test client. Save/conflict/restore/download regressions exercise the
unchanged app handlers; they do **not** constitute live database write, RLS isolation,
transaction rollback or real magic-link authentication tests. No real credentials
or real sessions are read by the harness. Without the optional fixture environment
variable, it runs against the fully synthetic sample only.

Stored fictional verification used the existing 5-unit / 80-lesson / 12-exception
“Large Restore Test — Fictional Civic Systems” course. The user explicitly approved
reading its calendar fields into the Git-excluded project review folder after
initial automatic approval review rejected that export. The data was read inside
`BEGIN; SET LOCAL ROLE authenticated` with the matching owner's JWT subject, then
`ROLLBACK`; no scheduling writes were issued. The fixture is local review material,
not committed or uploaded with this PR.

Independent authenticated-role SQL aggregates matched the model: 91 confirmed
instructional dates, 5 uncertain dates, 80 lessons,
92 required lesson-days, 86 saved lesson-days, 6 unscheduled lessons, 6 pins and
6 flexible preferences. The model reports 91 confirmed instructional dates,
5 uncertain dates, a one-day confirmed-capacity shortfall and 5 bounded feasibility
failures. The actual saved dates were rendered at both widths and checked for
stable lesson links and zero changes. This verifies read/projection/rendering of
stored fictional records, **not** a live signed-in hosted run of the new feature.
The subsequent hosted follow-up is recorded in the review correction below.

```sh
python3 app/tests/verify-demo-regression.py
```

Runs the existing `tests/verify_demo.py` against unchanged marketing/demo code.
The wrapper substitutes only its hardcoded local port and output directory,
preserving all assertions and all pre-existing untracked review files.
265 checks passed at 1440px/390px, with 42 screenshots and zero browser errors.
The first review-fix run stopped on the unchanged marketing page's mobile
`#customization` anchor assertion; the unmodified suite passed on its one rerun.

```sh
git diff --check
```

Passed. Browser evidence and approved fixture stay under
`app/reviews/saved-calendar-phase1/`, excluded by `app/.gitignore`.

## Remaining review gates

- Define Replace/Continue semantics, including partial-day/reserved flex behavior,
  collision precedence, and how multi-day pinned starts consume capacity.
- Hosted read-only acceptance passed on the archive fix, as recorded below. Live
  restore/backup write tests were not repeated during this change; the browser
  regressions for those handlers use the test client. Earlier pilot milestones
  remain historical evidence, not newly claimed results.
- Cross-account unauthorized-write testing and disaster recovery remain existing
  pilot gates. No production promotion or merge is part of this work.

## Proposed Phase 2

1. Resolve exception semantics with product owner and executable fixtures; settle
   hard-pin multi-day rules before implementing writes. Preserve the active-calendar
   archive policy above when adding explicit archive/recovery operations.
2. Extend the pure core to return explicit BEFORE → PROPOSED dates for every affected
   lesson, constraints, capacity, unscheduled work and protected conflicts. Preserve
   IDs/content/order unless the proposed action explicitly changes order.
3. Add keyboard-accessible move/pin/unpin/exception controls. Preview complete impact,
   explain soft-preference tradeoffs and prevent confirmation of protected conflicts.
   Cancel leaves all saved state unchanged; require deliberate teacher confirmation.
4. Apply through one owner-checked transactional RPC with expected revisions for
   course, lessons, units and exceptions; lock/revalidate dependencies in the same
   transaction. Reject stale previews, write all related changes together or none,
   and support idempotent submission/retry. Keep RLS and export/restore compatible.
5. Record recoverable before/after schedule changes with a change ID. Undo runs as
   another revision-checked transaction and rejects conflicting later edits with a
   fresh preview. Retain independent export/recovery paths and test interrupted writes,
   retries, rollback, stale preview, two accounts, multi-day pins, ambiguous-effect
   resolution, mobile confirmation and cancellation before any pilot promotion.


## PR #2 archive review correction — October 26, 2026

Addressed the review's active-calendar archive bug at the projection boundary,
without database, auth, persistence or backup changes. Live metadata confirmed
`archived_at` columns on both units and lessons. Refreshed only archive flags in
the previously approved local stored-fictional fixture through authenticated-role
RLS and a rolled-back read transaction: 5 units / 80 lessons, none archived.
Consequently, archive-specific behavior is covered by synthetic records, while
the stored-fictional fixture preserves the original 80-lesson smoke regression.
The new active-calendar count explains why the full saved workspace/export count
can be larger than active calendar totals.

Commands above were rerun: 43 Node tests and 153 calendar browser checks passed.
Existing-demo browser results and `git diff --check` are reported above. The
standalone browser harness uses a test client; it is not hosted acceptance.
The user established the designated collaboration-account session in the real
PR preview. After GitHub CI and the branch preview passed for archive-fix commit
`f7c048cc1190b4bee926f8987d7e208d63a35e34`, the signed-in tab was reloaded and
**17 hosted checks passed** using the actual saved 80-lesson fictional course:

- Correct active counts and capacity totals; six unscheduled lessons.
- Calendar lesson link opened the exact same stable lesson ID/title in Lesson
  Planning with inherited unit context; no form fields were edited or saved.
- Month/Week stayed scoped to Calendar; next/previous week and keyboard day
  navigation worked; saved multi-day dates, pins, soft preferences and closures
  were distinct; Replace/Continue remained explicitly uncertain.
- No page overflow and no hosted browser errors.

Before/after authenticated-role SQL signatures matched for the course's calendar
configuration/revision, unit IDs/order/targets/archive flags/revisions, lesson
IDs/parents/order/duration/dates/pins/preferences/archive flags/revisions, and all
exception rows. No saved data changed during hosted acceptance. No credentials
were copied, no archive flags were changed, and no scheduling writes were made.
The stored course has no archived records; archive-specific behavior remains
covered by synthetic model/browser regressions rather than a live archive mutation.

Git-excluded evidence: `hosted-browser-results.json`,
`hosted-persistence-check.json` and `hosted-archive-review.png` under
`app/reviews/saved-calendar-phase1/`. The application code checked in this hosted
run is unchanged by the subsequent report-only commit. The PR remains draft;
there was no merge or production promotion.
