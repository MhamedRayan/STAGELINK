"""Seed a complete demo tenant so the platform can be shown without Django admin.

The command is intentionally idempotent: rerunning it converges the demo
accounts, the role profiles, the verification states and the published offer
instead of creating duplicates. Accounts are written directly through the ORM
because Identity owns them; the offer is created through the Offers HTTP API
because Offers owns offers, and no cross-service database access is allowed.

User ids are derived deterministically from the demo email local part so the
front-end demo directory (``frontend/src/demo/directory.json``) can be
committed with ids that match a freshly seeded database. The command rewrites
that directory from the ids actually stored, so reruns after a manual delete
stay consistent.

Usage::

    python manage.py seed_demo
    python manage.py seed_demo --skip-offer
    python manage.py seed_demo --json
    python manage.py seed_demo --directory-file /tmp/directory.json
"""

import json
import uuid
from datetime import timedelta
from pathlib import Path

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

def _find_repo_root():
    """Return the repo checkout containing the front-end, or ``None``.

    In a local checkout this command lives at
    ``repo/services/identity/api/management/commands/seed_demo.py``. Inside the
    identity container it lives at ``/app/api/management/commands/seed_demo.py``
    with no repo checkout around it, so indexing ``parents[5]`` would raise
    ``IndexError`` at import time. Searching for the known ``frontend/src/demo``
    marker is safe in both layouts: it finds the repo locally and returns
    ``None`` in the container, where the front-end directory is skipped.
    """
    for parent in Path(__file__).resolve().parents:
        if (parent / "frontend" / "src" / "demo").is_dir():
            return parent
    return None


REPO_ROOT = _find_repo_root()
DEFAULT_DIRECTORY_FILE = (
    REPO_ROOT / "frontend" / "src" / "demo" / "directory.json"
    if REPO_ROOT is not None
    else None
)

ACTIVE = CompanyProfile.VerificationStatus.ACTIVE
PENDING = CompanyProfile.VerificationStatus.PENDING
REJECTED = CompanyProfile.VerificationStatus.REJECTED

STUDENT_DEFAULTS = {
    "university": "Demo University",
    "department": "Computer Science",
    "specialty": "Software Engineering",
    "academic_year": "2026/2027",
}
SUPERVISOR_DEFAULTS = {
    "department": "Computer Science",
    "grade": "Senior Lecturer",
}

