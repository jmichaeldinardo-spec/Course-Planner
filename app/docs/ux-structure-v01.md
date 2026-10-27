# Course Planner — UX Structure v0.1

Implements the owner's October 26 presentation proposal in draft PR #6. This is
an interface revision of the existing read-only prototype, not Phase 2B policy.

## Workspace structure

- A persistent neutral sidebar provides Course Sequence, Unit Planning, Lesson
  Planning and Calendar. The course menu is at the top; Settings is at the bottom.
  Desktop navigation collapses to labeled/tooltip icons. Narrow navigation starts
  as icons and can expand into a drawer. Switching courses retains dirty-edit
  confirmation and uses the existing owner-scoped course list and stable IDs.
- The center holds the current canonical sequence/unit list or Month/Week calendar.
  Its toolbar has one primary action: Add unit, Add lesson or Build Schedule.
  Course export/reload live in Course actions; account creation, backup and restore
  remain available in Settings. The old illustrative demonstration is available
  under its own collapsed disclosure below the real workspace.
- Selecting a lesson/unit opens the existing canonical authoring form in the
  inspector without replacing the central list or navigating away from Calendar.
  Selecting a date opens day details. The inspector can close and resize using a
  keyboard-operable Width slider. Closing returns focus to the original date,
  lesson or unit. Existing revision checks, failed-save retention and dirty guards
  remain active; errors and unsaved status are visible inside the inspector.
- On narrow screens the inspector is a dismissible modal detail sheet. The center
  and sidebar are inert while it is open, Tab stays inside it, and dismissal
  restores focus without changing the central scroll position. Explicitly hiding
  the desktop inspector releases its column; normal detail changes retain it.

## Build and calendar interaction

Build Schedule opens a focused inspector form. An explicit start and scope remain
required. Preview uses the same deterministic Build engine and overlays the
existing calendar. The outcome starts with ordinary language (for example,
**8 lessons placed; 0 need attention**) and an unsaved notice. Configuration becomes
an expandable summary after calculation. Conflicts, whole-course capacity, full
BEFORE → PROPOSED arrays and assumptions are under **More details**.

The calendar grid and date buttons are reconciled in place when overlays or
selection change. The primary pane and document scroll positions are retained;
focus changes use `preventScroll`. Build never selects a date or navigates to a
month implicitly. **Close Build preview**, Cancel and Escape restore the view,
selection and primary scroll captured before opening that proposal. Intentional
period/date navigation remains available while exploring a preview. **Review
preview** reopens its inspector without rebuilding or changing the explicit anchor.

The inspector's close button hides details while retaining the tentative overlay;
**Close Build preview** actually discards the proposal. This distinction lets a
mobile teacher inspect the existing calendar. Explicit Saved-only also discards
the proposal. Leaving Calendar, reloading saved records, changing configuration,
course changes and sign-out retain the existing invalidation boundaries.

Display options contain 2/4/6-week lenses and reversible certainty layers. Compact
calendar entries have small unit markers, tentative indicators and protected-date
labels. Tier 3 retains estimated/saved unit ranges, assessment anchors and honest
cannot-estimate states. Scheduling diagnostics and unscheduled-record analysis are
available under **More details · Calendar diagnostics** in the date inspector.
Existing Move/Keep event forms and analyses also live in the inspector; Extend
remains disabled. The event engine and fixed-saved-placement policies are unchanged.

## Appearance and isolation

Dark is the default, with neutral charcoal surfaces. Settings offers Dark/Light
and Sage/Blue/Violet/Amber accents. Typography, spacing and a quiet selected state
carry hierarchy; unit colors remain small markers. Appearance, collapse, width and
inspector state exist only in page memory and reset on reload. They do not change
Auth configuration, course fields or storage. Settings moves the existing account
DOM node rather than duplicating forms, listeners or course lists.

The immutable success fixture remains explicit and separate. Its records never
replace canonical owner variables, gain editing/export routes or reach Supabase.
All four saved planning workspaces, authoring, authentication, JSON export/restore
and ZIP backup remain available. No migration, scheduling write, merge or production
promotion is part of this revision.

## Try both scheduling scenarios

Use the existing signed-in session at:
https://course-planner-app-git-codex-build-schedu-45cd1a-course-planner.vercel.app/

1. Open Calendar in any saved fictional course → Try sample Build Schedule →
   Use selected date (2026-09-01) → Preview Build Schedule. Expect **4 confirmed
   fixture lessons / 8 tentative / 0 unplaceable / 0 not assessed**. Inspect the
   existing September calendar by closing the inspector's ×, then select Sep 3
   for a read-only same-ID multi-day reference. Review preview → More details
   shows all 12 comparisons. Expand Tier 3 for unit estimates Sep 1–8, Sep 10–17
   and Oct 19–23. Reset sample restores its baseline. Return to your saved course
   exits the fixture in one click.
2. Open the saved **Large Restore Test — Fictional Civic Systems (80 lessons)
   (restored)** using the sidebar course menu. Calendar → Build Schedule → Use
   selected date (initial Sep 9) → Preview. The inspector says **0 lessons placed;
   6 need attention**. More details retains **74 confirmed / 0 tentative /
   1 unplaceable / 5 not assessed**, all 80 comparisons and fixed saved dates.
   All five complete unit ranges cannot estimate. No dates are fabricated.
3. Try icon navigation, course menu, all four destinations, same-ID lesson/unit
   inspectors, Width/close, dark/light/accent settings, Month/Week, display options,
   preview cancellation and mobile dismissal. Authoring Save still applies only to
   ordinary existing lesson/unit details; scheduling has no Apply/Save action.

## Verification

Local results on the completed implementation:

- **92 Node tests passed**, retaining all 89 prior tests and adding three surface/
  progressive-disclosure regressions. No failures or skipped tests.
- **625 full application browser checks passed** at 1440px and 390px, zero uncaught
  errors, including all previous fictional/stored-fixture scenarios and 78 UX
  assertions. Tests cover actual calendar/date node identity, retained vertical
  position/primary/document scroll, explicit selection and close restoration,
  desktop resizing, mobile modal/inert/keyboard focus behavior, navigation drawer,
  theme/accent choices, same-ID canonical editors, positive/blocked scheduling,
  dirty-editor retention during display changes/Auth refresh, Escape confirmation,
  relocated account forms/sign-out and the separate illustrative demo.
- All archive filtering, saved authoring/reload/conflict protection, unchanged
  saved date arrays, JSON export/restore and ZIP backup checks remain in the full
  browser suite. Test writes use a mocked fictional client; no Supabase mutation.
- **265 existing standalone demo checks passed**, 42 screenshots and zero browser
  errors. `git diff --check` passes. No additional build/lint/typecheck is configured.

Evidence is Git-excluded under `app/reviews/ux-structure-v01/`: `node-tests.txt`,
`full-final/browser-results.json` (625 checks), desktop/mobile captures and
`existing-demo/` output. The focused preservation run passed 175 checks; the
focused UX run passed 83 including the shared empty-course checks. Private read
fixtures and record signatures are never committed.

Hosted read-only acceptance will be recorded after this draft preview deploys.

## Remaining product choices

- Should appearance, collapsed navigation and inspector width persist per browser
  or per account? This iteration deliberately adds no persistence.
- Which inspector fields and milestone summaries are the most useful defaults?
- Should the inspector's close control say Hide on narrow screens to distinguish
  hiding details from closing a scheduling proposal?

All earlier scheduling questions remain open: movement of ordinary saved dates,
pin spans, partial periods, continuity, reserved flex, soft preferences and Extend.
