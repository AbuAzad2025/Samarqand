# Contracting Co website

Code for site at: http://localhost


## Getting started

Make sure a recent version of Python is installed on your system.
Open this directory in a command prompt, then:

1. Install the software:
   ```
   pip install -r requirements.txt
   ```

1. Configure database (PostgreSQL):
   - Copy `.env.example` to `.env` and update values as needed.
   - Create the database if it does not exist:
     ```
     python manage.py ensure_postgres_db
     ```
   - Apply migrations and seed initial content:
     ```
     python manage.py migrate
     python manage.py seed_samarqand
     ```

1. Configure AI (optional):
   - Set `GEMINI_API_KEY` in `.env`.
   - Manage model/prompts and enable/disable from `/admin/` → Settings → AI settings.

1. Configure email (contact + quote forms):
   - Set SMTP values in `.env` (`EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, ...).
   - Test sending:
     ```
     python manage.py test_email --to you@example.com
     ```

1. Sync Samarqand SPA (frontend) into Django:
   - Frontend source lives inside this repo at `frontend/samarqand`.
   - Build + copy into static:
     ```
     python manage.py sync_samarqand_spa
     ```

2. Run the development server:
   ```
   python manage.py runserver
   ```

3. Go to http://localhost:8000/ in your browser, or http://localhost:8000/admin/
   to log in and get to work!

## Production deployment

This project is a standard Django + Wagtail site. A common deployment setup is Nginx (or a load balancer) in front of Gunicorn.

### Environment variables

- Copy `.env.example` to `.env` and fill values.
- Set `DJANGO_SETTINGS_MODULE=contracting_site.settings.prod`
- Set `SECRET_KEY` to a strong random value
- Set `ALLOWED_HOSTS` as a comma-separated list (example: `example.com,www.example.com`)
- Set `CSRF_TRUSTED_ORIGINS` as a comma-separated list of full origins (example: `https://example.com,https://www.example.com`)
- Set `WAGTAILADMIN_BASE_URL` (example: `https://example.com`)

### Build and run

1. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Apply migrations:
   ```
   python manage.py migrate
   ```

3. Build the Samarqand SPA into Django static files (requires Node.js + npm):
   ```
   python manage.py sync_samarqand_spa
   ```

4. Collect static files:
   ```
   python manage.py collectstatic --noinput
   ```

5. Run Gunicorn:
   ```
   gunicorn -c gunicorn.conf.py contracting_site.wsgi:application
   ```

### Static and media

- `STATIC_ROOT` is `static/` and should be served at `/static/`.
- `MEDIA_ROOT` is `media/` and should be served at `/media/`.

## Documentation links

* To customize the content, design, and features of the site see
  [Wagtail CRX](https://docs.coderedcorp.com/wagtail-crx/).

* For deeper customization of backend code see
  [Wagtail](http://docs.wagtail.io/) and
  [Django](https://docs.djangoproject.com/).

* For HTML template design see [Bootstrap](https://getbootstrap.com/).

---

Made with ♥ using [Wagtail](https://wagtail.io/) +
[CodeRed Extensions](https://www.coderedcorp.com/cms/)
