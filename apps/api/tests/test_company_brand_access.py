import uuid

import pytest

from app.domains.auth.access_service import AccessService
from app.domains.auth.models import User, UserRole


class EmptyResult:
    def all(self):
        return []


class UnassignedPersistence:
    async def scalar(self, _query):
        return None

    async def scalars(self, _query):
        return EmptyResult()


@pytest.mark.parametrize("legacy_role", list(UserRole))
async def test_legacy_account_role_does_not_authorize_an_unassigned_company(legacy_role):
    user = User(
        id=uuid.uuid4(),
        email="brand-access@example.com",
        password_hash="disabled",
        full_name="Company Access Test",
        role=legacy_role,
        is_active=True,
        email_verified=True,
    )

    context = await AccessService(UnassignedPersistence()).context(user, "solar-company")

    assert context.brand_key == "solar-company"
    assert context.dashboard_path == "/access-denied"
    assert context.roles == []
    assert context.departments == []
    assert context.permissions == []
    assert context.assignments == []
