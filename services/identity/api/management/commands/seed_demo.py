"""Seed a complete demo tenant so the platform can be shown without Django admin.

The command is intentionally idempotent: rerunning it converges the demo
accounts, the verified company profile and the published offer instead of
creating duplicates. Accounts are written directly through the ORM because
Identity owns them; the offer is created through the Offers HTTP API because
Offers owns offers, and no cross-service database access is allowed.

Usage::

    python manage.py seed_demo
    python manage.py seed_demo --skip-offer
    python manage.py seed_demo --json
"""

import json
from datetime import timedelta

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from api.models import (
    CompanyProfile,
    StudentProfile,
    SupervisorProfile,
    User,
    UserRole,
)

DEFAULT_PASSWORD = "StagelinkDemo!2026"
DEFAULT_DOMAIN = "stagelink.demo"
DEFAULT_OFFER_TITLE = "Software Engineering Internship"
DEFAULT_OFFER_CAPACITY = 3
DEFAULT_OFFER_DEADLINE_DAYS = 30

DEMO_ACCOUNTS = (
    {
        "key": "platform_admin",
        "local_part": "admin",
        "name": "Demo Platform Administrator",
        "role": UserRole.PLATFORM_ADMIN,
        "is_staff": True,
        "is_superuser": True,
    },
    {
        "key": "company",
        "local_part": "company",
        "name": "Demo Company",
        "role": UserRole.COMPANY,
    },
    {
        "key": "student",
        "local_part": "student",
        "name": "Demo Student",
        "role": UserRole.STUDENT,
    },
    {
        "key": "university_admin",
        "local_part": "university",
        "name": "Demo University Administrator",
        "role": UserRole.UNIVERSITY_ADMIN,
    },
    {
        "key": "supervisor",
        "local_part": "supervisor",
        "name": "Demo Supervisor",
        "role": UserRole.SUPERVISOR,
    },
)


