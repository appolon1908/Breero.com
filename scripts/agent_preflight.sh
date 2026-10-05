#!/usr/bin/env sh
set -eu
MODE="${1:-start}"
ROOT="$(git rev-parse --show-toplevel)"
. "$ROOT/.codestra/agent-governance.conf"
fail(){ echo "GOVERNANCE_FAIL=$1" >&2; exit 42; }
BRANCH="$(git branch --show-current)"
if [ "$MODE" = "ci" ]; then
  REF="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-$BRANCH}}"
  [ "$REF" = "$CODESTRA_ACTIVE_BRANCH" ] || [ "$REF" = "$CODESTRA_PROTECTED_BRANCH" ] || fail "wrong_ci_branch:$REF"
else
  [ "$BRANCH" = "$CODESTRA_ACTIVE_BRANCH" ] || fail "wrong_branch:${BRANCH:-DETACHED}:expected:$CODESTRA_ACTIVE_BRANCH"
fi
ORIGIN="$(git remote get-url "$CODESTRA_REMOTE")"
echo "$ORIGIN" | grep -qi "$CODESTRA_REPO_NAME" || fail "wrong_origin:$ORIGIN"
git cat-file -e "$CODESTRA_BASE_SHA^{commit}" 2>/dev/null || fail "missing_base_sha:$CODESTRA_BASE_SHA"
git merge-base --is-ancestor "$CODESTRA_BASE_SHA" HEAD || fail "head_not_descended_from_base:$CODESTRA_BASE_SHA"
grep -Fq "Caddy -> Kong -> Middleware :8095 -> /platform/v1" "$ROOT/.codestra/agent-route-policy.md" || fail "missing_canonical_path"
grep -Fq "X-Correlation-ID" "$ROOT/.codestra/agent-route-policy.md" || fail "missing_correlation_header"
grep -Fq "X-Command-ID" "$ROOT/.codestra/agent-route-policy.md" || fail "missing_command_header"
if [ "$MODE" = "start" ] && [ -n "$(git status --porcelain=v1)" ]; then fail "dirty_start"; fi
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || true)"
if [ -n "$UPSTREAM" ] && [ "$UPSTREAM" != "$CODESTRA_REMOTE/$CODESTRA_ACTIVE_BRANCH" ]; then fail "wrong_upstream:$UPSTREAM"; fi
REMOTE_LINE="$(git ls-remote "$CODESTRA_REMOTE" "refs/heads/$CODESTRA_ACTIVE_BRANCH" 2>/dev/null || true)"
REMOTE_SHA="$(printf "%s" "$REMOTE_LINE" | awk '{print $1}')"
if [ -n "$REMOTE_SHA" ]; then git merge-base --is-ancestor "$REMOTE_SHA" HEAD || fail "stale_or_divergent_remote:$REMOTE_SHA"; fi
if [ "$MODE" = "commit" ]; then DIFF="$(git diff --cached --unified=0 --no-ext-diff)"; else BASE="${REMOTE_SHA:-$CODESTRA_BASE_SHA}"; DIFF="$(git diff "$BASE...HEAD" --unified=0 --no-ext-diff 2>/dev/null || true)"; fi
ADDED="$(printf "%s\n" "$DIFF" | grep '^+' | grep -v '^+++' || true)"
printf "%s\n" "$ADDED" | grep -Eiq '(PRODUCTION_GO|PRODUCTION_EFFECTS|PROVIDER_EFFECTS|ENABLE_EXTERNAL_DELIVERY|ENABLE_LIVE_TRADING|LIVE_TRADING)[[:space:]]*[:=][[:space:]]*(true|yes|1)' && fail "production_effect_enabled"
printf "%s\n" "$ADDED" | grep -Eiq 'git[[:space:]]+push.*--force' && fail "force_push_added"
printf "%s\n" "$ADDED" | grep -Eiq '(Caddy|Kong)[[:space:]]*->[[:space:]]*(Odoo|N8N|Klyrow|Telnexa|Breero|Beyvra)' && fail "middleware_bypass_added"
for f in AGENTS.md .github/copilot-instructions.md CLAUDE.md .codestra/agent-governance.conf .codestra/agent-route-policy.md scripts/agent_preflight.sh scripts/agent_preflight.ps1 .github/workflows/agent-governance.yml docs/agent-governance/CONTINUE.md; do [ -e "$ROOT/$f" ] || fail "missing_guard_file:$f"; done
echo "GOVERNANCE_PASS=1"
echo "MODE=$MODE"
echo "REPOSITORY=$CODESTRA_REPOSITORY"
echo "ACTIVE_BRANCH=$CODESTRA_ACTIVE_BRANCH"
echo "BASE_SHA=$CODESTRA_BASE_SHA"
echo "REMOTE_ACTIVE_SHA=${REMOTE_SHA:-UNPUBLISHED}"
echo "PRODUCTION_EFFECTS=DENIED"
