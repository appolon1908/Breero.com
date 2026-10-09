
<!-- CODESTRA_SINGLE_LANE_START -->
## Codestra single-lane development contract

- Active branch: `governance/single-lane-lock-20260926`.
- Before editing, run `scripts/agent_preflight.sh start` or `scripts/agent_preflight.ps1 start`.
- Every other branch/worktree is preserved evidence or reconciliation-only: no commits or pushes from it.
- Never reset, clean, stash, discard, overwrite, or delete unproven history.
- Never force-push.
- Cross-system authority: `Caddy -> Kong -> Middleware :8095 -> /platform/v1`.
- Mutations preserve `X-Correlation-ID`, `X-Command-ID`, identity, idempotency, readback, and audit evidence.
- Production/provider effects remain disabled until protected CI, review, staging, readback, rollback, provenance/artifact, and explicit activation gates are green.
- Continue only through `docs/agent-governance/CONTINUE.md`.
<!-- CODESTRA_SINGLE_LANE_END -->
