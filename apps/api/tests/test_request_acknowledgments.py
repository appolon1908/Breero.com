import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from app.config import settings
from app.domains.catalog.models import Service
from app.domains.common.outbox import EventStatus, IntegrationEvent
from app.domains.public_submissions.models import DownstreamStatus, SubmissionType
from app.integrations.email import render_email
from app.workers.tasks import deliver_outbox_event


async def test_receipt_http_handoff_preserves_opaque_deduplication_key(monkeypatch):
    from app.integrations import email

    monkeypatch.setattr(settings, "live_email_delivery", True)
    monkeypatch.setattr(settings, "email_enabled", True)
    monkeypatch.setattr(settings, "transactional_email_mode", "controlled_canary")
    monkeypatch.setenv("EMAIL_DELIVERY_URL", "https://email.example.invalid/send")
    client, context = AsyncMock(), AsyncMock()
    context.__aenter__.return_value = client
    client.post.return_value = httpx.Response(
        202, request=httpx.Request("POST", "https://email.example.invalid/send"),
    )
    monkeypatch.setattr(email.httpx, "AsyncClient", Mock(return_value=context))
    key = "public_submission_ack:00000000-0000-0000-0000-000000000001:1"
    adapter = email.EmailAdapter()
    await adapter.send("service_request.received", {"idempotency_key": key})
    await adapter.send("service_request.received", {"idempotency_key": key})
    assert [call.kwargs["headers"].get("Idempotency-Key") for call in client.post.call_args_list] == [key, key]


async def test_seed_adds_quote_only_solar_without_a_fixed_price(monkeypatch):
    from app import seed as catalog

    session = AsyncMock()
    session.scalar.return_value = None
    session.scalars.return_value = SimpleNamespace(all=lambda: [])
    session.add = Mock()
    context = AsyncMock()
    context.__aenter__.return_value = session
    monkeypatch.setattr(catalog, "SessionLocal", Mock(return_value=context))
    monkeypatch.setattr(settings, "app_env", "staging")
    await catalog.seed()
    services = [call.args[0] for call in session.add.call_args_list if isinstance(call.args[0], Service)]
    solar = next((item for item in services if item.slug == "solar-panel-installation"), None)
    assert solar is not None
    assert solar.is_active is True
    assert solar.is_bookable is False
    assert solar.quote_required is True
    assert solar.provider_approval_required is True
    assert solar.base_price is None
    assert solar.duration_minutes is None
    assert solar.pricing_model == "quote_required"


class CaptureEmail:
    def __init__(self):
        self.messages = []

    async def send(self, event_type, payload):
        self.messages.append((event_type, payload))


def receipt_fixture():
    identifier = uuid.uuid4()
    submission = SimpleNamespace(
        id=identifier,
        submission_type=SubmissionType.SERVICE_REQUEST,
        normalized_email="client@example.invalid",
        created_at=datetime.now(UTC),
        downstream_status=DownstreamStatus.PENDING_CONFIGURATION,
        payload={
            "transactional_contact_allowed": True,
            "transactional_email_consent": True,
            "language": "es-MX",
            "service_description": "PRIVATE customer description",
        },
    )
    event = IntegrationEvent(
        id=uuid.uuid4(),
        aggregate_id=identifier,
        aggregate_type="public_submission_email",
        event_type="public_submission_acknowledgement_requested",
        idempotency_key=f"public_submission_ack:{identifier}:1",
        payload={"submission_id": str(identifier), "to": "forged@example.invalid"},
        status=EventStatus.PENDING,
        next_attempt_at=datetime.now(UTC),
    )
    session = AsyncMock()
    session.get.return_value = submission
    session.scalar.return_value = None
    return submission, event, session


@pytest.mark.parametrize(
    "language, subject_fragment, body_fragment",
    [
        ("en", "received", "not confirmed"),
        ("es", "recibida", "no están confirmados"),
        ("es-MX", "recibida", "no están confirmados"),
        ("fr", "received", "not confirmed"),
    ],
)
def test_receipt_language_and_request_only_meaning(language, subject_fragment, body_fragment):
    reference = str(uuid.uuid4())
    result = render_email("service_request.received", {"request_id": reference}, language=language)
    assert subject_fragment in result.subject
    assert body_fragment in result.text
    assert reference in result.text


async def test_receipt_reads_authoritative_recipient_without_changing_crm_status():
    submission, event, session = receipt_fixture()
    email, middleware = CaptureEmail(), Mock()
    await deliver_outbox_event(event, session, middleware, email)
    assert len(email.messages) == 1
    event_type, payload = email.messages[0]
    assert event_type == "service_request.received"
    assert payload["to"] == "client@example.invalid"
    assert payload["idempotency_key"] == f"public_submission_ack:{submission.id}:1"
    assert payload["purpose"] == "TRANSACTIONAL_EMAIL"
    assert "no están confirmados" in payload["text"]
    assert "PRIVATE" not in str(payload)
    assert "forged" not in str(payload)
    assert submission.downstream_status == DownstreamStatus.PENDING_CONFIGURATION
    assert middleware.mock_calls == []


@pytest.mark.parametrize(
    "change",
    ["missing", "wrong_kind", "contact_withdrawn", "email_withdrawn", "suppressed", "expired"],
)
async def test_ineligible_receipts_never_reach_email_adapter(change):
    submission, event, session = receipt_fixture()
    if change == "missing":
        session.get.return_value = None
    elif change == "wrong_kind":
        submission.submission_type = SubmissionType.CONTACT
    elif change == "contact_withdrawn":
        submission.payload["transactional_contact_allowed"] = False
    elif change == "email_withdrawn":
        submission.payload["transactional_email_consent"] = False
    elif change == "suppressed":
        session.scalar.return_value = object()
    elif change == "expired":
        submission.created_at -= timedelta(hours=25)
    email = CaptureEmail()
    with pytest.raises(RuntimeError) as error:
        await deliver_outbox_event(event, session, Mock(), email)
    expected = "ACKNOWLEDGMENT_EXPIRED" if change == "expired" else "ACKNOWLEDGMENT_SUPPRESSED"
    assert error.value.code == expected
    assert error.value.terminal is True
    assert email.messages == []
    assert "client@" not in str(error.value)
