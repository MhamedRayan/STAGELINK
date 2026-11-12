"""End-to-end tests driven by real accounts, not minted tokens.

Every user below is created through the Identity API, signs in with a real
password, and then performs the business flow with the issued access token.
The platform administrator is the only bootstrap account: it comes from
``manage.py seed_demo`` (see docs/setup.md). The full-flow test skips with a
clear message when that account has not been seeded.

Run against the Compose stack::

    docker compose --env-file .env -f infra/docker/docker-compose.yml \\
        exec -T identity python manage.py seed_demo
    python -m unittest discover -s tests/integration -v
"""

import os
import time
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

import requests

DEFAULT_IDENTITY_BASE_URL = "http://localhost:8001"
DEFAULT_OFFERS_BASE_URL = "http://localhost:8002"
DEFAULT_APPLICATIONS_BASE_URL = "http://localhost:8003"
DEFAULT_INTERNSHIPS_BASE_URL = "http://localhost:8004"
DEFAULT_INTERNAL_SERVICE_TOKEN = "dev-only-internal-service-token-change-me"

IDENTITY_BASE_URL = os.environ.get("IDENTITY_BASE_URL", DEFAULT_IDENTITY_BASE_URL)
OFFERS_BASE_URL = os.environ.get("OFFERS_BASE_URL", DEFAULT_OFFERS_BASE_URL)
APPLICATIONS_BASE_URL = os.environ.get(
    "APPLICATIONS_BASE_URL", DEFAULT_APPLICATIONS_BASE_URL
)
INTERNSHIPS_BASE_URL = os.environ.get(
    "INTERNSHIPS_BASE_URL", DEFAULT_INTERNSHIPS_BASE_URL
)
INTERNAL_SERVICE_TOKEN = os.environ.get(
    "INTERNAL_SERVICE_TOKEN", DEFAULT_INTERNAL_SERVICE_TOKEN
)
CORS_ALLOWED_ORIGIN = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")[0].strip()
CORS_DENIED_ORIGIN = "http://cors-not-allowed.invalid"

DEMO_ADMIN_EMAIL = os.environ.get("DEMO_ADMIN_EMAIL", "admin@stagelink.demo")
DEMO_ADMIN_PASSWORD = os.environ.get("DEMO_ADMIN_PASSWORD", "StagelinkDemo!2026")

REQUEST_TIMEOUT_SECONDS = 15
SERVICE_STARTUP_TIMEOUT_SECONDS = 60
PASSWORD = "IntegrationStrongPassword!2026"
NEW_PASSWORD = "IntegrationNewPassword!2026"
ROLE_STUDENT = "student"
ROLE_COMPANY = "company"
ROLE_SUPERVISOR = "supervisor"
ROLE_UNIVERSITY_ADMIN = "university_admin"


def unique_email(prefix):
    return f"{prefix}.{uuid.uuid4().hex[:12]}@integration.stagelink.test"


def auth_headers(access):
    return {"Authorization": f"Bearer {access}"}


def wait_for_service(name, base_url):
    deadline = time.monotonic() + SERVICE_STARTUP_TIMEOUT_SECONDS
    last_error = None
    while time.monotonic() < deadline:
        try:
            response = requests.get(f"{base_url}/health/", timeout=2)
            if response.status_code == 200:
                return
            last_error = f"HTTP {response.status_code}"
        except requests.RequestException as exc:
            last_error = str(exc)
        time.sleep(1)
    raise RuntimeError(
        f"{name} did not become healthy at {base_url} within "
        f"{SERVICE_STARTUP_TIMEOUT_SECONDS}s: {last_error}"
    )


class RealAccountTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        wait_for_service("identity", IDENTITY_BASE_URL)
        wait_for_service("offers", OFFERS_BASE_URL)
        wait_for_service("applications", APPLICATIONS_BASE_URL)
        wait_for_service("internships", INTERNSHIPS_BASE_URL)

    def assert_status(self, response, expected):
        self.assertEqual(
            response.status_code,
            expected,
            msg=(
                f"{response.request.method} {response.url} returned "
                f"{response.status_code}, expected {expected}: {response.text}"
            ),
        )

    def post(self, path, payload, headers=None, base_url=IDENTITY_BASE_URL):
        response = requests.post(
            f"{base_url}{path}",
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        return response

    def get(self, path, headers=None, base_url=IDENTITY_BASE_URL):
        return requests.get(
            f"{base_url}{path}",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    def register(self, role, email, name):
        response = self.post(
            "/api/auth/register/",
            {"email": email, "password": PASSWORD, "name": name, "role": role},
        )
        self.assert_status(response, 201)
        return response.json()

    def login(self, email, password=PASSWORD):
        response = self.post(
            "/api/auth/login/", {"email": email, "password": password}
        )
        self.assert_status(response, 200)
        return response.json()

    def admin_headers(self):
        response = self.post(
            "/api/auth/login/",
            {"email": DEMO_ADMIN_EMAIL, "password": DEMO_ADMIN_PASSWORD},
        )
        if response.status_code != 200:
            self.skipTest(
                "Seed the demo platform administrator first: "
                "docker compose --env-file .env -f infra/docker/docker-compose.yml "
                "exec -T identity python manage.py seed_demo"
            )
        return auth_headers(response.json()["access"])

    def create_provisioned_user(self, admin_headers, *, role, email, name):
        response = self.post(
            "/api/admin/users/",
            {"email": email, "name": name, "role": role, "password": PASSWORD},
            headers=admin_headers,
        )
        self.assert_status(response, 201)
        payload = response.json()
        self.assertEqual(payload["role"], role)
        self.assertTrue(payload["is_active"])
        return payload


class IdentityAccountLifecycleTests(RealAccountTestCase):
    def test_registration_login_password_change_logout_and_deactivation(self):
        email = unique_email("student.lifecycle")
        profile = self.register(ROLE_STUDENT, email, "Lifecycle Student")
        self.assertEqual(profile["role"], ROLE_STUDENT)
        self.assertTrue(profile["is_active"])

        tokens = self.login(email)
        headers = auth_headers(tokens["access"])

        me = self.get("/api/users/me/", headers)
        self.assert_status(me, 200)
        self.assertEqual(me.json()["id"], profile["id"])
        self.assertEqual(me.json()["email"], email)

        changed = self.post(
            "/api/users/me/password/",
            {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
            headers,
        )
        self.assert_status(changed, 200)

        stale_refresh = self.post(
            "/api/auth/refresh/", {"refresh": tokens["refresh"]}
        )
        self.assert_status(stale_refresh, 401)

        new_tokens = self.login(email, NEW_PASSWORD)
        new_headers = auth_headers(new_tokens["access"])

        logged_out = self.post(
            "/api/auth/logout/", {"refresh": new_tokens["refresh"]}, new_headers
        )
        self.assert_status(logged_out, 200)
        revoked_refresh = self.post(
            "/api/auth/refresh/", {"refresh": new_tokens["refresh"]}
        )
        self.assert_status(revoked_refresh, 401)

        deactivated = self.post(
            "/api/users/me/deactivate/", {"password": NEW_PASSWORD}, new_headers
        )
        self.assert_status(deactivated, 200)

        blocked = self.post(
            "/api/auth/login/", {"email": email, "password": NEW_PASSWORD}
        )
        self.assert_status(blocked, 401)

    def test_company_registration_stays_inactive_until_verified(self):
        admin_headers = self.admin_headers()
        email = unique_email("company.verify")
        profile = self.register(ROLE_COMPANY, email, "Verification Company")

        self.assertFalse(profile["is_active"])
        self.assert_status(
            self.post("/api/auth/login/", {"email": email, "password": PASSWORD}),
            401,
        )

        verified = self.post(
            f"/api/admin/companies/{profile['id']}/verify/",
            {},
            admin_headers,
        )
        self.assert_status(verified, 200)
        self.assertEqual(verified.json()["verification_status"], "active")

        self.login(email)


class CorsIntegrationTests(RealAccountTestCase):
    def preflight(self, origin):
        return requests.options(
            f"{OFFERS_BASE_URL}/api/offers/",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    def test_configured_front_end_origin_is_allowed(self):
        response = self.preflight(CORS_ALLOWED_ORIGIN)

        self.assert_status(response, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            CORS_ALLOWED_ORIGIN,
        )

    def test_unlisted_origin_gets_no_cors_permission(self):
        response = self.preflight(CORS_DENIED_ORIGIN)

        self.assertNotIn("access-control-allow-origin", response.headers)


class FullDemoFlowTests(RealAccountTestCase):
    def test_real_accounts_complete_the_offer_to_internship_flow(self):
        admin_headers = self.admin_headers()

        company_email = unique_email("company.flow")
        student_email = unique_email("student.flow")
        university_email = unique_email("university.flow")
        supervisor_email = unique_email("supervisor.flow")

        company = self.register(ROLE_COMPANY, company_email, "Flow Company")
        self.assert_status(
            self.post(
                f"/api/admin/companies/{company['id']}/verify/",
                {},
                admin_headers,
            ),
            200,
        )
        company_tokens = self.login(company_email)
        company_headers = auth_headers(company_tokens["access"])

        university = self.create_provisioned_user(
            admin_headers,
            role=ROLE_UNIVERSITY_ADMIN,
            email=university_email,
            name="Flow University Admin",
        )
        university_tokens = self.login(university_email)
        university_headers = auth_headers(university_tokens["access"])

        supervisor = self.create_provisioned_user(
            admin_headers,
            role=ROLE_SUPERVISOR,
            email=supervisor_email,
            name="Flow Supervisor",
        )
        supervisor_tokens = self.login(supervisor_email)
        supervisor_headers = auth_headers(supervisor_tokens["access"])

        start_date = date.today() + timedelta(days=30)
        end_date = start_date + timedelta(days=120)

        offer_payload = {
            "title": f"Real Account Offer {uuid.uuid4().hex[:10]}",
            "description": "Offer created by a registered and verified company.",
            "requirements": "Django, PostgreSQL",
            "location": "Algiers",
            "deadline": (
                datetime.now(timezone.utc) + timedelta(days=30)
            ).isoformat(),
            "capacity": 2,
        }
        created_offer = self.post(
            "/api/offers/", offer_payload, company_headers, OFFERS_BASE_URL
        )
        self.assert_status(created_offer, 201)
        offer = created_offer.json()

        published = self.post(
            f"/api/offers/{offer['id']}/publish/",
            {},
            company_headers,
            OFFERS_BASE_URL,
        )
        self.assert_status(published, 200)
        self.assertEqual(published.json()["status"], "published")

        student = self.register(ROLE_STUDENT, student_email, "Flow Student")
        student_tokens = self.login(student_email)
        student_headers = auth_headers(student_tokens["access"])

        application_response = self.post(
            "/api/applications/",
            {
                "offer_id": offer["id"],
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            student_headers,
            APPLICATIONS_BASE_URL,
        )
        self.assert_status(application_response, 201)
        application = application_response.json()
        self.assertEqual(application["company_user_id"], company["id"])
        self.assertEqual(application["student_user_id"], student["id"])

        company_accepted = self.post(
            f"/api/applications/{application['id']}/company-decision/",
            {"decision": "ACCEPT"},
            company_headers,
            APPLICATIONS_BASE_URL,
        )
        self.assert_status(company_accepted, 200)
        self.assertEqual(company_accepted.json()["status"], "COMPANY_ACCEPTED")

        validated = self.post(
            f"/api/applications/{application['id']}/university-decision/",
            {"decision": "ACCEPT"},
            university_headers,
            APPLICATIONS_BASE_URL,
        )
        self.assert_status(validated, 200)
        self.assertEqual(validated.json()["status"], "UNIVERSITY_VALIDATED")

        confirmed = self.post(
            f"/api/applications/{application['id']}/student-decision/",
            {"decision": "ACCEPT"},
            student_headers,
            APPLICATIONS_BASE_URL,
        )
        self.assert_status(confirmed, 200)
        self.assertEqual(confirmed.json()["status"], "CONFIRMED")

        internships_response = self.get(
            "/api/internships/", student_headers, INTERNSHIPS_BASE_URL
        )
        self.assert_status(internships_response, 200)
        internships = [
            item
            for item in internships_response.json()["results"]
            if item["source_application_id"] == application["id"]
        ]
        self.assertEqual(len(internships), 1)
        internship = internships[0]
        self.assertEqual(internship["status"], "confirmed")
        self.assertEqual(internship["student_user_id"], student["id"])
        self.assertEqual(internship["company_user_id"], company["id"])
        self.assertEqual(internship["offer_id"], offer["id"])

        assigned = self.post(
            f"/api/internships/{internship['id']}/assign-supervisor/",
            {"supervisor_user_id": supervisor["id"]},
            university_headers,
            INTERNSHIPS_BASE_URL,
        )
        self.assert_status(assigned, 200)

        supervisor_list = self.get(
            "/api/internships/", supervisor_headers, INTERNSHIPS_BASE_URL
        )
        self.assert_status(supervisor_list, 200)
        self.assertIn(
            internship["id"],
            [item["id"] for item in supervisor_list.json()["results"]],
        )

        counts = self.get(
            f"/api/internal/offers/{offer['id']}/applications-count/",
            {"X-Service-Token": INTERNAL_SERVICE_TOKEN},
            APPLICATIONS_BASE_URL,
        )
        self.assert_status(counts, 200)
        self.assertEqual(counts.json()["total"], 1)
        self.assertEqual(counts.json()["confirmed"], 1)
        self.assertEqual(counts.json()["by_status"]["CONFIRMED"], 1)
