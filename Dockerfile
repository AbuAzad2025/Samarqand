FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=contracting_site.settings.prod

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "-c", "contracting_site/gunicorn.conf.py", "contracting_site.wsgi:application"]
