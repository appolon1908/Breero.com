"""Provider read endpoints must declare their actual permission boundaries."""

import inspect
import uuid
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException

from app.api.policy_registry import (
    OPENAPI_METHODS,
    _matching_rules,
    build_endpoint_policies,
    iter_api_route_contexts,
)
from app.api.v1 import provider_catalog, provider_onboarding
from app.domains.auth.access_service import AccessService

EXPECTED = {
    "/api/v1/provider/onboarding/checklist": (
        "provider.profile.read",
        "bearer-or-session-cookie",
        "provider-owner",
        "vendor.owner_user_id=current-user; owned-application-and-derived-domain-readiness",
    ),
    "/api/v1/provider/skill-catalog": (
        "provider.skills.read",
        "bearer",
        "global-catalog",
        "active-catalog-skills-only",
    ),
}


@pytest.fixture(scope="module")
def provider_read_app():
    app = FastAPI()
    app.include_router(provider_onboarding.provider_router, prefix="/api/v1/provider")
    app.include_router(provider_catalog.router, prefix="/api/v1/provider")
    return app


@pytest.mark.parametrize("path", EXPECTED)
@pytest.mark.asyncio
async def test_provider_read_policy_matches_actual_authorization(
    provider_read_app, monkeypatch, path
):
    permission, authentication, tenant_scope, record_policy = EXPECTED[path]
    policies = [
        policy for policy in build_endpoint_policies(provider_read_app) if policy.path == path
    ]
    assert len(policies) == 1
    policy = policies[0]
    assert policy.method == "GET"
    assert policy.permission == permission
    assert policy.authentication == authentication
    assert policy.tenant_scope == tenant_scope
    assert policy.record_policy == record_policy
    assert policy.capability_gate == "always"
    assert policy.emitted_effect == "none"
    assert policy.idempotency_key_policy == "not-applicable"
    assert policy.if_match_version_policy == "not-applicable"

    (route,) = [
        route
        for route in iter_api_route_contexts(provider_read_app)
        if route.path == path and "GET" in route.methods
    ]
    guards = [
        dependency.call
        for dependency in route.original_route.dependant.dependencies
        if "required" in inspect.getclosurevars(dependency.call).nonlocals
    ]
    (guard,) = guards
    assert inspect.getclosurevars(guard).nonlocals["required"] == {permission}
    context = SimpleNamespace(roles=set(), permissions={permission})

    async def access_context(*_args):
        return context

    monkeypatch.setattr(AccessService, "context", access_context)
    principal = SimpleNamespace(id=uuid.uuid4())
    assert await guard(principal, None) is principal
    for granted in (set(), {"unrelated.read"}):
        context.permissions = granted
        with pytest.raises(HTTPException) as denied:
            await guard(principal, None)
        assert denied.value.status_code == 403


@pytest.mark.parametrize("path", EXPECTED)
def test_provider_read_policies_reject_unmounted_methods_and_neighbors(path):
    assert len(_matching_rules("GET", path)) == 1
    for method in OPENAPI_METHODS - {"GET"}:
        assert not _matching_rules(method, path), (method, path)
    for suffix in ("/reset", "/unreviewed"):
        for method in OPENAPI_METHODS:
            assert not _matching_rules(method, path + suffix), (method, path + suffix)
