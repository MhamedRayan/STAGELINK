import uuid
from datetime import date

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Internship, InternshipStatus

TEST_TOKEN = "test-service-token"
CREATE_URL = "/api/internal/internships/"

STUDENT_ID = uuid.uuid4()
COMPANY_ID = uuid.uuid4()
OFFER_ID = uuid.uuid4()


@override_settings(INTERNAL_SERVICE_TOKEN=TEST_TOKEN)
class InternalCreateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.payload = {
            "source_application_id": str(uuid.uuid4()),
            "student_user_id": str(STUDENT_ID),
            "company_user_id": str(COMPANY_ID),
            "offer_id": str(OFFER_ID),
            "start_date": "2027-02-01",
            "end_date": "2027-06-30",
        }

    def _post(self, data=None, token=TEST_TOKEN):
        headers = {} if token is None else {"HTTP_X_SERVICE_TOKEN": token}
        return self.api.post(
            CREATE_URL,
            data if data is not None else self.payload,
            format="json",
            **headers,
        )

    def test_creates_internship_with_confirmed_status(self):
        response = self._post()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], InternshipStatus.CONFIRMED)
        self.assertEqual(Internship.objects.count(), 1)
        self.assertEqual(response.data["student_user_id"], str(STUDENT_ID))

    def test_status_sent_by_caller_is_ignored(self):
        self._post({**self.payload, "status": "completed"})

        internship = Internship.objects.get()
        self.assertEqual(internship.status, InternshipStatus.CONFIRMED)

    def test_repeated_request_returns_existing_internship(self):
        first = self._post()
        second = self._post()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(Internship.objects.count(), 1)

    def test_missing_token_is_rejected(self):
        response = self._post(token=None)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Internship.objects.count(), 0)

    def test_wrong_token_is_rejected(self):
        response = self._post(token="wrong-token")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Internship.objects.count(), 0)

    @override_settings(INTERNAL_SERVICE_TOKEN="")
    def test_unconfigured_token_denies_everyone(self):
        response = self._post(token="")

        self.assertEqual(response.status_code, 403)

    def test_student_with_active_internship_gets_conflict(self):
        self._post()
        response = self._post(
            {**self.payload, "source_application_id": str(uuid.uuid4())}
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Internship.objects.count(), 1)

    def test_end_date_before_start_date_is_rejected(self):
        response = self._post({**self.payload, "end_date": "2027-01-01"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Internship.objects.count(), 0)

    def test_missing_required_field_is_rejected(self):
        data = {k: v for k, v in self.payload.items() if k != "offer_id"}
        response = self._post(data)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Internship.objects.count(), 0)

    def test_non_uuid_identifier_is_rejected(self):
        response = self._post({**self.payload, "offer_id": "not-a-uuid"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Internship.objects.count(), 0)
