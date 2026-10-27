# Build Schedule and planning outlook — Phase 2A.5

Issue: https://github.com/jmichaeldinardo-spec/Course-Planner/issues/5

Baseline: `pilot/app-foundation` at `54870b700564cfa65ebc9087fbfb8e330e1a6fcb`.
Feature branch: `codex/build-schedule-outlook`.

Read CPD tabs 03 Product Architecture, 05 Pilot & Roadmap and 08 Research & Open
Decisions, plus DEC-031/032 in the decision history, through the verified designated
collaboration Google connection. No school account or canonical document changes.
The adopted direction is one dataset and revisable three-tier presentation; the
allocation rules below are WORKING/OPEN prototype choices, not approved 2B policy.

## Review follow-up: try both hosted scenarios

The [independent review](https://github.com/jmichaeldinardo-spec/Course-Planner/pull/6#issuecomment-6430696164)
identified that the existing saved course correctly cannot produce positive
forecasts. A temporary, immutable fictional success scenario now lets the teacher
experience those forecasts without changing that comparison course or Supabase.

Use the existing signed-in session at the **exact app preview**:
https://course-planner-app-git-codex-build-schedu-45cd1a-course-planner.vercel.app/
Refresh once to load this update. No new sign-in email or Auth change is required.

### A. Positive fictional scenario — no saved data

1. Open any existing saved fictional course → **Calendar & Exceptions** →
   **Try sample Build Schedule**. The workspace changes to **FICTIONAL SUCCESS
   SCENARIO · IN MEMORY · NOT SAVED** and the banner says **NOT your saved course**.
   It contains 12 immutable sample lessons, three units and three sample events;
   it is never added to the saved course list. Shared “saved/confirmed” labels in
   this context mean fixture reference dates only.
2. In the already-open Build configuration, choose **Use selected date
   (2026-09-01)**, leave **Whole course**, then **Preview Build Schedule**. The
   deliberate explicit anchor is still required. Expect **4 confirmed fixture
   lessons / 8 tentative / 0 unplaceable / 0 not assessed**; capacity is 52 eligible
   dates, 15 required lesson-days, four fixture reference assignments and 11
   hypothetical day assignments. There is no scheduling Save/Apply/Confirm.
3. Inspect September's dashed **≈ Tentative · unsaved** overlay and select
   **September 3**. Lesson 3 spans **September 3–4** in BEFORE → PROPOSED; lesson 6
   spans **September 11 and 14** across the weekend. The September 7 closure and
   September 15 occupied event are skipped. The shortened September 3 Keep event
   retains instruction. The protected September 10 checkpoint stays fixed.
4. Expand **Tier 3 · Distant milestones**. Estimated unit ranges are **September
   1–8**, **September 10–17**, and **October 19–23**. The checkpoint is a protected
   fixture anchor; the October 23 assessment is an unsaved estimate. The September
   1 four-week daily lens excludes October proposals, while its distant milestone
   remains inspectable. Choose **Next calendar period** and **October 19** to see
   tentative October 20–23 dates in that new focus window.
5. Try **2/4/6 calendar weeks**, layer toggles, **Month / Week**, and date-keyboard
   navigation. On mobile select a day marked **≈** for details. Any sample lesson
   link opens a **fictional, read-only reference** with the same fixture ID, never
   the private lesson editor. Scope/start edits discard the old forecast and may
   honestly make a scoped scenario incomplete; **Reset sample** restores the
   known positive baseline, blank anchor, September 1 and default layers.
6. **Close Build preview**, **Cancel Build Schedule**, or **Escape** discards
   the proposal but keeps the sample. Escape again returns to the saved course.
   **Return to your saved course** always exits in one click, restoring its cursor
   and display preferences with no sample proposal. A saved-course reload/switch
   or sign-out also exits the sample. No sample state survives a page reload.

### B. Constrained saved 80-lesson comparison

1. Choose **Return to your saved course**. In Saved courses open **Large Restore
   Test — Fictional Civic Systems (80 lessons) (restored)** and select **Calendar
   & Exceptions**. Verify the private saved workspace header and **80 lessons /
   five units / 12 events**. Leave this course unchanged.
2. With its initial **September 9, 2026** calendar focus, choose **Build Schedule**
   → **Use selected date** → **Whole course** → **Preview Build Schedule**.
3. Expect **74 confirmed / 0 tentative / 1 unplaceable / 5 not assessed** with six
   already-unscheduled lessons. All five complete unit ranges **cannot estimate**.
   The first unscheduled lesson cannot fit before the next saved commitment even
   though the whole term has spare capacity. All 74 saved arrays and pins remain
   fixed, and the enabled tentative layer produces no invented dates.
4. Expand all 80 BEFORE → PROPOSED comparisons, try horizon/layer controls, then
   **Close Build preview** or **Saved-only view**. No saved record changes occur.

### Isolation and removal boundary

`build-sample.js` constructs and recursively freezes a small hardcoded fixture;
there is no owner snapshot input, editable lesson store, persistence import,
localStorage, Supabase call or new schema. `private-workspace.js` selects it only
as the read-only calendar/engine input while leaving all canonical owner record
variables untouched. `activePrivateCourseId()` remains the owner course ID.
Sample lesson links show reference details; ordinary authoring/export/event
controls are absent, and an explicit submit guard rejects stale authoring forms.
The same `buildSchedule`, `planningOutlook`, outlook renderer and Month/Week
renderer run both scenarios. Return/reset need no network fetch; an authoritative
owner refresh safely exits the fixture. The entry and fixture can be removed
without migrating records. This is a review aid, not new scheduling policy.

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

## Success-sample regression evidence

Current follow-up: **89 Node tests passed**, including all 85 earlier cases and
four fixture/engine/projection/view regressions. **545 full app browser checks
passed** across 1440px and 390px, including the approved stored 80-lesson snapshot;
**91 final focused sample checks passed**, including 44px reset/return targets.
Both browser runs had zero uncaught errors. The full run contains the original
461 checks plus the initial sample checks; the focused run adds two touch-target
assertions. **265 existing demo checks passed**, 42 screenshots, zero errors.
`git diff --check` passes; no additional build/lint/typecheck is configured.

Sample checks cover the successful 4/8 outcome, complete multi-day arrays,
protected/estimated assessment distinction, October milestones/horizon isolation,
layer/lens/scope controls, Month/Week/mobile details, same-ID read-only references,
Reset/Return/Close/Cancel/Escape, owner preferences/identity restoration, stale
ordinary-form rejection, owner export and authoritative-refresh exit. Test-client
reads/writes are counted: sample enter/exploration/reset/return performs **zero
reads and zero writes**; owner records remain byte-identical. The intentional
stale-form probe runs only in the local mock harness, never the hosted account.

New local evidence is Git-excluded under
`app/reviews/build-schedule-outlook/sample-success/`: `node-tests.txt`,
`full/browser-results.json` (545), `final-sample/browser-results.json` (91),
desktop/mobile screenshots and `existing-demo/` results. The existing private
snapshot is reused read-only; no new full saved-record export was needed.
Hosted verification of this sample update will be recorded after the draft
branch preview finishes deploying. Earlier hosted evidence below is historical.

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

**461 full desktop/mobile browser checks passed, 0 uncaught errors.**
A final focused outlook run passed **161 checks**, including Escape with focus on
calendar controls outside the configuration panel. The complete existing suite is retained;
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

## Draft preview and hosted acceptance

Draft PR: https://github.com/jmichaeldinardo-spec/Course-Planner/pull/6

Exact app branch preview:
https://course-planner-app-git-codex-build-schedu-45cd1a-course-planner.vercel.app/

Application commit: `32bc761f20e18c500950f633b9e34ca7020cfa75`.
GitHub app-tests and Vercel preview checks pass. Vercel deployment
`dpl_6JudDHj3iNX2dkkBckEujmeFmeVP` is READY on that branch/commit, with the exact
branch alias above, no alias error and preview target (not production).

### Hosted signed-in read-only acceptance — completed October 26

**50 hosted checks passed, 0 captured browser errors**, using the existing
shared-project account session on the exact PR #6 origin. Tested head:
`b722a7e9e3cafc58ed3ca7b447b4ef9f79db4e74`; its application code is identical to
`32bc761f20e18c500950f633b9e34ca7020cfa75`. This follow-up changes only the report.
The earlier browser/authentication blocker is resolved. The exact redirect had
been added separately with explicit user approval, preserving the Site URL and
all three earlier redirects. No email, Auth setting change, session/token copying,
new saved fixture or restore was performed during this acceptance run.

Verified on the hosted app at desktop (1440px) and mobile (390px):

- Exact-origin shared-project sign-in and three unique saved-course buttons,
  including after authenticated reload; no duplicate rendering.
- Three distinct textual certainty tiers; planning status and taught-date
  assumptions remain separate. Default four-week horizon starts at the historical
  selected Sep 9 date, not today's date. 2/4/6 weeks and changing focus update the
  display window while the explicit Build anchor stays unchanged.
- Explicit initially blank required start, deliberate Use selected date action,
  focused configuration/result headings, and no scheduling Apply/Save/Confirm button.
- Whole-course Build reports **74 confirmed / 0 tentative / 1 unplaceable / 5 not
  assessed**, with six already-unscheduled lessons. All 80 BEFORE comparisons
  remain available; all 74 saved arrays, six protected commitments and saved
  multi-day arrays are retained. No hypothetical date is fabricated.
- Capacity stays whole-course: 93 eligible dates, 92 required days, 86 saved
  assignments and seven unused eligible dates. The first unscheduled lesson still
  cannot fit before the next saved commitment; distant spare capacity is not
  permission to move teacher-established placements.
- All five unit ranges and unscheduled assessment anchors explicitly say cannot
  estimate. Confirmed/tentative/milestone toggles work reversibly; hidden saved
  placements still constrain the proposal. The impossible baseline produces no
  tentative overlay even when that layer is enabled.
- Unit-scoped Build retains 80 comparisons and whole-course capacity. Start/scope
  edits discard older results. Explicit reload discards configuration and proposal
  after its asynchronous read completes; the driver waits for that completion.
- Course switch resets preferences and discards forecasts. Returning to the
  80-lesson course brings no stale proposal. Same-ID calendar navigation opens the
  saved lesson editor without editing, and leaving Calendar discards Build state.
- Close, Cancel and Escape (including with focus on the calendar) discard Build
  and restore focus. Saved-only restores confirmed placements and hides the other
  layers. Existing event Keep preview remains functional and separate from Build.
- Month/Week, seven-day Week, keyboard date focus, mobile saved markers and pin
  accessible labels, 44px Build target and no horizontal overflow. Temporary
  browser viewport overrides were reset to the user's normal viewport.

**No saved records changed.** Before/after SELECT-only READ ONLY transactions,
using matching-owner authenticated RLS with UTC and ROLLBACK, returned identical
full-record signatures and counts for **3 courses, 7 units, 82 lessons and 12
calendar events**. No create, edit, delete, archive, restore or scheduling write
was performed. These signatures cover public course records; normal SDK session
refresh is not a scheduling write.

Historical scope limit (resolved by the temporary sample above): the stored
incomplete course cannot demonstrate positive tentative dates/estimated unit
ranges under the conservative fixed-saved-date policy. No live records were
changed to manufacture a success case. Unseen remote-edit
freshness and scheduling transactions remain future Phase 2B requirements.

Evidence stays Git-excluded under `app/reviews/build-schedule-outlook/`:
full browser-results.json (461 checks), focused-final-summary.json (161 checks),
node-tests.txt, synthetic fixture screenshots and existing-demo output. The
`hosted-acceptance/` subfolder contains results.json (50 hosted checks),
saved-record-signatures.json and desktop/mobile captures. No private record IDs,
owner IDs, authentication tokens or screenshots are committed/uploaded with the PR.

PR #6 remains draft against `pilot/app-foundation`; no merge or promotion. No database/schema or Auth configuration changed in that acceptance-only follow-up.
The later sample implementation is described above.

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
