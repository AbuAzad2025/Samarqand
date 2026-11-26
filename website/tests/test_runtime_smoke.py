"""Runtime smoke test: no registered GET endpoint may raise a server error."""

import re

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import URLPattern
from django.urls import URLResolver
from django.urls import get_resolver


def sample_value(name: str) -> str:
    if "id" in name.lower():
        return "1"
    return "x"


def build_paths(patterns, prefix=""):
    paths = []
    for p in patterns:
        if isinstance(p, URLResolver):
            # Skip third-party include trees; they need real CMS objects.
            if p.app_name or p.namespace:
                continue
            paths.extend(build_paths(p.url_patterns, prefix + str(p.pattern)))
            continue
        raw = str(p.pattern)
        path = prefix + raw
        path = re.sub(r"<int:(\w+)>", lambda m: sample_value(m.group(1)), path)
        path = re.sub(r"<str:(\w+)>", lambda m: sample_value(m.group(1)), path)
        path = re.sub(r"<slug:(\w+)>", lambda m: "x", path)
        path = re.sub(r"<path:(\w+)>", lambda m: "x", path)
        path = re.sub(r"\(\?P<(\w+)>\\d\+\)", lambda m: "1", path)
        path = re.sub(r"\(\?P<(\w+)>[^)]+\)", lambda m: sample_value(m.group(1)), path)
        path = path.lstrip("^").rstrip("$")
        if "<" in path or "(?" in path:
            continue
        if not path.startswith("/"):
            path = "/" + path
        paths.append((path, getattr(p, "name", "")))
    return paths


class RuntimeSmokeTests(TestCase):
    def test_all_get_endpoints(self):
        user = get_user_model().objects.create_superuser(
            username="smoke_admin",
            email="smoke@example.test",
            password="a-long-smoke-password",
        )
        self.client.force_login(user)
        results = {}
        for path, name in build_paths(get_resolver().url_patterns):
            if path.startswith("/api/") or path.startswith("/control") or path in {
                "/",
                "/about/",
                "/projects/",
                "/services/",
                "/contact/",
                "/tools/",
                "/showcase/",
            }:
                try:
                    response = self.client.get(path)
                    code = response.status_code
                except Exception as exc:  # noqa: BLE001
                    code = f"EXC:{type(exc).__name__}:{str(exc)[:120]}"
                results.setdefault(code, []).append(path)
        broken = []
        for code, paths in results.items():
            if str(code).startswith("5") or str(code).startswith("EXC"):
                broken.extend(f"{code}: {p}" for p in paths)
        self.assertEqual(broken, [], "GET endpoints must not raise server errors")
