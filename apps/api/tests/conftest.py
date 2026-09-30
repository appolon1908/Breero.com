"""Shared test-process safety guard.

Never override an environment selected by the operator or dotenv-backed
application settings. Tests that need APP_ENV=test must receive it explicitly
from their test runner/CI environment.
"""

from __future__ import annotations

import os

if "APP_ENV" not in os.environ:
    # Do not synthesize test mode here: pydantic-settings may still load a
    # staging/production .env (including DATABASE_URL) after this module loads.
    # Unit tests use their own dependency overrides; integration CI must set
    # APP_ENV=test together with its isolated database explicitly.
    pass
