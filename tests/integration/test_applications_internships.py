"""Cross-service tests for the applications -> internships flow.

These tests drive the real HTTP APIs, so they catch mismatches in headers,
payload field names, UUID handling, and date forwarding that unit tests with
mocks cannot see.

Run them against the Docker Compose stack:

    python -m unittest discover -s tests/integration -v

The tests mint user JWTs directly with the shared signing key. Identity is the
only service allowed to issue production tokens, but minting here keeps the
tests independent of registration throttles and privileged account
provisioning while still exercising the exact claim format the services accept.
"""

import os
import time
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone

import jwt
import requests

DEFAULT_IDENTITY_BASE_URL = "http://localhost:8001"
DEFAULT_OFFERS_BASE_URL = "http://localhost:8002"
DEFAULT_APPLICATIONS_BASE_URL = "http://localhost:8003"
DEFAULT_INTERNSHIPS_BASE_URL = "http://localhost:8004"
DEFAULT_JWT_SIGNING_KEY = "dev-only-user-jwt-signing-key-change-me-0123456789"
DEFAULT_INTERNAL_SERVICE_TOKEN = "dev-only-internal-service-token-change-me"

IDENTITY_BASE_URL = os.environ.get("IDENTITY_BASE_URL", DEFAULT_IDENTITY_BASE_URL)
OFFERS_BASE_URL = os.environ.get("OFFERS_BASE_URL", DEFAULT_OFFERS_BASE_URL)
APPLICATIONS_BASE_URL = os.environ.get(
    "APPLICATIONS_BASE_URL", DEFAULT_APPLICATIONS_BASE_URL
)
INTERNSHIPS_BASE_URL = os.environ.get(
    "INTERNSHIPS_BASE_URL", DEFAULT_INTERNSHIPS_BASE_URL
)
JWT_SIGNING_KEY = os.environ.get("JWT_SIGNING_KEY", DEFAULT_JWT_SIGNING_KEY)
INTERNAL_SERVICE_TOKEN = os.environ.get(
    "INTERNAL_SERVICE_TOKEN", DEFAULT_INTERNAL_SERVICE_TOKEN
)

REQUEST_TIMEOUT_SECONDS = 10
SERVICE_STARTUP_TIMEOUT_SECONDS = 60
ROLE_STUDENT = "student"
ROLE_COMPANY = "company"
ROLE_UNIVERSITY_ADMIN = "university_admin"


