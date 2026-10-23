"""Regression coverage for audit writers used by access changes and manual retries."""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import access
from app.domains.audit.catalog import ACCESS_ASSIGNMENTS_REPLACED_ACTION, ACCESS_DENIED_ACTION
from app.domains.auth.access_service import AccessService
from app.domains.auth.models import AccessRole, Department, User, UserRole
from app.domains.auth.schemas import AccessAssignmentInput, AccessProfileUpdate
from app.domains.common.outbox import AuditLog, EventStatus, IntegrationEvent
from app.domains.common.outbox_service import OutboxService


def user() -> User:
    return User(
        id=uuid.uuid4(),
        email="audit-writer@example.com",
        password_hash="disabled",
        full_name="Audit Writer",
        role=UserRole.admin,
        is_active=True,
    )


async def test_access_route_forwards_authenticated_actor_to_audit_writer(monkeypatch) -> None:
    actor, target_id = user(), uuid.uuid4()
    data = AccessProfileUpdate(
        assignments=[AccessAssignmentInput(role=AccessRole.support, department=Department.customer_support)]
    )
    service = Mock()
    service.replace_assignments = AsyncMock(return_value=object())
    monkeypatch.setattr(access, "AccessService", Mock(return_value=service))
    await access.replace_user_access(target_id, data, actor, Mock(spec=AsyncSession))
    service.replace_assignments.assert_awaited_once_with(
        user_id=target_id,
        brand_key=data.brand_key,
        assignments=data.assignments,
        actor_id=actor.id,
    )


async def test_access_replacement_records_actor_and_roles_in_same_commit(monkeypatch) -> None:
    actor_id, target = uuid.uuid4(), user()
    session = Mock(spec=AsyncSession)
    session.scalar.side_effect = [target, object()]
    previous = [SimpleNamespace(role_key="operations"), SimpleNamespace(role_key="operations")]
    session.scalars.return_value = SimpleNamespace(all=lambda: previous)
    service = AccessService(session)
    context = AsyncMock(return_value=object())
    monkeypatch.setattr(service, "context", context)
    assignment = AccessAssignmentInput(role=AccessRole.support, department=Department.customer_support)

    await service.replace_assignments(target.id, "breero", [assignment], actor_id=actor_id)

    (event,) = [call.args[0] for call in session.add.call_args_list if isinstance(call.args[0], AuditLog)]
    assert event.actor_id == actor_id and event.actor_type == "admin"
    assert event.action == ACCESS_ASSIGNMENTS_REPLACED_ACTION
    assert event.resource_type == "user" and event.resource_id == target.id
    assert event.metadata_json == {
        "brand_key": "breero",
        "target_user_id": str(target.id),
        "previous_roles": ["operations"],
        "new_roles": ["support"],
    }
    session.commit.assert_awaited_once()
    # The audit event is queued before the same commit that persists the assignment.
    assert session.mock_calls.index(("add", (event,), {})) < session.mock_calls.index(("commit", (), {}))
    context.assert_awaited_once_with(target, "breero")


async def test_denied_superadmin_grant_is_audited_without_replacing_roles(monkeypatch) -> None:
    actor = user()
    session = Mock(spec=AsyncSession)
    service = Mock()
    service.context = AsyncMock(return_value=SimpleNamespace(permissions=["admin.access.manage"]))
    service.replace_assignments = AsyncMock()
    monkeypatch.setattr(access, "AccessService", Mock(return_value=service))
    data = AccessProfileUpdate(
        assignments=[AccessAssignmentInput(role=AccessRole.superadmin, department=Department.administration)]
    )

    with pytest.raises(HTTPException) as denied:
        await access.replace_user_access(actor.id, data, actor, session)

    assert denied.value.status_code == 403
    service.replace_assignments.assert_not_awaited()
    event = session.add.call_args.args[0]
    assert isinstance(event, AuditLog)
    assert event.action == ACCESS_DENIED_ACTION and event.result == "denied"
    assert event.actor_id == actor.id
    assert event.metadata_json == {
        "required": ["role:superadmin"],
        "reason_code": "superadmin_grant_requires_superadmin",
        "brand_key": "breero",
    }
    session.commit.assert_awaited_once()


@pytest.mark.parametrize(
    "previous_status",
    [EventStatus.DEAD_LETTER, EventStatus.FAILED, EventStatus.FAILED_TERMINAL, EventStatus.PENDING_CONFIGURATION],
)
async def test_retry_audit_keeps_only_structured_metadata(previous_status: EventStatus) -> None:
    actor_id = uuid.uuid4()
    event = IntegrationEvent(
        id=uuid.uuid4(),
        aggregate_id=uuid.uuid4(),
        aggregate_type="job",
        event_type="job.completed",
        payload={"private": "payload-must-not-be-copied"},
        status=previous_status,
        attempt_count=5,
        last_error="upstream customer@example.com response-must-not-be-copied",
        last_error_code="UPSTREAM_REJECTED",
        claimed_at=datetime.now(UTC),
        lease_expires_at=datetime.now(UTC) + timedelta(minutes=5),
        claim_token=uuid.uuid4(),
    )
    session = Mock(spec=AsyncSession)
    session.scalar.return_value = event

    assert await OutboxService(session).retry(event.id, actor_id) is event

    audit = session.add.call_args.args[0]
    assert isinstance(audit, AuditLog)
    assert audit.actor_id == actor_id and audit.action == "integration.retry"
    assert audit.resource_id == event.id and audit.resource_type == "integration_event"
    assert audit.metadata_json == {
        "previous_error_code": "UPSTREAM_REJECTED",
        "previous_status": previous_status.value,
        "event_type": "job.completed",
        "aggregate_type": "job",
    }
    assert event.status == EventStatus.PENDING and event.attempt_count == 0
    assert event.claimed_at is event.lease_expires_at is event.claim_token is None
    session.commit.assert_awaited_once()
