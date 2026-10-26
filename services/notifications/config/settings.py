"""Django settings for the STAGELINK Notifications & Communication service.

All environment-specific values and secrets are read from environment
variables (or a local .env file that is never committed).
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default=env(
        "SECRET_KEY",
        default="django-insecure-notifications-development-key",
    ),
)
DEBUG = env.bool("DJANGO_DEBUG", default=env.bool("DEBUG", default=False))
ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]),
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
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

# Own PostgreSQL database for this service (no cross-service joins or FKs).
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
            "NAME": env("DB_NAME", default="notifications"),
            "USER": env("DB_USER", default="stagelink"),
            "PASSWORD": env("DB_PASSWORD", default="stagelink"),
            "HOST": env("DB_HOST", default="localhost"),
            "PORT": env("DB_PORT", default="5432"),
            "CONN_MAX_AGE": env.int("DATABASE_CONN_MAX_AGE", default=60),
        }
    }

AUTH_PASSWORD_VALIDATORS = []  # No local user accounts: Identity & Profiles owns users.

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DEV ONLY: trust the X-User-Id header when no Bearer token is sent.
# Defaults to DEBUG, so it is off whenever DEBUG is off.
DEV_AUTH_ENABLED = env.bool("DEV_AUTH_ENABLED", default=DEBUG)

# JWT validation (tokens are issued by Identity & Profiles; agree on these values with them).
# HS256: JWT_SIGNING_KEY is the shared secret. RS256: it is the PUBLIC key in PEM format
# (write newlines as \n inside .env). Empty key means every Bearer token is rejected.
JWT_ALGORITHM = env("JWT_ALGORITHM", default="HS256")
JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", default="").replace("\\n", "\n")
JWT_USER_ID_CLAIM = env("JWT_USER_ID_CLAIM", default="user_id")
JWT_ROLE_CLAIM = env("JWT_ROLE_CLAIM", default="role")

# Shared secret that trusted services send in the X-Service-Token header.
# Empty means the internal endpoint rejects every request (fail closed).
INTERNAL_SERVICE_TOKEN = env("INTERNAL_SERVICE_TOKEN", default="")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "api.authentication.JWTAuthentication",
        "api.authentication.DevHeaderAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# OpenAPI documentation served at /api/schema/ and /api/docs/.
SPECTACULAR_SETTINGS = {
    "TITLE": "STAGELINK Notifications & Communication API",
    "DESCRIPTION": (
        "In-app notifications: users read their own notifications; trusted services "
        "create them with the X-Service-Token header."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "serviceToken": {
                "type": "apiKey",
                "in": "header",
                "name": "X-Service-Token",
                "description": "Shared secret known only by trusted services.",
            }
        }
    },
}
