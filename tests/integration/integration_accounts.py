"""Real Identity accounts for cross-service integration tests.

Tenant scoping means a minted token with a synthetic student ID is no longer
enough: Applications and Internships resolve the caller's student roster from
Identity. These helpers create matching real accounts through the public APIs,
then return the IDs and bearer headers the flow tests need.
"""

import os
import uuid

import requests

IDENTITY_BASE_URL = os.environ.get(
    "IDENTITY_BASE_URL", "http://localhost:8001"
)
PASSWORD = "Z9!kTq2#vLm7"
DEMO_PLATFORM_ADMIN_EMAIL = "admin@stagelink.demo"
DEMO_PLATFORM_ADMIN_PASSWORD = "StagelinkDemo!2026"
UNIVERSITY_PREFIX = "Integration Tenant"
REQUEST_TIMEOUT_SECONDS = 10


def post(path, payload, headers=None):
    return requests.post(
        f"{IDENTITY_BASE_URL}{path}",
        json=payload,
        headers=headers or {},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


def _assert(response, expected, action):
    if response.status_code != expected:
        raise AssertionError(
            f"{action} returned {response.status_code}, expected {expected}: "
            f"{response.text}"
        )
    return response.json()


def _unique_email(prefix):
    return f"{prefix}.{uuid.uuid4().hex[:12]}@integration.stagelink.test"


def platform_headers():
    data = _assert(
        post(
            "/api/auth/login/",
            {
                "email": DEMO_PLATFORM_ADMIN_EMAIL,
                "password": DEMO_PLATFORM_ADMIN_PASSWORD,
            },
        ),
        200,
        "platform administrator login",
    )
    return {"Authorization": f"Bearer {data['access']}"}


def _headers_for(email):
    data = _assert(
        post("/api/auth/login/", {"email": email, "password": PASSWORD}),
        200,
        f"login for {email}",
    )
    return {"Authorization": f"Bearer {data['access']}"}


def _provision(admin_headers, role, prefix, university=None):
    payload = {
        "email": _unique_email(prefix),
        "name": f"Integration {prefix}",
        "role": role,
        "password": PASSWORD,
    }
    if university is not None:
        payload["university"] = university
    return _assert(
        post("/api/admin/users/", payload, admin_headers),
        201,
        f"provision {role}",
    )


def _register_company(admin_headers, prefix):
    email = _unique_email(prefix)
    company = _assert(
        post(
            "/api/auth/register/",
            {
                "email": email,
                "password": PASSWORD,
                "name": f"Integration {prefix}",
                "role": "company",
            },
        ),
        201,
        "register company",
    )
    _assert(
        post(
            f"/api/admin/companies/{company['id']}/verify/",
            {},
            admin_headers,
        ),
        200,
        "verify company",
    )
    return company


def create_flow_accounts(university=None):
    """Return matching company, student and university-admin account context.

    A fresh university per call keeps Applications' short-lived directory cache
    from hiding students created by a later test.
    """

    if university is None:
        university = f"{UNIVERSITY_PREFIX} {uuid.uuid4().hex[:8]}"
    admin_headers = platform_headers()
    company = _register_company(admin_headers, "company.flow")
    student = _provision(admin_headers, "student", "student.flow", university)
    university_admin = _provision(
        admin_headers, "university_admin", "university.flow", university
    )
    return {
        "university": university,
        "company_id": uuid.UUID(company["id"]),
        "company_headers": _headers_for(company["email"]),
        "student_id": uuid.UUID(student["id"]),
        "student_headers": _headers_for(student["email"]),
        "university_id": uuid.UUID(university_admin["id"]),
        "university_headers": _headers_for(university_admin["email"]),
    }
