# Hosted acceptance harness

This harness targets the real authenticated **development preview**, with the real
Supabase SDK and owner-scoped RLS reads. It never substitutes auth, records or the
backend in hosted mode. It adds no application runtime changes. Stage B, PR #16,
F3, schema, grants, RLS, spreadsheet and Apps Script are outside its scope.

## Architecture and installation

`tests/hosted/` is a separate Node >=20 development package, pinned to Playwright
1.62.1 with `pnpm-lock.yaml`. The application's dependency-free package and test
command stay intact. Install from this repository's harness directory:

```sh
cd app/tests/hosted
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec playwright install chromium
```

Use the Playwright-managed Chromium executable. Every invocation launches a new
browser with a fresh temporary profile; no `userDataDir`, Chrome profile import,
CDP attachment or unrelated browser session is used. Each mode and the final
integrity check use separate nonpersistent browser contexts. A process lock
prevents simultaneous setup/test runs from racing refresh tokens. A stale
`app/reviews/hosted-acceptance/active.lock` requires local inspection of its PID
and confirmation that the process has exited before removing that lock only.

- `run.mjs`: sequential orchestration, named assertions, cleanup and redacted results.
- `runtime.mjs`: preview/commit verification, real auth/RLS reads, context isolation,
  scoped state and optional origin-scoped Vercel OIDC header.
- `journeys.mjs`: UI actions and assertions for Mode A and Mode B.
- `safety.mjs`: request policy, fixture allowlist, canonical records and SHA-256.
- `zip.mjs`: independent ZIP directory/local-header/CRC reader and manifest checks.
- `setup.mjs`: owner-operated authentication and fixture enrollment.

Before loading the app for automated testing, source verification compares every
tracked top-level app JS/CSS/HTML file and JS/CSS/SVG asset against `git show` for
the supplied full commit. This verifies runtime content, not a server-reported Git
SHA: commits with identical runtime files are indistinguishable. The explicit
preview URL and expected commit must come from the intended PR/deployment. Local
Git must contain that commit. Unexpected bytes, denied access or redirects stop
the run; there is no localhost or production fallback. Only HTTPS Vercel branch
preview aliases (`-git-`) are accepted in this initial version.

## One-time owner setup

From the harness directory, run:

```sh
pnpm run setup
```

The defaults are the reviewed Stage A preview and commit:

```text
https://course-planner-app-git-codex-tab-workspac-be6823-course-planner.vercel.app/
fc719e1dbc90ba650b1f359828736060cc687820
```

1. Enter the email of the **existing authorized fictional-data account** in the
   local terminal. It is stored only in the ignored private fixture.
2. In the new testing Chromium window, authorize Vercel preview access. Press
   Enter in the terminal to verify source **before requesting application auth**.
   Do not change deployment protection. If an already configured same-project
   development `VERCEL_OIDC_TOKEN` is available, the harness accepts it from the
   environment and sends it only to the exact preview origin with redirects refused, never to Supabase
   or the SDK CDN. No CLI linking, credential pull or protection change is automatic.
3. If required, manually request **one** app sign-in email, then open its fresh
   magic link using the address bar of that same testing window. Use an authorized
   external mail application to retrieve the link; do not open a school mailbox
   in the testing browser, paste the link into source/terminal/chat, or copy another
   browser's cookies. The setup request guard restricts OTP to the expected email,
   forces `create_user:false` (no Auth signup), and blocks a second request.
   If rate limited or expired, stop; any later request requires owner involvement.
4. After the correct account is shown, press Enter. The server validates identity
   with `getUser(accessToken)`, then RLS reads require exactly four saved courses.
   Review the four names and counts locally, select the **original one-lesson
   Government course**, and type `FICTIONAL` to approve this exact fixture.

Setup stores only scoped app auth state/preview cookies in
`app/reviews/hosted-acceptance/session.json` and the account/course/lesson IDs and
counts in `fixture.json`. The parent directory is mode 0700 and JSON files 0600;
symlink files and permissive session files are rejected. `reviews/` is Git-ignored
and ignore coverage is checked before writing. Vercel-account cookies, unrelated
origins and arbitrary local storage are excluded. State is kept current after each
context to preserve legitimate refresh-token rotation. No credentials or sessions
belong in PRs, reports, screenshots, shared transfers or CI artifacts. Do not serve
`app/reviews/` through a local static server or upload it with a CLI deployment.

