"""Cross-service tests for the notifications service (P1-3, P1-4).

These tests drive the real HTTP API. The first class covers the part of the
notification contract that does not depend on another service emitting events:

* a trusted internal create returns ``201``;
* replaying the same ``deduplication_key`` returns ``200`` with the same row;
* the recipient sees exactly one notification;
* marking it read twice is idempotent;
* a user JWT cannot call the internal endpoint.

The second class covers the end-to-end producer scenario: a student accepts an
application and Applications emits one ``application_confirmed`` notification to
the company and one to the university administrator, with no duplicate on
replay.

Run against the Compose stack::

    docker compose -f infra/docker/docker-compose.yml up -d --build \
        identity offers applications internships notifications
    python -m unittest discover -s tests/integration -v
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
DEFAULT_NOTIFICATIONS_BASE_URL = "http://localhost:8005"
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
NOTIFICATIONS_BASE_URL = os.environ.get(
    "NOTIFICATIONS_BASE_URL", DEFAULT_NOTIFICATIONS_BASE_URL
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


def make_token(user_id, role="student"):
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


class NotificationsIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        deadline = time.monotonic() + SERVICE_STARTUP_TIMEOUT_SECONDS
        last_error = None

        while time.monotonic() < deadline:
            try:
                response = requests.get(
                    f"{NOTIFICATIONS_BASE_URL}/health/", timeout=2
                )
                if response.status_code == 200:
                    return
                last_error = f"HTTP {response.status_code}"
            except requests.RequestException as exc:
                last_error = str(exc)
            time.sleep(1)

        raise RuntimeError(
            "notifications did not become healthy at "
            f"{NOTIFICATIONS_BASE_URL} within {SERVICE_STARTUP_TIMEOUT_SECONDS}s: "
            f"{last_error}"
        )

    def setUp(self):
        self.recipient_id = uuid.uuid4()
        self.related_object_id = uuid.uuid4()
        self.deduplication_key = (
            f"application:{self.related_object_id}:confirmed:"
            f"recipient:{self.recipient_id}"
        )
        self.user_headers = auth_headers(make_token(self.recipient_id))

    def assert_status(self, response, expected):
        self.assertEqual(
            response.status_code,
            expected,
            msg=(
                f"{response.request.method} {response.url} returned "
                f"{response.status_code}, expected {expected}: {response.text}"
            ),
        )

    def payload(self, **overrides):
        payload = {
            "recipient_user_id": str(self.recipient_id),
            "type": "application_confirmed",
            "title": "Application confirmed",
            "message": "Your internship is confirmed.",
            "related_object_type": "application",
            "related_object_id": str(self.related_object_id),
            "deduplication_key": self.deduplication_key,
        }
        payload.update(overrides)
        return payload

    def create_internal(self, **overrides):
        return requests.post(
            f"{NOTIFICATIONS_BASE_URL}/api/internal/notifications/",
            json=self.payload(**overrides),
            headers={"X-Service-Token": INTERNAL_SERVICE_TOKEN},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    def list_mine(self):
        response = requests.get(
            f"{NOTIFICATIONS_BASE_URL}/api/notifications/",
            headers=self.user_headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.assert_status(response, 200)
        return response.json()

    def test_internal_create_is_idempotent_and_visible_to_the_recipient(self):
        created = self.create_internal()
        self.assert_status(created, 201)
        notification_id = created.json()["id"]

        replay = self.create_internal()
        self.assert_status(replay, 200)
        self.assertEqual(replay.json()["id"], notification_id)

        listing = self.list_mine()
        matching = [
            item
            for item in listing["results"]
            if item["id"] == notification_id
        ]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["type"], "application_confirmed")
        self.assertFalse(matching[0]["is_read"])

    def test_mark_read_is_idempotent(self):
        created = self.create_internal()
        self.assert_status(created, 201)
        notification_id = created.json()["id"]

        first = requests.patch(
            f"{NOTIFICATIONS_BASE_URL}/api/notifications/{notification_id}/read/",
            headers=self.user_headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.assert_status(first, 200)
        first_read_at = first.json()["read_at"]
        self.assertIsNotNone(first_read_at)

        second = requests.patch(
            f"{NOTIFICATIONS_BASE_URL}/api/notifications/{notification_id}/read/",
            headers=self.user_headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.assert_status(second, 200)
        self.assertEqual(second.json()["read_at"], first_read_at)

    def test_user_jwt_cannot_call_the_internal_endpoint(self):
        response = requests.post(
            f"{NOTIFICATIONS_BASE_URL}/api/internal/notifications/",
            json=self.payload(),
            headers=self.user_headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.assert_status(response, 403)

    def test_internal_create_rejects_a_non_uuid_recipient(self):
        response = self.create_internal(recipient_user_id="not-a-uuid")
        self.assert_status(response, 400)

class ApplicationNotificationIntegrationTests(unittest.TestCase):
    """End-to-end producer scenario for Applications P1-4."""

    @classmethod
    def setUpClass(cls):
        for name, base_url in (
            ("identity", IDENTITY_BASE_URL),
            ("offers", OFFERS_BASE_URL),
            ("applications", APPLICATIONS_BASE_URL),
            ("internships", INTERNSHIPS_BASE_URL),
            ("notifications", NOTIFICATIONS_BASE_URL),
        ):
            cls._wait_for_service(name, base_url)

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

    def post(self, url, payload, headers):
        return requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    def create_published_offer(self):
        payload = {
            "title": f"Notification Offer {uuid.uuid4().hex[:12]}",
            "description": "A published offer used by the notifications suite.",
            "requirements": "Django, PostgreSQL",
            "location": "Algiers",
            "deadline": (
                datetime.now(timezone.utc) + timedelta(days=30)
            ).isoformat(),
            "capacity": 2,
        }

        created = self.post(
            f"{OFFERS_BASE_URL}/api/offers/", payload, self.company_headers
        )
        self.assert_status(created, 201)

        published = self.post(
            f"{OFFERS_BASE_URL}/api/offers/{created.json()['id']}/publish/",
            {},
            self.company_headers,
        )
        self.assert_status(published, 200)
        return published.json()

    def create_application(self, offer):
        response = self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/",
            {
                "offer_id": offer["id"],
                "start_date": self.start_date,
                "end_date": self.end_date,
            },
            self.student_headers,
        )
        self.assert_status(response, 201)
        return response.json()

    def decide(self, application_id, stage, decision, headers):
        response = self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/{application_id}/{stage}/",
            {"decision": decision},
            headers,
        )
        self.assert_status(response, 200)
        return response.json()

    def notifications_for(self, headers, application_id, notification_type):
        response = requests.get(
            f"{NOTIFICATIONS_BASE_URL}/api/notifications/",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        self.assert_status(response, 200)
        return [
            notification
            for notification in response.json()["results"]
            if notification["related_object_id"] == application_id
            and notification["type"] == notification_type
        ]

    def test_student_confirmation_notifies_company_and_university_once(self):
        """End-to-end scenario from cross-cutting.md.

        1. create and publish an offer, submit an application;
        2. approve it as company and university, then accept as student;
        3. assert the company and the university admin each have exactly one
           ``application_confirmed`` notification;
        4. replay the student decision and assert the count does not change.
        """

        offer = self.create_published_offer()
        application = self.create_application(offer)

        self.decide(
            application["id"], "company-decision", "ACCEPT", self.company_headers
        )
        self.decide(
            application["id"],
            "university-decision",
            "ACCEPT",
            self.university_headers,
        )
        confirmed = self.decide(
            application["id"], "student-decision", "ACCEPT", self.student_headers
        )
        self.assertEqual(confirmed["status"], "CONFIRMED")

        company_notifications = self.notifications_for(
            self.company_headers, application["id"], "application_confirmed"
        )
        university_notifications = self.notifications_for(
            self.university_headers, application["id"], "application_confirmed"
        )
        self.assertEqual(len(company_notifications), 1)
        self.assertEqual(len(university_notifications), 1)
        self.assertNotEqual(
            company_notifications[0]["id"],
            university_notifications[0]["id"],
        )

        replay = self.post(
            f"{APPLICATIONS_BASE_URL}/api/applications/{application['id']}/student-decision/",
            {"decision": "ACCEPT"},
            self.student_headers,
        )
        self.assert_status(replay, 409)

        self.assertEqual(
            len(
                self.notifications_for(
                    self.company_headers,
                    application["id"],
                    "application_confirmed",
                )
            ),
            1,
        )
        self.assertEqual(
            len(
                self.notifications_for(
                    self.university_headers,
                    application["id"],
                    "application_confirmed",
                )
            ),
            1,
        )
