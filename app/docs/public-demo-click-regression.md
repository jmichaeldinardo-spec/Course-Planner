# Public-demo anchor verification: root cause and correction

Investigated after DEC-103/104 on draft PR #20, starting at
`5dbd60fb1f67ebc7366810bbf6bdeb29dc4c88d8`.

## Classification and baseline

This is a preexisting intermittent test-driver race, not a new application
navigation or DEC-103/104 defect. The unchanged complete harness passed 265 checks
on both the current head and an isolated managed worktree at previous head
`a5c03e18e1b951baa509379f3279598239383fa9`. Earlier retained runs failed twice at
mobile `Anchor #customization` after 134 passing assertions. A repeated anchor
probe reproduced the same failure mechanism at `#how-it-works` on desktop.

Git blob comparisons confirm that root `index.html`, every `assets/` file,
`tests/verify_demo.py` and its wrapper were byte-identical at the pilot base
`04e16296178916ba3ce118f41d71967cb5b05838`, previous head and investigated head.
A separate full pilot run was unnecessary: these are the complete served demo
assets and the same driver. No app/Supabase session or hosted records were used.

## Observed cause

The page intentionally uses `html { scroll-behavior: smooth; }`. The CDP helper
called `scrollIntoView({behavior:'instant'})`, measured the target immediately,
then issued mouse-down and mouse-up as separate protocol calls. An earlier smooth
anchor animation could resume between those calls. The fixed 60ms sleep occurred
*after* the click and could not prevent its target from moving during dispatch.

Captured trace for `#how-it-works`:

| Event | Time (page ms) | scrollY | Actual target |
| --- | --- | --- | --- |
| Measure | 190.2 | 0 | Link rectangle y=27.09, height=44.80; center y=49.49 |
| Mouse-down | 191.3 | 0 | `a[href="#how-it-works"]` |
| Mouse-up | 193.7 | 36 | Header |
| Click | 193.8 | 36 | Header |

The link never received the intended click, so its hash assertion correctly
failed. Visibility and DOM hit testing were correct when measured; the scroll
changed before mouse-up. Extra diagnostic round trips sometimes hid the race,
which explains why single reruns could pass. The low-overhead event trace recorded
inside the original coordinate evaluation reproduced it without those delays.

## Smallest correction

Only the CDP test helper changes. Runtime evaluation can await a Promise. Before
scrolling a target into view, the helper waits for its geometry and document
scroll to settle, allowing an earlier animation to finish. It then performs the
existing instant scroll, waits for stable geometry again, and verifies the pointer
center actually hits that element or its descendant before dispatching the same
mouse events. Stability requires three consecutive animation-frame comparisons;
a three-second deadline fails explicitly if movement never settles. An obscured
or zero-size target also fails explicitly.

No application CSS, anchor behavior, navigation handler, layout, saved data or
Stage B behavior changes. No click is replaced with JavaScript activation. Every
acceptance `check(...)` call and Python `assert` is AST-identical to the original;
none is removed, relaxed or skipped. The full suite still expects 265 assertions,
42 screenshots and zero browser errors. The targeted repeated probe is additional
diagnostic evidence, not a replacement for full acceptance.

## Running and limitations

Run the existing wrapper from the repository root:

```sh
COURSE_PLANNER_REVIEW_DIR=app/reviews/<fresh-folder> python3 app/tests/verify-demo-regression.py
node app/tests/qa.mjs --full
```

The wrapper changes only server/output paths; the corrected driver and all existing
assertions execute directly from `tests/verify_demo.py`. It still requires macOS
Google Chrome and uses a fresh temporary profile. It is synthetic public-demo
verification, not authenticated hosted acceptance or Supabase security validation.
The bounded wait may correctly fail on perpetually moving/obscured controls;
there is no force click, silent retry or passing fallback.

Final run logs, screenshots, baseline blob manifests, original failure trace and
repeated-probe evidence are retained in ignored primary-project reviews. The
investigation does not authorize merging, Stage C, backend changes or deployment
to pilot/production. Owner UX review of Stage B remains separate.

## Final verification

- Unmodified original full harness: PASS on current and isolated previous heads,
  265 checks / 42 screenshots / zero browser errors each, confirming intermittency.
- Original-driver repeated probe with normal smooth scrolling: FAIL with the
  measured link-to-header mouse-up trace above.
- Controlled diagnostic: original driver with smooth scrolling disabled only in
  the disposable page: PASS, 30 desktop/mobile cycles / 180 anchor checks (240
  assertions including resource checks). This is not an application CSS change.
- Corrected driver with normal application scrolling: PASS, the same 30 cycles /
  180 anchor checks (240 total assertions).
- Complete corrected-driver demo: PASS twice, 265 checks / 42 screenshots / zero
  browser errors each. Every original acceptance assertion remains unchanged.
- Full application QA: PASS, 141 Node tests and 1,095 browser checks in 37 cases.
  DEC-101 through DEC-104, tab/draft/Save and account isolation coverage retained.
