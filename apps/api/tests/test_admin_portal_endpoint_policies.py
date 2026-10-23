"""Explicit policies for user administration and portal read models."""

import inspect
import uuid
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException

from app.api.policy_registry import build_endpoint_policies, iter_api_route_contexts
from app.api.v1 import admin_users, portal, provider_onboarding
from app.domains.auth import dependencies

ADMIN_OVERVIEW_PERMISSIONS = (
    "admin.capabilities.read",
    "admin.audit.read",
    "admin.access.manage",
    "admin.integrations.read",
    "ops.dispatch.read",
    "ops.bookings.read",
    "ops.providers.read",
    "ops.customers.read",
    "finance.ledger.read",
    "finance.payouts.read",
)
EXPECTED_PERMISSIONS = {
    ("GET", "/api/v1/admin/users"): ("admin.access.manage",),
    ("GET", "/api/v1/admin/users/{user_id}"): ("admin.access.manage",),
    ("GET", "/api/v1/admin/users/{user_id}/effective-access"): ("admin.access.manage",),
    ("PUT", "/api/v1/admin/users/{user_id}/access"): ("admin.access.manage",),
    ("POST", "/api/v1/admin/users/{user_id}/disable"): ("admin.access.manage",),
    ("POST", "/api/v1/admin/users/{user_id}/reactivate"): ("admin.access.manage",),
    ("GET", "/api/v1/provider/onboarding/checklist"): ("provider.profile.read",),
    ("GET", "/api/v1/portal/capabilities"): (),
    ("GET", "/api/v1/portal/provider/overview"): ("provider.profile.read",),
    ("GET", "/api/v1/portal/provider/jobs"): ("provider.jobs.read",),
    ("GET", "/api/v1/portal/provider/workers"): ("provider.workers.read",),
    ("GET", "/api/v1/portal/provider/credentials"): ("provider.credentials.read",),
    ("GET", "/api/v1/portal/provider/earnings"): ("provider.earnings.read",),
    ("GET", "/api/v1/portal/provider/payout-batches"): ("provider.payouts.read",),
    ("GET", "/api/v1/portal/operations/overview"): ("ops.dispatch.read",),
    ("GET", "/api/v1/portal/admin/overview"): ADMIN_OVERVIEW_PERMISSIONS,
    ("GET", "/api/v1/portal/admin/audit"): ("admin.audit.read",),
}


def mounted_app() -> FastAPI:
    isolated = FastAPI()
    isolated.include_router(admin_users.router, prefix="/api/v1/admin/users")
    isolated.include_router(portal.router, prefix="/api/v1/portal")
    isolated.include_router(provider_onboarding.provider_router, prefix="/api/v1/provider")
    return isolated


def permission_dependencies():
    result = {}
    for route in iter_api_route_contexts(mounted_app()):
        for method in route.methods:
            key = (method, route.path)
            if key not in EXPECTED_PERMISSIONS:
                continue
            result[key] = [
                dependency.call
                for dependency in route.original_route.dependant.dependencies
                if dependency.call
                and "required" in inspect.getclosurevars(dependency.call).nonlocals
            ]
    return result


def test_policies_match_actual_route_permission_dependencies() -> None:
    isolated = mounted_app()
    policies = {(item.method, item.path): item for item in build_endpoint_policies(isolated)}
    declared = permission_dependencies()
    for operation, permissions in EXPECTED_PERMISSIONS.items():
        policy = policies[operation]
        assert policy.permission == (" && ".join(permissions) if permissions else "authenticated-user")
        assert policy.authentication == "bearer-or-session-cookie"
        assert policy.capability_gate == "always"
        if permissions:
            (dependency,) = declared[operation]
            assert inspect.getclosurevars(dependency).nonlocals["required"] == frozenset(permissions)
        else:
            assert declared[operation] == []
            (route,) = [
                route for route in iter_api_route_contexts(isolated)
                if route.path == operation[1]
            ]
            assert dependencies.current_user in {
                dependency.call for dependency in route.original_route.dependant.dependencies
            }
        if operation[0] == "GET":
            assert policy.emitted_effect == "none"
            assert policy.idempotency_key_policy == "not-applicable"
            assert policy.if_match_version_policy == "not-applicable"

    assert policies[("POST", "/api/v1/admin/users")].policy_rule == "internal-user-provisioning"
    for path in ("overview", "jobs", "workers", "credentials", "earnings", "payout-batches"):
        assert policies[("GET", "/api/v1/portal/provider/" + path)].tenant_scope == (
            "provider-membership-or-owner"
        )
    checklist = policies[("GET", "/api/v1/provider/onboarding/checklist")]
    assert checklist.tenant_scope == "provider-owner"
    assert "vendor.owner_user_id=current-user" in checklist.record_policy


