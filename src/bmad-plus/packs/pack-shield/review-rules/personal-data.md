Follow each personal field from where it enters to where it is deleted.

- **Minimisation.** A new field, column or payload property that identifies a person has a purpose the feature needs now. Collecting "in case" is the defect; so is copying a whole user object into another table, a cache, an event or a third-party call.
- **Special categories.** Health, biometric, political, religious, sexual orientation, criminal or children's data needs its own legal basis and safeguards; flag it even when the rest of the change is clean.
- **Retention and deletion.** Data added here has a retention period, and account deletion or an erasure request reaches it: backups, search indexes, analytics exports, soft-deleted rows and denormalised copies included.
- **Masking.** Identifiers and contact details are masked or pseudonymised where the full value is not needed: admin lists, logs, support views, test fixtures and seed data.
- **Migrations.** A migration that copies, backfills or widens personal data states why; a rollback does not resurrect erased data; a new nullable column that will hold personal data has a default that collects nothing.
- **Records of processing.** A new purpose, recipient or category of data subject is a change to the record of processing activities; say so in the finding so the register is updated.

Name the control a finding breaks (for example `GDPR:Art.5(1)(c)` for minimisation) in the finding's description.
