# Explicit Company Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require explicit brand access for additional company workspaces while preserving canonical Breero compatibility.

**Architecture:** Reuse AccessService, persisted AccessAssignment and existing access-denied response. Limit the legacy default-role fallback to canonical Breero.

**Tech Stack:** FastAPI, async SQLAlchemy, PostgreSQL, pytest, existing OpenAPI/CI gates.

**Spec:** docs/superpowers/specs/2026-10-23-company-access-design.md

## Global Constraints

- Additional brands require an active persisted assignment; no legacy implicit access.
- Canonical brand_key is "breero"; its unmanaged compatibility behavior is retained.
- No schema, HTTP, identity provider, live sending, scheduling activation or deployment changes.
- Source base is 88fa5c44fa823f76ceb0b973eaa4ed50f8e5337f; isolated atomic branch only.

## Review Focus

- Legacy admin wildcard must not carry into an unassigned additional brand: test every UserRole.
- Real SQL must filter both user and brand before evaluating assignments: PostgreSQL cross-brand/cross-user test.
- Inactive assignments must not restore implicit access: PostgreSQL revocation test.
- A deny override in brand A must not alter brand B: PostgreSQL permission-override test.
- Canonical unmanaged accounts and managed no-access profiles retain expected behavior: existing regressions plus canonical assertion.

### Task 1: Restrict compatibility fallback and prove assignment isolation

**Files:**
- Modify: apps/api/app/domains/auth/access_service.py
- Create: apps/api/tests/test_company_brand_access.py
- Create: apps/api/tests/integration/test_company_brand_access_postgres.py

**Interfaces:**
- Consumes: AccessService.context(user: User, brand_key: str) -> PortalContext.
- Produces: the same interface and response shape, with no-access context for unassigned additional brands.

- [ ] Write parameterized negative tests for every UserRole using the real AccessService and an empty persistence boundary.
- [ ] Run them and observe unauthorized permissions before the fix.
- [ ] Add the minimal no-access condition for noncanonical brands with no active rows.
- [ ] Verify new negatives and existing effective-access, privilege-escalation and auth-contract tests pass.
- [ ] Add real PostgreSQL cross-brand/cross-user, inactive/revoked assignment, scoped permission override and canonical compatibility cases. Use disposable database fixtures with unique user/brand identifiers.
- [ ] Run isolated database tests and the complete API suite, Ruff, mypy, OpenAPI validation and frontend contract. Record actual outcomes and unresolved gates.
- [ ] Obtain independent review, commit/push the atomic change, create a draft PR into the existing subsection/landing-pages-backend-foundation with PR 157 declared as a prerequisite, and record current-head hosted CI. Do not merge or promote.
