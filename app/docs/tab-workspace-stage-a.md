# Central workspace Stage A — shared state and navigation

Engineering decision record, October 28, 2026. Authority: CPD DEC-099,
with DEC-049 recovery, DEC-097 autosave and the DEC-098 restricted fictional-data
security exception remaining separate. This proposal targets `pilot/app-foundation`
at `462986e099f90563cb0a5f7f90c9d5a3379bb17d` (tree
`771fdf336971c7326cbcb1cf7cbe50e0fac139df`). No Stage B UI is included.

## Problem and resulting behavior

Previously, `private-workspace.js` kept saved arrays, a dirty flag, selection,
Inspector state and DOM nodes together in each cached course context. Draft text
existed only in the DOM. The save handler owned its own pending flag and revision
logic. Typing during an acknowledged save retained the form but left its original
revision in memory; the next manual Save could therefore conflict with its own
successful write. Creating while typing could leave a create form ready to insert
again. A completion from a previous account could also clear the global busy flag.

The existing teacher interface, labels, confirmations and manual-save actions remain.
Saved snapshots and raw drafts now have separate owners. A save acknowledgement
advances the record revision and retains any newer draft. A create acknowledgement
moves a newer draft to the assigned record's ordinary editor; the next Save updates
that identity. Stale account completions cannot publish data, errors or busy state.

## Boundaries

| Responsibility | Owner and lifetime |
| --- | --- |
| Saved curriculum | `workspace-state.js`: immutable account/course snapshot, one row per stable record identity, no DOM or database client |
| Raw curriculum drafts | Same store, separate map keyed by account generation, course, table and canonical record ID; a null record ID denotes an uncreated form, never a saved lesson |
| Manual-save coordination | Same store: one pending token, submitted immutable values, base revision, draft version, error retention and acknowledgement/rebase; the existing adapter supplies the Supabase operation |
| Navigation policy | `workspace-navigation.js`: explicit Home/resume/course/replace/reload transitions and centralized pending/discard/cancel policy; no record writes |
| Presentation | Existing workspace adapter: active view, selected unit/lesson, Inspector, Calendar focus, Build previews, scroll/focus and cached DOM; course contexts no longer own saved arrays or drafts |
| Transport and complete reads | Existing authenticated client and `course-snapshot.js`; owner-scoped pagination, count/identity/revision verification and export contract unchanged |

The adapter's current `course`/`units`/`lessons`/`exceptions` variables are read-only
aliases of the shared snapshot, not independent cached record copies. Its dirty
flag projects current-course draft presence and protects an edit begun during an
initial load. A monotonic edit/request epoch still guards DOM work while reads run.
Home and Dashboard metadata remain saved-record projections, never draft storage.

## Save and account safeguards

- Inputs capture raw form values into the record's shared draft; render projects
  that draft into the current form. Optional field normalization still happens
  only at manual submission, using the existing validators.
- Updates retain the existing ID plus optimistic `revision` predicate. Failures
  and zero-row conflicts retain exact raw text and the original base revision.
- Successful acknowledgements update submitted fields and the returned revision.
  Later edits remain dirty and use that acknowledged revision for the next Save.
  Complete reload verification remains the normal successful-save path.
- A create returns `id,revision`. Newer text is associated with that returned ID,
  with the original course/unit relationships retained. No view ID becomes a row ID.
- Pending saves block replacement/course navigation; Home/resume retain the form.
  A second manual save cannot compete with the pending operation.
- Changing accounts or signing out clears snapshots, drafts, pending tokens and
  presentation caches. Expired view references and old asynchronous completions
  cannot modify the replacement account's store or release its pending save.
- Restoring a cached course still requires a fresh owner-scoped access check. Its
  working snapshot is retained until an explicit reload, matching the existing
  cached-workspace behavior; a background read never silently rebases a dirty draft.
- Complete JSON export and ZIP backup continue to read independently verified saved
  database records. They do not serialize the workspace cache or unsaved drafts.
  Restore still uses the unchanged transactional `restore_course_export` RPC.

No new browser storage, dependencies, migrations or backend settings are introduced.
Drafts remain page-memory-only. `beforeunload` warns when drafts exist; it does not
guarantee recovery after refresh, crash or restart. Ambiguous network failures still
require checking saved records before retrying a create; this stage introduces no
server-side idempotency protocol.

## Stage B extension points — not implemented

