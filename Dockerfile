# Python 3.12 is the supported runtime (see pyproject.toml / CI target).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=contracting_site.settings.prod
# Containers listen on the published port; bare-metal uses the Unix socket.
ENV GUNICORN_BIND=0.0.0.0:8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build-time only: the real SECRET_KEY is supplied at runtime from the
# untracked .env / environment, never baked into the image.
RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "-c", "contracting_site/gunicorn.conf.py", "contracting_site.wsgi:application"]