# Design-plan §7: 1 platform admin, 1 university admin, 3 supervisors,
# 5 students and 6 companies (the requirement lists 5 but enumerates
# 3 verified + 2 pending + 1 rejected - see the Δ note in design-plan §7).
# The five original keys are kept so existing docs and scripts keep working.
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
        "key": "university_admin",
        "local_part": "university",
        "name": "Demo University Administrator",
        "role": UserRole.UNIVERSITY_ADMIN,
    },
    {
        "key": "company",
        "local_part": "company",
        "name": "Demo Company Ltd",
        "role": UserRole.COMPANY,
        "profile": {
            "legal_name": "Demo Company Ltd",
            "address": "1 Demo Avenue, Douala",
            "contact_person": "Demo Recruiter",
            "phone": "+237600000000",
            "website": "https://demo.example.com",
            "description": (
                "Fictional company used to demonstrate the STAGELINK internship flow."
            ),
            "verification_status": ACTIVE,
        },
    },
    {
        "key": "company_abc",
        "local_part": "abc-company",
        "name": "ABC Company",
        "role": UserRole.COMPANY,
        "profile": {
            "legal_name": "ABC Company",
            "address": "12 Industrial Road, Douala",
            "contact_person": "Claire Mbala",
            "phone": "+237611000001",
            "website": "https://abc-company.example.com",
            "description": "Engineering and digital services group.",
            "verification_status": ACTIVE,
        },
    },
    {
        "key": "company_farissia",
        "local_part": "eurl-farissia",
        "name": "EURL FARISSIA",
        "role": UserRole.COMPANY,
        "profile": {
            "legal_name": "EURL FARISSIA",
            "address": "8 Rue de la Paix, Yaoundé",
            "contact_person": "Farid Ali",
            "phone": "+237611000002",
            "website": "https://farissia.example.com",
            "description": "Consulting and software development cooperative.",
            "verification_status": ACTIVE,
        },
    },
    {
        "key": "company_horizon",
        "local_part": "horizon",
        "name": "Horizon Internships",
        "role": UserRole.COMPANY,
        "profile": {
            "legal_name": "Horizon Internships SARL",
            "address": "45 Akwa Street, Douala",
            "contact_person": "Hélène Nkomo",
            "phone": "+237611000003",
            "website": "https://horizon.example.com",
            "description": "Awaiting platform verification.",
            "verification_status": PENDING,
        },
    },
    {
        "key": "company_delta",
        "local_part": "delta-services",
        "name": "Delta Services",
        "role": UserRole.COMPANY,
        "profile": {
            "legal_name": "Delta Services and Consulting",
            "address": "3 Bastos Avenue, Yaoundé",
            "contact_person": "Daniel Ondo",
            "phone": "+237611000004",
            "website": "https://delta.example.com",
            "description": "Business process outsourcing company.",
            "verification_status": PENDING,
        },
    },
    {
        "key": "company_vertex",
        "local_part": "vertex",
        "name": "Vertex Consulting",
        "role": UserRole.COMPANY,
        "profile": {
            "legal_name": "Vertex Consulting Ltd",
            "address": "72 Bonamoussadi, Douala",
            "contact_person": "Victor Eto'a",
            "phone": "+237611000005",
            "website": "https://vertex.example.com",
            "description": "Registration documents could not be verified.",
            "verification_status": REJECTED,
            "rejection_reason": (
                "The registration certificate is expired. Please upload a current "
                "document and resubmit the registration."
            ),
        },
    },
    {
        "key": "supervisor",
        "local_part": "supervisor",
        "name": "Demo Supervisor",
        "role": UserRole.SUPERVISOR,
        "profile": dict(SUPERVISOR_DEFAULTS),
    },
    {
        "key": "supervisor_2",
        "local_part": "supervisor-2",
        "name": "Dr. Amina Bello",
        "role": UserRole.SUPERVISOR,
        "profile": {**SUPERVISOR_DEFAULTS, "grade": "Lecturer"},
    },
    {
        "key": "supervisor_3",
        "local_part": "supervisor-3",
        "name": "Dr. Pierre Nkoulou",
        "role": UserRole.SUPERVISOR,
        "profile": {**SUPERVISOR_DEFAULTS, "department": "Information Systems"},
    },
    {
        "key": "student",
        "local_part": "student",
        "name": "Demo Student",
        "role": UserRole.STUDENT,
        "profile": {**STUDENT_DEFAULTS, "matricule": "DEMO-2026-001"},
    },
    {
        "key": "student_2",
        "local_part": "student-2",
        "name": "Amina Njeri",
        "role": UserRole.STUDENT,
        "profile": {**STUDENT_DEFAULTS, "matricule": "DEMO-2026-002"},
    },
    {
        "key": "student_3",
        "local_part": "student-3",
        "name": "Paul Mbarga",
        "role": UserRole.STUDENT,
        "profile": {**STUDENT_DEFAULTS, "matricule": "DEMO-2026-003"},
    },
    {
        "key": "student_4",
        "local_part": "student-4",
        "name": "Sara Essomba",
        "role": UserRole.STUDENT,
        "profile": {
            **STUDENT_DEFAULTS,
            "department": "Information Systems",
            "matricule": "DEMO-2026-004",
        },
    },
    {
        "key": "student_5",
        "local_part": "student-5",
        "name": "Yann Fotso",
        "role": UserRole.STUDENT,
        "profile": {**STUDENT_DEFAULTS, "matricule": "DEMO-2026-005"},
    },
)


def demo_user_id(local_part):
    """Stable UUID for a demo local part (same value on every machine and rerun)."""
    return str(
        uuid.uuid5(uuid.NAMESPACE_URL, f"stagelink.demo/users/{local_part.lower()}")
    )


