# Issue #13 — complete editor reads and verified single-course export

## Foundation and decision

Read [Issue #13](https://github.com/jmichaeldinardo-spec/Course-Planner/issues/13)
and the current Canonical Product & Development Record, including OPS-042 and
the deferred DEC-096 design boundary. CPD revision:
`AHj4eMSaDQnylr6E8CT6_S11Coz_0JZUvf54d9K8T8P04gmSzSlWIJehamrRT7nh0fd80lpBSj6US2wWRq4fPm2u96EBE-vZjMWAI88GS9c`.
Verified local/GitHub/remote PR #11 at
`78b4c6fdf422d18f5eb51adac671dcc3668090df` before creating
`codex/lossless-course-snapshots`. PR #12 at `14e7d47` is a separate account-form
correction, deliberately excluded. No dependency PR was merged or rewritten.

The foundation fetched each child table once and exported the editor's cached
arrays. A capped response therefore looked like a complete course: 1,201 saved
lessons became 1,000 loaded/exported. Preserve one existing editable workspace;
replace its read boundary, not its records or three-pane architecture.

## Read and export protocol

`course-snapshot.js` supplies the shared complete read for editor and export:

1. Read the selected course with both its ID and the account's owner ID. Require
   the returned identity/owner and positive revision to match.
2. Read **all** units, lessons and calendar exceptions in deterministic ID order,
   100 records per range request, asking for an exact count. Bounds match existing
   restore/backup limits: 200 units, 2,000 lessons and 1,000 exceptions. A count
   over the bound fails; nothing is silently truncated. Two hundred units require
   two pages, so the unit boundary is tested as well as large lessons/events.
3. Require exact counts, expected page lengths, stable counts across pages,
   unique ordered IDs, valid revisions, course IDs and lesson→unit membership.
   Missing counts, partial/empty/short pages, invalid relationships or page errors
   fail closed. Never interpret a failed response as an empty saved course.
4. After the full first pass completes, independently page IDs, parent IDs,
   revisions and update timestamps again, and re-read the owned course. Reject
   changed identities/counts/revisions/parents/course fields. This detects observed
   insertions, deletions and parallel edits before accepting the snapshot.
5. Reapply the original position ordering for unit/lesson presentation and date
   ordering for events, with deterministic ID tie breaks. Keep every archived row
   in the saved read; existing active-view archive filters remain responsible for
   Calendar/Home/Overview. No IDs or authored fields are rewritten.

The editor publishes the complete result only after verification. Its existing
request epoch, edit epoch, dirty-state and account-reset guards still win over
late replies. A failed reload leaves the known complete editor DOM/records intact;
initial failures and errors are visible rather than leaving a loading placeholder.

Single-course export independently calls this protocol on a **fresh saved read**,
with authenticated `getUser()` checks before and after. It does not serialize the
cached editor. Local edits, saves, reloads, another course, sign-out or account
changes invalidate an in-flight export. Existing unsaved form values remain intact.
The export button is disabled while checking and restored even if its course DOM
was temporarily detached into a retained context.

Only after all checks succeed is the unchanged `course-planner.pilot-export.v1`
JSON serialized and a download created. The UTF-8 file must fit the existing 6 MB
restore limit. Success reports the verified units/lessons/events counts. Errors
appear in the visible live status with no file creation. An independently saved
edit present before export appears in the file without rebuilding the editor.

No new RPC, transaction, schema, RLS/Auth setting or global query limit change.
The client protocol uses multiple RLS-protected requests and revision triggers;
it is a verified saved snapshot, not a server-side transaction or a lock against
edits made after verification. A later save requires a new export. Client-side
owner checks supplement server RLS and do not establish live A/B security.

## ZIP and restore boundaries

`backup.js`, its paginated account backup reads, consistency checks and SHA-256
manifest format are unchanged. Tests verify complete original/restored courses
and every manifest hash at all requested lesson sizes. Restore retains its
existing separate-copy semantics: source IDs are preserved in the export; restored
UUIDs are new, with remapped course/unit relationships and original authored
fields, saved dates and archive flags. No scheduling Apply/Save feature is added.

## Verification and acceptance

All intentional writes use deterministic synthetic clients, never authentic
teacher records. Full logs and disposable fixtures are Git-excluded under
`app/reviews/issue-13/`; curated count evidence is in `lossless-course-snapshots/`.
Tests cover 1,001/1,201/2,000 lessons, 200 units and 601 events, including archives;
Sequence/Overview/Calendar tail records; complete fresh JSON; all field/ID/parent
checks; JSON restore; ZIP hashes; each table's page failure; visible no-download
errors; retained editor DOM; concurrent edits; save conflicts; new unsaved edits
during export; pending-export course changes; cached-button recovery; and sign-out
or account changes during a held page. Node tests additionally cover absent counts,
short/duplicate/out-of-order pages, broken parents, every bound, insert/delete
changes, missing revisions and UTF-8 size overflow.

Hosted signed-in read/export/restore and genuine independent-account RLS behavior
remain separate acceptance gates. No Supabase sign-in email is requested. A READY
preview and synthetic passes do not close those gates. Keep this PR, #6/#9/#11 and
separate #12 draft/unmerged pending owner review and the pre-merge security gates.
No production, marketing source, Sheet or Apps Script changes.

## Personally executed results

- **118 Node tests pass**, zero failures/skips: all 107 existing tests plus 11
  complete-read/export/ZIP correctness and failure cases.
- **877 full application Chrome browser checks pass**, zero uncaught errors:
  all existing scenarios plus six large-course desktop/mobile cases. Narrow
  320px checks remain in the existing suite.
- **265 unchanged marketing/demo browser checks pass**, 42 screenshots, zero
  browser errors. No marketing source was edited.
- `git diff --check` passes. No separate build/lint/typecheck script exists.
- Local environment: macOS 26.6.2, Node 24.22.1, Chrome 156.0.8078.73,
  loopback HTTP and isolated Playwright contexts, SDK replaced by a fictional
  owner-scoped client. Restore RPC execution in these tests is synthetic;
  live PostgreSQL restore acceptance is not inferred.

| Saved lessons | Exported / unique lesson IDs | Units | Events | Widths | Restore fields/parents and ZIP hashes |
| --- | --- | --- | --- | --- | --- |
| 1,001 | 1,001 / 1,001 | 200 | 601 | 1440px, 390px | Pass |
| 1,201 | 1,201 / 1,201 | 200 | 601 | 1440px, 390px | Pass |
| 2,000 | 2,000 / 2,000 | 200 | 601 | 1440px, 390px | Pass |

[Machine-readable export count and fidelity evidence](lossless-course-snapshots/export-count-evidence.json).
Unedited viewport captures show the Calendar reaching the final saved dates of
the 2,000-lesson synthetic course:
[desktop](lossless-course-snapshots/lossless-2000-1440-complete-calendar.png) ·
[mobile](lossless-course-snapshots/lossless-2000-390-complete-calendar.png).

Final logs: `app/reviews/issue-13/node-final-tests.txt`,
`browser-verified-tests.txt` and `marketing-tests.txt`. Initial development runs
exposed incomplete test doubles (missing exact count/revision fields) and modal
test navigation; these were corrected to model the real API/UI. An earlier full
run passed 865 checks before the additional course-switch cases. The next run
completed every large-course case but stopped at the previously observed
Dashboard help focus/scroll assertion. Its log is retained in
`browser-final-tests.txt`. The assertion now takes one coherent observation of
expansion/focus/scroll, retains its original tolerance, and the diagnostic focused
run plus the final 877-check suite pass. No assertion was skipped.

Real signed-in hosted editor reads, fresh export counts, JSON restore/ZIP recovery,
and authenticated account-switch/cross-account denial tests remain OPEN/BLOCKED
without authorized independent sessions. No authentic teacher records or live
database queries/writes were used for this implementation. PR #12's form-reset
correction and the separate least-privilege review remain outside this branch.
