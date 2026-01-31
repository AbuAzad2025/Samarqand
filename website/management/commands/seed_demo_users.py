import os
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from website.api_views import ROLE_GROUPS
from website.api_views import _user_role
from website.models import Worker
from website.models import WorkerAttendance


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=(os.environ.get("DEMO_USERS_PASSWORD") or "demo1234").strip(),
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            default=False,
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
        )
        parser.add_argument(
            "--list-only",
            action="store_true",
            default=False,
        )

    def handle(self, *args, **options):
        password = str(options.get("password") or "").strip()
        reset_passwords = bool(options.get("reset_passwords"))
        limit = int(options.get("limit") or 500)
        limit = max(1, min(limit, 5000))
        list_only = bool(options.get("list_only"))

        User = get_user_model()

        role_to_group_name = {
            "guest": "Guests",
            "registered_guest": "Registered Guests",
            "employee": "Employees",
            "registrar": "Registrars",
            "accountant": "Accountants",
            "manager": "Managers",
        }
        required_groups = set(role_to_group_name.values())

        with transaction.atomic():
            for name in required_groups:
                Group.objects.get_or_create(name=name)

            if not list_only:
                demo_users = [
                    ("demo_superadmin", "superadmin"),
                    ("demo_manager", "manager"),
                    ("demo_accountant", "accountant"),
                    ("demo_registrar", "registrar"),
                    ("demo_employee_1", "employee"),
                    ("demo_employee_2", "employee"),
                    ("demo_registered_guest", "registered_guest"),
                    ("demo_guest", "guest"),
                ]

                all_role_group_names: set[str] = set()
                for names in ROLE_GROUPS.values():
                    all_role_group_names |= set(names)

                for username, role in demo_users:
                    user, created = User.objects.get_or_create(username=username)
                    user.is_staff = True

                    if role == "superadmin":
                        user.is_superuser = True
                        try:
                            to_remove = list(
                                Group.objects.filter(name__in=all_role_group_names)
                            )
                            if to_remove:
                                user.groups.remove(*to_remove)
                        except Exception:
                            pass
                    else:
                        user.is_superuser = False
                        try:
                            to_remove = list(
                                Group.objects.filter(name__in=all_role_group_names)
                            )
                            if to_remove:
                                user.groups.remove(*to_remove)
                        except Exception:
                            pass
                        group_name = role_to_group_name.get(role)
                        if group_name:
                            grp = Group.objects.filter(name=group_name).first()
                            if grp:
                                user.groups.add(grp)

                    if password and (created or reset_passwords):
                        user.set_password(password)

                    user.save()

                employee_1 = User.objects.filter(username="demo_employee_1").first()
                employee_2 = User.objects.filter(username="demo_employee_2").first()

                if employee_1:
                    Worker.objects.update_or_create(
                        user=employee_1,
                        defaults={
                            "name": "موظف تجريبي 1",
                            "role": "موظف",
                            "phone": "",
                            "time_clock_id": "TC-DEMO-EMP-1",
                            "kind": Worker.KIND_EMPLOYEE,
                            "active": True,
                            "daily_cost": None,
                            "monthly_salary": "3500.00",
                            "notes": "",
                        },
                    )
                if employee_2:
                    Worker.objects.update_or_create(
                        user=employee_2,
                        defaults={
                            "name": "موظف تجريبي 2",
                            "role": "موظف",
                            "phone": "",
                            "time_clock_id": "TC-DEMO-EMP-2",
                            "kind": Worker.KIND_EMPLOYEE,
                            "active": True,
                            "daily_cost": None,
                            "monthly_salary": "3200.00",
                            "notes": "",
                        },
                    )

                Worker.objects.update_or_create(
                    time_clock_id="TC-DEMO-WRK-1",
                    defaults={
                        "user": None,
                        "name": "عامل تجريبي 1",
                        "role": "عامل",
                        "phone": "",
                        "kind": Worker.KIND_WORKER,
                        "active": True,
                        "daily_cost": "150.00",
                        "monthly_salary": None,
                        "notes": "",
                    },
                )

                approver = User.objects.filter(username="demo_manager").first()
                if not approver:
                    approver = User.objects.filter(username="demo_superadmin").first()

                worker_1 = Worker.objects.filter(time_clock_id="TC-DEMO-EMP-1").first()
                if worker_1:
                    today = timezone.localdate()
                    for i in range(0, 7):
                        d = today - timedelta(days=i)
                        status = WorkerAttendance.STATUS_PRESENT
                        hours = "8.00"
                        if i == 3:
                            status = WorkerAttendance.STATUS_ABSENT
                            hours = None
                        if i == 5:
                            status = WorkerAttendance.STATUS_HALF_DAY
                            hours = "4.00"
                        defaults = {
                            "status": status,
                            "hours": hours,
                            "project": None,
                            "notes": "",
                            "state": WorkerAttendance.STATE_APPROVED,
                            "approved_by": approver,
                            "approved_at": timezone.now() if approver else None,
                        }
                        WorkerAttendance.objects.update_or_create(
                            worker=worker_1, date=d, defaults=defaults
                        )

        qs = (
            User.objects.filter(is_staff=True)
            .prefetch_related("groups")
            .order_by("username", "id")[:limit]
        )
        user_ids = [int(u.id) for u in qs]
        worker_map: dict[int, Worker] = {}
        for w in Worker.objects.filter(user_id__in=user_ids).select_related("user"):
            uid = int(getattr(w, "user_id", 0) or 0)
            if uid:
                worker_map[uid] = w

        self.stdout.write(f"Staff users: {User.objects.filter(is_staff=True).count()}")
        self.stdout.write(f"Showing first: {len(qs)}")
        self.stdout.write("")
        for u in qs:
            groups = []
            try:
                groups = [str(g.name) for g in u.groups.all()]
            except Exception:
                groups = []
            w = worker_map.get(int(u.id))
            wid = int(getattr(w, "id", 0) or 0) if w else 0
            wname = str(getattr(w, "name", "") or "") if w else ""
            role = _user_role(u)
            self.stdout.write(
                f"- {getattr(u, 'username', '')} | role={role} | superuser={bool(getattr(u, 'is_superuser', False))} | workerId={wid} {wname} | groups={groups}"
            )
