import os

import psycopg
from django.core.management.base import BaseCommand


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


class Command(BaseCommand):
    requires_system_checks: list[str] = []

    def handle(self, *args, **options):
        if _env("DB_ENGINE").lower() not in {"postgres", "postgresql"}:
            self.stdout.write("DB_ENGINE is not postgres; nothing to do.")
            return

        db_name = _env("DB_NAME", "contracting_site")
        db_user = _env("DB_USER", "postgres")
        db_password = _env("DB_PASSWORD", "")
        db_host = _env("DB_HOST", "localhost")
        db_port = _env("DB_PORT", "5432")

        def connect(db: str):
            return psycopg.connect(
                dbname=db,
                user=db_user,
                password=db_password,
                host=db_host,
                port=db_port,
                autocommit=True,
            )

        try:
            with connect(db_name):
                self.stdout.write(self.style.SUCCESS(f"Database exists: {db_name}"))
                return
        except psycopg.OperationalError as e:
            message = str(e)
            if f'database "{db_name}" does not exist' not in message:
                raise

        with connect("postgres") as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
                if cur.fetchone():
                    self.stdout.write(self.style.SUCCESS(f"Database exists: {db_name}"))
                    return

                cur.execute(f'CREATE DATABASE "{db_name}"')
                self.stdout.write(self.style.SUCCESS(f"Created database: {db_name}"))

