import uuid

import pytest
from fastapi import FastAPI
from pydantic import ValidationError

from app.api.v1.provider_workforce import router
from app.domains.workforce.models import Vendor, Worker, WorkerStatus
from app.domains.workforce.provider_team import worker_read
from app.domains.workforce.schemas import ProviderWorkerCreate, ProviderWorkerList


def worker_payload() -> dict:
    return {
        "first_name": " Ada ",
        "last_name": " Lovelace ",
        "email": "ada@example.com",
        "phone": " +15551234567 ",
    }


def test_provider_worker_create_normalizes_contact_fields() -> None:
    command = ProviderWorkerCreate.model_validate(worker_payload())

    assert command.first_name == "Ada"
    assert command.last_name == "Lovelace"
    assert command.phone == "+15551234567"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("user_id", str(uuid.uuid4())),
        ("vendor_id", str(uuid.uuid4())),
        ("status", "ACTIVE"),
        ("available", True),
        ("skills", ["plumbing"]),
        ("has_account", True),
        ("is_account_owner", True),
    ],
)
def test_provider_worker_create_rejects_privileged_fields(field, value) -> None:
    with pytest.raises(ValidationError):
        ProviderWorkerCreate.model_validate({**worker_payload(), field: value})


@pytest.mark.parametrize(
    ("field", "value"),
    [("first_name", " "), ("last_name", " "), ("email", "invalid"), ("phone", "123")],
)
def test_provider_worker_create_rejects_invalid_contact_fields(field, value) -> None:
    with pytest.raises(ValidationError):
        ProviderWorkerCreate.model_validate({**worker_payload(), field: value})


@pytest.mark.parametrize("account", ["unlinked", "member", "owner"])
def test_provider_worker_read_exposes_account_flags_without_identity_ids(account) -> None:
    owner_id = uuid.uuid4()
    vendor = Vendor(id=uuid.uuid4(), owner_user_id=owner_id)
    worker = Worker(
        id=uuid.uuid4(),
        vendor_id=vendor.id,
        user_id=None if account == "unlinked" else owner_id if account == "owner" else uuid.uuid4(),
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        phone="+15551234567",
        status=WorkerStatus.INVITED,
        available=False,
        skills=[],
    )

    result = worker_read(vendor, worker)
    listing = ProviderWorkerList(items=[result], total=1).model_dump(mode="json")

    assert result.has_account is (account != "unlinked")
    assert result.is_account_owner is (account == "owner")
    assert listing["total"] == 1
    assert listing["items"][0]["id"] == str(worker.id)
    assert "user_id" not in listing["items"][0]
    assert "vendor_id" not in listing["items"][0]


def test_provider_worker_router_has_request_and_response_contracts() -> None:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/provider/workers")

    contract = app.openapi()
    operations = contract["paths"]["/api/v1/provider/workers"]
    schemas = contract["components"]["schemas"]
    assert operations["get"]["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProviderWorkerList"
    }
    assert operations["post"]["responses"]["201"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProviderWorkerRead"
    }
    assert operations["post"]["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ProviderWorkerCreate"
    }
    assert schemas["ProviderWorkerCreate"]["additionalProperties"] is False
    assert set(schemas["ProviderWorkerCreate"]["properties"]) == {
        "first_name", "last_name", "email", "phone"
    }
