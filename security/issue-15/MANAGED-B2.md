# Actual managed B2 requirements

The local supabase_admin is a new simulator in a private PG17 cluster. It proves
**nothing about access to Supabase's actual managed role**. Ordinary postgres is
non-superuser/non-member; actual local ALTER DEFAULT PRIVILEGES fails with 42501.
The proposal guard also rejects substituting that executor.

Before any actual B2:

1. Complete the post-rollout metadata gate. Establish exact creator, grantor,
   global/public scopes, grant options, inherited routes and remaining privileges.
2. Owner approves a support request through the designated Supabase channel.
   **No message has been sent** by this task.
3. Request a supported auditable mechanism to remove only authenticated's four
   default table privileges for supabase_admin/public, preserving all non-target
   grants. Confirm platform changes/regrant hooks, executor identity/authority,
   transaction behavior, compatible staging, logs, rollback and any fees/plan needs.
4. Do not obtain/guess managed credentials, elevate postgres, add memberships,
   disable protections, use service-role keys or install a SECURITY DEFINER helper
   as a workaround. Project ownership/payment does not establish DB authority.
5. Review the exact supported procedure; adapt guards explicitly if different
   from this simulator. Rehearse under separately approved conditions.
6. Obtain separate approval for exact environment, SQL hash, executor, window and
   rollback. Capture passive pre/post evidence and actual behavioral acceptance.

If unavailable, retain B2 **BLOCKED** or obtain explicit residual-risk acceptance.
A/B1 alone do not close it. No support plan upgrade/cloud spending is authorized.
