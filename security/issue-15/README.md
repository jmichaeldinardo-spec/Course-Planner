# Issue #15: local least-privilege rehearsal

**LOCAL STAGING ONLY. No East migration is approved or supplied.**
Files are outside registered migration paths, without CI/auto-apply hooks.
Refs [Issue #15](https://github.com/jmichaeldinardo-spec/Course-Planner/issues/15).

## Engineering decision

Remove authenticated's TRUNCATE, REFERENCES, TRIGGER and MAINTAIN in three
independent transactions, preserving CRUD, RLS, restore execution, constraints
and revision triggers:

| Phase | Scope | Proposal | Rollback | Tested executor |
| --- | --- | --- | --- | --- |
| A | Four existing public application tables | [Forward](proposals/A-up.sql) | [Rollback](proposals/A-rollback.sql) | Direct non-superuser postgres owner |
| B1 | postgres-created future public tables | [Forward](proposals/B1-up.sql) | [Rollback](proposals/B1-rollback.sql) | Direct non-superuser postgres |
| B2 | supabase_admin-created future public tables | [Forward](proposals/B2-up.sql) | [Rollback](proposals/B2-rollback.sql) | **Local simulated** supabase_admin |

Foundation: reviewed PR #11 at 78b4c6fdf422d18f5eb51adac671dcc3668090df.
No application edits or PR #12/#14 integration. The app uses row CRUD; restore is
SECURITY INVOKER and inserts owned copies; backups read records; scheduling
previews compute on saved data. No inspected workflow needs the four extras.
No arbitrary-SQL exploit was demonstrated. This is least-privilege remediation.

The owner's latest authorization supersedes the CPD OPS-044 execution hold only
for fictional local staging and a separate draft review PR. East remains unchanged.

## Environment and fidelity

Real **PostgreSQL 17.11**, compiled from checksum-verified official source with the
existing Apple compiler, without ICU/readline/zlib/OpenSSL dependencies. No
system-wide installation, paid license, cloud project or subscription. Cloud cost:
$0. [Versions/source checksum](evidence/environment.json).

The cluster uses a mode-0700 private temporary directory/socket, TCP disabled,
host authentication rejected and a unique cluster marker. Local trust is confined
to that same-account private socket. Two fictional UUID claims enter through a
NOINHERIT authenticator session and SET ROLE authenticated. Authenticated remains
NOLOGIN, non-owner, non-superuser and NOBYPASSRLS. This tests real database RLS
under **simulated authentication**, not Supabase Auth/JWT verification or PostgREST.

The [fixture](fixtures/schema.sql) reproduces 76 columns, 23 constraints, 16 owner
policies, four revision triggers, exact public functions including restore, table
ACLs and both creators' defaults. The four original definition fingerprints match.
Relevant role attributes, reachable roles, direct/effective/column ACLs, defaults
and schema privileges match the catalog-only East baseline.
[Fidelity evidence](evidence/fixture-fidelity.json). No teacher rows, Auth backup,
credentials or tokens were read or imported.

Explicit fixture differences:

- auth.users contains only a UUID primary key and two fictional identities.
  postgres receives fixture-only REFERENCES(id) to build the course-owner FK.
- auth.uid() body/owner/ACL behavior match; the rest of managed Auth is absent.
- Gateway membership options match; local setup grantor is f3_setup.
- Only ensure_rls is reproduced; six managed platform event triggers are absent.
- supabase_admin is a newly created local simulator, never East's managed role.

The local protected digest was bound after fidelity review. All six files require
the exact disposable DB/cluster names, a private socket, PG17 and an explicit
marker. East's database named postgres fails these guards. The renderer has no
database connection and does not accept a new baseline automatically.

## Verified results

**312 real local database checks pass**: 265 main + 47 supplemental; zero final
failures. [Main](evidence/database-results.json), [supplemental](evidence/additional-results.json),
[before](evidence/before.json), [after](evidence/after.json).

| Checkpoint | A target ACL tuples | B1 defaults | B2 defaults |
| --- | --- | --- | --- |
| Before | 16 | 4 | 4 |
| After A | 0 | 4 | 4 |
| After B1 | 0 | 0 | 4 |
| After simulated B2 | 0 | 0 | 0 |
| Exact rollbacks | 16 | 4 | 4 |
| Final reapplication | 0 | 0 | 0 |

All sixteen effective extra-privilege flags and any-column REFERENCES are false
after A. CRUD and protected metadata remain unchanged. Full rollback/reapplication
was repeated after adding cluster/socket interlocks.

Tests exercise all four tables: owned create/read/save/reopen, both identities'
independent operations, cross-account SELECT/UPDATE/INSERT denial, owner
reassignment, same-course FK enforcement, same-session claim switching/sign-out,
stable archive IDs, revision triggers and stale-save conflicts.

Real SQL restore/export retained **1,001 / 1,201 / 2,000 lessons**, 200 units and 601
exceptions per course, including archives and Unicode. Second restores verified
new IDs, remapped parents and all saved child fields. Failed restore was atomic.
These exports are SQL JSON serialization, **not hosted UI export acceptance**.

Negatives cover missing marker/wrong DB/executor, premature/repeated changes,
grant-option drift, inherited rights, global PUBLIC defaults, column REFERENCES
and non-target CRUD drift. Standard PG17 itself rejects postgres modifying
supabase_admin defaults (42501). An injected post-revoke failure rolls back A.
No TRUNCATE, maintenance, trigger replacement or exploit probe was executed.

Unchanged PR #11 regression: **107 Node**, **769 synthetic app-browser** checks
(1440/390px and retained 320px coverage), **265 public-demo** checks, zero browser
errors, all pass. [Summary](evidence/regressions.json). These fictional SDK tests
are separate from actual database controls and prove no hosted security property.
Known PR #11 F1/F2 app acceptance gaps remain assigned to separate #14/#12.

Earlier fixture/harness failures are disclosed in
[resolved-failures.json](evidence/resolved-failures.json). No final failing test is
hidden. Result files pin the exact executed proposal SHA-256 values.

## Remaining security risks

1. **East F3 is unchanged and OPEN.** Local success is not live remediation or
   permission to merge the app stack.
2. Actual managed B2 is **unverified**; the simulator proves no supported platform
   execution route. [Requirements](MANAGED-B2.md).
3. Future anon structural/maintenance grants, managed future CRUD, function/PUBLIC
   EXECUTE and sequence defaults remain separate decisions. Defaults do not repair
   existing objects; explicit future GRANT ALL can reintroduce rights.
4. **Modeled future-table RLS warning:** the copied postgres-owned SECURITY DEFINER
   helper enables RLS on postgres-owned probes but catches insufficient ownership
   on simulated managed-owned probes, leaving RLS disabled. Retained managed CRUD
   then makes explicit new-object RLS/policy review essential. This is a conditional
   future exposure concern, **not an observed East defect/exploit**: six platform
   event triggers were omitted and no table was created in East. Never rely solely
   on the helper for future-table safety.
5. Genuine Auth/API/hosted A/B acceptance remains **BLOCKED** without independent
   authorized sessions. Claim simulation does not establish token binding,
   session invalidation or browser draft cleanup.
6. October 30 rollout can change defaults. Current rehearsal date: October 28.
   Post-rollout metadata inspection is **pending**; no East-specific SQL is
   recommended. [Gate](POST-ROLLOUT.md).
7. Unknown external tooling and concurrent administrative changes require review
   before any live plan. A digest does not lock out another administrator.

## Reproduce locally

Use existing free PG17.11 tools, or compile official source with existing tools
and verify the published checksum. No download/installer runs automatically.
From this directory:

~~~sh
python3 start_cluster.py --pg-bin /path/to/pg17/bin
# Use only the new private cluster path printed above:
python3 rehearse.py --pg-bin /path/to/pg17/bin --cluster-dir /private/tmp/course-planner-f3-cluster-EXAMPLE --initialize
python3 rehearse.py --pg-bin /path/to/pg17/bin --cluster-dir /private/tmp/course-planner-f3-cluster-EXAMPLE --additional-only
python3 review_offline.py
python3 start_cluster.py --pg-bin /path/to/pg17/bin --stop /private/tmp/course-planner-f3-cluster-EXAMPLE
~~~

Initialize only a fresh cluster. For a repeated full run, use another new cluster
or first restore the fictional baseline with the three guarded rollbacks.
Never refresh a failing digest automatically; review version/catalog differences.
The runner accepts no URL/DSN, strips inherited PG environment variables and checks
socket/data/cluster/role/version identity before writes. Bootstrap SQL has a local
guard. Output defaults to ignored local-output; preserve sanitized evidence first.

## Rollback and approval boundaries

On error, preserve SQLSTATE and stop. Transaction errors abort without committing.
For a committed phase, use only its matching rollback, ordinarily B2 → B1 → A,
under the same executor and expected state. Rollback reintroduces excess rights.
Drift requires a newly reviewed recovery plan. Never force it with CASCADE, broad
grants or role elevation. Default rollback affects future objects only; inventory
interval-created tables and review any object-specific repair. No bulk regrant.

Completed authorization: local fixture, A/B1/simulated-B2 tests, rollback/reapply,
and separate draft security PR. Remaining decisions are actual managed execution,
future anon/CRUD/function/sequence policy, genuine hosted test identities, and
any later East scope/recovery approval **after** the post-rollout metadata review.
No merge, production promotion, live schema/grant/Auth change, marketing edit,
school account, Google Sheet or Apps Script operation occurred.
