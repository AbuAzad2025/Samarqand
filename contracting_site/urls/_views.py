"""Small view helpers shared by the URL modules."""

from django.http import HttpResponse
from django.shortcuts import redirect
from django.shortcuts import render


def spa_shell(request, *args, **kwargs):
    return render(request, "coderedcms/pages/spa_shell.html")


def cms_redirect(request, *args, **kwargs):
    return redirect("/control/dashboard", permanent=False)


def robots_txt(request, *args, **kwargs):
    sitemap_url = request.build_absolute_uri("/sitemap.xml")
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /control/",
            "Disallow: /api/",
            "Disallow: /cms/",
            f"Sitemap: {sitemap_url}",
            "",
        ]
    )
    return HttpResponse(body, content_type="text/plain; charset=utf-8")


def sitemap_xml(request, *args, **kwargs):
    paths = [
        "/",
        "/about",
        "/projects",
        "/services",
        "/tools",
        "/showcase",
        "/contact",
        "/blog",
        "/events",
        "/locations",
    ]
    urls = "".join(
        f"<url><loc>{request.build_absolute_uri(p)}</loc></url>" for p in paths
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + urls
        + "</urlset>"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")
