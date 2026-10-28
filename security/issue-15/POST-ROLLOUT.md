# East gate after October 30, 2026

**Pending, not passed.** Rehearsal date is October 28. A date alone does not prove
the platform change reached the project.

The [announced rollout](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
changes future public-table exposure defaults; existing grants remain distinct.
Observed postgres/public CRUD defaults were already absent while the four extras
remained. Applying the published CRUD-default revoke locally was a no-op and did
not close F3. Do not assume the rollout removes structural/maintenance grants.

After confirming project rollout:

1. Verify the designated connection and Course Planner East project
   rlyrfbvxpmmfxdpzkyia out of band; never access a school account.
2. Run only [catalog SELECTs](post-rollout-east-read-only.sql). Capture UTC date,
   version, executor/project. No data-table reads, role SET, RPC, DDL, Auth email,
   fixture writes or permission change.
3. Compare both creators' global/public ACLs, PUBLIC/anon/authenticated grants,
   grant options, memberships, column/effective privileges, owner/RLS state,
   restore/function ACLs, policies, triggers and FKs against October 28.
4. Determine whether each A/B1/B2 scope is still needed. Preserve snapshots and
   explain differences; do not simply refresh a digest or reuse local-bound SQL.
5. Establish supported actual B2 execution if needed, external-tool dependencies
   and genuine hosted A/B acceptance.
6. Only then propose reviewed East-bound SQL and obtain separate explicit approval
   for scope/executor/hash/window/rollback. This PR recommends **no East migration**.

Creator-specific defaults and schema/global behavior follow
[PostgreSQL 17](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
No unattended check, scheduled DB action or cloud resource was created.
