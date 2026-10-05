from fastapi import APIRouter

from app.api.v2 import capabilities, marketplace, project_requests

api_router = APIRouter()
api_router.include_router(capabilities.router, tags=["capabilities"])
api_router.include_router(project_requests.router, tags=["project-requests"])
api_router.include_router(marketplace.router, tags=["marketplace"])
