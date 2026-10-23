# Explicit access for additional company brands

This implements the approved separate-workspace requirement before adding company inquiry and appointment APIs. The existing Breero identity and AccessAssignment records remain authoritative; no competing login, company membership store or public tenant selector is introduced.

## Problem and chosen approach

AccessService.context(user, brand_key) currently synthesizes DEFAULT_ACCESS from the legacy User.role whenever that brand has no managed profile or active assignments. That compatibility path was built for canonical Breero accounts. Applying it to an additional brand gives, for example, a legacy operations account that brand's operations permissions without a persisted assignment. Tenant-email PR 70 consumes this context for brand scope, so this is a prerequisite for reliable company separation.

Restrict the compatibility path to brand_key == "breero". If an additional brand has no active assignment for the user, return the existing empty access-denied context even when no AccessProfile exists. Explicit active assignments retain their actual roles, scopes and brand-specific permission overrides. Managed empty profiles continue denying access for every brand. Do not broaden canonical Breero roles or alter identity verification.

Alternatives rejected: relying on client-side workspace filters does not authorize records; creating another membership system duplicates AccessAssignment and conflicts with the agreed shared identity architecture. A new database migration is unnecessary for this policy change.

## Observable behavior

- Every legacy UserRole, including admin, has no implicit access to an additional brand.
- A brand A assignment neither authorizes brand B nor another user.
- An inactive assignment does not restore fallback permissions in an additional brand.
- Brand-specific permission overrides remain local to that brand.
- Unmanaged canonical Breero accounts retain their existing default role/permission behavior. Managed revocation still denies access.

## Boundaries and validation

This establishes a permission prerequisite. It does not claim company/site inquiry ownership, company sender selection or a complete scheduler. Those must enforce trusted source and record scope separately. Existing access-administration endpoints and explicitly granted assignments remain the provisioning authority. A portfolio operator needs explicit access per additional brand; legacy admin status alone is insufficient there.

Run negative role tests first, then real PostgreSQL assignment/filter/revocation tests, existing authorization regressions, full API tests, Ruff, mypy, OpenAPI/frontend contract and hosted release checks at the new head. No schema/HTTP changes are intended. Keep this atomic slice separate from PR 157 and do not merge dependencies, deploy, migrate live data or activate email/calendar effects.

Base: PR 157 head 88fa5c44fa823f76ceb0b973eaa4ed50f8e5337f; canonical main 5992759bfb8bc63fe030cefbfcac0a3024c35c78. PR 70 and PR 152 remain separate open dependencies, with conflicting 032 migration lineages to reconcile before combined release.
