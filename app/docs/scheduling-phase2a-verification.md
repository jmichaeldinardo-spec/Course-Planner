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
change, Sheet/Apps Script/CPD edit or production promotion is part of 2A. Auth,
backup, restore, public demo assets, application HTML and config files are unchanged.

## Automated acceptance

Node 24.22.1 supplied by the desktop runtime; no dependencies or lockfile added.
With its Node binary on PATH:

```sh
cd app && node --test tests/*.test.mjs
```

**66 tests passed, 0 failed, 0 skipped.** All 43 previous test cases are retained;
the earlier universal-uncertainty assertion for Replace/Continue was updated to
DEC-027's newly approved semantics, while unknown effects still test uncertainty.
New cases cover the three annotated scenarios; effective legacy values and raw
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

**229 checks passed** at 1440px and 390px; **0 uncaught browser errors**. The actual
app modules are served by a loopback-only server. Only the Supabase SDK network
boundary is substituted with an owner-scoped test client; no real credentials or
sessions are read. The optional stored fixture can be omitted for synthetic-only
runs. These are local browser tests, not a new hosted signed-in acceptance claim.

Covered Add/Change event, type/effect defaults and permissible override, forbidden
Keep and deferred Extend, full downstream date list, stale-result hiding,
reloaded-snapshot invalidation, saved closure constraint, protected pin conflict,
keyboard/focus, no overflow, Cancel byte equality, unchanged exported arrays after
Cancel, no Apply action and zero REST/RPC writes from all preview controls. Existing
Month/Week, shared lesson IDs, unsaved authoring guard, save/reopen, stale-write
rejection, JSON restore and account ZIP tests remain included. Empty first-course
preview explains missing term and invents no placements. Archive preservation and
80-lesson/12-event blocked-baseline cases run at both widths.

An initial driver assertion treated a disabled `<option>` as enabled; inspected
HTML had `disabled`. The final check verifies the native `option.disabled` property.
No constraint was weakened to make that test pass.

```sh
COURSE_PLANNER_REVIEW_DIR=app/reviews/calendar-event-effect-preview/existing-demo \
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
Six lessons already have empty saved arrays. The new preview explicitly blocks on
those six incomplete baselines, retains all 80 BEFORE rows and returns unassessed
PROPOSED values. It does not invent initial dates or silently repair the course.
The synthetic consistent fixtures demonstrate successful Move and Keep proposals;
this stored sample demonstrates the adverse-input gate. No live saved scheduling,
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
2C history/Undo is a separate revision-checked atomic operation. Extend stays 2D.

**Please review the open assumptions and migration/RPC architecture before any
Phase 2B scheduling write implementation.** This PR authorizes none of those writes.
