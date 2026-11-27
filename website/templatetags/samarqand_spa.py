import json
import re
from html import escape
from pathlib import Path
from typing import Any

from django import template
from django.conf import settings
from django.templatetags.static import static
from django.utils.safestring import mark_safe
from wagtail.models import Site

from website.models import CompanySettings

register = template.Library()

# The shell owns the only skip link. Its target lives outside #root so it
# survives React mounting (React keeps its own, sometimes duplicated,
# "main-content" ids inside #root).
_SKIP_TARGET_ID = "sq-main-content"

# Hardcoded values in the built index.html are replaced at serve time; only
# metadata backed by the page / company settings is emitted.
_STALE_META_KEYS = (
    "description",
    "og:title",
    "og:description",
    "og:image",
    "og:image:alt",
    "og:type",
    "og:url",
    "og:locale",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:url",
)

# Safe resource hints. The SPA build ships a hardcoded Cairo <link rel=preload>
# in index.html; it is replaced below by one canonical hint derived from a real
# static asset, so a stale build artifact can never duplicate the hint or point
# at a font file that does not exist.
_CAIRO_FONT_STATIC_PATH = "website/fonts/Cairo.ttf"
_CAIRO_FONT_FILENAME = "Cairo.ttf"


def _text(value: Any) -> str:
    """Return a trimmed string for model / settings values."""
    if value is None:
        return ""
    return str(value).strip()


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


def _normalize_document(html: str) -> str:
    """Normalize static HTML accessibility and own the single skip link."""
    html = re.sub(
        r"<html\b[^>]*>",
        '<html lang="ar" dir="rtl">',
        html,
        count=1,
        flags=re.I,
    )

    # React still ships its own skip links in the compiled bundle. Hide those
    # so the shell link is the only one exposed to assistive technology; the
    # frontend source cleanup itself is outside this file's scope.
    style = (
        '<style id="sq-a11y">'
        ".sq-skip-link{position:absolute;width:1px;height:1px;padding:0;margin:-1px;"
        "overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}"
        ".sq-skip-link:focus{position:fixed;top:8px;right:8px;width:auto;height:auto;"
        "margin:0;overflow:visible;clip:auto;white-space:normal;padding:8px 14px;"
        "border-radius:8px;background:#007A3D;color:#fff;z-index:100;font-weight:700}"
        "#" + _SKIP_TARGET_ID + ":focus{outline:none}"
        'a.sr-only[href="#main-content"],a.sr-only[href="#control-main"]'
        "{display:none!important}"
        "</style>"
    )
    html = html.replace("<head>", "<head>\n    " + style, 1)

    skip_link = (
        '<a class="sq-skip-link" href="#'
        + _SKIP_TARGET_ID
        + '">تخطَّ إلى المحتوى الرئيسي</a>'
    )
    root_pattern = re.compile(
        r'(<div\b[^>]*\bid=(["\'])root\2[^>]*>)\s*(</div>)',
        re.I,
    )

    def wrap(match: re.Match[str]) -> str:
        return (
            skip_link
            + '\n  <div id="'
            + _SKIP_TARGET_ID
            + '" tabindex="-1">'
            + match.group(1)
            + match.group(3)
            + "</div>"
        )

    html, replaced = root_pattern.subn(wrap, html, count=1)
    if not replaced:
        html = html.replace(
            "<body>",
            "<body>\n  "
            + skip_link
            + '\n  <div id="'
            + _SKIP_TARGET_ID
            + '" tabindex="-1"></div>',
            1,
        )
    return html


def _company_for_request(request: Any) -> Any | None:
    if not request:
        return None
    try:
        site = Site.find_for_request(request)
        if site:
            return CompanySettings.for_site(site)
    except Exception:
        pass
    return None


def _absolute_url(request: Any, value: Any) -> str:
    url = _text(value)
    if not url:
        return ""
    if request:
        try:
            return request.build_absolute_uri(url)
        except Exception:
            pass
    return url


