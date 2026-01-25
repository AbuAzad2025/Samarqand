import os


bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
workers = int(os.environ.get("GUNICORN_WORKERS", "2") or "2")
threads = int(os.environ.get("GUNICORN_THREADS", "2") or "2")
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60") or "60")
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", "30") or "30")

accesslog = os.environ.get("GUNICORN_ACCESSLOG", "-")
errorlog = os.environ.get("GUNICORN_ERRORLOG", "-")
loglevel = os.environ.get("GUNICORN_LOGLEVEL", "info")