class Command(BaseCommand):
    help = (
        "Create or refresh the demo accounts, a verified company, and a "
        "published offer for end-to-end demonstrations."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=DEFAULT_PASSWORD,
            help=f"Password for every demo account (default: {DEFAULT_PASSWORD}).",
        )
        parser.add_argument(
            "--domain",
            default=DEFAULT_DOMAIN,
            help=f"Email domain for demo accounts (default: {DEFAULT_DOMAIN}).",
        )
        parser.add_argument(
            "--offers-url",
            default=None,
            help="Offers base URL. Defaults to settings.OFFERS_BASE_URL.",
        )
        parser.add_argument(
            "--skip-offer",
            action="store_true",
            help="Only seed Identity accounts; do not call Offers.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seeding demo accounts while DJANGO_DEBUG is false.",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Print the result as JSON instead of human-readable text.",
        )
        parser.add_argument(
            "--offer-title",
            default=DEFAULT_OFFER_TITLE,
            help=f"Title of the demo offer (default: {DEFAULT_OFFER_TITLE!r}).",
        )
        parser.add_argument(
            "--offer-capacity",
            type=int,
            default=DEFAULT_OFFER_CAPACITY,
            help=f"Capacity of the demo offer (default: {DEFAULT_OFFER_CAPACITY}).",
        )
        parser.add_argument(
            "--offer-deadline-days",
            type=int,
            default=DEFAULT_OFFER_DEADLINE_DAYS,
            help=(
                "Days from now until the demo offer deadline "
                f"(default: {DEFAULT_OFFER_DEADLINE_DAYS})."
            ),
        )

    def handle(self, *args, **options):
        self._quiet = bool(options["json"])
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed demo accounts while DJANGO_DEBUG is false. "
                "Pass --force only in a disposable environment."
            )
        if options["offer_capacity"] < 1:
            raise CommandError("--offer-capacity must be at least 1.")
        if options["offer_deadline_days"] < 1:
            raise CommandError("--offer-deadline-days must be at least 1.")

        domain = options["domain"].strip().lower()
        password = options["password"]
        emails = {
            account["key"]: f"{account['local_part']}@{domain}"
            for account in DEMO_ACCOUNTS
        }

        created_emails = []
        with transaction.atomic():
            users = {}
            for account in DEMO_ACCOUNTS:
                user, created = self._upsert_user(
                    email=emails[account["key"]],
                    name=account["name"],
                    role=account["role"],
                    password=password,
                    is_staff=account.get("is_staff", False),
                    is_superuser=account.get("is_superuser", False),
                )
                users[account["key"]] = user
                if created:
                    created_emails.append(user.email)

            self._seed_company_profile(users["company"], users["platform_admin"])
            self._seed_student_profile(users["student"])
            self._seed_supervisor_profile(users["supervisor"])

        offer = None
        if not options["skip_offer"]:
            offer = self._ensure_demo_offer(users["company"], options)

        result = {
            "password": password,
            "created": created_emails,
            "accounts": {
                key: {
                    "id": str(user.id),
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                    "is_active": user.is_active,
                }
                for key, user in users.items()
            },
            "company_profile_id": str(users["company"].company_profile.id),
            "offer": offer,
            "offer_skipped": bool(options["skip_offer"]),
        }

        if options["json"]:
            self.stdout.write(json.dumps(result, indent=2, default=str))
        else:
            self._write_human_summary(result)
        return None

    def _log(self, message, style=None):
        if self._quiet:
            return
        if style is not None:
            message = style(message)
        self.stdout.write(message)

    @staticmethod
    def _upsert_user(*, email, name, role, password, is_staff, is_superuser):
        user = User.objects.filter(email__iexact=email).first()
        created = user is None

        if created:
            if isinstance(role, UserRole):
                role = role.value
            if role == UserRole.PLATFORM_ADMIN and is_superuser:
                user = User.objects.create_superuser(
                    email=email,
                    password=password,
                    name=name,
                    role=role,
                )
            else:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    name=name,
                    role=role,
                )

        # Converge every run: the demo tenant must always be usable and the
        # documented password must always work, including after manual edits.
        # Company accounts are created inactive by the manager; they are
        # activated here because the demo company is already verified.
        user.name = name
        user.role = role
        user.is_active = True
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.set_password(password)
        user.save()
        return user, created

    @staticmethod
    def _seed_company_profile(company, admin):
        profile, _ = CompanyProfile.objects.get_or_create(user=company)
        profile.legal_name = "Demo Company Ltd"
        profile.address = "1 Demo Avenue, Douala"
        profile.contact_person = "Demo Recruiter"
        profile.phone = "+237600000000"
        profile.website = "https://demo.example.com"
        profile.description = (
            "Fictional company used to demonstrate the STAGELINK internship flow."
        )
        profile.verification_status = CompanyProfile.VerificationStatus.ACTIVE
        profile.verified_by = admin
        profile.verified_at = timezone.now()
        profile.rejection_reason = ""
        profile.save()
        return profile

    @staticmethod
    def _seed_student_profile(student):
        profile, _ = StudentProfile.objects.get_or_create(user=student)
        profile.university = "Demo University"
        profile.department = "Computer Science"
        profile.specialty = "Software Engineering"
        profile.academic_year = "2026/2027"
        profile.matricule = "DEMO-2026-001"
        profile.save()
        return profile

    @staticmethod
    def _seed_supervisor_profile(supervisor):
        profile, _ = SupervisorProfile.objects.get_or_create(user=supervisor)
        profile.department = "Computer Science"
        profile.grade = "Senior Lecturer"
        profile.save()
        return profile

    def _ensure_demo_offer(self, company, options):
        base_url = (options.get("offers_url") or settings.OFFERS_BASE_URL or "").rstrip(
            "/"
        )
        if not base_url:
            raise CommandError(
                "OFFERS_BASE_URL is not configured. Pass --offers-url or use "
                "--skip-offer."
            )

        title = options["offer_title"]
        token = self._company_access_token(company)
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

        existing = self._find_offer(base_url, title, headers)
        if existing is not None and existing.get("status") == "published":
            self._log(
                f"Offer {existing.get('id')} is already published; leaving it as is.",
                self.style.SUCCESS,
            )
            return existing

        if existing is None:
            payload = {
                "title": title,
                "description": (
                    "Work with the demo engineering team on a six-week backend "
                    "project. This offer exists so the full application flow can "
                    "be demonstrated end to end."
                ),
                "requirements": (
                    "Python, Django, relational databases, and a willingness to "
                    "learn. No prior professional experience required."
                ),
                "location": "Douala, Cameroon (hybrid)",
                "deadline": (
                    timezone.now()
                    + timedelta(days=options["offer_deadline_days"])
                )
                .replace(microsecond=0)
                .isoformat(),
                "capacity": options["offer_capacity"],
            }
            created = self._request_json(
                "post",
                f"{base_url}/api/offers/",
                headers=headers,
                json=payload,
            )
            self._log(
                f"Created draft offer {created.get('id')}.",
                self.style.SUCCESS,
            )
        else:
            created = existing

        if created.get("status") == "published":
            return created

        if created.get("status") != "draft":
            raise CommandError(
                f"Offer {created.get('id')} is {created.get('status')!r} and cannot be "
                "published. Delete it or use a different --offer-title, then rerun."
            )

        published = self._request_json(
            "post",
            f"{base_url}/api/offers/{created['id']}/publish/",
            headers=headers,
        )
        self._log(
            f"Published offer {published.get('id')}.",
            self.style.SUCCESS,
        )
        return published

    def _find_offer(self, base_url, title, headers):
        payload = self._request_json(
            "get",
            f"{base_url}/api/offers/",
            headers=headers,
            params={"mine": "true", "search": title},
        )
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            raise CommandError("Offers returned an unexpected offer list payload.")
        for offer in results:
            if isinstance(offer, dict) and offer.get("title") == title:
                return offer
        return None

    @staticmethod
    def _company_access_token(company):
        refresh = RefreshToken.for_user(company)
        refresh["email"] = company.email
        refresh["role"] = company.role
        return str(refresh.access_token)

    @staticmethod
    def _request_json(method, url, **kwargs):
        kwargs.setdefault("timeout", settings.OFFERS_TIMEOUT_SECONDS)
        request = getattr(requests, method)
        try:
            response = request(url, **kwargs)
        except requests.RequestException as exc:
            raise CommandError(
                f"Could not reach Offers at {url}: {exc}. Accounts were created; "
                "fix Offers and rerun the command."
            ) from exc

        if response.status_code not in (200, 201):
            raise CommandError(
                f"Offers {method.upper()} {url} returned {response.status_code}: "
                f"{response.text[:300]}. Accounts were created; fix Offers and "
                "rerun the command."
            )
        try:
            return response.json()
        except ValueError as exc:
            raise CommandError(
                f"Offers returned invalid JSON for {url}. Accounts were created; "
                "fix Offers and rerun the command."
            ) from exc

    def _write_human_summary(self, result):
        self.stdout.write(self.style.SUCCESS("Demo data is ready."))
        self.stdout.write(f"Password for every account: {result['password']}")
        self.stdout.write("")
        labels = {
            "platform_admin": "Platform admin",
            "company": "Company",
            "student": "Student",
            "university_admin": "University admin",
            "supervisor": "Supervisor",
        }
        for key, account in result["accounts"].items():
            self.stdout.write(
                f"  {labels.get(key, key):<16} {account['email']:<38} {account['id']}"
            )

        if result["offer_skipped"]:
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING("Offer seeding skipped (--skip-offer).")
            )
            return

        offer = result["offer"] or {}
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Offer: {offer.get('title')} ({offer.get('id')}) "
                f"[{offer.get('status')}]"
            )
        )
        self.stdout.write(
            f"  deadline={offer.get('deadline')} capacity={offer.get('capacity')}"
        )
        self.stdout.write(
            "  The company, student, university admin and supervisor accounts "
            "can now log in with the password above."
        )
