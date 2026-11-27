"""Root URL configuration for contracting_site (local-friendly layout)."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import re_path

from . import admin_accounts
from . import admin_boq
from . import admin_content
from . import admin_field_docs
from . import admin_fleet
from . import admin_hr
from . import admin_leads
from . import admin_mail
from . import admin_ops
from . import ai
from . import auth
from . import site
from . import spa
from . import system
from . import vite

urlpatterns = []
urlpatterns += system.urlpatterns
urlpatterns += ai.urlpatterns
urlpatterns += auth.urlpatterns
urlpatterns += admin_content.urlpatterns
urlpatterns += admin_ops.urlpatterns
urlpatterns += admin_accounts.urlpatterns
urlpatterns += admin_boq.urlpatterns
urlpatterns += admin_field_docs.urlpatterns
urlpatterns += admin_hr.urlpatterns
urlpatterns += admin_leads.urlpatterns
urlpatterns += admin_fleet.urlpatterns
urlpatterns += admin_mail.urlpatterns
urlpatterns += site.urlpatterns
urlpatterns += vite.urlpatterns
urlpatterns += spa.urlpatterns

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()  # type: ignore
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)  # type: ignore

if not settings.DEBUG and getattr(settings, "SERVE_MEDIA", False):
    from django.views.static import serve
    from wagtailcache.cache import nocache_page

    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            nocache_page(serve),
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
