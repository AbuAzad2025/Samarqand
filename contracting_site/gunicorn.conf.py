"""Gunicorn configuration for the Samarqand application.

Production (systemd + nginx) binds this app's private Unix socket only, so it
never competes for a TCP port with the other applications on the server.
Docker overrides GUNICORN_BIND explicitly (see docker-compose.yml).
"""

import os


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "") or default)
    except ValueError:
        return default


# Keep the socket inside this app's shared/run directory (nginx needs access
# to that directory). An explicitly supplied GUNICORN_BIND always wins.
_socket = os.environ.get("GUNICORN_SOCKET", "").strip() or (
    "/srv/apps/samarqand/shared/run/samarqand.sock"
)
bind = os.environ.get("GUNICORN_BIND", "").strip() or f"unix:{_socket}"

workers = _int_env("GUNICORN_WORKERS", 3)
threads = _int_env("GUNICORN_THREADS", 2)
timeout = _int_env("GUNICORN_TIMEOUT", 120)
graceful_timeout = _int_env("GUNICORN_GRACEFUL_TIMEOUT", 30)
keepalive = _int_env("GUNICORN_KEEPALIVE", 5)

# "-" logs to stdout/stderr, which the systemd unit captures in shared/logs.
accesslog = os.environ.get("GUNICORN_ACCESSLOG", "-") or "-"
errorlog = os.environ.get("GUNICORN_ERRORLOG", "-") or "-"
loglevel = os.environ.get("GUNICORN_LOGLEVEL", "info") or "info"