A future view instance can retain its own presentation descriptor
`{viewId, courseId, table, recordId}` while obtaining the saved row/draft through
`workspaceState.reference(...)`. Two view references resolve to the same saved
object and same draft. Activating a view must project the shared draft and route
Inspector ownership to that view; it must not clone a row or establish a second
save path. The navigation coordinator's target descriptors already separate
`viewId` from `recordId`. Stage B will adapt presentation per view and add the
separately approved tab controls and keyboard behavior. Durable restoration,
autosave, split panes and groups need their own reviewed implementations.

## Verification

Run from the repository root with a supported Node runtime and local Chrome:

```sh
node --test app/tests/*.test.mjs
NODE_PATH=/path/to/playwright/node_modules node app/tests/calendar.browser.mjs
python3 -m http.server 8000 --bind 127.0.0.1
# In a second process, with the server running:
python3 tests/verify_demo.py
```

Browser verification replaces the Supabase SDK at the network boundary with an
owner-scoped fictional in-memory client. It runs the real application modules,
forms, renderer, export/restore and ZIP paths. It is **synthetic**, not a live
Supabase authentication or RLS test. The public demo uses its existing standalone
CDP regression script. Evidence/logs belong in Git-excluded `app/reviews/`; no
private data, credentials or authentic teacher records are published.

Final results and review limitations are recorded below before the draft PR opens.

### Final local results

Environment: AI Development macOS account; Node 24.22.1; Google Chrome
156.0.8078.73; local HTTP servers only; synthetic fixtures at desktop 1440px and
mobile 390px, with existing 320px/keyboard/accessibility checks retained.

| Suite | Existing checks | New Stage A checks | Result |
| --- | ---: | ---: | --- |
| Node | 119 | 14 | 133 PASS, 0 failures/skips |
| Full application browser | 883 | 38 | 921 PASS, 0 uncaught browser errors |
| Public illustrative demo | 265 | 0 | 265 PASS, 42 captures, 0 browser errors |

New focused Node coverage includes two references to one immutable record/shared
draft; dirty cancellation/discard; Home and course-state separation; pending-save
serialization; edits during save with revision rebasing; failure/conflict retention;
create-ID promotion without duplicate inserts; stale account success/failure;
stale reads; expired view references; frozen submissions; and saved export shape.
New real-adapter browser checks cover save races, exact DOM/text retention through
Home, manual retries, stable IDs, pending unit/lesson creation and account changes.

Existing browser checks retain 1,001/1,201/2,000-lesson export/restore fidelity,
archived records, failed pagination, concurrent external edits, ZIP contents,
Calendar, Dashboard deep links, unsaved navigation and Settings account reset.
No existing assertion was removed or relaxed. Two static error-location assertions
now inspect the extracted coordinator, and the VM harness injects its real modules.
The SDK test double now supports authorized fictional unit/lesson inserts as well
as course inserts.

An initial new-scenario run stopped because Settings was still modal; its setup
now closes Settings with the existing control. Two intermediate runs exposed
Dashboard checks racing the deliberately timer-scheduled token refresh. The test
now waits for a new course-list request and the complete saved-week projection,
then runs the original focus, date, count and visibility assertions unchanged.
The focused rerun (179 checks) and final complete run both passed. These failed
attempt logs remain in the local evidence bundle; they are not reported as passes.

Presentation evidence: 65 of 71 common before/after PNGs are byte-identical to the
verified development baseline, including the desktop/mobile Calendar Month/Week
and multi-course cards. The six differing captures have unchanged dimensions and
include focus/scroll/caret capture differences; no blanket pixel-identity claim is
made. The application HTML, CSS, visible labels, public demo and Dashboard source
are unchanged. Local `visual-comparison-final.json` records each path and hash.

Full evidence is in the primary project's ignored
`app/reviews/tab-workspace-stage-a-2026-10-28/`. The public-demo script was copied
byte-for-byte into that evidence folder solely to redirect its script-relative
output away from existing untracked reviews. Its assertions and served source were
unchanged. The runner manifest records its checksum.

### Limits and owner acceptance

No live sign-in, hosted private-record read/write, restore or independent-account
RLS test was performed. Automated owner scoping is a fixture simulation. Live
independent-account isolation remains BLOCKED without authorized independent
sessions. Physical-device testing and signed-in owner acceptance on the new
non-production preview remain separate. No additional sign-in emails were requested.

Page reload loses unsaved drafts by design for this stage. Cached workspaces still
need explicit reload to adopt external saved edits. One uncreated form per course
and record type matches the current UI; future multiple create documents need a
separate draft identity before Stage B exposes them. Acknowledged saves preserve
newer text, but this is manual save coordination, not autosave or durable recovery.

Review this draft before authorizing Stage B. No merge or production promotion is
part of this work. Security PR #16, F3 grants, and the post-October-30 East metadata
inspection remain separate and unchanged.
