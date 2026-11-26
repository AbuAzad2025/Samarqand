import re
from html import escape
from pathlib import Path
from typing import Any

from django import template
from django.conf import settings
from django.templatetags.static import static
from django.utils.safestring import mark_safe

register = template.Library()


def _load_index_html() -> str:
    base_dir = Path(__file__).resolve().parents[1]
    candidates = [
        base_dir / "static" / "website" / "samarqand_spa" / "index.html",
    ]
    static_root = getattr(settings, "STATIC_ROOT", None)
    if static_root:
        candidates.append(
            Path(static_root) / "website" / "samarqand_spa" / "index.html"
        )

    for index_path in candidates:
        if index_path.exists():
            return index_path.read_text(encoding="utf-8")
    return ""


def _rewrite_root_paths(html: str) -> str:
    if not html:
        return ""
    base = static("website/samarqand_spa")

    def repl(match: re.Match[str]) -> str:
        quote = match.group(1)
        path = match.group(2)
        if path.startswith("//") or "://" in path:
            return match.group(0)
        if path.startswith("/static/"):
            static_base = str(
                getattr(settings, "STATIC_URL", "/static/")
            ).rstrip("/")
            return f"{quote}{static_base}/{path[len('/static/'):]}{quote}"
        if path in {"/manifest.webmanifest", "/sw.js"}:
            return f"{quote}{base.rstrip('/')}{path}{quote}"
        if not (path.startswith("/assets/") or path.startswith("/@vite/")):
            return match.group(0)
        if path.startswith("/"):
            path = path[1:]
        return f"{quote}{base.rstrip('/')}/{path}{quote}"

    html = re.sub(r"([\"\'])(\/(?!\/)[^\"\']+)\1", repl, html)
    # Let client code discover the real static prefix for service-worker scope.
    static_prefix = base.rstrip("/") + "/"
    html = html.replace(
        "<head>",
        f'<head>\n    <meta name="sq-static-base" content="{static_prefix}">',
        1,
    )
    return html


def _apply_page_seo(html: str, page: Any) -> str:
    """Use the Wagtail page's SEO fields when the SPA shell is page-served."""
    title = str(
        getattr(page, "seo_title", "") or getattr(page, "title", "") or ""
    )
    description = str(getattr(page, "search_description", "") or "")
    if title:
        html = re.sub(
            r"<title>.*?</title>",
            f"<title>{escape(title)}</title>",
            html,
            count=1,
            flags=re.S | re.I,
        )
    if description:
        safe = escape(description, quote=True)
        html = re.sub(
            r'(<meta name="description" content=")[^"]*(")',
            lambda m: f"{m.group(1)}{safe}{m.group(2)}",
            html,
            flags=re.I,
        )
        html = re.sub(
            r'(<meta property="og:description" content=")[^"]*(")',
            lambda m: f"{m.group(1)}{safe}{m.group(2)}",
            html,
            flags=re.I,
        )
    return html


@register.simple_tag(takes_context=True)
def samarqand_spa_document(context: Any) -> str:
    html = _rewrite_root_paths(_load_index_html())
    if not html:
        return ""
    page = context.get("page") if context else None
    if page:
        html = _apply_page_seo(html, page)
    return mark_safe(html)