@pytest.mark.parametrize("operation", EXPECTED_PERMISSIONS)
async def test_every_declared_permission_is_required(monkeypatch, operation) -> None:
    required = EXPECTED_PERMISSIONS[operation]
    if not required:
        return  # Authentication-only capabilities are checked against current_user above.
    (guard,) = permission_dependencies()[operation]
    granted = set(required)

    class AccessContext:
        def __init__(self, _session):
            pass

        async def context(self, _user, _brand_key):
            return SimpleNamespace(permissions=sorted(granted))

    class Session:
        def add(self, _row):
            pass

        async def commit(self):
            pass

    monkeypatch.setattr(dependencies, "AccessService", AccessContext)
    principal = SimpleNamespace(id=uuid.uuid4())
    session = Session()
    assert await guard(principal, session) is principal
    for permission in required:
        granted.remove(permission)
        with pytest.raises(HTTPException) as denied:
            await guard(principal, session)
        assert denied.value.status_code == 403
        granted.add(permission)
    granted.clear()
    granted.add("*")
    assert await guard(principal, session) is principal


@pytest.mark.parametrize("operation", EXPECTED_PERMISSIONS)
def test_policy_method_boundaries_fail_closed(operation) -> None:
    _method, path = operation
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        if (method, path) in EXPECTED_PERMISSIONS or (
            method, path
        ) == ("POST", "/api/v1/admin/users"):
            continue
        isolated = FastAPI()
        isolated.add_api_route(path, lambda: {}, methods=[method])
        with pytest.raises(RuntimeError, match="unmatched="):
            build_endpoint_policies(isolated)


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/admin/users/{user_id}/delete",
        "/api/v1/admin/users/{user_id}/access/history",
        "/api/v1/provider/onboarding/checklist/reset",
        "/api/v1/portal/provider/export",
        "/api/v1/portal/provider/overview/details",
        "/api/v1/portal/admin/audit/export",
    ],
)
def test_unreviewed_neighbor_routes_fail_closed(path) -> None:
    isolated = FastAPI()
    isolated.add_api_route(path, lambda: {}, methods=["GET"])
    with pytest.raises(RuntimeError, match="unmatched="):
        build_endpoint_policies(isolated)


def test_administrative_write_policies_describe_local_effects() -> None:
    policies = {(item.method, item.path): item for item in build_endpoint_policies(mounted_app())}
    for method, suffix in (("PUT", "access"), ("POST", "disable"), ("POST", "reactivate")):
        policy = policies[(method, "/api/v1/admin/users/{user_id}/" + suffix)]
        assert policy.permission == "admin.access.manage"
        assert "non-self" in policy.record_policy
        assert "superadmin" in policy.record_policy
        assert policy.if_match_version_policy == "database-row-lock; no-client-version"
        assert policy.idempotency_key_policy == "legacy-not-enforced"
        assert policy.request_hash_policy == "legacy-not-enforced"
        assert "transactional-audit" in policy.emitted_effect
        assert "identity-provider-write" in policy.emitted_effect
    disabled = policies[("POST", "/api/v1/admin/users/{user_id}/disable")]
    assert "local-refresh-sessions-revoked" in disabled.emitted_effect
    assert "credential-version-incremented" in disabled.emitted_effect
    reactivated = policies[("POST", "/api/v1/admin/users/{user_id}/reactivate")]
    assert "no-session-restoration" in reactivated.emitted_effect
