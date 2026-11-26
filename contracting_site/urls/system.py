"""System and CMS-facing URLs."""

from django.urls import include
from django.urls import path
from django.urls import re_path
from django.contrib import admin
from django.http import HttpResponse
from django.shortcuts import redirect
from wagtail.documents import urls as wagtaildocs_urls

from website import api as api_views
from ._views import cms_redirect
from ._views import robots_txt
from ._views import sitemap_xml
from ._views import spa_shell


urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('admin-backup/', api_views.admin_backup_portal),
    re_path('^cms/.*$', cms_redirect),
    path('robots.txt', robots_txt),
    path('sitemap.xml', sitemap_xml),
    re_path('^docs/$', lambda request: HttpResponse('', status=404)),
    path('docs/', include(wagtaildocs_urls)),
    path('search/', spa_shell),
]
