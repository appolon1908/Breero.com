# Solar inquiry and acknowledgment verification — 2026-10-23

Base: 5992759bfb8bc63fe030cefbfcac0a3024c35c78.
Branch: atomic/landing-solar-ack-20261023.
Scope: canonical Breero request receipts and quote-only solar catalog source. No database migration is added.

## Verified local checks

- Before implementation: 13 new unit cases failed on missing receipt dispatch/template/key behavior and missing solar; the existing focused email/outbox/channel/consent set passed 32 tests.
- After implementation: the same new cases plus existing focused regressions passed 45 tests.
- Ruff check over the complete API directory passed.
- OpenAPI generation/operation-policy validation passed: 149 paths, 182 operations, 183 endpoint policies.
- Frontend OpenAPI contract check passed: 44 required paths and payments remain disabled.
- The canonical OpenAPI artifact is retained unchanged. The installed newer Pydantic regenerated only five unrelated Decimal pattern removals; those unrelated artifact edits are not included.

## Incomplete gates

The complete backend suite was attempted: 424 passed, 52 failed, with 16 warnings and 8 passing subtests. Fifty-one failures reported the unavailable isolated PostgreSQL socket. The geography migration round-trip test did not honor the socket-only URL query when constructing its admin connection, fell back to localhost:5432, and was rejected because the breero role does not exist. No migration executed through that failed connection. A valid dedicated PostgreSQL/PostGIS URL with an explicit owned host/port is required for rerunning the database suite; never point it at an existing shared database.

The disposable Docker database setup could not complete reliably on the nearly full local disk. A Python test environment was moved to memory-backed storage. Docker creation/removal/readiness requests for this task's containers timed out; this is not a reason to restart the shared Docker service or change other containers.

New PostgreSQL tests cover concurrent/replayed intake, channel permissions, current suppression, CRM/email separation, disabled delivery and real solar seed/intake. Their database assertions remain UNVERIFIED locally and require a successful isolated database/CI run.

Mypy before and after the change reports the same two pre-existing errors in app/domains/booking/repository.py at lines 198 and 202 (Select/sequence typing under the installed SQLAlchemy). No new type errors are reported in the acknowledgment/solar scope. Do not claim full backend typing is green.

Hosted CI, independent protected approval, staging readback, provider-side deduplication and live sending are separate gates. This source proposal must remain draft until applicable database and release checks pass.

## Safety and next work

No live email, SMS, Odoo write, appointment, automatic confirmation, payment, seed, live migration or deployment was activated. Existing production configuration continues to reject live email and automatic booking.

Current public submissions lack company tenant columns and fixed Breero context is retained. Before multi-brand activation implement trusted company/site binding, tenant-safe sender configuration and report access. Reuse the existing tenant-email PR #70 rather than duplicate mailbox provisioning.

Use existing booking-intent/operator capacity authority for the next scheduling slice. Confirmed-appointment reminders, cancellation/rescheduling version checks and delivery/bounce receipts are not implemented in this first source slice.
