# Phone workspace foundation — Phase 1

Based on development `b19f6bc87eccde6306a0a8afc5864325a2155f39`.
CPD DEC-105–108 take precedence over the original supplied concept PNGs and
v0.2/v0.3/v0.4 interaction references. Reference files and their verified hash
manifest are ignored review evidence, not application assets or curriculum data.

At <=700px the rail becomes Navigate, controlled by a stationary bottom button.
The current-course selector is at its top and excludes the selected course.
The original authorized course list and its existing handler are reused. Course
changes preserve page-memory contexts and remain blocked by pending writes.
There is no new record or draft store, backend read/write adapter or persistence.

The primary planning surface owns vertical scrolling. Home has its own active
surface; Navigate and Open Views lock the background and own overlay scrolling.
Safe-area padding and the visual viewport adapt the layout to browser chrome and
keyboard resizing. Desktop placement and the desktop Inspector are unchanged.
Navigate supports outside dismissal, Escape, focus containment/return and an
inside-panel left swipe. No edge-open or global content gesture is installed.

Phone tabs remain in workspace state, with stable view IDs, DOM caches, histories
and raw drafts, but their strip is hidden. Open Views reuses existing selection
and guarded close paths; Back/Forward operate on the selected view's own history.
The same toolbar control toggles Open Views. New View invokes the existing
launcher. No inactive Search or More controls are shown. Existing manual-save
status, acknowledgement/readback semantics and unknown-create protections remain
real; no prototype autosave label or fictional record is imported.

This basic switcher deliberately does not implement finger-following sheet
handles, expanded Search, card grips/reordering or contextual More. DEC-108's
no-grips/direct-card reordering and finger-following sheet direction remain future
requirements; this Phase 1 does not claim those interactions are complete.

Tests use fictional fixtures and actual visible phone controls. Old phone strip
geometry/keyboard interactions are replaced by Navigate/Open Views expectations;
desktop compression and all data/draft/history/save assertions remain. Dynamic
viewport and drawer-entry tests await measured geometry, never arbitrary delays
or force clicks. The historical PR #21 teacher-refresh timeout remains unresolved;
passing current checks does not establish a root cause or resolve that observation.

Run `node app/tests/qa.mjs --full`. Physical iOS Safari/Android, screen readers,
real keyboard/chrome behavior and authenticated hosted acceptance remain separate
owner acceptance gates. No auth email, protected preview access, CPD/workbook
change, production deployment or merge is authorized by this implementation.

## DEC-106 Home clarification

On phones, the primary menu labels the global Dashboard destination Home.
The existing Overview row moves into the Current course section as Course summary,
using the same guarded navigation/new-view paths and selection authority. It is
not a second Home. Home and summary selection remain mutually exclusive. Desktop
labels, row placement and behavior are restored unchanged at the breakpoint.

## Overlay capture and selector reset

Phone review captures await actual drawer entrance/exit bounds and a fully visible,
unobscured Open Views panel above the toolbar. The prior partial drawer image was
a transition-time capture; settled baseline geometry showed it fully hidden.
Closing Navigate now collapses its course dropdown, including Escape, same-button,
swipe and navigation closures. The selector has a subtle expanded-state chevron.
Open Views is anchored above the measured toolbar height, avoiding fractional-pixel overlap from a fixed bottom offset.

## Owner-authorized phone sheet architecture correction

Real iPhone acceptance rejected the desktop finder/input and launcher reuse. Phone
Views and New now use a separate sheet presenter. Desktop keeps its original
finder. Sheets initially focus their pull handle, contain no search input, have
one list scroller and lock the background through animated dismissal. The handle
tracks downward pointer motion, snaps back below threshold and animates offscreen
above threshold. Native normal list swipes do not initiate reordering.

Views cards derive titles, previews, dirty/active state and IDs from workspace
state. Touch long-press (420ms) activates direct-card dragging with sibling motion;
Alt+Up/Down supplies an announced keyboard alternative. The existing tab store's
move operation retains view objects, selection and histories. Opening New creates
nothing; choosing a destination uses guarded navigation. No record/store copy,
autosave, unrelated Search/More feature or Auth/configuration change is added.
Animation waits and rendered geometry are tested in Chromium emulation. iPhone
Safari browser chrome, keyboard dismissal, scrolling/rubber-banding, long-list
edge dragging and VoiceOver still require real-device owner acceptance. Earlier
Phase 1 deferrals concerning these specific sheet/reorder interactions are now
superseded by this owner's explicit correction request; other deferrals stand.
The toolbar has an explicit higher stacking layer than sheets, so a downward pull passes beneath its fixed boundary rather than covering its controls.

## DEC-109 / OPS-085 follow-up

Open Views scrolls only its list during an active card drag near a vertical edge.
A frame loop uses elapsed time and stable layout geometry; release, cancellation,
sheet reset and leaving the edge stop scrolling. Drag sorting commits to the same
live per-course tab store used on desktop, with no persistence or synchronization.
Guarded card closes keep the sheet open, redraw remaining cards, retain list scroll
and place focus on the adjacent close control. Cancel and failed saves retain the
view. Closing a view never deletes its curriculum record. A restrained caption
explains full-card long-press dragging; no grip or unrelated UI is introduced.
Physical iPhone Safari acceptance remains required.

## DEC-110 shared sheet positions

Open Views and New share compact-first viewport geometry, independent of item
count. Compact uses 44% of the available sheet area; a common type-scaled chrome
floor preserves controls in short viewports, clamped to available space. Expanded
uses the available height above the measured toolbar, below the app header.
The handle follows upward height changes and downward compact dismissal. One
downward gesture from expanded returns to compact; short/canceled gestures return
to the prior position. Tap/Enter/Space toggles, Up expands, Down compacts or
dismisses, and Close/Escape dismiss. Reduced motion skips settling animation.
Viewport/toolbar resize recalculates the selected position without rebuilding
content or workspace state. Only the sheet list scrolls. Heights and thresholds
remain owner-calibration choices; physical Safari testing is still required.
The generic sheet-positions module owns no records, views or persistence.
