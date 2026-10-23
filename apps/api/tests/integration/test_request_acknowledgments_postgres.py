import asyncio
import os
import uuid
from unittest.mock import Mock

import pytest
from sqlalchemy import select

from app.config import settings
from app.db.session import SessionLocal
from app.domains.catalog.models import Service
from app.domains.common.outbox import EventStatus, IntegrationEvent
from app.domains.common.outbox_service import OutboxService
from app.domains.compliance.models import Suppression
from app.domains.compliance.service import digest
from app.domains.public_submissions.models import DownstreamStatus, PublicSubmission, SubmissionType
from app.domains.public_submissions.schemas import ServiceRequestCreate
from app.domains.public_submissions.service import PublicSubmissionService
from app.integrations.email import EmailAdapter
from app.workers.tasks import deliver_outbox_event

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgresql"),
    reason="requires isolated PostgreSQL",
)


class CaptureEmail:
    def __init__(self):
        self.messages = []

    async def send(self, event_type, payload):
        self.messages.append((event_type, payload))


async def prepare_request(*, email_permission=True, marketing_permission=False):
    marker = uuid.uuid4().hex
    slug = f"ack-fixture-{marker}"
    async with SessionLocal() as session:
        session.add(Service(slug=slug, name="Receipt test", is_active=True, is_bookable=False))
        await session.commit()
    data = ServiceRequestCreate(
        name="Receipt Customer",
        email=f"receipt-{marker}@example.com",
        phone="+1 281 555 0199",
        service_slug=slug,
        service_description="Private details must not be copied to the receipt.",
        address_line1="1 Test Street",
        city="Houston",
        state="TX",
        postal_code="77002",
        contact_preference="email",
        source_url="https://breero.com/request-service",
        transactional_contact_allowed=True,
        transactional_email_consent=email_permission,
        marketing_email_consent=marketing_permission,
        policy_version="2026-08-13-request-only",
        language="es",
    )
    return data, f"receipt-{marker}"


async def accept(data, key):
    async with SessionLocal() as session:
        return await PublicSubmissionService(session).accept(
            SubmissionType.SERVICE_REQUEST, data, key, "192.0.2.70",
        )


async def events_for(identifier):
    async with SessionLocal() as session:
        return list((await session.scalars(
            select(IntegrationEvent).where(IntegrationEvent.aggregate_id == identifier),
        )).all())


async def test_concurrent_replay_creates_one_receipt_in_the_inquiry_transaction(monkeypatch):
    monkeypatch.setattr(settings, "middleware_enabled", False)
    data, key = await prepare_request()
    first, second = await asyncio.gather(accept(data, key), accept(data, key))
    replay = await accept(data, key)
    assert first.request_id == second.request_id == replay.request_id
    events = await events_for(first.request_id)
    assert len(events) == 2
    crm = next(e for e in events if e.event_type == "breero.service_request.created")
    receipt = next(e for e in events if e.event_type == "public_submission_acknowledgement_requested")
    assert receipt.aggregate_type == "public_submission_email"
    assert receipt.payload == {"submission_id": str(first.request_id)}
    assert receipt.idempotency_key == f"public_submission_ack:{first.request_id}:1"
    assert crm.status == EventStatus.PENDING_CONFIGURATION


@pytest.mark.parametrize("marketing_permission", [False, True])
async def test_no_receipt_without_transactional_channel_permission(monkeypatch, marketing_permission):
    monkeypatch.setattr(settings, "middleware_enabled", False)
    data, key = await prepare_request(
        email_permission=False, marketing_permission=marketing_permission,
    )
    accepted = await accept(data, key)
    events = await events_for(accepted.request_id)
    assert [e.event_type for e in events] == ["breero.service_request.created"]


async def test_current_suppression_is_rechecked_after_the_request_was_accepted(monkeypatch):
    monkeypatch.setattr(settings, "middleware_enabled", False)
    data, key = await prepare_request()
    accepted = await accept(data, key)
    async with SessionLocal() as session:
        session.add(Suppression(
            destination_hash=digest(str(data.email)),
            channel="EMAIL",
            purpose="TRANSACTIONAL_EMAIL",
            active=True,
            reason="PREFERENCE_WITHDRAWN",
            source="PREFERENCE_CENTER",
        ))
        await session.commit()
        event = await session.scalar(select(IntegrationEvent).where(
            IntegrationEvent.aggregate_id == accepted.request_id,
            IntegrationEvent.event_type == "public_submission_acknowledgement_requested",
        ))
        assert event is not None
        email = CaptureEmail()
        with pytest.raises(RuntimeError) as error:
            await deliver_outbox_event(event, session, Mock(), email)
        assert error.value.code == "ACKNOWLEDGMENT_SUPPRESSED"
        assert email.messages == []


async def test_receipt_is_independent_of_crm_parking_and_live_delivery_stays_dark(monkeypatch):
    monkeypatch.setattr(settings, "middleware_enabled", False)
    monkeypatch.setattr(settings, "live_email_delivery", False)
    data, key = await prepare_request()
    accepted = await accept(data, key)
    async with SessionLocal() as session:
        event = await session.scalar(select(IntegrationEvent).where(
            IntegrationEvent.aggregate_id == accepted.request_id,
            IntegrationEvent.event_type == "public_submission_acknowledgement_requested",
        ))
        assert event is not None
        assert event.status == EventStatus.PENDING
        await OutboxService(session).park_unconfigured()
        await session.refresh(event)
        assert event.status == EventStatus.PENDING
        async def deliver(item):
            return await deliver_outbox_event(item, session, Mock(), EmailAdapter())
        # Process only this event through the real parking/error path.
        try:
            await deliver(event)
        except Exception as error:
            assert error.code == "EMAIL_DELIVERY_DISABLED"
            assert error.pending_configuration is True
        else:
            pytest.fail("disabled delivery must not succeed")
        submission = await session.get(PublicSubmission, accepted.request_id)
        assert submission.downstream_status == DownstreamStatus.PENDING_CONFIGURATION


async def test_solar_seed_is_quote_only_without_invented_price(monkeypatch):
    from app.seed import seed

    monkeypatch.setattr(settings, "app_env", "staging")
    await seed()
    async with SessionLocal() as session:
        solar = await session.scalar(select(Service).where(Service.slug == "solar-panel-installation"))
        assert solar is not None
        assert solar.is_active is True
        assert solar.is_bookable is False
        assert solar.quote_required is True
        assert solar.provider_approval_required is True
        assert solar.base_price is None
        assert solar.duration_minutes is None
        assert solar.pricing_model == "quote_required"
    # The same canonical intake accepts the new catalog offering without booking.
    data, key = await prepare_request()
    data.service_slug = "solar-panel-installation"
    accepted = await accept(data, key)
    async with SessionLocal() as session:
        submission = await session.get(PublicSubmission, accepted.request_id)
        assert submission.payload["service_slug"] == "solar-panel-installation"
        assert submission.payload["appointment_confirmed"] is False
