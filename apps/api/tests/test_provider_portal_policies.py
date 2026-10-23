"""Policy coverage for the provider and marketplace routes mounted by the portal."""
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
from app.api.v1 import (
    provider_availability,
    provider_catalog,
    provider_qualifications,
    provider_work,
    provider_workforce,
)
from app.domains.auth.access_service import AccessService
from app.domains.auth.models import AccessRole

OPERATIONS = [('GET', '/api/v1/provider/workers'), ('POST', '/api/v1/provider/workers'), ('GET', '/api/v1/provider/availability'), ('GET', '/api/v1/provider/availability/preview'), ('POST', '/api/v1/provider/availability/rules'), ('PATCH', '/api/v1/provider/availability/rules/{rule_id}'), ('DELETE', '/api/v1/provider/availability/rules/{rule_id}'), ('POST', '/api/v1/provider/availability/blackouts'), ('PATCH', '/api/v1/provider/availability/blackouts/{blackout_id}'), ('DELETE', '/api/v1/provider/availability/blackouts/{blackout_id}'), ('GET', '/api/v1/provider/qualifications'), ('POST', '/api/v1/provider/qualifications'), ('GET', '/api/v1/provider/qualifications/{qualification_id}'), ('PATCH', '/api/v1/provider/qualifications/{qualification_id}'), ('DELETE', '/api/v1/provider/qualifications/{qualification_id}'), ('POST', '/api/v1/provider/qualifications/{qualification_id}/submit'), ('POST', '/api/v1/provider/qualifications/{qualification_id}/evidence'), ('POST', '/api/v1/admin/provider-qualifications/{qualification_id}/review'), ('GET', '/api/v1/provider/jobs'), ('GET', '/api/v1/provider/offers'), ('POST', '/api/v1/provider/offers/{offer_id}/decision')]

@pytest.fixture(scope='module')
def feature_app():
    app = FastAPI()
    app.include_router(provider_workforce.router, prefix='/api/v1/provider/workers')
    app.include_router(provider_availability.router, prefix='/api/v1/provider/availability')
    app.include_router(provider_qualifications.router, prefix='/api/v1/provider/qualifications')
    app.include_router(provider_qualifications.admin_router, prefix='/api/v1/admin/provider-qualifications')
    app.include_router(provider_work.router, prefix='/api/v1/provider')
    return app

def feature_route(app, method, path):
    return next((route.original_route for route in iter_api_route_contexts(app) if route.path == path and method in route.methods))

def authorization(route):
    for dependency in route.dependant.dependencies:
        values = inspect.getclosurevars(dependency.call).nonlocals
        if 'required' in values or 'allowed_roles' in values:
            return (dependency.call, values)
    raise AssertionError('Feature route has no authorization dependency')

def test_all_provider_operations_have_exactly_one_policy(feature_app):
    policies = build_endpoint_policies(feature_app)
    assert {(policy.method, policy.path) for policy in policies} == set(OPERATIONS)
    assert all((policy.permission != 'none' for policy in policies))

@pytest.mark.parametrize(('method', 'path'), OPERATIONS)
@pytest.mark.asyncio
async def test_feature_policy_matches_authorization_and_denies_missing_access(feature_app, monkeypatch, method, path):
    matches = _matching_rules(method, path)
    assert len(matches) == 1
    rule = matches[0]
    dependency, values = authorization(feature_route(feature_app, method, path))
    assert rule.authentication == 'bearer'
    context = SimpleNamespace(roles=set(), permissions=set())

    async def access_context(*_args):
        return context
    monkeypatch.setattr(AccessService, 'context', access_context)
    principal = SimpleNamespace(id=uuid.uuid4())
    if 'required' in values:
        required = values['required']
        assert set(rule.permission.split(' && ')) == set(required)
        context.permissions = set(required)
        assert await dependency(principal, None) is principal
        for missing in required:
            context.permissions = set(required) - {missing}
            with pytest.raises(HTTPException) as denied:
                await dependency(principal, None)
            assert denied.value.status_code == 403
    else:
        allowed = values['allowed_roles']
        assert set(rule.permission.split(':', 1)[1].split('|')) == {role.value for role in allowed}
        for role in AccessRole:
            context.roles = {role}
            if role in allowed:
                assert await dependency(principal, None) is principal
            else:
                with pytest.raises(HTTPException) as denied:
                    await dependency(principal, None)
                assert denied.value.status_code == 403