class Command(BaseCommand):
    help = (
        "Create or refresh the demo accounts, role profiles, a verified demo "
        "company, the front-end directory and a published offer."
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
            "--directory-file",
            default=None,
            help=(
                "Where to write the front-end demo directory "
                f"(default: {DEFAULT_DIRECTORY_FILE or 'auto-detected repo checkout'})."
            ),
        )
        parser.add_argument(
            "--skip-directory",
            action="store_true",
            help="Do not write the front-end demo directory file.",
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
                    user_id=demo_user_id(account["local_part"]),
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
                self._seed_profile(account, user, users["platform_admin"])

        directory_file = None
        if options["skip_directory"]:
            pass
        elif options["directory_file"]:
            directory_file = self._write_directory(
                users, Path(options["directory_file"])
            )
        elif DEFAULT_DIRECTORY_FILE is not None:
            directory_file = self._write_directory(users, DEFAULT_DIRECTORY_FILE)
        else:
            # No repo checkout (e.g. the identity container in CI). The
            # directory.json artifact is generated locally and committed; there
            # is nowhere to write it here, so skip instead of crashing.
            self._log(
                "No front-end checkout found; skipping the demo directory "
                "(pass --directory-file to write one explicitly).",
                self.style.WARNING,
            )

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
            "directory": str(directory_file) if directory_file else None,
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
    def _upsert_user(
        *,
        user_id,
        email,
        name,
        role,
        password,
        is_staff,
        is_superuser,
    ):
        user = User.objects.filter(email__iexact=email).first()
        created = user is None

        if created:
            if isinstance(role, UserRole):
                role = role.value
            if role == UserRole.PLATFORM_ADMIN and is_superuser:
                user = User.objects.create_superuser(
                    id=uuid.UUID(user_id),
                    email=email,
                    password=password,
                    name=name,
                    role=role,
                )
            else:
                user = User.objects.create_user(
                    id=uuid.UUID(user_id),
                    email=email,
                    password=password,
                    name=name,
                    role=role,
                )

        # Converge every run: the demo tenant must always be usable and the
        # documented password must always work, including after manual edits.
        user.name = name
        user.role = role
        # Companies are refined by _seed_profile once their verification state
        # is known (a signal creates the profile on user creation).
        user.is_active = True
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.set_password(password)
        user.save()
        return user, created

    @staticmethod
    def _seed_profile(account, user, admin):
        data = account.get("profile")
        if not data:
            return
        if user.role == UserRole.COMPANY:
            profile, created = CompanyProfile.objects.get_or_create(user=user)
            status = data["verification_status"]
            # A status that differs from the seed and carries a decision marker
            # was set by a tester through the verification UI: keep it.
            ui_decision = (
                not created
                and profile.verification_status != status
                and bool(profile.verified_at or profile.rejection_reason)
            )
            if not ui_decision:
                for field in (
                    "legal_name",
                    "address",
                    "contact_person",
                    "phone",
                    "website",
                    "description",
                    "verification_status",
                ):
                    setattr(profile, field, data.get(field, ""))
                profile.rejection_reason = data.get("rejection_reason", "")
                profile.verified_by = admin if status != PENDING else None
                profile.verified_at = timezone.now() if status != PENDING else None
                profile.save()
            user.is_active = profile.verification_status == ACTIVE
            user.save(update_fields=["is_active"])
        elif user.role == UserRole.STUDENT:
            profile, _ = StudentProfile.objects.get_or_create(user=user)
            for field in (
                "university",
                "department",
                "specialty",
                "academic_year",
                "matricule",
            ):
                setattr(profile, field, data.get(field, ""))
            profile.save()
        elif user.role == UserRole.SUPERVISOR:
            profile, _ = SupervisorProfile.objects.get_or_create(user=user)
            profile.department = data.get("department", "")
            profile.grade = data.get("grade", "")
            profile.save()

    def _write_directory(self, users, path):
        """Write the demo-only name directory consumed when VITE_DEMO_DIRECTORY=1."""
        entries = {}
        for account in DEMO_ACCOUNTS:
            user = users[account["key"]]
            entry = {
                "name": user.name,
                "email": user.email,
                "role": user.role,
            }
            data = account.get("profile") or {}
            for field in ("matricule", "department"):
                if data.get(field):
                    entry[field] = data[field]
            entries[str(user.id)] = entry

        payload = {
            "users": dict(sorted(entries.items(), key=lambda item: item[1]["email"]))
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        self._log(f"Wrote demo directory to {path}.", self.style.SUCCESS)
        return path

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
            "company_abc": "Company (ABC)",
            "company_farissia": "Company (Farissia)",
            "company_horizon": "Company (pending)",
            "company_delta": "Company (pending)",
            "company_vertex": "Company (rejected)",
            "student": "Student",
            "university_admin": "University admin",
            "supervisor": "Supervisor",
        }
        for key, account in result["accounts"].items():
            self.stdout.write(
                f"  {labels.get(key, key):<24} {account['email']:<38} {account['id']}"
            )
        if result["directory"]:
            self.stdout.write(f"\nDemo directory written to {result['directory']}.")

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
            "  The verified companies, students, university admin and "
            "supervisors can now log in with the password above."
        )
