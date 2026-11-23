import json
import tempfile
import uuid
from io import StringIO
from pathlib import Path
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework_simplejwt.tokens import AccessToken

from api.management.commands.seed_demo import (
    DEFAULT_OFFER_TITLE,
    DEFAULT_PASSWORD,
    demo_user_id,
)
from api.models import (
    CompanyProfile,
    StudentProfile,
    SupervisorProfile,
    User,
    UserRole,
)

OFFERS_BASE_URL = "http://offers.test"


def _response(payload, status_code=200):
    return Mock(status_code=status_code, json=lambda: payload, text="")


def _offer_payload(status="draft", **overrides):
    payload = {
        "id": str(uuid.uuid4()),
        "title": DEFAULT_OFFER_TITLE,
        "status": status,
        "deadline": "2026-12-31T12:00:00Z",
        "capacity": 3,
    }
    payload.update(overrides)
    return payload


@override_settings(
    DEBUG=True,
    OFFERS_BASE_URL=OFFERS_BASE_URL,
    OFFERS_TIMEOUT_SECONDS=2.0,
)
class SeedDemoCommandTests(TestCase):
    def setUp(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        self.directory_file = Path(temp_dir.name) / "directory.json"
        patcher = patch(
            "api.management.commands.seed_demo.DEFAULT_DIRECTORY_FILE",
            self.directory_file,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_seeds_accounts_profiles_and_a_published_offer(self):
        offer = _offer_payload()
        published = {**offer, "status": "published"}
        stdout = StringIO()

        with patch(
            "api.management.commands.seed_demo.requests.get",
            return_value=_response(
                {"count": 0, "next": None, "previous": None, "results": []}
            ),
        ) as mock_get, patch(
            "api.management.commands.seed_demo.requests.post",
            side_effect=[
                _response(offer, status_code=201),
                _response(published),
            ],
        ) as mock_post:
            call_command("seed_demo", stdout=stdout)

        self.assertEqual(User.objects.count(), 16)

        admin = User.objects.get(email="admin@stagelink.demo")
        self.assertEqual(str(admin.id), demo_user_id("admin"))
        self.assertEqual(admin.role, UserRole.PLATFORM_ADMIN)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_active)

        company = User.objects.get(email="company@stagelink.demo")
        self.assertEqual(company.role, UserRole.COMPANY)
        self.assertTrue(company.is_active)
        self.assertTrue(company.check_password(DEFAULT_PASSWORD))

        company_profile = CompanyProfile.objects.get(user=company)
        self.assertEqual(company_profile.legal_name, "Demo Company Ltd")
        self.assertEqual(
            company_profile.verification_status,
            CompanyProfile.VerificationStatus.ACTIVE,
        )
        self.assertEqual(company_profile.verified_by, admin)
        self.assertIsNotNone(company_profile.verified_at)
        self.assertTrue(company.is_active)

        statuses = dict(
            CompanyProfile.objects.values_list("user__email", "verification_status")
        )
        self.assertEqual(
            statuses["abc-company@stagelink.demo"], CompanyProfile.VerificationStatus.ACTIVE
        )
        self.assertEqual(
            statuses["eurl-farissia@stagelink.demo"],
            CompanyProfile.VerificationStatus.ACTIVE,
        )
        self.assertEqual(
            statuses["horizon@stagelink.demo"], CompanyProfile.VerificationStatus.PENDING
        )
        self.assertEqual(
            statuses["delta-services@stagelink.demo"],
            CompanyProfile.VerificationStatus.PENDING,
        )
        self.assertEqual(
            statuses["vertex@stagelink.demo"], CompanyProfile.VerificationStatus.REJECTED
        )
        self.assertIn(
            "expired",
            CompanyProfile.objects.get(user__email="vertex@stagelink.demo").rejection_reason,
        )
        self.assertFalse(User.objects.get(email="vertex@stagelink.demo").is_active)
        self.assertEqual(
            CompanyProfile.objects.filter(
                verification_status=CompanyProfile.VerificationStatus.ACTIVE
            ).count(),
            3,
        )

        student = User.objects.get(email="student@stagelink.demo")
        student_profile = StudentProfile.objects.get(user=student)
        self.assertEqual(student_profile.university, "Demo University")
        self.assertEqual(student_profile.matricule, "DEMO-2026-001")

        university_admin = User.objects.get(email="university@stagelink.demo")
        self.assertEqual(university_admin.role, UserRole.UNIVERSITY_ADMIN)

        supervisor = User.objects.get(email="supervisor@stagelink.demo")
        self.assertEqual(supervisor.role, UserRole.SUPERVISOR)
        self.assertEqual(
            SupervisorProfile.objects.get(user=supervisor).department,
            "Computer Science",
        )
        self.assertEqual(User.objects.filter(role=UserRole.SUPERVISOR).count(), 3)
        self.assertEqual(User.objects.filter(role=UserRole.STUDENT).count(), 5)
        self.assertEqual(User.objects.filter(role=UserRole.COMPANY).count(), 6)

        # The directory is written from the ids actually stored, for the
        # front-end demo-only name resolver (design-plan §6.1).
        directory = json.loads(self.directory_file.read_text(encoding="utf-8"))
        self.assertEqual(len(directory["users"]), 16)
        self.assertEqual(directory["users"][str(student.id)]["matricule"], "DEMO-2026-001")
        self.assertEqual(directory["users"][str(supervisor.id)]["role"], "supervisor")
        self.assertEqual(
            directory["users"][str(User.objects.get(email="student-4@stagelink.demo").id)][
                "department"
            ],
            "Information Systems",
        )

        # The offer is created and published through Offers, using a company JWT.
        mock_get.assert_called_once()
        get_args, get_kwargs = mock_get.call_args
        self.assertEqual(get_args[0], f"{OFFERS_BASE_URL}/api/offers/")
        self.assertEqual(
            get_kwargs["params"],
            {"mine": "true", "search": DEFAULT_OFFER_TITLE},
        )
        self.assertEqual(get_kwargs["timeout"], 2.0)

        self.assertEqual(mock_post.call_count, 2)
        create_args, create_kwargs = mock_post.call_args_list[0]
        self.assertEqual(create_args[0], f"{OFFERS_BASE_URL}/api/offers/")
        self.assertEqual(create_kwargs["json"]["capacity"], 3)
        self.assertIsNotNone(parse_datetime(create_kwargs["json"]["deadline"]))

        token = create_kwargs["headers"]["Authorization"].split(" ", 1)[1]
        claims = AccessToken(token)
        self.assertEqual(claims["role"], "company")
        self.assertEqual(claims["user_id"], str(company.id))

        publish_args, _ = mock_post.call_args_list[1]
        self.assertEqual(
            publish_args[0],
            f"{OFFERS_BASE_URL}/api/offers/{offer['id']}/publish/",
        )

        output = stdout.getvalue()
        self.assertIn("Demo data is ready.", output)
        self.assertIn(DEFAULT_PASSWORD, output)
        self.assertIn(company.email, output)

    def test_rerun_is_idempotent_and_does_not_republish(self):
        offer = _offer_payload()
        published = {**offer, "status": "published"}

        with patch(
            "api.management.commands.seed_demo.requests.get",
            side_effect=[
                _response(
                    {"count": 0, "next": None, "previous": None, "results": []}
                ),
                _response(
                    {
                        "count": 1,
                        "next": None,
                        "previous": None,
                        "results": [published],
                    }
                ),
            ],
        ), patch(
            "api.management.commands.seed_demo.requests.post",
            side_effect=[
                _response(offer, status_code=201),
                _response(published),
            ],
        ) as mock_post:
            call_command("seed_demo", stdout=StringIO())
            self.assertEqual(mock_post.call_count, 2)

            call_command("seed_demo", stdout=StringIO())

        self.assertEqual(User.objects.count(), 16)
        self.assertEqual(CompanyProfile.objects.count(), 6)
        self.assertEqual(StudentProfile.objects.count(), 5)
        self.assertEqual(SupervisorProfile.objects.count(), 3)
        # The second run found the published offer and did not publish again.
        self.assertEqual(mock_post.call_count, 2)

    def test_skip_offer_never_calls_offers(self):
        with patch(
            "api.management.commands.seed_demo.requests.get"
        ) as mock_get, patch(
            "api.management.commands.seed_demo.requests.post"
        ) as mock_post:
            call_command(
                "seed_demo",
                "--skip-offer",
                stdout=StringIO(),
            )

        self.assertEqual(User.objects.count(), 16)
        mock_get.assert_not_called()
        mock_post.assert_not_called()

    def test_skip_directory_leaves_the_file_untouched(self):
        call_command("seed_demo", "--skip-offer", "--skip-directory", stdout=StringIO())

        self.assertEqual(User.objects.count(), 16)
        self.assertFalse(self.directory_file.exists())

    def test_rerun_preserves_a_company_verified_through_the_ui(self):
        call_command("seed_demo", "--skip-offer", stdout=StringIO())
        user = User.objects.get(email="horizon@stagelink.demo")
        profile = user.company_profile
        profile.verification_status = CompanyProfile.VerificationStatus.ACTIVE
        profile.verified_by = User.objects.get(email="admin@stagelink.demo")
        profile.verified_at = timezone.now()
        profile.save()
        user.is_active = True
        user.save()

        call_command("seed_demo", "--skip-offer", stdout=StringIO())

        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertEqual(
            user.company_profile.verification_status,
            CompanyProfile.VerificationStatus.ACTIVE,
        )

    def test_json_output_is_a_single_document(self):
        stdout = StringIO()

        call_command(
            "seed_demo",
            "--skip-offer",
            "--json",
            "--password",
            "CustomDemoPass!2026",
            stdout=stdout,
        )

        payload = json.loads(stdout.getvalue())
        self.assertEqual(payload["password"], "CustomDemoPass!2026")
        self.assertTrue(payload["offer_skipped"])
        self.assertIsNone(payload["offer"])
        self.assertEqual(
            set(payload["accounts"]),
            {
                "platform_admin",
                "university_admin",
                "company",
                "company_abc",
                "company_farissia",
                "company_horizon",
                "company_delta",
                "company_vertex",
                "supervisor",
                "supervisor_2",
                "supervisor_3",
                "student",
                "student_2",
                "student_3",
                "student_4",
                "student_5",
            },
        )
        self.assertEqual(payload["directory"], str(self.directory_file))
        self.assertEqual(
            User.objects.get(email="student@stagelink.demo").check_password(
                "CustomDemoPass!2026"
            ),
            True,
        )

    def test_offers_outage_fails_but_leaves_accounts_for_rerun(self):
        with patch(
            "api.management.commands.seed_demo.requests.get",
            return_value=Mock(status_code=500, text="boom"),
        ):
            with self.assertRaisesMessage(CommandError, "Accounts were created"):
                call_command("seed_demo", stdout=StringIO())

        self.assertEqual(User.objects.count(), 16)

    def test_closed_offer_is_not_silently_recreated(self):
        closed = _offer_payload(status="closed")

        with patch(
            "api.management.commands.seed_demo.requests.get",
            return_value=_response(
                {
                    "count": 1,
                    "next": None,
                    "previous": None,
                    "results": [closed],
                }
            ),
        ), patch(
            "api.management.commands.seed_demo.requests.post"
        ) as mock_post:
            with self.assertRaisesMessage(CommandError, "cannot be published"):
                call_command("seed_demo", stdout=StringIO())

        mock_post.assert_not_called()

    @override_settings(DEBUG=False)
    def test_refuses_to_run_outside_debug_without_force(self):
        with self.assertRaisesMessage(CommandError, "Refusing to seed"):
            call_command("seed_demo", "--skip-offer", stdout=StringIO())

        self.assertEqual(User.objects.count(), 0)

    @override_settings(DEBUG=False)
    def test_force_allows_seeding_outside_debug(self):
        call_command(
            "seed_demo",
            "--skip-offer",
            "--force",
            stdout=StringIO(),
        )

        self.assertEqual(User.objects.count(), 16)
