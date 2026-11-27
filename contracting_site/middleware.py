from __future__ import annotations

from urllib.parse import urlsplit

from django.conf import settings
from django.http import HttpRequest
from django.http import HttpResponse
from django.http import HttpResponseNotFound

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_ORIGIN_FAILURE_MESSAGE = "فشل التحقق الأمني. حدّث الصفحة ثم أعد المحاولة."


def _trusted_peer(request: HttpRequest) -> bool:
    """Only an explicitly configured proxy may supply forwarding headers."""
    remote = str(request.META.get("REMOTE_ADDR") or "").strip()
    trusted = set(getattr(settings, "TRUSTED_PROXY_IPS", None) or [])
    return bool(remote and remote in trusted)


def _effective_scheme(request: HttpRequest) -> str:
    """Scheme from the real transport, or from a declared trusted proxy."""
    raw = str(request.META.get("wsgi.url_scheme") or "http").strip().lower()
    if raw not in {"http", "https"}:
        raw = "http"
    if not _trusted_peer(request):
        # A direct client can send X-Forwarded-Proto, but it must not be able
        # to influence any security decision made here.
        return raw
    header_pair = getattr(settings, "SECURE_PROXY_SSL_HEADER", None)
    if (
        not isinstance(header_pair, (tuple, list))
        or len(header_pair) != 2
        or str(header_pair[0]).lower() != "http_x_forwarded_proto"
    ):
        return raw
    forwarded = (
        str(request.META.get("HTTP_X_FORWARDED_PROTO") or "")
        .split(",")[0]
        .strip()
        .lower()
    )
    return forwarded if forwarded in {"http", "https"} else raw


def _allowed_origins(request: HttpRequest) -> set[str]:
    origins: set[str] = set()
    scheme = _effective_scheme(request)
    try:
        host = request.get_host()
    except Exception:
        # DisallowedHost / malformed Host: never trust a header we cannot
        # validate against ALLOWED_HOSTS.
        host = ""
    if host:
        origins.add(f"{scheme}://{host}".lower())
    for value in getattr(settings, "CSRF_TRUSTED_ORIGINS", None) or []:
        try:
            parsed = urlsplit(str(value))
        except ValueError:
            continue
        if parsed.scheme and parsed.netloc:
            origins.add(f"{parsed.scheme.lower()}://{parsed.netloc.lower()}")
    for value in getattr(settings, "ALLOWED_HOSTS", None) or []:
        host_value = str(value).strip()
        if host_value and "*" not in host_value:
            origins.add(f"{scheme}://{host_value}".lower())
    return origins


def _origin_allowed(request: HttpRequest) -> bool:
    """Check a supplied Origin (or Referer) against configured origins."""
    origin = str(request.META.get("HTTP_ORIGIN") or "").strip()
    referer = str(request.META.get("HTTP_REFERER") or "").strip()
    value = origin or referer
    if not value:
        # Missing headers are handled by Django's CSRF middleware, which
        # still requires a valid token for these state-changing endpoints.
        return True
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    scheme = parsed.scheme.lower()
    host = parsed.netloc.lower()
    if not scheme or not host:
        # Includes Origin: "null" and relative/malformed Referer values.
        return False
    return f"{scheme}://{host}" in _allowed_origins(request)


def _origin_rejection(request: HttpRequest) -> HttpResponse:
    if str(request.path_info or "").startswith("/api/"):
        # Import lazily: this middleware is loaded during Django setup.
        from website.api.common import _api_error

        return _api_error(
            "csrf_failed", status=403, message=_ORIGIN_FAILURE_MESSAGE
        )
    return HttpResponse(
        "Forbidden", status=403, content_type="text/plain; charset=utf-8"
    )


class BlockStaticDirectoryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        static_url = getattr(settings, "STATIC_URL", "/static/") or "/static/"
        path = getattr(request, "path_info", "") or ""
        if static_url and path.startswith(static_url) and path.endswith("/"):
            return HttpResponseNotFound()
        if (
            path.startswith("/api/auth/")
            and str(getattr(request, "method", "") or "").upper()
            in _UNSAFE_METHODS
            and not _origin_allowed(request)
        ):
            return _origin_rejection(request)
        return self.get_response(request)


class AdminApiRateLimitMiddleware:
    """Apply the shared API limiter to admin endpoints without their own limit."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path_info.startswith("/api/admin/"):
            return self.get_response(request)
        method = str(getattr(request, "method", "") or "").upper()
        if method in _UNSAFE_METHODS and not _origin_allowed(request):
            return _origin_rejection(request)

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
