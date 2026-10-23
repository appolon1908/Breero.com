# Company brand context isolation — 2026-10-23

Branch: atomic/landing-company-access-20261023.
Source base: 88fa5c44fa823f76ceb0b973eaa4ed50f8e5337f (PR 157).
Canonical main: 5992759bfb8bc63fe030cefbfcac0a3024c35c78.

## Change and observed checks

Additional brand contexts require an explicit active assignment. Canonical Breero unmanaged legacy roles retain compatibility; managed no-access profiles still deny access. No endpoint or schema change is introduced.

Six negative role cases failed against the original implementation, then passed with the guard. Together with existing effective authorization, privilege escalation and auth contracts, 25 focused tests passed. Full API Ruff and mypy (209 source files) passed. OpenAPI validation passed (149 paths, 182 operations, 183 endpoint policies), and generated artifacts remain unchanged. Frontend contract passed all 44 required paths.

Four real PostgreSQL tests cover persisted company/user isolation, explicit roles with/without managed profiles, local permission overrides, inactive assignments/direct wildcard denial and canonical compatibility/revocation. Their execution is required before this source slice is considered verified. The local disposable PostGIS image setup timed out; do not use an existing shared database as a substitute. Hosted complete API/DB/CI results must be recorded against the eventual commit in the PR and project evidence.

Independent source/test review found no actionable defect. It did not execute the database tests. Parent head 88fa5c44fa823f76ceb0b973eaa4ed50f8e5337f independently passed the hosted backend gate, including 476 tests, migrations, drift, typing, dependency and image checks; this does not substitute for this branch's new database assertions.

## Release and remaining scope

The new subsection review-base creation was rejected: active codestra-control-plane-required rules apply to subsection branches with do_not_enforce_on_create=false and no bypass actor. Use the existing subsection/landing-pages-backend-foundation and declare PR 157 as an explicit prerequisite. Do not bypass the rule, self-report a control-plane status or promote either branch.

This is context isolation only. Current public submissions still need trusted company/site ownership. Tenant-email PR 70 needs target-brand action permission checks and brand-filtered outbox listing before company activation. Existing call requests, confirmation/reminders and sender delivery need their own scope and lifecycle implementation. PR 70 and PR 152 also have conflicting 032 migration lineages requiring explicit reconciliation before combination.

No live migration, seed, email, SMS, Odoo write, calendar event, appointment confirmation, payment or deployment was performed.
