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
