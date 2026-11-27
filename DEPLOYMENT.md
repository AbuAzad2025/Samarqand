# Production deployment — Samar Qand Contracting

Live site: **https://samarqand.azadexa.com**  
Control panel: **https://samarqand.azadexa.com/control/login**

This app is deployed as an isolated system alongside other applications on the same
server. It uses its own directory, virtualenv, systemd unit, PostgreSQL role/database,
Unix socket, nginx site and log files. The default nginx site and the other applications
are never modified.

## Layout on the server

```
/srv/apps/samarqand/
├── current -> releases/<timestamp>      # live release (symlink)
├── releases/                            # immutable snapshots
├── venv/                                # private Python environment
└── shared/
    ├── .env                             # secrets, chmod 600, never in git
    ├── .admin_pass                      # rotated demo-user password, chmod 600
    ├── db/samarqand_data.json           # data snapshot, chmod 600
    ├── uploads/                         # Wagtail media (MEDIA_ROOT)
    ├── static/                          # collectstatic output (STATIC_ROOT)
    ├── cache/
    ├── logs/gunicorn*.log
    ├── run/samarqand.sock               # gunicorn Unix socket
    └── DEPLOY_INFO                      # deployed commit + release timestamp
```

- systemd unit: `/etc/systemd/system/samarqand.service`
- nginx site: `/etc/nginx/sites-available/samarqand.conf` (TLS managed by Certbot)
- nginx logs: `/srv/logs/nginx/samarqand-*.log`
- PostgreSQL: database `samarqand_db`, role `samarqand_user`, host `127.0.0.1`
- App server: gunicorn, 3 workers, bound to a Unix socket

Only these variable **names** are used (values live exclusively in `shared/.env` on the
server; see `.env.example`):

```
DJANGO_SETTINGS_MODULE=contracting_site.settings.prod
SECRET_KEY, DEBUG
DB_ENGINE, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS
TRUST_X_FORWARDED_PROTO, USE_X_FORWARDED_HOST
STATIC_ROOT, MEDIA_ROOT, CACHE_LOCATION
AUTO_MIGRATE, SECURE_SSL_REDIRECT, SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE
GEMINI_API_KEY, GA_MEASUREMENT_ID      # optional; empty is valid
```

`GEMINI_API_KEY` and `GA_MEASUREMENT_ID` are intentionally empty until real values are
provided. No AI feature is advertised as active, and no analytics tag is emitted.

## Deploying a new release

1. Build the frontend locally: `npm run build` in `frontend/samarqand`, then commit.
2. Run local checks: `ruff`, `black --check`, `manage.py check`,
   `makemigrations --check`, `manage.py test`, `npm run typecheck`, `npm run lint`,
   `npm run build`.
3. On the server, create a new immutable release from the pinned commit and repoint
   `current`. Keep `shared/` untouched so `.env`, uploads, static files and logs survive.
4. Source `shared/.env`, then on the server run:

   ```bash
   python manage.py migrate --noinput
   python manage.py collectstatic --noinput
   ```

   `set_truthful_stats` and `seed_jericho_project` are one-time data commands and are
   already reflected in the restored fixture; only run them when intentionally
   resetting content.
5. `systemctl restart samarqand` and `nginx -t && systemctl reload nginx`.

## Rollback

Repoint `current` to the previous release and `systemctl restart samarqand`. Keep the
database migrations compatible with the previous release; schema changes require a
separate, deliberate rollback plan.

## Verification

```bash
curl -s https://samarqand.azadexa.com/health
# {"status": "ok", "database": "ok"}

curl -s -o /dev/null -w '%{http_code}\n' https://samarqand.azadexa.com/
curl -s -o /dev/null -w '%{http_code}\n' https://samarqand.azadexa.com/projects/jericho-hall
curl -s -o /dev/null -w '%{http_code}\n' https://samarqand.azadexa.com/control/login
curl -s -o /dev/null -w '%{http_code}\n' https://samarqand.azadexa.com/django-admin/
# expected: 200, 200, 200, 404

systemctl is-active samarqand nginx postgresql
```

HTTP is redirected to HTTPS. Security headers (`HSTS`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`) are present.

## Security notes

- No passwords, API keys or database dumps are committed. The repository is clean of
  sensitive literals; `.env`, `db.sqlite3`, `media/` and `.local/` are ignored by git.
- The default Django admin is not exposed: `/django-admin/` returns 404; management is
  at `/control/`.
- The demo accounts have a server-only random password stored in `shared/.admin_pass`.
  Change it with the normal password-change screen after first login.
- Other applications on the server, including the default nginx site, were not touched.
