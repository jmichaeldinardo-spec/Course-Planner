# Stage B — functional central tabs

Stage B builds on merged Stage A and DEC-100 at
`04e16296178916ba3ce118f41d71967cb5b05838`. Feature branch:
`codex/central-tabs-stage-b`; draft PR targets `pilot/app-foundation`.

Authority: CPD DEC-054, 055, 056, 062, 064, 067, 084, 085, 092, 099 and 100,
plus the owner's explicit Stage B implementation request. The current
[Canonical Product & Development Record](https://docs.google.com/document/d/1IAvhZsR6o6-hDQyEjAMz-lxy_gCZMJdke6vosMBK4K0/edit)
was read through the verified collaboration account. The CPD was not edited.
Page-memory arrangements and manual Save are the temporary DEC-099 boundary.

## Teacher behavior

- Home remains global. Continue Planning restores the course workspace, tabs,
  selection, drafts and view positions.
- A sidebar destination replaces the selected tab. Its adjacent ↗ action opens
  and selects another populated tab. Record directories and Sequence also offer
  an explicit ↗ action for a separate Unit or Lesson Plan view.
- **+ New Tab** opens an empty launcher. It creates no curriculum record. Closing
  the final tab leaves a blank tab in that course. Recently closed views can be
  reopened from the launcher.
- Unit Planning is a directory; Lesson Planning is searchable. Individual plans
  occupy the central pane. Calendar retains contextual lesson editing in the
  Inspector so selecting a lesson need not replace the grid.
- Duplicate lesson views share their saved record and raw unsaved draft. A dot
  marks unsaved work. Duplicate views have live titles and View 1 / View 2 suffixes
  in their full labels/tooltips and Open Tabs finder.
- Leaving the last open view of a dirty record offers **Save and Continue**,
  **Discard Changes**, and **Cancel**. Replacing/closing one duplicate preserves
  the draft while another current view holds that record. Back/Forward uses the
  same protection. Hiding or reopening the Inspector does not discard work.
- Save remains manual and revision checked. Failed/conflicting saves retain the
  draft. Text typed during a pending save remains unsaved after acknowledgement.
  View changes wait during a write; Home/Continue remain available.
- Each course keeps its own arrangement. Account changes clear all arrangements,
  DOM contexts and drafts; an old async response cannot restore them.

## Architecture and changed files

`workspace-state.js` remains the sole saved-record and draft authority. It keeps
immutable saved snapshots, account/generation-scoped references, raw drafts,
optimistic revisions and the existing serialized save coordinator. Stage B adds
record-scoped discard and a distinct temporary `draftId` for every uncreated plan.
Only a successful create acknowledgement promotes that reference to a canonical
record ID. Two canonical lesson references still address one shared draft.

`workspace-tabs.js` stores presentation metadata only:

```text
account generation
  course ID -> tabs[], selected view ID, recently closed[]
    view ID -> history[], current history index
      entry ID -> destination { kind, table?, recordId?, draftId?, date? }
```

View IDs, history entry IDs and temporary draft IDs are distinct from curriculum
IDs. Histories are bounded to 50 entries per view; recently closed metadata is
bounded to 10 views per course. Opening, navigating, closing and reopening views
never calls a database write. Cross-course destinations are rejected.

`private-workspace.js` adapts these destinations to the existing renderers and
save/read/export paths. Its entry-ID cache holds presentation/DOM, scroll, caret,
disclosures, calendar/preview preferences, search and Inspector state. It contains
no copied canonical row arrays. Restored forms receive the current shared saved
values and raw draft; directories and record choices are refreshed from that
same saved snapshot. Separate history entries have separate DOM projections.
Shared drafts are checked before replacing, closing or travelling in a view.
Create acknowledgement promotes only matching temporary destinations.

`workspace-tab-view.js` renders the strip, controls and launcher.
`workspace-shell.js` adds explicit sidebar new-tab actions and maps individual
plans to their directory's sidebar context. `workspace-navigation.js` extends the
existing navigation policy with record-scoped decisions. `workspace.css` adds
scoped tab/directory/dialog layout and preserves the mobile Inspector sheet.

Tests: `workspace-tabs.test.mjs` adds six state/identity tests;
`central-tabs.browser.mjs` adds a scenario to the existing browser runner.
`calendar.browser.mjs` retains scheduling/export/restore assertions and updates
old Inspector-only/native-confirm expectations to the approved central editors
and explicit navigation dialog. `persistence.test.mjs` supplies the real tab model
to its existing VM harness. `qa.mjs` includes the new scenario in normal smoke
and full runs. README and DEC-100 documentation link this behavior and procedure.
No additional framework, runtime dependency or backend store is introduced.

The destination/ref/view/entry separation leaves room for later pane assignments,
groups or serialization without making them curriculum records. Those features,
durable restoration and autosave are not implemented here.

## Keyboard and narrow screens

Tab through native controls. On a focused tab, Left/Right select adjacent views,
Home/End select the first/last view, and Delete closes the focused view with the
same dirty protection. Under DEC-102, the strip compresses horizontally and keeps the selected
tab visible without moving the document. At extreme counts the counted Open Tabs
finder provides access to views outside the bounded strip. Open Tabs searches the current course's open
views by title, unit, view type or course; Down/Up move among results and Enter
selects one. Escape closes the finder or cancels a navigation decision.

At narrow widths the existing sidebar rail and dismissible modal Inspector remain.
Expand the sidebar to expose its explicit ↗ actions. The launcher and Open Tabs
finder provide alternatives to a crowded strip. Broader mobile refinement is
reserved for Stage C and owner review.

## Repeatable verification

With the already documented test tooling installed, run from the repository root:

```sh
node app/tests/qa.mjs --full
```

For ordinary changes and CI, `node app/tests/qa.mjs` runs Node plus the synthetic
smoke fixtures, including `central-tabs`, at desktop and mobile widths. No login
or hosted account is needed. The existing workflow uses that command on Node 22.

The focused browser scenario checks sidebar replacement, explicit populated tabs,
blank/final close/reopen, shared saved/draft values, Inspector visibility, caret,
independent histories/search/scroll/calendar position, finder/keyboard behavior,
Save and Continue, rejection/retry/conflict, cancel/discard/close, distinct
uncreated unit/lesson references, create promotion with newer typing, updated unit
choices, inactive-draft export protection, course arrangements, Home/Continue,
account isolation and delayed old-account responses. The full existing matrix
also checks JSON/ZIP/restore fidelity, stable IDs, pagination through 2,000 lessons,
scheduling previews, archived records, Dashboard and full-page save/refresh.

The unchanged public-demo regression remains separate:

```sh
python3 app/tests/verify-demo-regression.py
```

Set `COURSE_PLANNER_REVIEW_DIR` to a new ignored evidence folder when retaining a
fresh demo run. All browser profiles and records are disposable fictional fixtures.
Reports explicitly identify synthetic testing and **authenticated hosted: NOT RUN**.
Final local verification: **139/139 Node tests**, **1,027/1,027 synthetic browser
checks in 37 fixture/viewport cases**, including **82 Stage B assertions**, with
zero uncaught browser errors. The unchanged public demo passed **265/265 checks**,
42 screenshots, zero browser errors. The full run retained 79 screenshots.
Exact source identity, logs and screenshots are retained in ignored project-local
evidence. Screenshots and local runtime state are not committed.

## Owner usability review

1. In a fictional course, click five sidebar destinations. Judge whether replacing
   one selected tab is understandable. Use ↗ for Calendar and a Lesson Plan and
   compare the resulting arrangement.
2. Use + New Tab, its launcher and Open Tabs. Judge labels, density, active-tab
   visibility, finder wording and the distinction between opening a view and
   creating a record.
3. With disposable fictional fixtures, open one lesson twice; edit an objective
   and switch views. Review whether shared draft/duplicate labels are clear.
   Compare Cancel, Discard, Save and Continue, closing a duplicate and closing the
   last holder. Save/create review requires disposable fixtures; keep the owner's
   four hosted acceptance courses to read-only navigation.
4. Compare independent Back/Forward, Calendar positions, directory searches,
   hidden/reopened Inspector, Home/Continue and switching courses.
5. Try keyboard navigation and a phone-width screen. Judge reachability, readable
   labels, central editor space and whether the contextual sheet feels coherent.

Technical success does not approve the appearance, workflow or planning experience.
Those judgments remain explicitly with the owner.

## Limits and boundaries

Arrangements, histories and drafts last only for this page. Save before refreshing
or closing the browser. A refresh intentionally starts a fresh arrangement.
There is no autosave, split pane, manual group, cross-course comparison, durable
workspace persistence or Stage C implementation. Many open views retain DOM in
memory; automatic eviction of open drafts is deliberately absent. Visual title
truncation can occur; the finder and full accessible labels provide the full name.

The existing conservative reload policy refuses to rebase while other plans in
the course remain dirty. Save or explicitly discard those plans first. Individual
Calendar interactions retain the existing discard/cancel confirmation policy.

Synthetic owner filters, sessions and conflicts exercise application behavior;
they do not validate real Supabase Auth/RLS, network durability or independent
account security. No hosted authentication setup or owner-course writes ran.
Supabase/schema/Auth/RLS/grants, security PR #16, optional hosted PR #18, production,
main, marketing, Google Sheets and Apps Script remain outside this change.

## DEC-101 usability refinements

Individual Unit Plans now show **Lessons in This Unit**, ordered by saved sequence
position with title, status and archived metadata. A title opens the canonical
Lesson Plan in the selected tab; ↗ opens another populated tab. Existing dirty-unit
Save/Discard/Cancel protection applies to replacement. Empty units explain that
there are no lessons yet. Unit editing is unchanged.

Lesson Planning starts with a native **Unit** selector: All Units or a saved unit.
Text search applies within that selection. Both controls are independent per-tab
presentation state, preserved through history, Home and course switching. Filtering
never changes saved order or membership. Planning directories retain archived
records as before (now labeled Archived); Calendar keeps its existing active-only
rules. No new archive workflow is introduced.

For owner review, open a Unit Plan, compare title-click versus ↗, and cancel a
replacement with an unsaved unit edit. Open two Lesson Planning tabs, select
separate units and search terms, then switch between them. Check an empty unit
and a search with no matches on desktop and a narrow screen. Closing the last tab
still leaves the existing blank launcher; global Home remains in the sidebar.
Use disposable fictional fixtures for save review. The four hosted courses were
not accessed by automated verification.

## DEC-102 compressing tabs — proposed overflow treatment for owner review

Tabs share one row and shrink from a 180px preferred width (260px maximum).
Titles ellipsize while full names remain in accessible labels, tooltips and the
Open Tabs finder. Selection, close actions, unsaved dots, + New Tab and keyboard
arrows/Home/End/Delete retain their existing behavior. There is no horizontal
scroll container or programmatic strip scrolling.

Below an approximately 80px desktop / 100px narrow-screen tab budget, further
compression would crowd close controls and titles. The demonstrated treatment
therefore shows a contiguous window in unchanged tab order around the active tab.
The active tab always remains in the strip; a counted Open Tabs control reports
how many views are outside it. The finder lists **every** open view with full names
and unsaved status. Select any result to bring that view into the strip. Each finder row also has
a close control, using the same unsaved-work guard without selecting that view. Arrow keys and Home/End also reach views outside the
current window. No tab is closed, reordered or removed from navigation history.
Resizing the pane recalculates the visible window.

Tradeoff: narrow screens enter this treatment earlier and may show only one tab.
Comparison of several labels then requires the finder rather than simultaneous
strip visibility. No tabs are permanently inaccessible; the finder may scroll
vertically through its complete list, while the tab strip never scrolls. This is a
scoped overflow proposal for owner visual/usability review, not Stage C approval.
Density screenshots demonstrate 3, 6, 10 and 40 tabs on desktop and narrow widths.

## DEC-103 / DEC-104 final Stage B refinements

Individual Unit Plans, Lesson Plans and their creation views no longer show the
prominent generic Add action. Intentional creation remains available in planning
directories, Course Sequence and the unchanged New Tab launcher. The actual Create
form action remains; insertion positions and sequence policy are unchanged.

The Inspector starts closed, stays closed on new destinations, and closes when
activating another tab or restoring a course workspace. Non-Calendar views have
no generic Inspector opener. Calendar retains its explicit Inspector/details,
date, event, lesson and Build Schedule actions. Those actions may open contextual
presentation; switching away closes it. Returning to a Calendar tab retains its
grid, position, selected date, preview state and drafts but leaves the panel closed
until an explicit Calendar action opens it. Existing explicit Calendar context is
not collapsed merely by a background saved-data refresh. Hidden Inspector inputs
are not focused when restoring a view. Manual saves and all canonical/draft stores
are unchanged.

Owner review: compare directory Add controls with individual/creation views. Open
Calendar details and Build Schedule explicitly, switch to another tab and return.
Confirm the panel stays closed until requested, the Calendar position is retained,
and central plan editing has more space. Repeat on a narrow screen. Technical
checks do not approve appearance or usability; Stage C remains out of scope.
