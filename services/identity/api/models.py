import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import check_password as verify_password
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    COMPANY = "company", "Company"
    SUPERVISOR = "supervisor", "Supervisor"
    UNIVERSITY_ADMIN = "university_admin", "University administration"
    PLATFORM_ADMIN = "platform_admin", "Platform administrator"


PUBLIC_REGISTRATION_ROLES = (UserRole.STUDENT, UserRole.COMPANY)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, name, role, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        if not password:
            raise ValueError("A password is required.")
        if not name or not name.strip():
            raise ValueError("A name is required.")

        email = self.normalize_email(email).strip().lower()
        name = name.strip()
        try:
            role = UserRole(role)
        except ValueError as exc:
            raise ValueError("The supplied role is not supported.") from exc

        if role == UserRole.COMPANY:
            extra_fields["is_active"] = False

        user = self.model(email=email, name=name, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password, name, role, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, name, role, **extra_fields)

    def create_superuser(
        self,
        email,
        password,
        name,
        role=UserRole.PLATFORM_ADMIN,
        **extra_fields,
    ):
        if role != UserRole.PLATFORM_ADMIN:
            raise ValueError("A superuser must have the platform_admin role.")
        for field_name in ("is_staff", "is_superuser", "is_active"):
            extra_fields[field_name] = True
        return self._create_user(email, password, name, role, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=128)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=32, choices=UserRole.choices)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users_user"
        ordering = ("email",)
        constraints = [
            models.UniqueConstraint(Lower("email"), name="users_user_email_ci_unique"),
            models.CheckConstraint(
                condition=models.Q(role__in=[role.value for role in UserRole]),
                name="users_user_role_valid",
            ),
        ]

    @property
    def password(self):
        return self.password_hash

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)
        self._password = raw_password

    def check_password(self, raw_password):
        def _setter(password):
            self.set_password(password)
            self.save(update_fields=["password_hash"])

        return verify_password(raw_password, self.password_hash, _setter)

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class StudentProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="student_profile"
    )
    university = models.CharField(max_length=255, blank=True, default="")
    department = models.CharField(max_length=255, blank=True, default="")
    specialty = models.CharField(max_length=255, blank=True, default="")
    academic_year = models.CharField(max_length=64, blank=True, default="")
    matricule = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        db_table = "users_student_profile"


class CompanyProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="company_profile"
    )
    legal_name = models.CharField(max_length=255, blank=True, default="")
    address = models.TextField(blank=True, default="")
    contact_person = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=64, blank=True, default="")
    website = models.URLField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    verified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="verified_companies",
        blank=True,
        null=True,
    )
    verified_at = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, default="")

    class Meta:
        db_table = "users_company_profile"


class SupervisorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="supervisor_profile"
    )
    department = models.CharField(max_length=255, blank=True, default="")
    grade = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "users_supervisor_profile"
