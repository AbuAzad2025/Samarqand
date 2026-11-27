"""Front-end SPA shell routes (must be last)."""

from coderedcms import urls as crx_urls
from django.urls import include
from django.urls import path
from django.urls import re_path

from ._views import spa_shell

urlpatterns = [
    path("admin/", spa_shell, name="spa_admin"),
    re_path(r"^control/.*$", spa_shell, name="spa_control"),
    path("services/", spa_shell, name="spa_services"),
    path("tools/", spa_shell, name="spa_tools"),
    path("showcase/", spa_shell, name="spa_showcase"),
    path("request-quote/", spa_shell, name="spa_request_quote"),
    re_path(r"^blog(/.*)?$", spa_shell, name="spa_blog"),
    re_path(r"^events(/.*)?$", spa_shell, name="spa_events"),
    re_path(r"^locations(/.*)?$", spa_shell, name="spa_locations"),
    path("", include(crx_urls)),
    re_path(
        r"^(?!cms/|api/|docs/|search/|static/|media/|django-admin/).*$",
        spa_shell,
        name="spa_catchall",
    ),
]