@pytest.mark.parametrize('path', sorted({path for _, path in OPERATIONS}))
def test_feature_policies_do_not_claim_unmounted_methods(path):
    allowed = {method for method, candidate in OPERATIONS if candidate == path}
    if path == '/api/v1/provider/availability':
        allowed.add('PUT')
    for method in OPENAPI_METHODS - allowed:
        assert not _matching_rules(method, path), (method, path)

@pytest.mark.parametrize('path', ['/api/v1/provider/workers/{worker_id}', '/api/v1/provider/availability/rules/{rule_id}/approve', '/api/v1/provider/qualifications/{qualification_id}/review', '/api/v1/admin/provider-qualifications/{qualification_id}'])
def test_neighboring_feature_routes_still_fail_closed(path):
    for method in OPENAPI_METHODS:
        assert not _matching_rules(method, path)

def test_feature_policy_preserves_write_preconditions_and_disabled_storage(feature_app):
    policies = {(p.method, p.path): p for p in build_endpoint_policies(feature_app)}
    for method, path in OPERATIONS:
        policy = policies[method, path]
        route = feature_route(feature_app, method, path)
        headers = {field.alias for field in route.dependant.header_params}
        assert (policy.if_match_version_policy == 'required') == ('If-Match' in headers)
        if 'Idempotency-Key' in headers:
            assert policy.idempotency_key_policy == 'required'
            assert policy.request_hash_policy == 'required'
    evidence = policies['POST', '/api/v1/provider/qualifications/{qualification_id}/evidence']
    assert evidence.capability_gate == 'unavailable:governed-evidence-storage'
    assert evidence.emitted_effect == 'none'

def test_canonical_provider_handlers_replace_only_shadowed_legacy_gets():
    from app.api.v1.router import api_router
    app = FastAPI()
    app.include_router(api_router, prefix='/api/v1')
    routes = list(iter_api_route_contexts(app))
    for path, endpoint in [('/api/v1/provider/jobs', provider_work.list_provider_jobs), ('/api/v1/provider/availability', provider_availability.get_provider_availability)]:
        matching = [route for route in routes if route.path == path and 'GET' in route.methods]
        assert len(matching) == 1
        assert matching[0].original_route.endpoint is endpoint
    mounted = {(method, route.path) for route in routes for method in route.methods}
    assert {('GET', '/api/v1/provider/jobs/{job_id}'), ('PUT', '/api/v1/provider/availability'), ('GET', '/api/v1/provider/availability/exceptions'), ('PATCH', '/api/v1/provider/capacity'), ('GET', '/api/v1/provider/service-areas')} <= mounted


@pytest.mark.asyncio
async def test_skill_catalog_policy_matches_its_permission_and_fails_closed(monkeypatch):
    app = FastAPI()
    app.include_router(provider_catalog.router, prefix="/api/v1/provider")
    path = "/api/v1/provider/skill-catalog"
    policy = next(p for p in build_endpoint_policies(app) if p.path == path)
    assert policy.method == "GET"
    assert policy.permission == "provider.skills.read"
    assert policy.tenant_scope == "global-catalog"
    assert policy.record_policy == "active-catalog-skills-only"
    assert policy.emitted_effect == "none"
    dependency, values = authorization(feature_route(app, "GET", path))
    assert values["required"] == {"provider.skills.read"}
    context = SimpleNamespace(roles=set(), permissions=set())

    async def access_context(*_args):
        return context

    monkeypatch.setattr(AccessService, "context", access_context)
    principal = SimpleNamespace(id=uuid.uuid4())
    with pytest.raises(HTTPException) as denied:
        await dependency(principal, None)
    assert denied.value.status_code == 403
    context.permissions = {"provider.skills.read"}
    assert await dependency(principal, None) is principal
    for method in OPENAPI_METHODS - {"GET"}:
        assert not _matching_rules(method, path)
    assert not _matching_rules("GET", path + "/unreviewed")
