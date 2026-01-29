"""
WSGI config for contracting_site project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
from typing import Any

from django.core.wsgi import get_wsgi_application


os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "contracting_site.settings.dev",
)

application = get_wsgi_application()


def _auto_migrate_if_enabled() -> None:
    auto = os.environ.get("AUTO_MIGRATE")
    if auto is not None and auto.strip().lower() not in {"1", "true", "yes", "on"}:
        return
    if auto is None:
        settings_module = os.environ.get("DJANGO_SETTINGS_MODULE", "")
        if not settings_module.endswith(".prod"):
            return

    _fcntl: Any
    try:
        import fcntl as _fcntl  # type: ignore[import-not-found]
    except Exception:
        _fcntl = None

    fcntl_any: Any = _fcntl

    lock_path = os.environ.get("AUTO_MIGRATE_LOCK_PATH") or "/tmp/django_migrate.lock"
    try:
        fh = open(lock_path, "w", encoding="utf-8")
    except Exception:
        fh = None

    try:
        if fh and fcntl_any:
            fcntl_any.flock(fh.fileno(), fcntl_any.LOCK_EX)
        from django.core.management import call_command

        call_command("migrate", interactive=False, verbosity=1)
    finally:
        try:
            if fh:
                fh.close()
        except Exception:
            pass


_auto_migrate_if_enabled()
