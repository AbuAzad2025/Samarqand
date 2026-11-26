"""URL routes: auth."""

from django.urls import path

from website import api as api_views

urlpatterns = [
    path("api/auth/access", api_views.auth_access),
    path("api/auth/login", api_views.auth_login),
    path("api/auth/me", api_views.auth_me),
    path("api/auth/logout", api_views.auth_logout),
    path("api/auth/change-password", api_views.auth_change_password),
]
