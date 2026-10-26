# Build Schedule and planning outlook — Phase 2A.5

Issue: https://github.com/jmichaeldinardo-spec/Course-Planner/issues/5

Baseline: `pilot/app-foundation` at `54870b700564cfa65ebc9087fbfb8e330e1a6fcb`.
Feature branch: `codex/build-schedule-outlook`.

Read CPD tabs 03 Product Architecture, 05 Pilot & Roadmap and 08 Research & Open
Decisions, plus DEC-031/032 in the decision history, through the verified designated
collaboration Google connection. No school account or canonical document changes.
The adopted direction is one dataset and revisable three-tier presentation; the
allocation rules below are WORKING/OPEN prototype choices, not approved 2B policy.

## What the teacher can try

Open an existing fictional saved course → **Calendar & Exceptions**.

1. **Three tiers:** confirmed saved placements remain distinct from ◆ protected
   pins. ≈ tentative entries are hypothetical and unsaved. Expand **Tier 3 ·
   Distant milestones** for unit ranges and assessment anchors, or explicit
   **cannot estimate** states. Draft/In Progress/Ready describes lesson planning,
   not date certainty; a past date never proves a lesson was taught.
2. **Build Schedule:** choose the button, then explicitly enter an earliest start
   for unscheduled lessons or choose **Use selected date**. Select Whole course or
   an active unit, then **Preview Build Schedule**. Inspect counts, whole-course
   capacity, conflicts, complete BEFORE → PROPOSED arrays and assumptions. Existing
   saved dates never move. There is no scheduling Save/Apply/Confirm action.
3. **Horizon:** choose 2, 4 (default) or 6 calendar weeks. It starts at the calendar's
   selected/focus date and ends inclusively after weeks × 7 − 1 days, independent
   of today's real date. Select another day or navigate a period to explore historic
   or future fictional courses. The horizon is a display lens; it does not rerun
   scheduling or change the explicit Build anchor.
4. **Layers:** show/hide confirmed placements, the near-term tentative overlay and
   milestone summaries independently. Month and Week use the same forecast IDs.
   On mobile, compact ≈ tentative markers and accessible date labels lead to day
   details; selecting a lesson opens the same saved Lesson Planning record.
   Distant months do not receive a second grid of presumed fixed daily lessons.
5. **Return to saved-only:** choose **Saved-only view**, or Close/Cancel the Build
   proposal. Escape inside the outlook cancels and returns focus to Build Schedule.
   Saved-only restores confirmed placements and hides the other two layers.
6. **Try freshness:** change the start/scope to discard the old forecast, reload
   saved data, switch course or leave Calendar. A previous proposal is discarded.
   Opening an event Move/Keep proposal also discards Build state so two independent
   hypothetical changes are never presented as one combined schedule.

Preferences and previews live only in local module/UI memory. Course changes and
sign-out reset them. No localStorage, persisted forecast, schema or lesson store is
introduced; JSON export/restore and ZIP backups continue to contain saved records.

## Computation and limits

`build-schedule.js` contains a pure deterministic `buildSchedule(snapshot, config)`
and a separate `planningOutlook` display projection. Results reference canonical
lesson/unit IDs and date arrays, not copies of editable lesson records.
`planning-outlook-view.js` owns controls/review presentation; `calendar-view.js`
projects near-term IDs into the existing saved Month/Week calendar. The private
workspace dispatches Build before ordinary authoring submissions and has no new
REST/RPC mutation path. The existing event preview engine remains unchanged.

WORKING/OPEN policy:

- A valid teacher-supplied in-term start, saved term/weekday configuration, known
  full-day event availability, valid durations/order/relationships/revisions and
  an exact snapshot token are required. Unknown event allocation, reserved flex,
  malformed inputs, existing overlap/order conflicts and unresolved continuity
  block forecasting; they do not trigger automatic repair.
- All saved placement arrays are fixed, including ordinary confirmed dates.
  Pins remain a stronger commitment, conservatively protecting their entire saved
  array. Pin-span semantics remain open for future persistent scheduling.
- Only wholly unscheduled lessons receive new hypothetical arrays. They use the
  earliest eligible dates from the explicit start and canonical sequence cursor.
  No allocation crosses the next saved lesson's first date, or term end. A
  multi-day allocation is complete or wholly unplaceable; no shortened arrays.
- A partial saved multi-day array is retained with no completion guess. Unscheduled
  pins without their complete saved array need a reviewed initial-placement policy.
- Earliest ordered fit can satisfy a soft preference naturally. Otherwise the
  preference is disclosed as unmet, not treated as a reservation or reorder command.
- After unresolved work, later unscheduled work is not assessed. Later saved facts
  remain visible. Unit scope never hides whole-course capacity or commitments;
  unscheduled work outside scope can block a later unit's estimate.
