from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    def handle(self, *args, **options):
        username = (os.environ.get("DJANGO_SUPERUSER_USERNAME") or "").strip()
        password = (os.environ.get("DJANGO_SUPERUSER_PASSWORD") or "").strip()
        email = (os.environ.get("DJANGO_SUPERUSER_EMAIL") or "").strip()

        if not username or not password:
            self.stdout.write(
                "Skipping ensure_superuser: set DJANGO_SUPERUSER_USERNAME and DJANGO_SUPERUSER_PASSWORD to create one."
            )
            return

        User = get_user_model()
        with transaction.atomic():
            user, created = User.objects.get_or_create(username=username)
            changed = False

            if created:
                changed = True

            if email and getattr(user, "email", "") != email:
                user.email = email
                changed = True

            if not getattr(user, "is_staff", False):
                user.is_staff = True
                changed = True

            if not getattr(user, "is_superuser", False):
                user.is_superuser = True
                changed = True

            user.set_password(password)
            changed = True

            if changed:
                user.save()

        action = "Created" if created else "Updated"
        self.stdout.write(f"{action} superuser: {username}")
