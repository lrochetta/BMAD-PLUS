# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest stable npm release | Active fixes |
| Earlier releases | Update to the latest stable release |

The current release is listed on [npm](https://www.npmjs.com/package/bmad-plus)
and in the [release history](https://bmad-plus.rochetta.fr/docs/#releases).

## Reporting a Vulnerability

If you discover a security vulnerability in BMAD+, please report it responsibly:

### 🔒 Preferred: GitHub private vulnerability reporting

Use **[Report a vulnerability](https://github.com/lrochetta/BMAD-PLUS/security/advisories/new)**
(repository *Security* tab → *Report a vulnerability*). The report stays private
between you and the maintainer, and the fix and advisory are coordinated there.

### 📧 Fallback: email

If you cannot use GitHub private reporting:

**Email:** [l.rochetta@gmail.com](mailto:l.rochetta@gmail.com)

**Subject line:** `[SECURITY] BMAD+ — Brief description`

### What to include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment (what could an attacker do?)
- Affected version(s)
- Any suggested fix (optional)

### Response SLA

| Severity | Acknowledgment | Fix Target |
|----------|---------------|------------|
| 🔴 Critical | 24 hours | 72 hours |
| 🟡 High | 48 hours | 7 days |
| 🟢 Medium | 7 days | 30 days |

### What NOT to do

- ❌ Do not open a public GitHub issue for security vulnerabilities
- ❌ Do not exploit the vulnerability beyond proof of concept
- ❌ Do not share the vulnerability publicly before a fix is released

### Recognition

Security researchers who report valid vulnerabilities will be credited in the CHANGELOG (unless they prefer anonymity).

## Security Practices

### Secret Management
- All secrets are stored in GitHub Actions Secrets (never in code)
- Local secrets directory is gitignored
- CI/CD pipeline scrubs private directories before public distribution

### Dependency Management
- Production npm dependencies are audited before each release; high and critical findings block publication
- Maintained Python requirements are audited in CI and block publication on known findings
- The private legacy MCP ML stack has a separate, visible advisory audit and migration backlog; its findings do not describe the npm runtime
- Minimal dependency footprint (6 runtime dependencies)
- Bundled source notices are included in [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md); npm runtime dependency licenses are recorded in the release SBOM

### Distribution Security
- Golden (private) → scrubbed distribution snapshot with no parent commit or source history
- npm packages are built from scrubbed distribution copies
- No private infrastructure details in public distribution
- Each release retains its CycloneDX production SBOM, archive and integrity manifest as workflow artifacts; registry integrity must match the checked archive before the landing is deployed
- Publication uses npm OIDC authentication. npm provenance is not enabled: the private build repository and distribution repository differ. An inventory or hash is not a provenance attestation

BMAD+ is an independent derivative of BMAD-METHOD. It is not an official release
of BMad Code, LLC and does not imply its endorsement.
