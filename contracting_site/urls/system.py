"""System and CMS-facing URLs (public, read-only routes)."""

from django.urls import include
from django.urls import path
from django.urls import re_path
from wagtail.documents import urls as wagtaildocs_urls

from website import api as api_views

from ._views import cms_redirect
from ._views import django_admin_not_found
from ._views import docs_disabled
from ._views import health
from ._views import robots_txt
from ._views import sitemap_xml
from ._views import spa_shell

urlpatterns = [
    path("health", health, name="health"),
    # Explicitly deny the stock Django admin before any page/catch-all route.
    re_path(
        r"^django-admin(?:/.*)?$",
        django_admin_not_found,
        name="django_admin_not_found",
    ),
    re_path(r"^cms/.*$", cms_redirect, name="cms_redirect"),
    path("robots.txt", robots_txt, name="robots_txt"),
    path("sitemap.xml", sitemap_xml, name="sitemap_xml"),
    re_path(r"^docs/$", docs_disabled, name="docs_disabled"),
    path("docs/", include(wagtaildocs_urls)),
    path("search/", spa_shell, name="crx_search"),
    path(
        "admin-backup/",
        api_views.admin_backup_portal,
        name="admin_backup_portal",
    ),
]
