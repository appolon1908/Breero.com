# Codestra canonical integration and mutation policy

Cross-system path: Caddy -> Kong -> Middleware :8095 -> /platform/v1

Required mutation headers: `X-Correlation-ID` and `X-Command-ID`.

All cross-system effects require authenticated tenant/service identity, idempotency, durable readback, audit evidence, staging/readback/rollback, and separate production activation approval.

Forbidden: direct Caddy/Kong product/provider bypasses, default-on provider/production effects, force-push, branch-protection bypass, or treating READY as live activation.
