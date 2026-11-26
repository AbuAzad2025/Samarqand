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


class AdminApiRateLimitMiddleware:
    """Apply the shared API limiter to admin endpoints without their own limit."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path_info.startswith("/api/admin/"):
            return self.get_response(request)

        from website.api.common import _check_rate_limit

        limited = _check_rate_limit(
            request,
            scope="admin_api",
            limit=int(getattr(settings, "ADMIN_API_RATE_LIMIT", 600)),
            window_seconds=60,
        )
        if limited:
            return limited
        return self.get_response(request)