def _canonical_url(request: Any) -> str:
    """Canonicalize to the path only, dropping query/tracking parameters."""
    if not request:
        return ""
    try:
        return escape(request.build_absolute_uri(request.path), quote=True)
    except Exception:
        return ""


def _strip_stale_metadata(html: str) -> str:
    for key in _STALE_META_KEYS:
        html = re.sub(
            r'<meta\b[^>]*\b(?:name|property)\s*=\s*(["\'])'
            + re.escape(key)
            + r"\1[^>]*>",
            "",
            html,
            flags=re.I,
        )
    html = re.sub(
        r'<link\b[^>]*\brel\s*=\s*(["\'])canonical\1[^>]*>',
        "",
        html,
        flags=re.I,
    )
    return html


def _set_title(html: str, title: str) -> str:
    if not title:
        return html
    return re.sub(
        r"<title\b[^>]*>.*?</title>",
        "<title>" + escape(title) + "</title>",
        html,
        count=1,
        flags=re.S | re.I,
    )


def _ga4_snippets() -> list[str]:
    ga_id = _text(getattr(settings, "GA_MEASUREMENT_ID", ""))
    # Accept only a real GA4 measurement id; no placeholder / Universal
    # Analytics ids are ever emitted.
    if not re.fullmatch(r"G-[A-Z0-9]{9,10}", ga_id):
        return []
    if ga_id.upper() in {"G-XXXXXXXXXX", "G-XXXXXXXXX"}:
        return []
    safe_id = escape(ga_id, quote=True)
    return [
        f'<script async src="https://www.googletagmanager.com/gtag/js?id={safe_id}"></script>',
        "<script>window.dataLayer=window.dataLayer||[];"
        "function gtag(){dataLayer.push(arguments);}"
        "gtag('js',new Date());gtag('config',"
        + json.dumps(ga_id)
        + ");</script>",
    ]


def _json_ld(data: dict[str, Any]) -> str:
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return '<script type="application/ld+json">' + payload + "</script>"


def _cairo_font_available() -> bool:
    """Only emit a font hint when the shipped asset actually exists."""
    base_dir = Path(__file__).resolve().parents[1]
    if (
        base_dir / "static" / "website" / "fonts" / _CAIRO_FONT_FILENAME
    ).exists():
        return True
    static_root = getattr(settings, "STATIC_ROOT", None)
    if static_root:
        return (
            Path(static_root) / "website" / "fonts" / _CAIRO_FONT_FILENAME
        ).exists()
    return False


def _strip_duplicate_font_preloads(html: str) -> str:
    """Drop built-in font preloads so exactly one real hint is emitted."""

    def repl(match: re.Match[str]) -> str:
        tag = match.group(0).lower()
        if "cairo" in tag and "font" in tag and "preload" in tag:
            return ""
        return match.group(0)

    return re.sub(r"<link\b[^>]*>", repl, html, flags=re.I)


def _apply_resource_hints(html: str) -> str:
    """Emit safe hints backed by real, shipped assets only.

    No dns-prefetch / preconnect: the shell uses no external origin, and
    speculative hints would only open useless connections. No cover-image
    preload: the cover is not present on the homepage served by this shell,
    and any future image hint must be gated on real page data instead.
    """
    html = _strip_duplicate_font_preloads(html)

    hints: list[str] = []
    if _cairo_font_available():
        font_url = _text(static(_CAIRO_FONT_STATIC_PATH))
        if font_url:
            hints.append(
                '<link rel="preload" href="'
                + escape(font_url, quote=True)
                + '" as="font" type="font/ttf" crossorigin>'
            )

    if hints:
        html = html.replace("<head>", "<head>\n    " + "\n    ".join(hints), 1)
    return html


