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
