"""Django settings for the STAGELINK applications service."""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default=env("SECRET_KEY", default="django-insecure-applications-development-key"),
)
DEBUG = env.bool("DJANGO_DEBUG", default=env.bool("DEBUG", default=False))
ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]),
)
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "applications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASE_URL = env("DATABASE_URL", default="")

if DATABASE_URL:
    DATABASES = {"default": env.db("DATABASE_URL")}
else:
    DB_ENGINE = env("DB_ENGINE", default="django.db.backends.sqlite3")
    if DB_ENGINE.endswith("sqlite3"):
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": env("DB_NAME", default=str(BASE_DIR / "db.sqlite3")),
            }
        }
    else:
        DATABASES = {
            "default": {
                "ENGINE": DB_ENGINE,
                "NAME": env("DB_NAME", default="applications"),
                "USER": env("DB_USER", default="stagelink"),
                "PASSWORD": env("DB_PASSWORD", default="stagelink"),
                "HOST": env("DB_HOST", default="localhost"),
                "PORT": env("DB_PORT", default="5432"),
                "CONN_MAX_AGE": env.int("DATABASE_CONN_MAX_AGE", default=60),
            }
        }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"
    },
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "applications.authentication.IdentityJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "EXCEPTION_HANDLER": "applications.errors.api_exception_handler",
}

# JWT issued by the Identity & Profiles service. The signing key must match theirs.
# The algorithm is fixed in code on purpose, not read from the environment, so it
# cannot be weakened by configuration.
JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", default=SECRET_KEY)
JWT_ALGORITHM = "HS256"

# Microservice integration.
INTERNSHIP_SERVICE_URL = env(
    "INTERNSHIP_SERVICE_URL",
    default="http://localhost:8004/api/internal/internships/",
)
INTERNSHIP_TIMEOUT_SECONDS = env.float("INTERNSHIP_TIMEOUT_SECONDS", default=5.0)
INTERNSHIP_CREATION_ATTEMPTS = env.int("INTERNSHIP_CREATION_ATTEMPTS", default=3)
OFFERS_SERVICE_URL = env(
    "OFFERS_SERVICE_URL",
    default="http://localhost:8002/api/internal/offers/",
)
OFFERS_TIMEOUT_SECONDS = env.float("OFFERS_TIMEOUT_SECONDS", default=5.0)
INTERNAL_SERVICE_TOKEN = env("INTERNAL_SERVICE_TOKEN", default="")

# Identity role directory, used to resolve university-administrator recipients.
# The lookup is best effort and runs after commit, never inside the business
# transaction. Results are cached briefly.
IDENTITY_BASE_URL = env("IDENTITY_BASE_URL", default="http://localhost:8001")
IDENTITY_TIMEOUT_SECONDS = env.float("IDENTITY_TIMEOUT_SECONDS", default=2.0)
IDENTITY_DIRECTORY_CACHE_SECONDS = env.int(
    "IDENTITY_DIRECTORY_CACHE_SECONDS", default=60
)
IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS = env.int(
    "IDENTITY_DIRECTORY_ERROR_CACHE_SECONDS", default=10
)

# Notifications (best effort, after commit). See ADR-009.
NOTIFICATIONS_ENABLED = env.bool("NOTIFICATIONS_ENABLED", default=True)
NOTIFICATIONS_BASE_URL = env(
    "NOTIFICATIONS_BASE_URL",
    default="http://localhost:8005",
)
NOTIFICATIONS_TIMEOUT_SECONDS = env.float("NOTIFICATIONS_TIMEOUT_SECONDS", default=5.0)
NOTIFICATIONS_MAX_ATTEMPTS = env.int("NOTIFICATIONS_MAX_ATTEMPTS", default=3)

# Fallback university administrators who receive validation notifications when
# the Identity directory is unavailable, as a list of UUIDs. The directory is
# the primary source; the application's recorded university_user_id is always
# included.
UNIVERSITY_ADMIN_USER_IDS = env.list("UNIVERSITY_ADMIN_USER_IDS", default=[])

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# WhiteNoise serves the admin and DRF static assets from STATIC_ROOT when the
# services run under gunicorn (runserver handles them itself in DEBUG).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Browser clients call the APIs from a different origin. Only explicitly
# allowed origins are accepted; authentication uses the Bearer header, not
# cookies, so credentials are not shared.
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = False

SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=not DEBUG)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

if env.bool("SECURE_PROXY_SSL_HEADER", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
