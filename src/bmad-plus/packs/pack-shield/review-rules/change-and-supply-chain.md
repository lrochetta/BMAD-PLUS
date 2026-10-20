Look at what reaches production and who could change it.

- **Change path.** A pipeline change keeps review and approval before deployment: no new branch that deploys unreviewed, no `continue-on-error` or skipped job on a required check, no manual override without a record.
- **Separation.** The identity that writes code cannot approve and deploy it alone; a workflow that widens `permissions`, adds `pull_request_target` with a checkout of untrusted code, or exposes deployment secrets to forks breaks that.
- **Dependencies.** A new dependency comes from the expected publisher, is pinned by lockfile or hash, and is needed; actions and images are pinned to a digest or a full commit, not a moving tag. Install scripts of new packages are read.
- **Build provenance.** Artifacts are built by the pipeline from the reviewed commit; a step that downloads and runs a script from a URL, or publishes from a developer machine, removes the link between review and release.
- **Configuration baseline.** Hardening settings in images and manifests (non-root user, read-only filesystem, dropped capabilities, resource limits) are not weakened; a changed base image is a new supplier.
- **Vulnerabilities.** A dependency with a known exploitable vulnerability, or a scanner disabled for convenience, is reported with its advisory id.

Name the control a finding breaks (for example `ISO27001:A.8.32` for change management) in the finding's description.