An expired session or a **new preview origin** may require running setup again.
The existing fixture remains pinned; reauthentication does not silently authorize
new courses. Never delete/change fixture IDs merely to make a failing run pass.

## Running against this or future development PRs

```sh
pnpm test                         # both modes, default Stage A target
pnpm test -- --mode readonly
pnpm test -- --mode draft
pnpm test -- --url https://course-planner-app-git-YOUR-BRANCH-YOUR-TEAM.vercel.app/ --sha FULL_40_CHARACTER_COMMIT
pnpm run setup -- --url https://course-planner-app-git-YOUR-BRANCH-YOUR-TEAM.vercel.app/ --sha FULL_40_CHARACTER_COMMIT
pnpm run probe                   # unauthenticated source preflight only
```

Run only one process at a time, against stable fictional records while the owner
is not editing. Normal runs do not request OTP, create accounts, sign out, insert,
save, restore, delete or revert records. Browser requests block POST/PATCH/PUT/DELETE
to the four saved tables, all RPCs (including GET RPCs), logout, unrelated hosts,
and WebSockets. Service workers are disabled. Only the existing session refresh
POST and verified reads are allowed in automated mode. Any blocked request fails
the run. Read-only source probes use Playwright's request client exclusively for
GETs with redirects disabled; no write API is exposed by the harness.

### Mode A: read-only hosted

- Verify deployment source, server-validated account, the four enrolled course IDs,
  record counts, owner IDs and course/unit/lesson/exception relationships.
- Switch through all four courses, open Course Overview and Sequence, navigate to
  Dashboard/Home and Continue Planning, and verify the selected course/view returns.
- Open Unit Planning, inspect every unit title, and open Lesson Planning; compare
  the complete lesson selector and the first saved objective and unit context.
- Verify Month and Week grids; next/previous changes and restores each period.
- Download each real course JSON and the real account ZIP through the UI.
  Compare all saved fields, IDs, revisions, archive flags and relationships to the
  pre-run reads. Check ZIP membership, local/central headers, CRC-32, manifest
  counts, unique course IDs and SHA-256 for each course JSON. Downloads remain
  temporary and are deleted; export contents are not copied into reports.

### Mode B: unsaved draft

A new context opens the enrolled Government lesson and checks its original saved
objective. It appends a unique marker through the real form, never clicks Save,
then verifies exact draft preservation through Home/Continue Planning and a course
switch/return. It cancels the real reload/discard dialog and verifies preservation,
then explicitly accepts discard, checks the original objective and clean draft
state, and repeats Home/return to detect draft resurrection.

### Integrity and failure behavior

The initial and final checks use the real server-validated user's RLS client, with
paginated complete reads including archive records. Canonical full-record SHA-256
fingerprints include fields and relationships, not just counts or revisions.
An independently opened final context re-reads all four courses and checks the
Government objective and absence of a dirty workspace. These are best-effort
multi-query observations, not a transaction or database lock.

On a journey failure, the runner stops further journeys, destroys the isolated
draft context, and attempts the independent saved-record check. If UI discard
could not be exercised but context destruction and original saved records are
verified, cleanup explicitly reports `CONTEXT_DISPOSED_SAVED_ORIGINAL_VERIFIED`;
the journey still FAILS. If cleanup/integrity cannot be verified, report
`UNVERIFIED_STOP`/FAIL and stop. There is no destructive cleanup or saved-data revert.

## Results and diagnostics

Exit codes: **0 PASS**, **1 FAIL**, **2 BLOCKED** (setup/access prerequisite).
Each named step prints PASS/FAIL; the final machine-readable summary includes
per-mode status, counts, source-file count, before/after and export digests, blocked-request
categories, page/HTTP error counts, cleanup and timestamps. Results are stored in
ignored `app/reviews/hosted-acceptance/runs/<timestamp>/results.json`.
No raw console messages, exception text, network URLs/headers/bodies, page HTML,
HAR, traces or video are recorded because they can contain authentication data.
A failed step name is the diagnostic entry point. Re-run locally after inspecting
that step; never paste auth-bearing debugging output into a PR.

