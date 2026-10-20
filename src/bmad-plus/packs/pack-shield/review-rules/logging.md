A log is evidence for an investigation and a store of personal data at the same time.

- **Security events.** Sign-in success and failure, access denied, privilege and role changes, exports, deletions and configuration changes are logged with who, what, when and from where. A security-relevant path the change adds without an event is a gap.
- **Content.** No passwords, tokens, keys, full card numbers, session ids or request bodies with personal data in log lines, traces, metrics labels or error reports. Identifiers are pseudonymised where the investigation does not need them in clear.
- **Integrity.** Audit records cannot be edited or deleted by the application account that writes them; a change that routes audit events through a mutable table or a best-effort queue that drops on failure weakens the trail.
- **Time.** Timestamps are in UTC from a synchronised clock and carry their zone; ordering never depends on a client-supplied time.
- **Retention.** The retention of new logs is set, matches the policy for their content, and is shorter for logs holding personal data than for pure security events where the policy says so.
- **Detection.** An alert or dashboard that the change removes, renames or silences is called out: incident detection and notification deadlines depend on it.

Name the control a finding breaks (for example `ISO27001:A.8.15` for logging) in the finding's description.
