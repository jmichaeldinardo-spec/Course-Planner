# Practical technical QA — DEC-100

Run this from the repository root after ordinary application changes:

```sh
node app/tests/qa.mjs
```

This single command runs all Node tests and a small selection of the **existing**
synthetic browser suite at 1440px and 390px. It checks mechanical behavior so the
owner can concentrate on usability, workflow, appearance and the experience of
planning. A PASS does not approve UX or product design.

## One-time tooling setup

Use Node 22 (minimum 20) and pnpm 11.25.0. Install the existing Playwright tooling
in its private test-only package; application runtime dependencies stay unchanged:

```sh
pnpm --dir app/tests install --frozen-lockfile --ignore-scripts
pnpm --dir app/tests exec playwright install chromium
```

No account, login, OTP, database fixture setup or hosted credentials are required.
On this development Mac the bundled Node and testing Chromium are already available.
`npm run qa` from `/app` is an alias for the same runner. The runner uses its own
Node executable for child tests, so it also works when invoked by an absolute Node
path. Test dependencies and evidence are Git-ignored.

For changes affecting scheduling, archive rules, exports, broad UI adapters or
fixture infrastructure, run the complete existing browser matrix:

```sh
node app/tests/qa.mjs --full
```

The normal smoke profile selects `central-tabs`, `teacher-refresh`, `synthetic`, `home`, and
`dashboard`, plus the existing empty-course check. The full profile includes all
built-in synthetic scenarios, including the 1,001/1,201/2,000-lesson export cases.
The runner clears inherited stored-fixture and browser-filter variables; neither
profile loads the owner's courses or the optional hosted harness.

## Coverage inventory and actual gaps

Reviewed PR #17 at `fc719e1dbc90ba650b1f359828736060cc687820` and PR #18 at
`3132ceed4f5e7d29f8f4328694735dd4262dbef3`; both were draft/unmerged with passing
existing Node CI when inspected. The QA branch is stacked on Stage A, with its draft PR targeting the Stage A branch
so its review diff contains only QA changes. After Stage A is approved/merged,
retarget this QA PR to `pilot/app-foundation` before its separate merge review. Existing
checks were retained rather than rewritten in a new framework.

| Teacher operation | Already automated before DEC-100 | Meaningful addition |
| --- | --- | --- |
| Edit and Save | `workspace-state.test.mjs` and `calendar.browser.mjs::verifyStageA`: revision-bound lesson saves, typed-during-save text, serialized saves, unit/lesson create acknowledgement, retry without duplicate insertion | Save existing unit content as a prerequisite to full refresh checks |
| Refresh and persistence | Same-page save/reopen existed; the browser fixture reset on full page refresh | New `verifyTeacherRefresh`: successful unit/lesson values survive an actual `page.reload()` with a fresh application/module state |
| Reload saved data | `verifyPreviewInterface` and `verifyLossless`: re-read saved records, invalidate stale previews, preserve editor on failed pagination/read | Check newer externally saved unit content and the unchanged unit ID |
| Preserve/discard unsaved edits | `verifyHomeNavigation`, `verifyDashboard`, Stage A Node navigation tests: Home/Continue, per-course drafts, cancel/explicit discard, exact DOM/text/scroll retention | After a rejected lesson save, explicit browser reload drops the draft and retains the original saved value |
| Navigate between courses and views | Existing Home, Dashboard, course-card and shared-record browser checks, at both widths; synthetic account changes clear old contexts | No duplicate navigation journey added |
| Save failures and conflicts | Stage A Node failure/conflict/throw tests; browser lesson failure/manual retry, stale-revision rejection, old-account completion, pending-save navigation guard | Compare the whole saved and persisted synthetic database before/after rejected **unit and lesson** saves; retry a failed unit save and refresh |
| Stable IDs | Stage A shared state/create promotion; browser unit/lesson create-then-update and no second insert; exported IDs and parent links | Assert every existing ID/count survives saves, retries and full reloads |
| JSON/ZIP export and restore | `course-snapshot.test.mjs`, `backup.test.mjs`, `verifyLossless` and existing synthetic browser: complete pagination, schema/fields, archive data, parent links, hashes, stable source IDs, remapped restore IDs and field fidelity | No duplicate export/restore suite added |
| Calendar and scheduling | Existing calendar/model, Build, outlook and event-preview Node/browser matrices, date/DST/pin/archive/conflict rules; preview cancellation writes nothing | Existing checks reused |
| Account/refresh boundaries | Node auth/dashboard refresh races and synthetic owner filters; browser next-account draft/form isolation | Existing checks reused; real Auth/RLS is a separate limit |

