from .base import *  # noqa: F403
from .base import _env
from .base import _env_list


# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = _env("SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is required for production.")

# Add your site's domain name(s) here.
ALLOWED_HOSTS = _env_list("ALLOWED_HOSTS", "localhost")
CSRF_TRUSTED_ORIGINS = _env_list("CSRF_TRUSTED_ORIGINS", "")


def _env_bool(name: str, default: str = "false") -> bool:
    return _env(name, default).lower() in {"1", "true", "yes", "on"}


SECURE_SSL_REDIRECT = _env_bool("SECURE_SSL_REDIRECT", "true")
SESSION_COOKIE_SECURE = _env_bool("SESSION_COOKIE_SECURE", "true")
CSRF_COOKIE_SECURE = _env_bool("CSRF_COOKIE_SECURE", "true")
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = _env_bool("USE_X_FORWARDED_HOST", "true")

SECURE_HSTS_SECONDS = int(_env("SECURE_HSTS_SECONDS", "31536000") or "31536000")
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", "true")
SECURE_HSTS_PRELOAD = _env_bool("SECURE_HSTS_PRELOAD", "true")

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = _env("SECURE_REFERRER_POLICY", "same-origin")

# To send email from the server, we recommend django_sendmail_backend
# Or specify your own email backend such as an SMTP server.
# https://docs.djangoproject.com/en/5.2/ref/settings/#email-backend
# EMAIL_BACKEND = "django_sendmail_backend.backends.EmailBackend"

# Default email address used to send messages from the website.
DEFAULT_FROM_EMAIL = "Contracting Co <info@localhost>"

# A list of people who get error notifications.
ADMINS = [
    ("Administrator", "admin@localhost"),
]

# A list in the same format as ADMINS that specifies who should get broken link
# (404) notifications when BrokenLinkEmailsMiddleware is enabled.
MANAGERS = ADMINS

# Email address used to send error messages to ADMINS.
SERVER_EMAIL = DEFAULT_FROM_EMAIL

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": BASE_DIR / "cache",  # noqa
        "KEY_PREFIX": "coderedcms",
        "TIMEOUT": 14400,  # in seconds
    }
}
