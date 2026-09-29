Check that the protection claimed is the protection delivered.

- **Primitives.** Vetted library calls only; no home-made encryption, padding or random numbers. Reject MD5, SHA-1 or an unsalted fast hash for anything security-relevant, ECB mode, static or reused IVs and nonces, and `Math.random`-class generators for tokens or keys.
- **Keys.** Keys and secrets come from a secret store or the environment, never from source, fixtures or container images. Each key has one purpose, a rotation path, and an owner; a key used both to sign and to encrypt is a defect.
- **In transit.** TLS verification stays on (no `verify=False`, `rejectUnauthorized: false`, `InsecureSkipVerify`); internal calls that carry personal data or credentials are encrypted too.
- **At rest.** Data the change stores that needs confidentiality is encrypted at the field or volume level the design promised; exports and backups receive the same protection as the primary store.
- **Tokens and signatures.** Signed tokens pin the algorithm (no `none`, no algorithm taken from the token header), verify issuer, audience and expiry, and compare in constant time.
- **Failure.** A decryption or verification failure is an error, never a fallback to the plaintext or unsigned path.

Name the control a finding breaks (for example `ISO27001:A.8.24` for the use of cryptography) in the finding's description.