The new fixture adds 24 assertions across desktop/mobile. It persists only its
synthetic database in an isolated context's `sessionStorage`; app editor/module
state starts fresh on every reload. This simulates a backend surviving document
reload. It does **not** prove Supabase durability, refresh-token behavior or RLS.
No application implementation or UI styling changed.

## Results and diagnostics

Each invocation creates an ignored `app/reviews/technical-qa/<timestamp>/` folder:

- `summary.txt` / `summary.json`: PASS/FAIL per stage, counts, source HEAD/dirty
  state, duration, profile, and an explicit **authenticated hosted: NOT RUN** label.
- `node.log` / `browser.log`: full synthetic diagnostic output.
- `browser-results.json`: every named assertion, executed fixture/viewport cases,
  uncaught errors, and the first failing case/message.
- Existing useful synthetic screenshots; `failure.png` when a page is available.

Exit 0 means both stages passed. Exit 1 means a test/launch failed; browser absence
is a FAIL, never a silent skip. Invalid arguments exit 2. Read the summary, fix the
named failure, then rerun the same command. No cleanup of saved records is needed:
all mutation scenarios operate on disposable synthetic data in fresh contexts.
The local server serves app runtime assets only, and external browser traffic is
blocked while the existing SDK substitution supplies the fictional test client.

CI uses this same smoke command after installing pinned test tooling/Chromium on
Node 22. It publishes a concise job summary and retains synthetic failure logs and
screenshots for seven days. It requires no owner secrets or authenticated account.
CI is a mechanical smoke gate; use the full profile for broader changes.

The legacy public-demo Python checks remain separate (`tests/verify_demo.py` and
`app/tests/verify-demo-regression.py`). Stage A recorded 265 public-demo checks;
those were not duplicated in this saved-application gate. Their previous evidence
is historical, not an authenticated test result.

## Verification performed October 28, 2026

| Run | Outcome |
| --- | --- |
| Full unified command | PASS: 133 Node tests, 945 browser assertions in 35 fixture/viewport contexts; zero uncaught browser errors |
| Default smoke command | PASS: 133 Node tests, 262 browser assertions in 9 contexts; zero uncaught browser errors |
| Inherited stored-fixture/filter exclusion | PASS: smoke still used only the built-in synthetic fixtures despite deliberately misleading inherited settings |
| Deliberately unavailable browser | Expected FAIL and exit 1, with diagnostics; verified that a browser skip cannot become PASS |
| Authenticated hosted | NOT RUN; no login, OTP, owner-course reads/writes or hosted fixture setup |

The full browser matrix retains the previous 921 Stage A assertions and adds 24;
none was removed or relaxed. An initial new mobile fixture run stopped because a
plain sidebar click was covered by the existing inspector. The test now uses the
same inspector-aware click helper as the rest of the suite; no application change
or forced click was used. Subsequent focused, full and smoke runs passed.

## Hosted testing and outstanding risks

PR #18 remains **optional**. Under DEC-100, owner setup of the four preserved
courses is not a prerequisite for product work. This command never opens its
session files, signs in, runs hosted probes, or sends saved writes to those courses.
A future hosted write test requires a separately authorized isolated account,
disposable fixtures and reviewed bounded write/recovery rules. PR #18's current
four-course enrollment assumptions would need explicit adaptation for that setup.

Synthetic SDK/RPC doubles do not validate actual Auth, RLS, transactional rollback,
server grants, network transport failures (including commit-success/response-loss
uncertainty), deployed asset correctness, independent
account security or cross-device database durability. Existing fake conflict and
failure paths cover the UI response to those outcomes, not real server enforcement.
Archive/export completeness and restore fidelity are checked against known data;
the mocked restore is not a proof of PostgreSQL transaction behavior. Physical
mobile devices, other browsers, accessibility completeness and the quality of the
planning experience remain outside this gate. Unsaved drafts still disappear on a
full page reload by Stage A design; no autosave/durable-draft promise is introduced.

## Recommendation

Use the smoke command during ordinary development and as the PR CI gate; use the
full profile before changes affecting shared adapters, scheduling or export logic.
Proceed with Stage A owner review using these mechanical results. The owner retains
approval of workflow, appearance, usability and product direction. Keep Stage B
implementation gated on Stage A review/approval and an explicit next instruction;
this QA change does not authorize Stage B or any merge. PR #16/F3, production,
Supabase configuration/schema, the canonical spreadsheet and Apps Script are
unchanged.

## Stage B follow-up

The same smoke/CI command now includes the central-tab acceptance scenario at both
widths. It verifies presentation identities, shared drafts, per-tab histories and
state, last-holder Save/Discard/Cancel, simultaneous uncreated plans, delayed saves
and account isolation. Existing persistence, scheduling and export/restore tests
remain in the suite. See [Stage B behavior and verification](stage-b-central-tabs.md).
