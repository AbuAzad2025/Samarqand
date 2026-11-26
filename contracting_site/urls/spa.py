"""Front-end SPA shell routes (must be last)."""

from coderedcms import urls as crx_urls
from django.urls import include
from django.urls import path
from django.urls import re_path

from ._views import spa_shell

urlpatterns = [
    path("admin/", spa_shell),
    re_path("^control/.*$", spa_shell),
    path("services/", spa_shell),
    path("tools/", spa_shell),
    path("showcase/", spa_shell),
    path("request-quote/", spa_shell),
    re_path("^blog(/.*)?$", spa_shell),
    re_path("^events(/.*)?$", spa_shell),
    re_path("^locations(/.*)?$", spa_shell),
    path("", include(crx_urls)),
    re_path(
        "^(?!django-admin/|cms/|api/|docs/|search/|static/|media/).*$",
        spa_shell,
    ),
]
