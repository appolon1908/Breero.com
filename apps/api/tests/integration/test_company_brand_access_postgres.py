import os
import uuid

import pytest

from app.db.session import SessionLocal
from app.domains.auth.access_service import AccessService
from app.domains.auth.models import (
    AccessAssignment,
    AccessProfile,
    AccessRole,
    Department,
    TenantScope,
    User,
    UserPermission,
    UserRole,
)

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgresql"),
    reason="requires isolated PostgreSQL",
)


async def create_user():
    user = User(
        id=uuid.uuid4(),
        email=f"company-access-{uuid.uuid4().hex}@example.com",
        password_hash="disabled",
        full_name="Company Access Test",
        role=UserRole.admin,
        is_active=True,
        email_verified=True,
    )
    async with SessionLocal() as session:
        session.add(user)
        await session.commit()
    return user


def assignment(user, brand, role=AccessRole.support):
    return AccessAssignment(
        user_id=user.id,
        brand_key=brand,
        role_key=role.value,
        department=Department.customer_support.value,
        tenant_scope=TenantScope.brand.value,
        active=True,
        is_primary=True,
    )


async def read_context(user, brand):
    async with SessionLocal() as session:
        return await AccessService(session).context(user, brand)


def assert_denied(context):
    assert context.dashboard_path == "/access-denied"
    assert context.roles == []
    assert context.departments == []
    assert context.permissions == []
    assert context.assignments == []


async def test_global_role_assignment_does_not_cross_company_or_user_boundaries():
    user, other = await create_user(), await create_user()
    brand_a, brand_b = f"solar-{uuid.uuid4().hex}", f"solar-{uuid.uuid4().hex}"
    privileged = assignment(user, brand_a, AccessRole.superadmin)
    privileged.tenant_scope = TenantScope.global_.value
    async with SessionLocal() as session:
        session.add_all([privileged, assignment(other, brand_b)])
        await session.commit()

    own = await read_context(user, brand_a)
    assert own.roles == [AccessRole.superadmin]
    assert own.permissions == ["*"]
    assert_denied(await read_context(user, brand_b))
    assert_denied(await read_context(other, brand_a))
    assert (await read_context(other, brand_b)).roles == [AccessRole.support]


async def test_explicit_company_role_and_permission_overrides_are_brand_scoped():
    user = await create_user()
    brand_a, brand_b = f"solar-{uuid.uuid4().hex}", f"solar-{uuid.uuid4().hex}"
    async with SessionLocal() as session:
        session.add_all([
            assignment(user, brand_a),
            assignment(user, brand_b),
            UserPermission(user_id=user.id, brand_key=brand_a,
                           permission="support.bookings.read", allow=False),
            UserPermission(user_id=user.id, brand_key=brand_a,
                           permission="company.custom.read", allow=True),
        ])
        await session.commit()

    context = await read_context(user, brand_a)
    assert context.roles == [AccessRole.support]
    assert "*" not in context.permissions
    assert "support.bookings.read" not in context.permissions
    assert "company.custom.read" in context.permissions
    assert context.assignments[0].tenant_scope == TenantScope.brand
    other_context = await read_context(user, brand_b)
    assert "support.bookings.read" in other_context.permissions
    assert "company.custom.read" not in other_context.permissions

    async with SessionLocal() as session:
        session.add(AccessProfile(user_id=user.id, brand_key=brand_a))
        await session.commit()
    assert (await read_context(user, brand_a)).model_dump() == context.model_dump()


async def test_revoked_company_assignment_cannot_fall_back_or_use_direct_wildcard():
    user = await create_user()
    brand = f"solar-{uuid.uuid4().hex}"
    record = assignment(user, brand)
    async with SessionLocal() as session:
        session.add(record)
        await session.commit()
        record.active = False
        session.add(UserPermission(user_id=user.id, brand_key=brand, permission="*", allow=True))
        await session.commit()
    # No profile exists: an inactive row or permission override is not membership.
    assert_denied(await read_context(user, brand))

    async with SessionLocal() as session:
        await AccessService(session).replace_assignments(user.id, brand, [])
    # Supported revocation persists its managed no-access profile across sessions.
    assert_denied(await read_context(user, brand))


async def test_unmanaged_canonical_account_retains_legacy_access_and_managed_revocation():
    user = await create_user()
    canonical = await read_context(user, "breero")
    assert canonical.roles == [AccessRole.admin]
    assert canonical.dashboard_path == "/admin"
    assert "admin.access.manage" in canonical.permissions
    assert_denied(await read_context(user, f"solar-{uuid.uuid4().hex}"))

    async with SessionLocal() as session:
        await AccessService(session).replace_assignments(user.id, "breero", [])
    assert_denied(await read_context(user, "breero"))
