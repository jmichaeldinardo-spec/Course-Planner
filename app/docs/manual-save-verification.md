# Manual-save acknowledgement and verification

Local reliability increment based on Stage B development merge
`26a6c8ffbdbd96b1feefefb6a91fba1c2d46198d`. This implements a manual-save
foundation for DEC-097, not autosave, Stage C, or hosted reliability acceptance.

## Behavior

The upper-right status describes unit/lesson manual saves across all retained
tabs and courses: unsaved, writing, verifying, confirmed, rejected/conflicting,
or unconfirmed. Initial loaded records say **Manual Save · No pending edits**.
The header stays visible while scrolling. A narrow-screen Calendar Inspector
mirrors the same feedback and read-only retry inside its modal sheet; only one
status region announces changes. It has no independent save state.

**All changes saved** requires no retained drafts or unresolved operations.
Edits made during writing or verification remain raw and unsaved, with the
acknowledged revision as their next base. Saving another tab/course cannot hide
them. Save and Continue waits for verification and stays in the plan if newer
typing remains. Manual Save, Discard, Cancel, revision checks, Home/Resume,
and course/tab safeguards remain.

Acknowledged creates become canonical records in their existing forms without
replacing input nodes. Failed readback keeps the returned ID. **Retry
verification**, including a manual Save on an unconfirmed acknowledged record,
repeats reads only. With newer edits, verify first, then explicitly Save those
edits. A created lesson keeps its original course/unit relationship.

Unknown outcomes differ from rejected writes. A thrown request, transport error,
or malformed acknowledgement may follow a successful commit. The submission is
retained and cannot be sent again automatically or by clicking Save again.
Inspect saved records and preserve needed text before explicitly discarding
local work. Discard cannot undo a cloud write. After explicit discard and a
complete fresh read, an existing record can use its fresh revision. An
unidentified create keeps a page-memory tombstone so its old temporary
destination cannot insert again through history. A dismissed unknown create
conservatively suppresses the confirmed-saved claim for the rest of that page
session, even after other records are verified.

Unconfirmed operations count as unsaved work for sign-out/unload warnings and
export/backup/restore guards, even without a remaining submitted draft. While
writing or verifying, existing navigation/write locks remain; Home/Resume still
preserves the editor.

## Shared authority

`workspace-state.js` remains the sole editable snapshot/draft authority. Immutable
operation receipts hold submission metadata, not another editable record store:
account generation, operation ID, course/table, original temporary or canonical
identity, submitted draft version, raw submission, normalized patch, base
revision, and acknowledged ID/revision.

`save()` performs one write and returns a receipt while retaining the busy guard.
`verify()` owns a separate read attempt and releases the guard when it finishes.
Read failure retains an unconfirmed receipt. Old-session completions, including
return to the same account with a new generation, cannot publish status or
snapshots or release another operation. Obsolete receipts cannot verify later
writes.

Verification checks the complete owner-scoped course read, acknowledged revision,
and submitted fields. It cannot publish a whole-course read over newer drafts,
another snapshot, or unresolved operations. Neither acknowledgement nor readback
clears a draft created after submission. Existing paginated two-pass read/export
verification remains unchanged.

`private-workspace.js` adapts forms and stable status text/control nodes to that
lifecycle. Successful existing-record verification does not rerender the editor.
Create promotion keeps existing input nodes and adds remaining record fields.
Titles, dirty markers, and saved Dashboard summaries use the shared authority.

## Verification

With the existing test-only Playwright tooling and local Chrome/Chromium:

```sh
node app/tests/qa.mjs --full
```

`manual-save.test.mjs` adds 13 deterministic coordinator cases;
`manual-save.browser.mjs` adds 66 browser checks at 1440px/390px. Smoke and full
runners include them. Existing state assertions now exercise acknowledgement plus
verification. The old synthetic rejection flag returns an explicit PostgreSQL
permission error; separate new probes commit a fictional insert and lose its
response.

Final full run: **154/154 Node tests, 1,161/1,161 browser checks in 39 cases,
zero uncaught browser errors**. Evidence, source hashes, resolved development
failures, and local-review report are retained in the primary project's ignored
`app/reviews/manual-save-verification/` directory. These are synthetic results,
not real Supabase Auth, RLS, or network-durability verification.

## Limits and next gate

No autosave timers, automatic write retries, browser draft persistence, offline
queue, database/schema/RLS/Auth changes, SDK upgrades, hosted owner-course
access, production/marketing changes, CPD/workbook/Apps Script edits, push, PR,
merge, or deployment. Course creation and scheduling remain outside this
unit/lesson lifecycle.

Receipts, drafts, and uncertain-create tombstones remain page memory only;
reload/crash/sign-out can lose them. Browser warnings are best effort. Server
create idempotency and automatic reconciliation remain deferred. Later external
revisions can prevent confirmation of an acknowledged revision; retry never
silently rebases or overwrites. Full-course verification remains relatively
expensive and is not an atomic database snapshot. No timeout or background
recovery scheduler is introduced.

Next gate: local diff and owner UX review of feedback, failure/retry wording,
and navigation. Hosted acceptance needs separately authorized disposable
fictional records and independent accounts. Autosave, PR/publication, merge,
deployment, or backend work require a subsequent instruction.

## Feedback refinement before acceptance

Status text is 13.5px at the default root size. Acknowledged readback failures
now say “Write received · Unverified”, with Retry verification visible in the
header or mobile Inspector. The longer explanation begins “Write acknowledged;
verification incomplete” rather than “Save failed”. Unknown writes say
“Outcome unknown · Do not resend”; rejected/conflicting writes remain “Not saved”.
Verified submissions and newer unsaved edits retain their distinct feedback.
The compact acknowledgement explanation remains visible even when diagnostic
details are outside the scrolled mobile editor. No save/coordinator behavior changed.
