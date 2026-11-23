"""Tests for administrative provisioning, institution scope and the directory."""

from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import (
    CompanyProfile,
    StudentProfile,
    SupervisorProfile,
    UniversityAdminProfile,
    User,
    UserRole,
)


STUDENT_UNIVERSITY = "  University of Example  "
ADMIN_UNIVERSITY = "University of Example"


class ProvisioningTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.platform_admin = User.objects.create_user(
            email="platform@example.edu",
            password="PlatformAdminStrong!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        self.university_admin = User.objects.create_user(
            email="uni-admin@example.edu",
            password="UniversityAdminStrong!2026",
            name="University Admin",
            role=UserRole.UNIVERSITY_ADMIN,
        )
        UniversityAdminProfile.objects.filter(user=self.university_admin).update(
            university=ADMIN_UNIVERSITY, department="Admissions"
        )
        self.other_university_admin = User.objects.create_user(
            email="other-admin@example.edu",
            password="OtherUniversityAdminStrong!2026",
            name="Other University Admin",
            role=UserRole.UNIVERSITY_ADMIN,
        )
        UniversityAdminProfile.objects.filter(user=self.other_university_admin).update(
            university="Other University"
        )

    def _provision(self, email, role, university=None, generate_password=False):
        data = {
            "email": email,
            "name": email.split("@")[0],
            "role": role,
        }
        if university is not None:
            data["university"] = university
        if generate_password:
            data["generate_password"] = True
        else:
            data["password"] = "ProvisionedStrong!2026"
        return self.client.post(
            reverse("admin-user-list-create"), data, format="json"
        )

    def test_platform_admin_can_provision_every_role(self):
        self.client.force_authenticate(user=self.platform_admin)

        responses = {
            UserRole.STUDENT: self._provision(
                "new-student@example.edu",
                UserRole.STUDENT,
                university=STUDENT_UNIVERSITY,
                generate_password=True,
            ),
            UserRole.SUPERVISOR: self._provision(
                "new-supervisor@example.edu",
                UserRole.SUPERVISOR,
                university=ADMIN_UNIVERSITY,
            ),
            UserRole.UNIVERSITY_ADMIN: self._provision(
                "new-uni-admin@example.edu",
                UserRole.UNIVERSITY_ADMIN,
                university=ADMIN_UNIVERSITY,
            ),
            UserRole.COMPANY: self._provision(
                "new-company@example.com", UserRole.COMPANY, generate_password=True
            ),
        }

        self.assertTrue(
            all(response.status_code == status.HTTP_201_CREATED for response in responses.values())
        )
        student = User.objects.get(email="new-student@example.edu")
        self.assertTrue(student.check_password(responses[UserRole.STUDENT].data["one_time_password"]))
        self.assertEqual(
            StudentProfile.objects.get(user=student).university, ADMIN_UNIVERSITY
        )
        self.assertEqual(
            SupervisorProfile.objects.get(
                user=User.objects.get(email="new-supervisor@example.edu")
            ).university,
            ADMIN_UNIVERSITY,
        )
        self.assertEqual(
            UniversityAdminProfile.objects.get(
                user=User.objects.get(email="new-uni-admin@example.edu")
            ).university,
            ADMIN_UNIVERSITY,
        )
        self.assertNotIn(
            "one_time_password", responses[UserRole.SUPERVISOR].data
        )
        self.assertFalse(User.objects.get(email="new-company@example.com").is_active)

    def test_no_role_can_provision_platform_admin(self):
        self.client.force_authenticate(user=self.platform_admin)
        response = self._provision("sneaky@example.edu", UserRole.PLATFORM_ADMIN)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="sneaky@example.edu").exists())

    def test_platform_admin_cannot_change_a_role_or_provision_admin_via_patch(self):
        student = User.objects.create_user(
            email="role-change@example.edu",
            password="RoleChangeStrong!2026",
            name="Role Change Student",
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=self.platform_admin)

        role_change = self.client.patch(
            reverse("admin-user-detail", args=[student.id]),
            {"role": UserRole.PLATFORM_ADMIN},
            format="json",
        )

        self.assertEqual(role_change.status_code, status.HTTP_400_BAD_REQUEST)
        student.refresh_from_db()
        self.assertEqual(student.role, UserRole.STUDENT)

    def test_university_admin_provisions_only_scoped_roles(self):
        self.client.force_authenticate(user=self.university_admin)

        student = self._provision("scoped-student@example.edu", UserRole.STUDENT)
        supervisor = self._provision(
            "scoped-supervisor@example.edu",
            UserRole.SUPERVISOR,
            university=STUDENT_UNIVERSITY,
        )
        wrong_university = self._provision(
            "wrong-university@example.edu", UserRole.STUDENT, university="Elsewhere"
        )
        company = self._provision("blocked-company@example.com", UserRole.COMPANY)
        other_admin = self._provision(
            "blocked-admin@example.edu", UserRole.UNIVERSITY_ADMIN
        )

        self.assertEqual(student.status_code, status.HTTP_201_CREATED)
        self.assertEqual(supervisor.status_code, status.HTTP_201_CREATED)
        self.assertEqual(wrong_university.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(company.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(other_admin.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            StudentProfile.objects.get(
                user=User.objects.get(email="scoped-student@example.edu")
            ).university,
            ADMIN_UNIVERSITY,
        )
        self.assertEqual(
            SupervisorProfile.objects.get(
                user=User.objects.get(email="scoped-supervisor@example.edu")
            ).university,
            ADMIN_UNIVERSITY,
        )
        self.assertFalse(User.objects.filter(email="wrong-university@example.edu").exists())
        self.assertFalse(User.objects.filter(email="blocked-company@example.com").exists())
        self.assertFalse(User.objects.filter(email="blocked-admin@example.edu").exists())

    def test_university_admin_without_university_cannot_provision(self):
        self.client.force_authenticate(user=self.other_university_admin)
        UniversityAdminProfile.objects.filter(user=self.other_university_admin).update(
            university=""
        )

        response = self._provision("no-institution@example.edu", UserRole.STUDENT)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_university_admin_cannot_see_or_edit_out_of_scope_accounts(self):
        outsider = User.objects.create_user(
            email="outsider@example.edu",
            password="OutsiderStrong!2026",
            name="Outsider",
            role=UserRole.STUDENT,
        )
        StudentProfile.objects.filter(user=outsider).update(university="Other University")
        self.client.force_authenticate(user=self.university_admin)

        detail = self.client.get(reverse("admin-user-detail", args=[outsider.id]))
        patch = self.client.patch(
            reverse("admin-user-detail", args=[outsider.id]),
            {"name": "Changed"},
            format="json",
        )

        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(patch.status_code, status.HTTP_404_NOT_FOUND)
        outsider.refresh_from_db()
        self.assertEqual(outsider.name, "Outsider")

    def test_university_admin_edits_scoped_profile_but_not_lifecycle_or_verification(self):
        target = User.objects.create_user(
            email="editable@example.edu",
            password="EditableStrong!2026",
            name="Editable Student",
            role=UserRole.STUDENT,
        )
        StudentProfile.objects.filter(user=target).update(university=ADMIN_UNIVERSITY)
        self.client.force_authenticate(user=self.university_admin)

        valid = self.client.patch(
            reverse("admin-user-detail", args=[target.id]),
            {
                "name": "Renamed Student",
                "email": "renamed@example.edu",
                "department": "Computer Science",
                "specialty": "Software Engineering",
                "academic_year": "3",
                "matricule": "STU-123",
            },
            format="json",
        )
        other_university = self.client.patch(
            reverse("admin-user-detail", args=[target.id]),
            {"university": "Elsewhere"},
            format="json",
        )
        deactivate = self.client.patch(
            reverse("admin-user-detail", args=[target.id]),
            {"is_active": False},
            format="json",
        )
        change_role = self.client.patch(
            reverse("admin-user-detail", args=[target.id]),
            {"role": UserRole.PLATFORM_ADMIN},
            format="json",
        )
        verification = self.client.patch(
            reverse("admin-user-detail", args=[target.id]),
            {"verification_status": "active"},
            format="json",
        )

        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        self.assertEqual(other_university.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(deactivate.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(change_role.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(verification.status_code, status.HTTP_403_FORBIDDEN)
        target.refresh_from_db()
        self.assertEqual(target.name, "Renamed Student")
        self.assertEqual(target.email, "renamed@example.edu")
        self.assertTrue(target.is_active)
        profile = StudentProfile.objects.get(user=target)
        self.assertEqual(profile.department, "Computer Science")
        self.assertEqual(profile.specialty, "Software Engineering")
        self.assertEqual(profile.academic_year, "3")
        self.assertEqual(profile.matricule, "STU-123")

    def test_platform_admin_edits_any_account_and_its_profile(self):
        student = User.objects.create_user(
            email="platform-edit@example.edu",
            password="PlatformEditStrong!2026",
            name="Platform Edit Student",
            role=UserRole.STUDENT,
        )
        self.client.force_authenticate(user=self.platform_admin)

        response = self.client.patch(
            reverse("admin-user-detail", args=[student.id]),
            {
                "university": "A New University",
                "department": "Physics",
                "specialty": "Astrophysics",
                "academic_year": "4",
                "matricule": "STU-999",
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student.refresh_from_db()
        self.assertFalse(student.is_active)
        profile = StudentProfile.objects.get(user=student)
        self.assertEqual(profile.university, "A New University")
        self.assertEqual(profile.specialty, "Astrophysics")
        self.assertEqual(profile.matricule, "STU-999")

    def test_admin_user_list_is_scoped_and_filterable(self):
        in_scope = User.objects.create_user(
            email="in-scope@example.edu",
            password="InScopeStrong!2026",
            name="In Scope Student",
            role=UserRole.STUDENT,
        )
        StudentProfile.objects.filter(user=in_scope).update(university=ADMIN_UNIVERSITY)
        out_of_scope = User.objects.create_user(
            email="out-of-scope@example.edu",
            password="OutOfScopeStrong!2026",
            name="Out Of Scope Student",
            role=UserRole.STUDENT,
        )
        StudentProfile.objects.filter(user=out_of_scope).update(university="Other University")
        self.client.force_authenticate(user=self.university_admin)

        all_users = self.client.get(reverse("admin-user-list-create"))
        searched = self.client.get(
            reverse("admin-user-list-create"), {"q": "IN-SCOPE"}
        )
        university = self.client.get(
            reverse("admin-user-list-create"), {"university": "university of example"}
        )
        invalid = self.client.get(
            reverse("admin-user-list-create"), {"role": "administrator"}
        )
        unknown_param = self.client.get(
            reverse("admin-user-list-create"), {"surprise": "1"}
        )

        self.assertEqual(all_users.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {item["id"] for item in all_users.data["results"]},
            {str(in_scope.id)},
        )
        self.assertEqual(searched.data["count"], 1)
        self.assertEqual(searched.data["results"][0]["id"], str(in_scope.id))
        self.assertEqual(university.data["count"], 1)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unknown_param.status_code, status.HTTP_400_BAD_REQUEST)

    def test_university_admin_cannot_manage_company_verification(self):
        company = User.objects.create_user(
            email="uni-company@example.com",
            password="UniCompanyStrong!2026",
            name="Uni Company",
            role=UserRole.COMPANY,
        )
        self.client.force_authenticate(user=self.university_admin)

        responses = (
            self.client.get(reverse("admin-company-list"), {"status": "pending"}),
            self.client.post(reverse("admin-company-verify", args=[company.id])),
            self.client.post(
                reverse("admin-company-reject", args=[company.id]),
                {"reason": "Not your role."},
                format="json",
            ),
        )

        self.assertTrue(
            all(response.status_code == status.HTTP_403_FORBIDDEN for response in responses)
        )
        company.refresh_from_db()
        self.assertFalse(company.is_active)


class UserDirectoryTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.student = User.objects.create_user(
            email="dir-student@example.edu",
            password="DirStudentStrong!2026",
            name="Directory Student",
            role=UserRole.STUDENT,
        )
        StudentProfile.objects.filter(user=self.student).update(
            university="University of Example",
            department="Computer Science",
            specialty="Software Engineering",
            academic_year="3",
            matricule="STU-001",
        )
        self.supervisor = User.objects.create_user(
            email="dir-supervisor@example.edu",
            password="DirSupervisorStrong!2026",
            name="Directory Supervisor",
            role=UserRole.SUPERVISOR,
        )
        SupervisorProfile.objects.filter(user=self.supervisor).update(
            university="University of Example",
            department="Computer Science",
            grade="Professor",
        )
        self.company = User.objects.create_user(
            email="dir-company@example.com",
            password="DirCompanyStrong!2026",
            name="Directory Company",
            role=UserRole.COMPANY,
        )
        User.objects.filter(pk=self.company.pk).update(is_active=True)
        self.university_admin = User.objects.create_user(
            email="dir-uni-admin@example.edu",
            password="DirAdminStrong!2026",
            name="Directory Admin",
            role=UserRole.UNIVERSITY_ADMIN,
        )
        UniversityAdminProfile.objects.filter(user=self.university_admin).update(
            university="University of Example", department="Admissions"
        )
        self.platform_admin = User.objects.create_user(
            email="dir-platform@example.edu",
            password="DirPlatformStrong!2026",
            name="Platform Admin",
            role=UserRole.PLATFORM_ADMIN,
        )
        self.inactive = User.objects.create_user(
            email="dir-inactive@example.edu",
            password="DirInactiveStrong!2026",
            name="Former Student",
            role=UserRole.STUDENT,
        )
        User.objects.filter(pk=self.inactive.pk).update(is_active=False)

    def test_directory_requires_authentication_and_filters(self):
        anonymous = self.client.get(reverse("user-directory-list"))
        self.client.force_authenticate(user=self.student)

        all_users = self.client.get(reverse("user-directory-list"))
        searched = self.client.get(reverse("user-directory-list"), {"q": "SUPERVISOR"})
        by_role = self.client.get(
            reverse("user-directory-list"), {"role": UserRole.COMPANY}
        )
        by_university = self.client.get(
            reverse("user-directory-list"), {"university": "university of example"}
        )
        invalid_role = self.client.get(reverse("user-directory-list"), {"role": "nurse"})
        unknown_param = self.client.get(reverse("user-directory-list"), {"foo": "bar"})

        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(all_users.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            str(self.inactive.id), {item["id"] for item in all_users.data["results"]}
        )
        self.assertEqual(searched.data["results"][0]["id"], str(self.supervisor.id))
        self.assertEqual(
            {item["id"] for item in by_role.data["results"]}, {str(self.company.id)}
        )
        self.assertEqual(
            {item["id"] for item in by_university.data["results"]},
            {str(self.student.id), str(self.supervisor.id), str(self.university_admin.id)},
        )
        self.assertEqual(invalid_role.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unknown_param.status_code, status.HTTP_400_BAD_REQUEST)

    def test_directory_paginates_results(self):
        for index in range(22):
            User.objects.create_user(
                email=f"dir-page-{index:02d}@example.edu",
                password="DirPageStrong!2026",
                name=f"Page User {index}",
                role=UserRole.STUDENT,
            )
        self.client.force_authenticate(user=self.student)

        first = self.client.get(reverse("user-directory-list"), {"page": 1})
        second = self.client.get(reverse("user-directory-list"), {"page": 2})

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["count"], 27)
        self.assertEqual(len(first.data["results"]), 20)
        self.assertEqual(len(second.data["results"]), 7)
        self.assertFalse(
            {item["id"] for item in first.data["results"]}
            & {item["id"] for item in second.data["results"]}
        )

    def test_batch_lookup_preserves_order_and_includes_inactive_users(self):
        self.client.force_authenticate(user=self.company)
        unknown = "00000000-0000-4000-8000-000000000000"
        response = self.client.get(
            reverse("user-lookup"),
            {"ids": f"{self.student.id},{unknown},{self.inactive.id},{self.supervisor.id}"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [str(self.student.id), str(self.inactive.id), str(self.supervisor.id)],
        )
        self.assertEqual(
            response.data["results"][0]["university"], "University of Example"
        )
        self.assertEqual(response.data["results"][0]["specialty"], "Software Engineering")
        self.assertNotIn("matricule", response.data["results"][0])

    def test_batch_lookup_rejects_bad_requests(self):
        self.client.force_authenticate(user=self.student)
        missing = self.client.get(reverse("user-lookup"))
        invalid = self.client.get(reverse("user-lookup"), {"ids": "not-a-uuid"})
        too_many = self.client.get(
            reverse("user-lookup"), {"ids": ",".join([str(self.student.id)] * 101)}
        )
        mixed = self.client.get(
            reverse("user-lookup"), {"ids": str(self.student.id), "role": "student"}
        )

        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mixed.status_code, status.HTTP_400_BAD_REQUEST)

    def test_visibility_matrix_across_viewer_and_target_roles(self):
        base = {"id", "name", "role"}
        admin_fields = {"is_active", "email"}
        student_public = {"university", "department", "specialty", "academic_year"}
        student_private = {"matricule"}
        supervisor_private = {"university", "department", "grade"}
        admin_private = {"university", "department"}
        viewers = {
            "student": self.student,
            "company": self.company,
            "supervisor": self.supervisor,
            "university_admin": self.university_admin,
            "platform_admin": self.platform_admin,
        }
        targets = {
            "student": (
                self.student,
                base | {"email"} | student_public | student_private,
                base | admin_fields | student_public | student_private,
            ),
            "supervisor": (
                self.supervisor,
                base | {"email"} | supervisor_private,
                base | admin_fields | supervisor_private,
            ),
            "company": (
                self.company,
                base | {"email", "phone"},
                base | admin_fields | {"phone"},
            ),
            "university_admin": (
                self.university_admin,
                base | {"email", "is_active"} | admin_private,
                base | admin_fields | admin_private,
            ),
        }

        for viewer_name, viewer in viewers.items():
            self.client.force_authenticate(user=viewer)
            for target_name, (target, self_fields, admin_view) in targets.items():
                with self.subTest(viewer=viewer_name, target=target_name):
                    response = self.client.get(
                        reverse("user-directory-detail", args=[target.id])
                    )
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                    if viewer.pk == target.pk:
                        expected = self_fields
                    elif viewer_name in ("university_admin", "platform_admin"):
                        expected = admin_view
                    elif viewer_name in ("supervisor", "company") and target_name == "student":
                        expected = base | student_public
                    else:
                        expected = base
                    self.assertEqual(set(response.data), expected)

        # The same rules apply to list and batch responses.
        self.client.force_authenticate(user=self.supervisor)
        listed = self.client.get(
            reverse("user-directory-list"), {"role": UserRole.STUDENT}
        )
        self.assertEqual(set(listed.data["results"][0]), base | student_public)
        batch = self.client.get(reverse("user-lookup"), {"ids": str(self.student.id)})
        self.assertEqual(set(batch.data["results"][0]), base | student_public)

    def test_university_admin_can_manage_own_role_profile(self):
        self.client.force_authenticate(user=self.university_admin)
        get_response = self.client.get(reverse("user-role-profile"))
        put_response = self.client.put(
            reverse("user-role-profile"),
            {"university": "University of Example", "department": "Registrar"},
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(put_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            UniversityAdminProfile.objects.get(user=self.university_admin).department,
            "Registrar",
        )


class PublicCompanyVerificationTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _company(self, email):
        return User.objects.create_user(
            email=email,
            password="VerifyCompanyStrong!2026",
            name=email.split("@")[0],
            role=UserRole.COMPANY,
        )

    def test_verification_status_is_public_for_every_state(self):
        pending = self._company("pending-verify@example.com")
        active = self._company("active-verify@example.com")
        rejected = self._company("rejected-verify@example.com")
        CompanyProfile.objects.filter(user=active).update(
            verification_status=CompanyProfile.VerificationStatus.ACTIVE
        )
        CompanyProfile.objects.filter(user=rejected).update(
            verification_status=CompanyProfile.VerificationStatus.REJECTED
        )

        for company, expected in (
            (pending, "pending"),
            (active, "active"),
            (rejected, "rejected"),
        ):
            with self.subTest(company=company.email):
                response = self.client.get(
                    reverse("public-company-verification", args=[company.id])
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["id"], str(company.id))
                self.assertEqual(response.data["verification_status"], expected)

    def test_verification_status_for_unknown_company_is_not_found(self):
        response = self.client.get(
            reverse(
                "public-company-verification",
                args=["00000000-0000-4000-8000-000000000000"],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_active_company_profile_includes_verification_status(self):
        company = self._company("public-profile@example.com")
        CompanyProfile.objects.filter(user=company).update(
            verification_status=CompanyProfile.VerificationStatus.ACTIVE,
            legal_name="Public Profile LLC",
        )
        User.objects.filter(pk=company.pk).update(is_active=True)

        response = self.client.get(
            reverse("public-company-profile", args=[company.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["verification_status"], "active")
