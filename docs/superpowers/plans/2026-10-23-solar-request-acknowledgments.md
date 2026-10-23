# Solar Inquiry and Receipt Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement the bounded tasks with test-first verification.

**Goal:** Accept configured solar inquiries and durably queue consent-aware bilingual receipt emails from existing service-request APIs.
**Architecture:** Breero remains authority; use one transaction for inquiry/CRM/receipt events. A dedicated worker handler reads current consent and suppression before invoking the gated adapter. Existing scheduling APIs remain unchanged.
**Tech Stack:** Existing FastAPI, async SQLAlchemy, PostgreSQL/PostGIS, Celery and pytest.
**Spec:** docs/superpowers/specs/2026-10-23-solar-request-acknowledgments-design.md

## Global Constraints
- Canonical Breero context only; no claim of generic multi-brand intake.
- No live sends, migrations, scheduling, deployments or capability activation.
- Existing HTTP schemas and CRM event behavior stay compatible.
- English and Spanish, 24-hour receipt expiry, explicit suppression/consent checks.
- No invented solar fee, installed-system price, duration, savings or incentive claim.
- External email delivery remains at-least-once unless approved adapter deduplication is verified.

## Review Focus
- A replayed/concurrent accepted request must not enqueue another receipt: PostgreSQL integration task.
- Withdrawal after acceptance must block delivery: real suppression-query task.
- Receipt completion/parking must not change CRM state: outbox dispatch task.
- Unsafe/unknown locales must not select arbitrary templates or include customer free text: template task.
- Solar seed must not advertise an invented price or make a service bookable: seed behavior task.

## Task 1: Durable consent-aware receipt
Files: create app/domains/public_submissions/acknowledgments.py; modify its service.py, integrations/email.py and workers/tasks.py; add tests/test_request_acknowledgments.py and tests/integration/test_request_acknowledgments_postgres.py.
Interfaces: acknowledgment_event(submission, now) returns IntegrationEvent or None; deliver_acknowledgment(event, session, email) validates current source and delivers fixed event payload; render_email gains keyword-only language default en while retaining existing callers.
- [ ] Add failing template, dispatch, suppression and PostgreSQL acceptance/replay/concurrency tests.
- [ ] Run new tests against current baseline and record expected missing-feature failures.
- [ ] Implement separate reference-only outbox event, current-recipient/suppression guard, bounded templates and stable adapter deduplication key.
- [ ] Run focused unit/PostgreSQL tests and existing email/outbox/consent regressions.
- [ ] Commit verified bounded behavior.

## Task 2: Solar inquiry catalog
Files: modify app/seed.py; add isolated-database seed test.
Interfaces: existing seed() and LAUNCH_SERVICES, same canonical catalog API.
- [ ] Exercise seed in a disposable database and assert solar is present, non-bookable, quote-required and has no fixed amount/duration.
- [ ] Observe missing solar failure.
- [ ] Add solar with explicit quote-only defaults; do not alter existing service policies.
- [ ] Run intake with solar slug and verify request state remains unconfirmed.
- [ ] Commit verified catalog behavior.

## Task 3: Evidence, contract and handoff
- [ ] Run the complete backend suite, applicable lint/type/OpenAPI/schema checks and frontend contract checker; report all baseline/environment failures explicitly.
- [ ] Review the whole diff and request independent review if a fresh agent is available.
- [ ] Preserve concrete evidence and create a draft PR through the repository's branch workflow; no merge/deployment.
- [ ] Update Landing-Pages design/mission catalog with solar, sender ownership and staged email/scheduling work.
