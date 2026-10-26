from django import forms
from django.contrib import admin
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from api.models import User, UserRole


class UserAdminCreationForm(forms.ModelForm):
    role = forms.ChoiceField(
        choices=tuple(
            choice
            for choice in UserRole.choices
            if choice[0] != UserRole.PLATFORM_ADMINISTRATOR
        )
    )
    password = forms.CharField(
        label="Password",
        max_length=128,
        strip=False,
        widget=forms.PasswordInput,
    )

    class Meta:
        model = User
        fields = ("email", "name", "role")

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError(
                "An account with this email address already exists."
            )
        return email

    def clean_password(self):
        password = self.cleaned_data["password"]
        candidate = User(
            email=self.cleaned_data.get("email", ""),
            name=self.cleaned_data.get("name", ""),
        )
        try:
            validate_password(password, user=candidate)
        except DjangoValidationError as exc:
            raise forms.ValidationError(exc.messages) from exc
        return password

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.set_password(self.cleaned_data["password"])
        if user.role == UserRole.COMPANY:
            user.is_active = False
        if commit:
            user.save()
            self.save_m2m()
        return user


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    add_form = UserAdminCreationForm
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "name", "role", "password")}),
    )
    list_display = ("email", "name", "role", "is_active", "is_staff", "date_joined")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "name")
    ordering = ("email",)
    readonly_fields = ("id", "last_login", "date_joined")
    fieldsets = (
        (None, {"fields": ("id", "email", "name", "role")}),
        ("Access", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
        ("Permissions", {"fields": ("groups", "user_permissions"), "classes": ("collapse",)}),
    )

    def get_fieldsets(self, request, obj=None):
        if obj is None:
            return self.add_fieldsets
        return super().get_fieldsets(request, obj)