Set `HOSTED_SCREENSHOTS=1` for optional workspace-only PNGs after the account and
fixture gates pass. Account UI, browser address bar and editor inputs/textareas
are excluded/masked. Screenshots stay private and ignored. No screenshots are
captured during sign-in or protection failures.

Local checks, explicitly **not authenticated hosted acceptance**:

```sh
pnpm run test:safety     # Node request-policy/source-pinning/export fault checks
pnpm run test:contract   # local pinned Stage A UI, synthetic SDK and records, no real backend
cd ../.. && node --test tests/*.test.mjs
```

The local UI contract serves the tracked Stage A runtime directly from Git at the
default reviewed commit; fetch that commit first in a shallow checkout. The source
pinning unit test uses the available checkout HEAD, so it works in shallow CI.
The hosted runner does not import the synthetic contract fixture or mock SDK.
CI runs only the existing Node suite and new harness safety/source checks. It
receives no owner session and cannot imply authenticated hosted acceptance.

## Verification performed October 28, 2026

| Check | Outcome |
| --- | --- |
| Development base Node suite | PASS — 119 tests |
| Stage A Node suite (initial inspection) | PASS — 133 tests |
| Harness safety/source checks | PASS — 12 tests |
| Local synthetic UI contract | PASS — 30 steps, zero writes, identical records |
| Dedicated-session-missing gate | BLOCKED as required, exit 2, redacted evidence |
| Actual Stage A unauthenticated source preflight | BLOCKED by deployment access |
| Authenticated hosted Mode A | NOT RUN — dedicated owner setup required |
| Authenticated hosted Mode B | NOT RUN — dedicated owner setup required |
| Actual saved-record before/after comparison | NOT PERFORMED — no authenticated access |

No owner profile/session was opened or copied. No OTP was requested, saved-record
API queried, database record created/changed, or real draft made during this work.
Thus no hosted record-preservation claim is made beyond **no record access/write
attempts by this implementation run**. The previous owner-performed manual draft
check remains separate and is not converted into an automated PASS.

## Future capabilities — design only, not authorized to execute

| Capability | Required fixtures/authorization and design |
| --- | --- |
| Bounded save/reload/revert | Separately approved disposable course/record IDs, exact field allowlist, original signed snapshot and revision, one bounded save, reload verification, conflict-aware revert and independent final equality. Stop for owner recovery if revert cannot be verified; never overwrite concurrent edits. Current write guard must remain default and any future exception must be narrow and explicit. |
| Concurrent editing | Two dedicated contexts and an approved disposable lesson; deterministic revision barriers and expected stale-write rejection. Do not use the four preserved records. |
| Network failures | Approved isolated session/fixture and deterministic request abort/delay at specified endpoints; separate read-failure and authorized write-failure scenarios. Verify unsaved recovery and record equality after reconnect. |
| Account isolation | Two separately authorized fictional accounts and disjoint known IDs, independent sessions, expected-denial RLS reads. Unauthorized-write probes need additional explicit authorization; no admin/service-role client. |
| Large-course exports | Preauthorized disposable or existing fictional fixtures at pagination boundaries, bounded memory/download limits, counts plus full ID/field/hash checks. Current ZIP reader deliberately rejects compression/ZIP64 rather than silently ignoring unknown formats. |
| Mobile viewports | Reuse read-only gates at approved sizes, add sidebar/inspector keyboard/touch paths and masked screenshots; viewport-specific page actions need explicit implementation and review. Current selectors target desktop 1440×1000. |

Do not run these scenarios until their fixtures, access and mutation/recovery
boundaries are authorized. No Stage B implementation or merge is part of this PR. The harness branch starts
from `pilot/app-foundation` at `462986e099f90563cb0a5f7f90c9d5a3379bb17d`; it does
not include Stage A changes and does not depend on merging PR #17 to run.

References: [Playwright authentication](https://playwright.dev/docs/auth),
[Playwright browser contexts](https://playwright.dev/docs/api/class-browsercontext),
[Supabase verified user](https://supabase.com/docs/reference/javascript/auth-getuser),
[Supabase passwordless setup and signup prevention](https://supabase.com/docs/guides/auth/auth-email-passwordless).
