from __future__ import annotations

from django.conf import settings
from django.http import HttpResponseNotFound


class BlockStaticDirectoryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        static_url = getattr(settings, "STATIC_URL", "/static/") or "/static/"
        path = getattr(request, "path_info", "") or ""
        if static_url and path.startswith(static_url) and path.endswith("/"):
            return HttpResponseNotFound()
        return self.get_response(request)
