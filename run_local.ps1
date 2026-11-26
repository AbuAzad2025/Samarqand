# Local-only development launcher (SQLite, no external services required)
$env:DJANGO_SETTINGS_MODULE = "contracting_site.settings.dev"
$env:DB_ENGINE = ""

Write-Host "Applying migrations..."
python manage.py migrate --noinput

Write-Host "Backend starting -> http://127.0.0.1:8000/"
python manage.py runserver --settings=contracting_site.settings.dev
