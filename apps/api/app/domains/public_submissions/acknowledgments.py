"""Canonical BREERO request receipts, separate from CRM delivery and booking."""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.common.outbox import EventStatus, IntegrationEvent
from app.domains.compliance.models import Suppression
from app.domains.compliance.service import digest
from app.integrations.email import EmailAdapter, render_email

from .models import PublicSubmission, SubmissionType

ACKNOWLEDGMENT_EVENT = "public_submission_acknowledgement_requested"
ACKNOWLEDGMENT_AGGREGATE = "public_submission_email"
ACKNOWLEDGMENT_MAX_AGE = timedelta(hours=24)


class AcknowledgmentSuppressed(RuntimeError):
    code = "ACKNOWLEDGMENT_SUPPRESSED"
    terminal = True


class AcknowledgmentExpired(AcknowledgmentSuppressed):
    code = "ACKNOWLEDGMENT_EXPIRED"


def acknowledgment_event(
    submission: PublicSubmission, now: datetime
) -> IntegrationEvent | None:
    """Build a reference-only receipt in the caller's acceptance transaction."""
    if (
        submission.submission_type != SubmissionType.SERVICE_REQUEST
        or submission.payload.get("transactional_contact_allowed") is not True
        or submission.payload.get("transactional_email_consent") is not True
    ):
        return None
    return IntegrationEvent(
        aggregate_type=ACKNOWLEDGMENT_AGGREGATE,
        aggregate_id=submission.id,
        event_type=ACKNOWLEDGMENT_EVENT,
        aggregate_version=1,
        schema_version=1,
        idempotency_key=f"public_submission_ack:{submission.id}:1",
        payload={"submission_id": str(submission.id)},
        status=EventStatus.PENDING,
        next_attempt_at=now,
    )


async def deliver_acknowledgment(
    event: IntegrationEvent, session: AsyncSession, email: EmailAdapter
) -> None:
    """Read current consent and recipient; never trust a queued recipient override."""
    if event.aggregate_type != ACKNOWLEDGMENT_AGGREGATE:
        raise AcknowledgmentSuppressed("Request receipt is not eligible")
    submission = await session.get(PublicSubmission, event.aggregate_id)
    if (
        submission is None
        or submission.submission_type != SubmissionType.SERVICE_REQUEST
        or submission.payload.get("transactional_contact_allowed") is not True
        or submission.payload.get("transactional_email_consent") is not True
        or not submission.normalized_email
        or event.idempotency_key != f"public_submission_ack:{submission.id}:1"
    ):
        raise AcknowledgmentSuppressed("Request receipt is no longer authorized")
    if datetime.now(UTC) >= submission.created_at + ACKNOWLEDGMENT_MAX_AGE:
        raise AcknowledgmentExpired("Request receipt has expired")
    suppressed = await session.scalar(
        select(Suppression.id).where(
            Suppression.destination_hash == digest(submission.normalized_email),
            Suppression.channel.in_(("EMAIL", "ALL")),
            Suppression.purpose.in_(("TRANSACTIONAL_EMAIL", "ALL")),
            Suppression.active.is_(True),
        )
    )
    if suppressed is not None:
        raise AcknowledgmentSuppressed("Request receipt is no longer authorized")
    language = submission.payload.get("language") or "en"
    rendered = render_email(
        "service_request.received", {"request_id": str(submission.id)}, language=language
    )
    payload: dict[str, Any] = {
        "submission_id": str(submission.id),
        "to": submission.normalized_email,
        "subject": rendered.subject,
        "text": rendered.text,
        "purpose": "TRANSACTIONAL_EMAIL",
        "idempotency_key": event.idempotency_key,
    }
    await email.send("service_request.received", payload)