def make_token(user_id, role):
    """Build an access token in the same shape Identity issues."""
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": str(user_id),
        "role": role,
        "token_type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, JWT_SIGNING_KEY, algorithm="HS256")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class ApplicationsToInternshipsIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._wait_for_service("identity", IDENTITY_BASE_URL)
        cls._wait_for_service("offers", OFFERS_BASE_URL)
        cls._wait_for_service("applications", APPLICATIONS_BASE_URL)
        cls._wait_for_service("internships", INTERNSHIPS_BASE_URL)

    @classmethod
    def _wait_for_service(cls, name, base_url):
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

    def setUp(self):
        self.student_id = uuid.uuid4()
        self.company_id = uuid.uuid4()
        self.university_id = uuid.uuid4()

        self.student_headers = auth_headers(
            make_token(self.student_id, ROLE_STUDENT)
        )
        self.company_headers = auth_headers(
            make_token(self.company_id, ROLE_COMPANY)
        )
        self.university_headers = auth_headers(
            make_token(self.university_id, ROLE_UNIVERSITY_ADMIN)
        )

        # Keep the internship period in the future regardless of when the
        # suite runs.
        self.start_date = (date.today() + timedelta(days=30)).isoformat()
        self.end_date = (date.today() + timedelta(days=120)).isoformat()

    def assert_status(self, response, expected):
        self.assertEqual(
            response.status_code,
            expected,
            msg=(
                f"{response.request.method} {response.url} returned "
                f"{response.status_code}, expected {expected}: {response.text}"
            ),
        )

    def post(self, url, payload, headers=None):
        return requests.post(
            url,
            json=payload,
            headers=headers or {},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    def get(self, url, headers):
        return requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    def create_published_offer(self):
        payload = {
            "title": f"Integration Offer {uuid.uuid4().hex[:12]}",
            "description": "A published offer used by the integration suite.",
            "requirements": "Django, PostgreSQL",
            "location": "Algiers",
            "deadline": (
                datetime.now(timezone.utc) + timedelta(days=30)
            ).isoformat(),
            "capacity": 2,
        }

        created = self.post(
            f"{OFFERS_BASE_URL}/api/offers/",
            payload,
            self.company_headers,
        )
        self.assert_status(created, 201)

        published = self.post(
            f"{OFFERS_BASE_URL}/api/offers/{created.json()['id']}/publish/",
            {},
            self.company_headers,
        )
        self.assert_status(published, 200)
        self.assertEqual(published.json()["status"], "published")
        return published.json()

    def create_application(self, offer):
        payload = {
            "offer_id": offer["id"],
            "company_user_id": str(self.company_id),
            "start_date": self.start_date,
            "end_date": self.end_date,
        }

        response = self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/",
            payload,
            self.student_headers,
        )
        self.assert_status(response, 201)
        return response.json()

    def approve_application(self, application):
        company_response = self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/{application['id']}/company-decision/",
            {"decision": "ACCEPT"},
            self.company_headers,
        )
        self.assert_status(company_response, 200)
        self.assertEqual(company_response.json()["status"], "COMPANY_ACCEPTED")

        university_response = self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/{application['id']}/university-decision/",
            {"decision": "ACCEPT"},
            self.university_headers,
        )
        self.assert_status(university_response, 200)
        self.assertEqual(
            university_response.json()["status"], "UNIVERSITY_VALIDATED"
        )

    def accept_application(self, application_id):
        return self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/{application_id}/student-decision/",
            {"decision": "ACCEPT"},
            self.student_headers,
        )

    def get_application(self, application_id):
        response = self.get(
            f"{APPLICATIONS_BASE_URL}/api/applications/{application_id}/",
            self.student_headers,
        )
        self.assert_status(response, 200)
        return response.json()

    def list_internships(self):
        response = self.get(
            f"{INTERNSHIPS_BASE_URL}/api/internships/",
            self.student_headers,
        )
        self.assert_status(response, 200)
        return response.json()

    def internships_for_application(self, application_id):
        return [
            internship
            for internship in self.list_internships()
            if internship["source_application_id"] == application_id
        ]

    def internship_payload(self, application):
        return {
            "source_application_id": application["id"],
            "student_user_id": str(self.student_id),
            "company_user_id": str(self.company_id),
            "offer_id": application["offer_id"],
            "start_date": application["start_date"],
            "end_date": application["end_date"],
        }

    def test_student_acceptance_creates_internship_and_confirms_application(self):
        offer = self.create_published_offer()
        application = self.create_application(offer)
        self.approve_application(application)

        response = self.accept_application(application["id"])
        self.assert_status(response, 200)
        self.assertEqual(response.json()["status"], "CONFIRMED")
        self.assertEqual(self.get_application(application["id"])["status"], "CONFIRMED")

        internships = self.internships_for_application(application["id"])
        self.assertEqual(len(internships), 1)

        internship = internships[0]
        self.assertEqual(internship["student_user_id"], str(self.student_id))
        self.assertEqual(internship["company_user_id"], str(self.company_id))
        self.assertEqual(internship["offer_id"], offer["id"])
        self.assertEqual(internship["start_date"], self.start_date)
        self.assertEqual(internship["end_date"], self.end_date)
        self.assertEqual(internship["status"], "confirmed")

        detail = self.get(
            f"{INTERNSHIPS_BASE_URL}/api/internships/{internship['id']}/",
            self.student_headers,
        )
        self.assert_status(detail, 200)
        self.assertEqual(detail.json()["id"], internship["id"])

    def test_repeated_internal_create_returns_the_existing_internship(self):
        offer = self.create_published_offer()
        application = self.create_application(offer)
        self.approve_application(application)
        self.assert_status(self.accept_application(application["id"]), 200)

        existing = self.internships_for_application(application["id"])
        self.assertEqual(len(existing), 1)

        repeated = self.post(
            f"{INTERNSHIPS_BASE_URL}/api/internal/internships/",
            self.internship_payload(application),
            {"X-Service-Token": INTERNAL_SERVICE_TOKEN},
        )
        self.assert_status(repeated, 200)
        self.assertEqual(repeated.json()["id"], existing[0]["id"])
        self.assertEqual(len(self.internships_for_application(application["id"])), 1)

    def test_internal_create_requires_a_valid_service_token(self):
        payload = {
            "source_application_id": str(uuid.uuid4()),
            "student_user_id": str(uuid.uuid4()),
            "company_user_id": str(uuid.uuid4()),
            "offer_id": str(uuid.uuid4()),
            "start_date": self.start_date,
            "end_date": self.end_date,
        }

        missing = self.post(
            f"{INTERNSHIPS_BASE_URL}/api/internal/internships/", payload
        )
        self.assert_status(missing, 403)

        wrong = self.post(
            f"{INTERNSHIPS_BASE_URL}/api/internal/internships/",
            payload,
            {"X-Service-Token": "wrong-token"},
        )
        self.assert_status(wrong, 403)

        valid = self.post(
            f"{INTERNSHIPS_BASE_URL}/api/internal/internships/",
            payload,
            {"X-Service-Token": INTERNAL_SERVICE_TOKEN},
        )
        self.assert_status(valid, 201)

    def test_downstream_conflict_rolls_back_the_second_student_acceptance(self):
        first_offer = self.create_published_offer()
        first_application = self.create_application(first_offer)
        self.approve_application(first_application)

        second_offer = self.create_published_offer()
        second_application = self.create_application(second_offer)
        self.approve_application(second_application)

        first_acceptance = self.accept_application(first_application["id"])
        self.assert_status(first_acceptance, 200)
        self.assertEqual(first_acceptance.json()["status"], "CONFIRMED")

        second_acceptance = self.accept_application(second_application["id"])
        self.assert_status(second_acceptance, 502)

        # The applications service rolls the transaction back when internships
        # rejects the call, so the second application stays validated rather
        # than becoming confirmed without an internship.
        second_state = self.get_application(second_application["id"])
        self.assertEqual(second_state["status"], "UNIVERSITY_VALIDATED")
        self.assertIsNone(second_state["student_decision"])

        self.assertEqual(
            len(self.internships_for_application(first_application["id"])), 1
        )
        self.assertEqual(
            self.internships_for_application(second_application["id"]), []
        )


if __name__ == "__main__":
    unittest.main()
