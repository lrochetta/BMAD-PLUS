Read the change as the person who should not get in.

- **Enforcement point.** Every new route, handler, job or command checks who is calling and what they may do, on the server, before it reads or writes. A check only in the UI, in a client-side guard or in the caller is not enforcement.
- **Object ownership.** A lookup by an id taken from the request is scoped to the caller (tenant, owner, organisation). Listing, export, search and bulk endpoints apply the same filter as the single-object read.
- **Least privilege.** A new role, scope, permission or service account grants only what the feature needs; a wildcard, an admin fallback or a default of "allow" when the policy is missing is a defect.
- **Authentication.** Passwords hashed with a slow, salted algorithm; comparison of secrets in constant time; MFA not bypassable through a secondary path (API token, password reset, legacy login, support impersonation).
- **Sessions and tokens.** Expiry and revocation exist and are checked; logout and password change invalidate what they should; tokens are bound to their audience and never accepted from a query string where they would be logged.
- **Access changes.** Granting, changing or removing a right is recorded with who did it; removal takes effect on the next request, not at the next login.

Name the control a finding breaks (for example `ISO27001:A.8.5` for authentication) in the finding's description.