def _apply_document_metadata(html: str, context: Any) -> str:
    """Emit SEO metadata derived exclusively from page and company data."""
    request = context.get("request") if context else None
    page = context.get("page") if context else None
    company = _company_for_request(request)

    title = (
        _text(getattr(page, "seo_title", ""))
        or _text(getattr(page, "title", ""))
        or _text(getattr(company, "name", ""))
    )
    description = _text(getattr(page, "search_description", "")) or _text(
        getattr(company, "description", "")
    )
    canonical = _canonical_url(request)
    html = _set_title(html, title)

    logo_url = ""
    image = getattr(company, "logo_image", None)
    if image is not None:
        image_file = getattr(image, "file", None)
        if image_file is not None:
            logo_url = _absolute_url(request, getattr(image_file, "url", ""))
    if not logo_url.startswith(("http://", "https://")):
        logo_url = ""

    parts: list[str] = []
    if canonical:
        parts.append(f'<link rel="canonical" href="{canonical}">')
    if title:
        parts.append(
            f'<meta property="og:title" content="{escape(title, quote=True)}">'
        )
    if description:
        safe_description = escape(description, quote=True)
        parts.append(f'<meta name="description" content="{safe_description}">')
        parts.append(
            f'<meta property="og:description" content="{safe_description}">'
        )
    parts.append('<meta property="og:type" content="website">')
    parts.append('<meta property="og:locale" content="ar">')
    if canonical:
        parts.append(f'<meta property="og:url" content="{canonical}">')
    if logo_url:
        safe_logo = escape(logo_url, quote=True)
        parts.append(f'<meta property="og:image" content="{safe_logo}">')
        company_name = _text(getattr(company, "name", ""))
        if company_name:
            parts.append(
                '<meta property="og:image:alt" content="'
                + escape(company_name, quote=True)
                + '">'
            )

    parts.append(
        '<meta name="twitter:card" content="'
        + ("summary_large_image" if logo_url else "summary")
        + '">'
    )
    if title:
        parts.append(
            f'<meta name="twitter:title" content="{escape(title, quote=True)}">'
        )
    if description:
        parts.append(
            '<meta name="twitter:description" content="'
            + escape(description, quote=True)
            + '">'
        )
    if logo_url:
        parts.append(
            f'<meta name="twitter:image" content="{escape(logo_url, quote=True)}">'
        )
    if canonical:
        parts.append(f'<meta name="twitter:url" content="{canonical}">')

    parts.extend(_ga4_snippets())

    # Structured data: only fields that actually exist in company settings.
    structured: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "GeneralContractor",
    }
    name = _text(getattr(company, "name", ""))
    company_description = _text(getattr(company, "description", ""))
    if name:
        structured["name"] = name
    # Organization JSON-LD describes the company, not the current page.
    if company_description:
        structured["description"] = company_description
    if canonical:
        structured["url"] = canonical
    if logo_url:
        structured["logo"] = logo_url

    phone = _text(getattr(company, "phone_1", "")) or _text(
        getattr(company, "phone_2", "")
    )
    if phone:
        structured["telephone"] = phone
    email = _text(getattr(company, "email", ""))
    if email:
        structured["email"] = email
    address = _text(getattr(company, "address", ""))
    if address:
        structured["address"] = {
            "@type": "PostalAddress",
            "streetAddress": address,
        }
    social: list[str] = []
    for field in ("facebook_url", "instagram_url", "linkedin_url"):
        url = _text(getattr(company, field, ""))
        if url.startswith(("https://", "http://")):
            social.append(url)
    if social:
        structured["sameAs"] = social

    # A type-only payload would assert business facts that are not in the
    # settings; require at least a real company name or description.
    if name or company_description:
        parts.append(_json_ld(structured))

    if parts:
        html = html.replace("</head>", "\n".join(parts) + "\n  </head>", 1)
    return html


@register.simple_tag(takes_context=True)
def samarqand_spa_document(context: Any) -> str:
    html = _rewrite_root_paths(_load_index_html())
    if not html:
        return ""
    html = _normalize_document(html)
    html = _strip_stale_metadata(html)
    html = _apply_document_metadata(html, context)
    html = _apply_resource_hints(html)
    return mark_safe(html)
