"""Small view helpers shared by the URL modules."""

from xml.sax.saxutils import escape

from django.db import connection
from django.http import Http404
from django.http import HttpResponse
from django.http import JsonResponse
from django.shortcuts import redirect
from django.shortcuts import render
from django.views.decorators.http import require_GET
from wagtail.models import Site


@require_GET
def spa_shell(request, *args, **kwargs):
    return render(request, "coderedcms/pages/spa_shell.html")


@require_GET
def cms_redirect(request, *args, **kwargs):
    return redirect("/control/dashboard", permanent=False)


def django_admin_not_found(request, *args, **kwargs):
    """The default Django admin is never exposed; keep it a real 404."""
    raise Http404


def docs_disabled(request, *args, **kwargs):
    return HttpResponse("", status=404)


@require_GET
def robots_txt(request, *args, **kwargs):
    sitemap_url = request.build_absolute_uri("/sitemap.xml")
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /control/",
            "Disallow: /api/",
            "Disallow: /cms/",
            "Disallow: /admin-backup/",
            f"Sitemap: {sitemap_url}",
            "",
        ]
    )
    return HttpResponse(body, content_type="text/plain; charset=utf-8")


@require_GET
def sitemap_xml(request, *args, **kwargs):
    # Only advertise canonical, published Wagtail URLs. Static/SPA-only paths
    # (showcase, blog, events, locations, ...) are not pages and must not be
    # listed here.
    paths = ["/"]
    try:
        site = Site.find_for_request(request)
        root = site.root_page if site else None
        if root is not None:
            for page in root.get_descendants().live().public():
                url = page.get_url(request=request)
                if not url or not url.startswith("/") or url.startswith("//"):
                    continue
                if url.startswith(
                    ("/api/", "/control/", "/cms/", "/admin-backup/")
                ):
                    continue
                if url not in paths:
                    paths.append(url)
    except Exception:
        # A broken/unavailable page tree must not produce fake sitemap links.
        paths = ["/"]

    urls = "".join(
        "<url><loc>{}</loc></url>".format(
            escape(
                request.build_absolute_uri(path), {'"': "&quot;", "'": "&apos;"}
            )
        )
        for path in paths
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + urls
        + "</urlset>"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")


@require_GET
def health(request, *args, **kwargs):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse(
            {"status": "error", "database": "error"}, status=503
        )
    return JsonResponse({"status": "ok", "database": "ok"})
