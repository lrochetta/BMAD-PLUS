# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.7.x   | ✅ Active |
| < 0.7   | ❌ No longer supported |

## Reporting a Vulnerability

If you discover a security vulnerability in BMAD+, please report it responsibly:

### 📧 Contact

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
- Dependencies are audited with `npm audit` before each release
- Minimal dependency footprint (6 runtime dependencies)
- All dependencies use MIT-compatible licenses

### Distribution Security
- Golden (private) → Public repo via automated CI scrubbing
- npm packages are built from scrubbed distribution copies
- No private infrastructure details in public distribution
