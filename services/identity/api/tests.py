from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from api.models import (
    CompanyProfile,
    StudentProfile,
    SupervisorProfile,
    User,
    UserRole,
)

TEST_SERVICE_TOKEN = "test-service-token"


@override_settings(INTERNAL_SERVICE_TOKEN=TEST_SERVICE_TOKEN)
class IdentityApiTests(APITestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            email="student@example.edu",
            password="StudentStrongPassword!2026",
            name="Sample Student",
            role=UserRole.STUDENT,
        )
        self.other_student = User.objects.create_user(
            email="other@example.edu",
            password="OtherStrongPassword!2026",
            name="Other Student",
            role=UserRole.STUDENT,
        )

    def test_registration_hashes_password_and_normalizes_email(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "NEW.STUDENT@EXAMPLE.EDU",
                "password": "RegistrationStrongPassword!2026",
                "name": "New Student",
                "role": UserRole.STUDENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="new.student@example.edu")
        self.assertNotEqual(user.password_hash, "RegistrationStrongPassword!2026")
        self.assertTrue(user.check_password("RegistrationStrongPassword!2026"))
        self.assertTrue(StudentProfile.objects.filter(user=user).exists())

    def test_company_registration_creates_inactive_account(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "company@example.com",
                "password": "SecureIndustryPhrase!2026",
                "name": "Example Company",
                "role": UserRole.COMPANY,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        company = User.objects.get(email="company@example.com")
        self.assertFalse(company.is_active)

    def test_registration_rejects_privileged_roles(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "admin@example.edu",
                "password": "AdministratorPassword!2026",
                "name": "Attempted Administrator",
                "role": UserRole.PLATFORM_ADMIN,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="admin@example.edu").exists())

    def test_registration_rejects_case_insensitive_duplicate_email(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "STUDENT@EXAMPLE.EDU",
                "password": "DuplicateStrongPassword!2026",
                "name": "Duplicate Student",
                "role": UserRole.STUDENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_issues_access_and_refresh_tokens_with_user_claims(self):
        response = self.client.post(
            reverse("auth-login"),
            {
                "email": "STUDENT@EXAMPLE.EDU",
                "password": "StudentStrongPassword!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["token_type"], "Bearer")
        access_token = AccessToken(response.data["access"])
        self.assertEqual(access_token["role"], UserRole.STUDENT)
        self.assertEqual(access_token["email"], self.student.email)

    def test_login_rejects_inactive_company(self):
        User.objects.create_user(
            email="inactive@example.com",
            password="SecureInactiveCompanyPhrase!2026",
            name="Inactive Company",
            role=UserRole.COMPANY,
        )

        response = self.client.post(
            reverse("auth-login"),
            {
                "email": "inactive@example.com",
                "password": "SecureInactiveCompanyPhrase!2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_requires_authentication(self):
        response = self.client.get(reverse("user-profile"))
        role_profile_response = self.client.get(reverse("user-role-profile"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(role_profile_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_patch_updates_only_the_authenticated_user(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            reverse("user-profile"),
            {"name": "Updated Student"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.other_student.refresh_from_db()
        self.assertEqual(self.student.name, "Updated Student")
        self.assertEqual(self.other_student.name, "Other Student")

    def test_profile_patch_rejects_protected_role_change(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            reverse("user-profile"),
            {"role": UserRole.PLATFORM_ADMIN},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, UserRole.STUDENT)

    def test_profile_patch_rejects_email_owned_by_another_user(self):
        self.client.force_authenticate(user=self.student)

        response = self.client.patch(
            reverse("user-profile"),
            {"email": "OTHER@example.edu"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_lookup_rejects_user_access_token_as_service_token(self):
        self.client.force_authenticate(user=None)
        login_response = self.client.post(
            reverse("auth-login"),
            {
                "email": self.student.email,
                "password": "StudentStrongPassword!2026",
            },
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_internal_lookup_accepts_service_token_and_returns_minimal_data(self):
        self.client.credentials(HTTP_X_SERVICE_TOKEN=TEST_SERVICE_TOKEN)

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.student.id))
        self.assertEqual(response.data["role"], UserRole.STUDENT)
        self.assertNotIn("password_hash", response.data)

    def test_internal_lookup_rejects_missing_service_token(self):
        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_internal_lookup_rejects_wrong_service_token(self):
        self.client.credentials(HTTP_X_SERVICE_TOKEN="wrong-token")

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(INTERNAL_SERVICE_TOKEN="")
    def test_internal_lookup_denies_everyone_when_token_is_unconfigured(self):
        self.client.credentials(HTTP_X_SERVICE_TOKEN="anything")

        response = self.client.get(
            reverse("internal-user-lookup", args=[self.student.id])
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_login_idempotently_creates_missing_role_profile(self):
        StudentProfile.objects.filter(user=self.student).delete()

        first_response = self.client.post(
            reverse("auth-login"),
            {
                "email": self.student.email,
                "password": "StudentStrongPassword!2026",
            },
            format="json",
        )
        second_response = self.client.post(
            reverse("auth-login"),
            {
                "email": self.student.email,
                "password": "StudentStrongPassword!2026",
            },
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(StudentProfile.objects.filter(user=self.student).count(), 1)

    def test_user_creation_automatically_creates_role_profiles_once(self):
        student = User.objects.create_user(
            email="automatic-student@example.edu",
            password="AutomaticStudentPassword!2026",
            name="Automatic Student",
            role=UserRole.STUDENT,
        )
        company = User.objects.create_user(
            email="automatic-company@example.com",
            password="AutomaticCompanyPassword!2026",
            name="Automatic Company",
            role=UserRole.COMPANY,
        )
        supervisor = User.objects.create_user(
            email="automatic-supervisor@example.edu",
            password="AutomaticSupervisorPassword!2026",
            name="Automatic Supervisor",
            role=UserRole.SUPERVISOR,
        )

        self.assertEqual(StudentProfile.objects.filter(user=student).count(), 1)
        self.assertEqual(CompanyProfile.objects.filter(user=company).count(), 1)
        self.assertEqual(SupervisorProfile.objects.filter(user=supervisor).count(), 1)

    def test_student_can_read_and_replace_own_role_profile(self):
        self.client.force_authenticate(user=self.student)

        get_response = self.client.get(reverse("user-role-profile"))
        put_response = self.client.put(
            reverse("user-role-profile"),
            {
                "university": "University of Algiers",
                "department": "Computer Science",
                "specialty": "Software Engineering",
                "academic_year": "2026-2027",
                "matricule": "STU-001",
            },
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["department"], "")
        self.assertEqual(put_response.status_code, status.HTTP_200_OK)
        self.assertEqual(put_response.data["matricule"], "STU-001")
        self.assertEqual(StudentProfile.objects.filter(user=self.student).count(), 1)

    def test_role_profile_rejects_field_errors_and_account_field_edits(self):
        self.client.force_authenticate(user=self.student)

        missing_fields = self.client.put(
            reverse("user-role-profile"),
            {"university": "University of Algiers"},
            format="json",
        )
        protected_field = self.client.put(
            reverse("user-role-profile"),
            {
                "university": "University of Algiers",
                "department": "Computer Science",
                "specialty": "Software Engineering",
                "academic_year": "2026-2027",
                "matricule": "STU-001",
                "role": UserRole.PLATFORM_ADMIN,
                "email": "changed@example.edu",
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(missing_fields.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("department", missing_fields.data)
        self.assertEqual(protected_field.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", protected_field.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.role, UserRole.STUDENT)
        self.assertTrue(self.student.is_active)

    def test_roles_without_role_profiles_get_forbidden(self):
        for role in (UserRole.UNIVERSITY_ADMIN, UserRole.PLATFORM_ADMIN):
            user = User.objects.create_user(
                email=f"{role}-profile@example.edu",
                password="ProfilePermissionPassword!2026",
                name=f"{role} profile test",
                role=role,
            )
            self.client.force_authenticate(user=user)

            get_response = self.client.get(reverse("user-role-profile"))
            put_response = self.client.put(
                reverse("user-role-profile"), {}, format="json"
            )

            self.assertEqual(get_response.status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(put_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_company_can_read_and_replace_own_profile(self):
        company = User.objects.create_user(
            email="profile-company@example.com",
            password="SecureCompanyProfilePhrase!2026",
            name="Profile Company",
            role=UserRole.COMPANY,
        )
        self.client.force_authenticate(user=company)

        get_response = self.client.get(reverse("user-role-profile"))
        put_response = self.client.put(
            reverse("user-role-profile"),
            {
                "legal_name": "Profile Company LLC",
                "address": "10 Main Street",
                "contact_person": "Sam Contact",
                "phone": "+2135550100",
                "website": "https://example.com",
                "description": "An example company.",
            },
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["verification_status"], "pending")
        self.assertEqual(put_response.status_code, status.HTTP_200_OK)
        self.assertEqual(put_response.data["legal_name"], "Profile Company LLC")
        company.refresh_from_db()
        self.assertFalse(company.is_active)

    def test_supervisor_can_read_and_replace_own_profile(self):
        supervisor = User.objects.create_user(
            email="profile-supervisor@example.edu",
            password="SecureSupervisorProfilePhrase!2026",
            name="Profile Supervisor",
            role=UserRole.SUPERVISOR,
        )
        self.client.force_authenticate(user=supervisor)

        get_response = self.client.get(reverse("user-role-profile"))
        put_response = self.client.put(
            reverse("user-role-profile"),
            {"department": "Computer Science", "grade": "Associate Professor"},
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(put_response.status_code, status.HTTP_200_OK)
        self.assertEqual(put_response.data["grade"], "Associate Professor")
        self.assertEqual(SupervisorProfile.objects.filter(user=supervisor).count(), 1)

    def test_company_verification_records_admin_and_rejection_reason(self):
        company_response = self.client.post(
            reverse("auth-register"),
            {
                "email": "verify@example.com",
                "password": "SecureCompanyPhrase!2026",
                "name": "Verify Me LLC",
                "role": UserRole.COMPANY,
            },
            format="json",
        )
        company = User.objects.get(email="verify@example.com")
        admin = User.objects.create_user(
            email="platform@example.edu",
            password="PlatformAdminStrongPassword!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        self.client.force_authenticate(user=admin)

        pending = self.client.get(
            reverse("admin-company-list"), {"status": "pending"}
        )
        missing_reason = self.client.post(
            reverse("admin-company-reject", args=[company.id]), {}, format="json"
        )
        rejected = self.client.post(
            reverse("admin-company-reject", args=[company.id]),
            {"reason": "Business registration could not be confirmed."},
            format="json",
        )
        company.refresh_from_db()
        profile = CompanyProfile.objects.get(user=company)

        self.assertEqual(company_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        self.assertIn(str(company.id), [item["id"] for item in pending.data["results"]])
        self.assertEqual(missing_reason.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        self.assertFalse(company.is_active)
        self.assertEqual(profile.verification_status, CompanyProfile.VerificationStatus.REJECTED)
        self.assertEqual(profile.rejection_reason, "Business registration could not be confirmed.")

        verified = self.client.post(
            reverse("admin-company-verify", args=[company.id]), format="json"
        )
        company.refresh_from_db()
        profile.refresh_from_db()
        self.assertEqual(verified.status_code, status.HTTP_200_OK)
        self.assertTrue(company.is_active)
        self.assertEqual(profile.verification_status, CompanyProfile.VerificationStatus.ACTIVE)
        self.assertEqual(profile.verified_by, admin)
        self.assertIsNotNone(profile.verified_at)
        self.assertEqual(profile.rejection_reason, "")
        login = self.client.post(
            reverse("auth-login"),
            {
                "email": company.email,
                "password": "SecureCompanyPhrase!2026",
            },
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_public_company_profile_is_limited_to_verified_non_sensitive_fields(self):
        company = User.objects.create_user(
            email="public@example.com",
            password="SecurePublicCompanyPhrase!2026",
            name="Public Company",
            role=UserRole.COMPANY,
        )
        profile, _ = CompanyProfile.objects.update_or_create(
            user=company,
            defaults={
                "legal_name": "Public Company LLC",
                "address": "10 Main Street",
                "contact_person": "Private Contact",
                "phone": "+2135550100",
                "website": "https://example.com",
                "description": "A verified company.",
                "verification_status": CompanyProfile.VerificationStatus.ACTIVE,
            },
        )
        company.is_active = True
        company.save(update_fields=["is_active"])

        response = self.client.get(
            reverse("public-company-profile", args=[company.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(profile.id))
        self.assertNotIn("phone", response.data)
        self.assertNotIn("contact_person", response.data)

    def test_public_company_profile_hides_pending_company(self):
        company = User.objects.create_user(
            email="pending@example.com",
            password="SecurePendingCompanyPhrase!2026",
            name="Pending Company",
            role=UserRole.COMPANY,
        )
        response = self.client.get(
            reverse("public-company-profile", args=[company.id])
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_admin_cannot_call_admin_endpoints(self):
        company = User.objects.create_user(
            email="matrix-company@example.com",
            password="SecureMatrixCompanyPhrase!2026",
            name="Matrix Company",
            role=UserRole.COMPANY,
        )
        non_admin_roles = (
            UserRole.STUDENT,
            UserRole.COMPANY,
            UserRole.SUPERVISOR,
            UserRole.UNIVERSITY_ADMIN,
        )

        for role in non_admin_roles:
            user = User.objects.create_user(
                email=f"matrix-{role}@example.edu",
                password="SecureMatrixRolePassword!2026",
                name=f"{role} user",
                role=role,
            )
            self.client.force_authenticate(user=user)
            responses = (
                self.client.get(
                    reverse("admin-company-list"), {"status": "pending"}
                ),
                self.client.post(
                    reverse("admin-company-verify", args=[company.id]),
                    format="json",
                ),
                self.client.post(
                    reverse("admin-company-reject", args=[company.id]),
                    {"reason": "Not authorized."},
                    format="json",
                ),
                self.client.get(reverse("admin-user-list-create")),
                self.client.post(
                    reverse("admin-user-list-create"),
                    {
                        "email": f"prohibited-{role}@example.edu",
                        "name": "Prohibited Provisioning",
                        "role": UserRole.SUPERVISOR,
                        "password": "SecureProvisionedSupervisor!2026",
                    },
                    format="json",
                ),
                self.client.patch(
                    reverse("admin-user-detail", args=[company.id]),
                    {"is_active": True},
                    format="json",
                ),
            )

            self.assertTrue(
                all(response.status_code == status.HTTP_403_FORBIDDEN for response in responses),
                msg=f"{role} must not access platform administration endpoints.",
            )
            self.assertFalse(
                User.objects.filter(email=f"prohibited-{role}@example.edu").exists()
            )

    def test_platform_admin_provisions_account_with_initial_or_generated_password(self):
        admin = User.objects.create_user(
            email="platform@example.edu",
            password="PlatformAdminStrongPassword!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        self.client.force_authenticate(user=admin)

        initial_response = self.client.post(
            reverse("admin-user-list-create"),
            {
                "email": "supervisor@example.edu",
                "name": "Supervisor One",
                "role": UserRole.SUPERVISOR,
                "password": "SecureSupervisorPhrase!2026",
            },
            format="json",
        )
        generated_response = self.client.post(
            reverse("admin-user-list-create"),
            {
                "email": "provisioned-company@example.com",
                "name": "Provisioned Company",
                "role": UserRole.COMPANY,
                "generate_password": True,
            },
            format="json",
        )

        self.assertEqual(initial_response.status_code, status.HTTP_201_CREATED)
        supervisor = User.objects.get(email="supervisor@example.edu")
        self.assertTrue(supervisor.check_password("SecureSupervisorPhrase!2026"))
        self.assertTrue(SupervisorProfile.objects.filter(user=supervisor).exists())
        self.assertEqual(generated_response.status_code, status.HTTP_201_CREATED)
        company = User.objects.get(email="provisioned-company@example.com")
        self.assertFalse(company.is_active)
        self.assertTrue(company.check_password(generated_response.data["one_time_password"]))
        self.assertEqual(
            CompanyProfile.objects.get(user=company).verification_status,
            CompanyProfile.VerificationStatus.PENDING,
        )
        self.assertNotIn("one_time_password", initial_response.data)

    def test_provisioning_rejects_platform_admin_and_missing_password_choice(self):
        admin = User.objects.create_user(
            email="platform@example.edu",
            password="PlatformAdminStrongPassword!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        self.client.force_authenticate(user=admin)

        privileged = self.client.post(
            reverse("admin-user-list-create"),
            {
                "email": "new-admin@example.edu",
                "name": "New Admin",
                "role": UserRole.PLATFORM_ADMIN,
                "password": "SecureNewAdminPhrase!2026",
            },
            format="json",
        )
        missing_password = self.client.post(
            reverse("admin-user-list-create"),
            {
                "email": "missing-password@example.edu",
                "name": "Missing Password",
                "role": UserRole.SUPERVISOR,
            },
            format="json",
        )

        self.assertEqual(privileged.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing_password.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="new-admin@example.edu").exists())

    def test_admin_user_list_filter_and_patch_limits_fields(self):
        admin = User.objects.create_user(
            email="platform@example.edu",
            password="PlatformAdminStrongPassword!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        supervisor = User.objects.create_user(
            email="listed-supervisor@example.edu",
            password="SecureListedSupervisorPhrase!2026",
            name="Listed Supervisor",
            role=UserRole.SUPERVISOR,
        )
        self.client.force_authenticate(user=admin)

        listing = self.client.get(
            reverse("admin-user-list-create"), {"role": UserRole.SUPERVISOR}
        )
        patch_response = self.client.patch(
            reverse("admin-user-detail", args=[supervisor.id]),
            {"is_active": False},
            format="json",
        )
        privilege_escalation = self.client.patch(
            reverse("admin-user-detail", args=[supervisor.id]),
            {"role": UserRole.PLATFORM_ADMIN},
            format="json",
        )

        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertTrue(all(item["role"] == UserRole.SUPERVISOR for item in listing.data["results"]))
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        supervisor.refresh_from_db()
        self.assertFalse(supervisor.is_active)
        self.assertEqual(privilege_escalation.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(supervisor.role, UserRole.SUPERVISOR)

    def test_admin_user_patch_applies_company_verification_rules(self):
        admin = User.objects.create_user(
            email="platform@example.edu",
            password="PlatformAdminStrongPassword!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        company = User.objects.create_user(
            email="patch-company@example.com",
            password="SecurePatchCompanyPhrase!2026",
            name="Patch Company",
            role=UserRole.COMPANY,
        )
        self.client.force_authenticate(user=admin)

        rejected = self.client.patch(
            reverse("admin-user-detail", args=[company.id]),
            {
                "verification_status": "rejected",
                "rejection_reason": "Missing registration document.",
            },
            format="json",
        )
        activate_rejected = self.client.patch(
            reverse("admin-user-detail", args=[company.id]),
            {"is_active": True},
            format="json",
        )
        protected = self.client.patch(
            reverse("admin-user-detail", args=[company.id]),
            {"email": "attacker@example.com"},
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_200_OK)
        company.refresh_from_db()
        self.assertFalse(company.is_active)
        self.assertEqual(
            CompanyProfile.objects.get(user=company).verification_status,
            CompanyProfile.VerificationStatus.REJECTED,
        )
        self.assertEqual(activate_rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(protected.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_directory_filters_paginates_and_batch_looks_up(self):
        supervisor = User.objects.create_user(
            email="directory-supervisor@example.edu",
            password="SecureDirectorySupervisorPhrase!2026",
            name="Directory Supervisor",
            role=UserRole.SUPERVISOR,
        )
        SupervisorProfile.objects.filter(user=supervisor).update(department="CS-01")
        self.client.credentials(HTTP_X_SERVICE_TOKEN=TEST_SERVICE_TOKEN)

        filtered = self.client.get(
            reverse("internal-user-directory"),
            {"role": UserRole.SUPERVISOR, "department": "CS-01", "page": 1},
        )
        batch = self.client.get(
            reverse("internal-user-directory"),
            {"ids": f"{supervisor.id},{self.student.id}"},
        )
        unknown_role = self.client.get(
            reverse("internal-user-directory"), {"role": "administrator"}
        )

        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(filtered.data["results"][0]["id"], str(supervisor.id))
        self.assertNotIn("is_active", filtered.data["results"][0])
        self.assertEqual(batch.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in batch.data["results"]],
            [str(supervisor.id), str(self.student.id)],
        )
        self.assertEqual(
            set(batch.data["results"][0]),
            {"id", "name"},
        )
        self.assertEqual(unknown_role.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_directory_rejects_bad_token_and_more_than_100_ids(self):
        self.client.credentials(HTTP_X_SERVICE_TOKEN="wrong-token")
        unauthorized = self.client.get(reverse("internal-user-directory"))
        self.client.credentials(HTTP_X_SERVICE_TOKEN=TEST_SERVICE_TOKEN)
        too_many = self.client.get(
            reverse("internal-user-directory"),
            {"ids": ",".join([str(self.student.id)] * 101)},
        )

        self.assertEqual(unauthorized.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_directory_rejects_user_auth_and_malformed_batch_queries(self):
        self.client.force_authenticate(user=self.student)
        jwt_only = self.client.get(reverse("internal-user-directory"))
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_X_SERVICE_TOKEN=TEST_SERVICE_TOKEN)
        malformed = self.client.get(
            reverse("internal-user-directory"), {"ids": "not-a-uuid"}
        )
        mixed = self.client.get(
            reverse("internal-user-directory"),
            {"ids": str(self.student.id), "page": 1},
        )

        self.assertEqual(jwt_only.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(malformed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mixed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_internal_directory_returns_distinct_pages(self):
        for index in range(21):
            User.objects.create_user(
                email=f"page-{index:02d}@example.edu",
                password="SecurePaginationPassword!2026",
                name=f"Page User {index}",
                role=UserRole.STUDENT,
            )
        self.client.credentials(HTTP_X_SERVICE_TOKEN=TEST_SERVICE_TOKEN)

        first_page = self.client.get(reverse("internal-user-directory"), {"page": 1})
        second_page = self.client.get(reverse("internal-user-directory"), {"page": 2})

        first_ids = {item["id"] for item in first_page.data["results"]}
        second_ids = {item["id"] for item in second_page.data["results"]}
        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data["count"], 23)
        self.assertEqual(len(first_ids), 20)
        self.assertEqual(len(second_ids), 3)
        self.assertFalse(first_ids & second_ids)
