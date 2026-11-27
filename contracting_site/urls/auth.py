"""URL routes: auth."""

from django.urls import path
from django.views.decorators.http import require_GET

from website import api as api_views

# Read-only auth endpoints; the write endpoints already use require_POST.
auth_access = require_GET(api_views.auth_access)
auth_me = require_GET(api_views.auth_me)

urlpatterns = [
    path("api/auth/access", auth_access, name="api_auth_access"),
    path("api/auth/login", api_views.auth_login, name="api_auth_login"),
    path("api/auth/me", auth_me, name="api_auth_me"),
    path("api/auth/logout", api_views.auth_logout, name="api_auth_logout"),
    path(
        "api/auth/change-password",
        api_views.auth_change_password,
        name="api_auth_change_password",
    ),
    path(
        "api/auth/2fa/status",
        api_views.auth_2fa_status,
        name="api_auth_2fa_status",
    ),
    path(
        "api/auth/2fa/setup",
        api_views.auth_2fa_setup,
        name="api_auth_2fa_setup",
    ),
    path(
        "api/auth/2fa/confirm",
        api_views.auth_2fa_confirm,
        name="api_auth_2fa_confirm",
    ),
    path(
        "api/auth/2fa/disable",
        api_views.auth_2fa_disable,
        name="api_auth_2fa_disable",
    ),
]