- Unit estimates require every active lesson in the unit to have a complete known
  result. Otherwise display **cannot estimate**. Assessment dates distinguish saved
  references, protected anchors and unsaved estimates. Only daily hypothetical dates
  inside the selected horizon appear on the calendar; full arrays remain available
  in the opt-in impact review.

The exact token includes course, units, lessons and events, including content,
revisions and membership. Changed loaded inputs discard the forecast. Explicit
Reload discards it even if the read is identical. Unseen remote edits still need
server validation before any future write: a local token is not transactional
freshness. No Phase 2B implementation, migration or new Auth privilege is included.

## Fictional fixture outcomes

- A two-unit four-lesson case keeps Sep 14 and the protected Sep 21 assessment,
  proposes a two-day lesson Sep 15–16 and another lesson Sep 22, excluding a closure.
- An 80-lesson case with one saved protected lesson and 79 unscheduled lessons
  exercises near-term overlays versus distant estimated unit/assessment milestones.
- The fully scheduled 80-lesson fixture retains every saved date and adds no
  tentative dates. A synthetic six-unscheduled case with genuine holes may fill
  those holes from the explicit anchor; this is separate from the stored fixture.
- The previously approved stored 5-unit/80-lesson/12-event read fixture has six
  unscheduled lessons with no gap before the first following saved commitment.
  Build reports **74 confirmed / 0 tentative / 1 unplaceable / 5 not assessed**.
  All five complete unit ranges are **cannot estimate**. Whole-term spare capacity
  does not permit shifting teacher-established later placements. No initial dates
  are fabricated or applied to this stored course.

## Verification

Node runtime: desktop bundled Node 24.22.1. From the project root:

```sh
/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test app/tests/*.test.mjs
```

**85 tests passed, 0 failed/skipped**, including all 74 existing cases and 11 new
pure/projection/view cases. Covers frozen inputs, stable IDs/order/arrays, new and
partially unscheduled courses, explicit anchors, weekdays/closures/occupied/Keep,
full multi-day allocation, ordinary commitments/pins, capacity exhaustion, term
bounds, scoped dependencies, archives, revisions/stale snapshots, leap day/DST,
horizon filtering, known/unknown milestones, escaping and no persistence imports.
The existing VM dirty-guard harness now supplies the imported default preference
factory; its original assertions are unchanged.

```sh
NODE_PATH=/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
COURSE_PLANNER_CALENDAR_FIXTURE=app/reviews/calendar-event-effect-preview/stored-current-calendar.json \
/Users/aidevelopment/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node app/tests/calendar.browser.mjs
```

Desktop/mobile browser results: in progress. The complete existing suite is retained;
new small/80-lesson Build scenarios cover the three tiers, 2/4/6-week choices,
layers, explicit start/scope, stale configuration/reload/course switch, keyboard
focus/Escape, saved-only reset, no preview writes, same-ID navigation, unchanged
JSON exports, event-preview coexistence and honest stored incomplete input.

```sh
COURSE_PLANNER_REVIEW_DIR=app/reviews/build-schedule-outlook/existing-demo \
python3 app/tests/verify-demo-regression.py
```

**265 existing demo checks passed; 42 screenshots; 0 browser errors.**
`git diff --check` passes. No additional build/lint/typecheck script is configured.
Auth, JSON/ZIP/restore, authoring conflict, dirty guard and archive tests are retained.
The local browser substitutes only the Supabase SDK boundary; its intentional
save/restore regressions write to a fictional in-memory test client, never Supabase.

Hosted signed-in acceptance: pending the exact draft PR deployment/session.
No email requests, new Auth privileges, token copying or saved scheduling writes
are authorized by this issue. If an authenticated session is unavailable, report
pending; do not substitute a different branch's signed-in test. Any hosted read-only
acceptance must compare full saved-record signatures/counts before and after.

Evidence belongs only in Git-excluded `app/reviews/build-schedule-outlook/`:
local browser results, synthetic/stored fixture screenshots and existing-demo output.
No private snapshots, owner IDs or screenshots are committed or uploaded with the PR.

## Product questions for hands-on review

- Is four calendar weeks the useful default? Which layers should start visible,
  and should display preferences survive reload or be remembered per course?
- Should focused unit planning stop at unknown earlier work, or expose independently
  provable segments? What should a deliberate initial scheduling conflict repair do?
- Should ordinary confirmed placements be movable in a separately reviewed proposal,
  and should pins protect starts, selected dates or full multi-day spans?
- How should soft preferences, multi-day gaps/segmentation, partial periods,
  replacement activities, reserved flex and Extend affect allocation?
- Are reference/estimated unit ranges and assessment anchors enough distant context?

These require product review before any server-authoritative Phase 2B persistence,
transaction/serialization boundary, migrations, recovery journal or Undo work.
Nothing is merged or promoted by this draft prototype.
