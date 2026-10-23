"""The audit read model has its own admin-only, GET-only policy boundary."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.routing import APIRoute

from app.api.policy_registry import build_endpoint_policies
from app.api.v1 import audit
from app.domains.auth import dependencies
from app.domains.auth.access_service import DEFAULT_PERMISSIONS
from app.domains.auth.models import AccessRole, User, UserRole
from app.domains.common.outbox import AuditLog

AUDIT_PATHS = (
    "/api/v1/admin/audit/catalog",
    "/api/v1/admin/audit/correlations/{correlation_id}",
    "/api/v1/admin/audit/events",
    "/api/v1/admin/audit/events/{event_id}",
    "/api/v1/admin/audit/security-events",
)


def test_mounted_audit_routes_have_one_admin_read_policy() -> None:
    isolated = FastAPI()
    isolated.include_router(audit.router, prefix="/api/v1/admin/audit")
    policies = build_endpoint_policies(isolated)

    assert {(policy.method, policy.path) for policy in policies} == {
        ("GET", path) for path in AUDIT_PATHS
    }
    assert len(policies) == len(AUDIT_PATHS)
    for policy in policies:
        assert policy.policy_rule == "admin-audit-read-model"
        assert policy.resource_owner == "audit"
        assert policy.audience == "admin"
        assert policy.authentication == "bearer"
        assert policy.permission == "admin.audit.read"
        assert policy.tenant_scope == "global-operations"
        assert policy.pii_classification == "restricted-audit"
        assert policy.emitted_effect == "none"
        assert policy.idempotency_key_policy == "not-applicable"
    for route in audit.router.routes:
        assert isinstance(route, APIRoute)
        assert audit.can_read_audit in {dependency.call for dependency in route.dependant.dependencies}


@pytest.mark.parametrize("path", AUDIT_PATHS)
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_audit_policy_rejects_mutations(method: str, path: str) -> None:
    isolated = FastAPI()

    def mutation() -> dict:
        return {}

    isolated.add_api_route(path, mutation, methods=[method])
    with pytest.raises(RuntimeError, match="unmatched="):
        build_endpoint_policies(isolated)


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/admin/audit/export",
        "/api/v1/admin/audit/catalog/details",
        "/api/v1/admin/audit/events/{event_id}/export",
    ],
)
def test_unreviewed_audit_reads_fail_closed(path: str) -> None:
    isolated = FastAPI()

    def unreviewed() -> dict:
        return {}

    isolated.add_api_route(path, unreviewed, methods=["GET"])
    with pytest.raises(RuntimeError, match="unmatched="):
        build_endpoint_policies(isolated)


@pytest.mark.parametrize(
    ("legacy_role", "access_role", "allowed"),
    [
        (UserRole.BREERO_DISPATCH, AccessRole.operations, False),
        (UserRole.BREERO_SUPPORT, AccessRole.finance, False),
        (UserRole.operations, AccessRole.ops_manager, False),
        (UserRole.operations, AccessRole.support, False),
        (UserRole.admin, AccessRole.admin, True),
        (UserRole.admin, AccessRole.superadmin, True),
    ],
    ids=["dispatch", "legacy-support", "ops-manager", "support", "admin", "superadmin"],
)
async def test_audit_permission_excludes_legacy_staff(
    monkeypatch, legacy_role: UserRole, access_role: AccessRole, allowed: bool
) -> None:
    class AccessContext:
        def __init__(self, _session) -> None:
            pass

        async def context(self, _user, _brand_key):
            return SimpleNamespace(
                roles=[access_role], permissions=sorted(DEFAULT_PERMISSIONS[access_role])
            )

    class RecordingSession:
        def __init__(self) -> None:
            self.added: list[AuditLog] = []

        def add(self, row: AuditLog) -> None:
            self.added.append(row)

        async def commit(self) -> None:
            pass

    monkeypatch.setattr(dependencies, "AccessService", AccessContext)
    user = User(id=uuid.uuid4(), role=legacy_role)
    session = RecordingSession()
    if allowed:
        assert await audit.can_read_audit(user, session) is user
        assert session.added == []
    else:
        with pytest.raises(HTTPException) as denied:
            await audit.can_read_audit(user, session)
        assert denied.value.status_code == 403
        assert len(session.added) == 1
        assert session.added[0].result == "denied"
        assert session.added[0].metadata_json["required"] == ["admin.audit.read"]


@pytest.mark.parametrize(
    "path", ["/api/v1/admin/audit-events", "/api/v1/admin/audit-events/{event_id}"]
)
def test_legacy_audit_routes_retain_their_existing_authority(path: str) -> None:
    isolated = FastAPI()

    def legacy_read() -> dict:
        return {}

    isolated.add_api_route(path, legacy_read, methods=["GET"])
    (policy,) = build_endpoint_policies(isolated)
    assert policy.policy_rule == "admin-audit-read"
    assert policy.permission == "roles:breero_admin|breero_dispatch|breero_support"
    assert policy.audience == "operations-admin-support"
