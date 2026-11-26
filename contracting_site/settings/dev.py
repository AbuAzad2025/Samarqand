import secrets

from .base import *  # noqa: F403
from .base import _env

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# SECURITY WARNING: keep the secret key used in production secret!
_secret_key = _env("SECRET_KEY", "")
if not _secret_key:
    _secret_key = secrets.token_urlsafe(64)
SECRET_KEY = _secret_key

ALLOWED_HOSTS = [
    host.strip()
    for host in _env("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in _env(
        "CSRF_TRUSTED_ORIGINS",
        "http://127.0.0.1:8000,http://127.0.0.1:5173,http://localhost:8000,http://localhost:5173",
    ).split(",")
    if origin.strip()
]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

WAGTAIL_CACHE = False

try:
    from .local import *  # noqa
except ImportError:
    pass
