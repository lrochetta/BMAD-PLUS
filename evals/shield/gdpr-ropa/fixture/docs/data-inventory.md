# Data Inventory — MailReach SAS

> FICTIONAL company used as an eval fixture. Any resemblance to real entities
> is coincidental. Facts below are intentionally imperfect.

**Company**: MailReach SAS, 12 rue Fictive, 75011 Paris, France (acts as
controller for its own customers; customers upload their own prospect lists).
**Product**: email outreach automation for B2B sales teams (~800 customers, EU
and US).
**DPO**: none appointed. **Representative**: n/a.

## Systems and data held

1. **App database** — PostgreSQL on Hetzner (Falkenstein, Germany)
   - Customer accounts: full name, work email, hashed password (bcrypt),
     company name, plan, timezone.
   - Prospect lists uploaded by customers: full name, business email, job
     title, LinkedIn profile URL, free-text notes written by sales reps.
2. **Product analytics** — self-hosted Plausible (EU), IP addresses truncated.
3. **Support** — Zendesk (hosted in the US). Tickets contain customer emails
   and sometimes full forwarded mail threads with prospect data.
4. **Payments** — Stripe (US). Cardholder name, last4, billing address.
5. **Email sending logs** — SMTP logs with recipient addresses, subject lines,
   open/click events. Kept indefinitely ("we never delete logs" — CTO).
6. **Marketing** — company newsletter via Mailchimp (US). The signup checkbox
   on the website is pre-ticked by default.

## Contracts on file

- Hetzner: DPA signed (2025).
- Stripe: standard Stripe DPA accepted at signup.
- Zendesk: **no DPA on file**.
- Mailchimp: **no DPA on file**.

## Policies

- No retention schedule exists for any system.
- No Record of Processing Activities has ever been drafted.
- Privacy notice on the website last updated in 2022, does not mention
  Zendesk, Mailchimp, or the sending logs.
