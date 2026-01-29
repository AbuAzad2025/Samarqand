import re
from pathlib import Path

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
        candidates.append(Path(static_root) / "website" / "samarqand_spa" / "index.html")

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
        if not (path.startswith("/assets/") or path.startswith("/@vite/")):
            return match.group(0)
        if path.startswith("/"):
            path = path[1:]
        return f"{quote}{base.rstrip('/')}/{path}{quote}"

    html = re.sub(r'([\"\'])(\/(?!\/)[^\"\']+)\1', repl, html)
    return html


@register.simple_tag
def samarqand_spa_document() -> str:
    html = _rewrite_root_paths(_load_index_html())
    if not html:
        return ""
    return mark_safe(html)
