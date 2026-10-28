# Pre-merge acceptance: account form isolation

The acceptance audit of PR #11 at `78b4c6f` reproduced an account-bound UI leak:
a fictional unsaved Create course title survived sign-out and appeared in the
next simulated account's Settings at both 1440px and 390px. Lesson drafts and
course lists were cleared correctly. The restore file input was also outside
the existing workspace-reset boundary.

This isolated follow-up resets authentication, course-creation and restore
forms, including the selected restore file, plus recovery status messages when
the account identity changes. Same-account session/token refreshes preserve
unfinished inputs. No records, Auth limits, RLS policies, schemas, scheduling
logic, marketing source, Sheets or Apps Script change.

Regression coverage exercises same-account preservation, sign-out clearing and
next-account Settings/editor visibility with deterministic synthetic clients.
This verifies client-side UI behavior; it does not establish live independent
authenticated-account isolation. Those tests remain BLOCKED without two sessions.

The broader pre-merge audit also reproduced incomplete single-course exports
after the editor's unpaginated 1,000-row read. That separate defect is not fixed
here. The integrated chain must remain unmerged pending that fix, real hosted
acceptance and independent-account read/write/insert verification. This PR targets
PR #11's branch and does not modify or approve the three earlier draft PRs.

Full local verification logs are Git-excluded under
`app/reviews/premerge-acceptance-2026-10-28/`.

Personally executed validation: 108 Node tests pass; 85 focused Dashboard browser
checks pass; the full browser suite passes 775 checks with zero uncaught errors
at 1440px/390px plus focused 320px coverage. The first full run stopped at the
existing mobile help expansion/focus/scroll assertion, before the new form tests;
a diagnostic focused run and the full rerun passed. The assertion retains its
original tolerance and now records one coherent DOM observation on failure.
The unchanged marketing/demo suite passed 265 checks on standalone rerun after
its first navigation-anchor assertion failed. Both failed logs are retained.
`git diff --check` passes. Hosted authenticated acceptance and genuine A/B
read/write/insert verification remain BLOCKED, not inferred from these suites.
