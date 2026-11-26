"""Seed realistic demo operational data for Samarqand ERP."""

from __future__ import annotations

import random
from datetime import date
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from website.models import Client
from website.models import ContractPayment
from website.models import EmailMessage
from website.models import Equipment
from website.models import FuelLog
from website.models import InventoryItem
from website.models import LeaveRequest
from website.models import OvertimeRecord
from website.models import ProjectContract
from website.models import ProjectPage
from website.models import PurchaseOrder
from website.models import ResourceAssignment
from website.models import Subcontractor
from website.models import Supplier
from website.models import Vehicle
from website.models import VehicleMaintenance
from website.models import Worker
from website.models import WorkerAttendance
from website.models import WorkerPayrollEntry

User = get_user_model()


ARABIC_NAMES = [
    "أحمد الخالدي",
    "محمد السعدي",
    "سارة النجار",
    "عمر خليل",
    "فاطمة يوسف",
    "خالد العمري",
    "نور الدين حسن",
    "ليلى عبد الرحمن",
    "ياسر القاسم",
    "هند محمود",
    "رياض سعيد",
    "منى فؤاد",
    "طارق حمدان",
    "دينا إبراهيم",
    "باسم سليمان",
]

WORKER_ROLES = [
    "مهندس مدني",
    "مهندس معماري",
    "مشرف موقع",
    "فني كهرباء",
    "فني سباكة",
    "نجار",
    "حداد",
    "سائق",
    "عامل",
    "محاسب",
    "مسجل",
    "مدير مشروع",
]

EQUIPMENT_LIST = [
    ("حفارة هيدروليكية", "EQ-001", "200.00"),
    ("رافعة برجية", "EQ-002", "350.00"),
    ("خلاطة خرسانة", "EQ-003", "45.00"),
    ("هزاز خرسانة", "EQ-004", "15.00"),
    ("منشار حديد", "EQ-005", "25.00"),
    ("مولد كهرباء", "EQ-006", "80.00"),
    ("كمبروسر هواء", "EQ-007", "30.00"),
    ("لودر صغير", "EQ-008", "120.00"),
    ("مضخة خرسانة", "EQ-009", "180.00"),
    ("سقالة متحركة", "EQ-010", "40.00"),
]

INVENTORY_ITEMS = [
    ("إسمنت بورتلاند", "طن", "85.000", "15.000"),
    ("حديد تسليح 12مم", "طن", "42.000", "8.000"),
    ("حديد تسليح 16مم", "طن", "38.000", "6.000"),
    ("بلوك 20×20×40", "حبة", "12000.000", "2000.000"),
    ("رمل ناعم", "م³", "150.000", "20.000"),
    ("حصى 3/4", "م³", "120.000", "15.000"),
    ("بلاط سيراميك", "م²", "800.000", "50.000"),
    ("دهان جدران", "لتر", "400.000", "50.000"),
    ("أنابيب PVC", "متر", "600.000", "50.000"),
    ("كابلات كهرباء", "متر", "2500.000", "200.000"),
]

VEHICLE_DATA = [
    ("شاحنة مرسيدس", "12345-ف", "truck", "Mercedes", "Actros", 2019),
    ("بيك أب تويوتا", "23456-ف", "pickup", "Toyota", "Hilux", 2020),
    ("سيدان هونداي", "34567-ف", "sedan", "Hyundai", "Elantra", 2021),
    ("باص كيا", "45678-ف", "bus", "Kia", "Bongo", 2018),
    ("رافعة شوكية", "56789-ف", "forklift", "Toyota", "8FGU25", 2020),
    (
        "لودر كاتربيلر",
        "67890-ف",
        "heavy_equipment",
        "Caterpillar",
        "950M",
        2019,
    ),
]

CLIENTS = [
    ("بلدية رام الله", "02-2987000", "info@ramallah-city.ps", "رام الله"),
    ("وزارة الأشغال العامة", "02-2941000", "contact@mop.gov.ps", "رام الله"),
    ("شركة الأقصى للاستثمار", "02-2405000", "info@alaqsa.ps", "البيرة"),
    ("جمعية الإغاثة الزراعية", "02-2966000", "office@arij.ps", "بيتونيا"),
    ("مستشفى المُطَّلع", "02-2791000", "info@mustakbal.ps", "رام الله"),
]

SUBCONTRACTORS = [
    ("مقاولات البرج", "كهرباء وسباكة", "059-9001001", "alburj@example.ps"),
    ("مؤسسة الصفا للتشطيبات", "دهان وبلاط", "059-9001002", "alsafa@example.ps"),
    (
        "شركة الأمل للألمنيوم",
        "ألمنيوم وUPVC",
        "059-9001003",
        "alamal@example.ps",
    ),
    ("مؤسسة القدس للمقاولات", "أعمال ترابية", "059-9001004", "quds@example.ps"),
]

SUPPLIERS = [
    ("مؤسسة الأصيل للمواد", "059-8001001", "alaseel@example.ps"),
    ("شركة الجود للحديد", "059-8001002", "aljood@example.ps"),
    ("مؤسسة الإسكان للإسمنت", "059-8001003", "iskan@example.ps"),
    ("شركة النور للكهرباء", "059-8001004", "alnoor@example.ps"),
]


class Command(BaseCommand):
    help = "Seed realistic demo operational data for Samarqand ERP"

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="",
            help="Kept for compatibility; demo accounts are created by "
            "seed_demo_users with an explicit password.",
        )
        parser.add_argument(
            "--allow-production",
            action="store_true",
            default=False,
            help="Explicit opt-in required when DEBUG is False.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options.get("allow_production"):
            raise CommandError(
                "seed_ops_demo is a development-only command. "
                "Refusing to seed demo operational data with DEBUG=False."
            )
        password = str(options.get("password") or "").strip()
        self.stdout.write("Seeding operational demo data...")

        admin = User.objects.filter(is_superuser=True).first()
        manager = User.objects.filter(username="demo_manager").first()
        accountant = User.objects.filter(username="demo_accountant").first()
        registrar = User.objects.filter(username="demo_registrar").first()
        emp1 = User.objects.filter(username="demo_employee_1").first()
        emp2 = User.objects.filter(username="demo_employee_2").first()
        users = [
            u for u in [admin, manager, accountant, registrar, emp1, emp2] if u
        ]

        with transaction.atomic():
            self._seed_workers(users, password)
            self._seed_equipment()
            self._seed_inventory()
            self._seed_vehicles()
            self._seed_clients()
            self._seed_subcontractors()
            self._seed_suppliers()
            self._seed_contracts()
            self._seed_purchase_orders(users)
            self._seed_attendance()
            self._seed_payroll()
            self._seed_leave_requests(users)
            self._seed_overtime(users)
            self._seed_resource_assignments()
            self._seed_fuel_logs()
            self._seed_vehicle_maintenance()
            self._seed_emails(users)

        self.stdout.write(
            self.style.SUCCESS("Done seeding operational demo data.")
        )

    def _seed_workers(self, users: list[Any], password: str) -> None:
        """Create workers and link to users."""
        used_user_ids: set[int] = set()
        for i, name in enumerate(ARABIC_NAMES[:10]):
            user = users[i] if i < len(users) else None
            if user:
                used_user_ids.add(user.id)
                # Update existing worker for this user
                existing = Worker.objects.filter(user=user).first()
                if existing:
                    existing.name = name
                    existing.role = WORKER_ROLES[i % len(WORKER_ROLES)]
                    existing.phone = f"059-{9001000 + i}"
                    existing.time_clock_id = f"TC-2024-{i + 1:03d}"
                    existing.kind = (
                        Worker.KIND_EMPLOYEE if i < 6 else Worker.KIND_WORKER
                    )
                    existing.active = True
                    existing.daily_cost = (
                        None if i < 6 else Decimal(str(120 + i * 10))
                    )
                    existing.monthly_salary = (
                        Decimal(str(2500 + (i * 300))) if i < 6 else None
                    )
                    existing.save()
                    if password:
                        user.email = f"{user.username}@samarqand.ps"
                        user.save()
                    continue
            role = WORKER_ROLES[i % len(WORKER_ROLES)]
            salary = Decimal(str(2500 + (i * 300)))
            Worker.objects.update_or_create(
                time_clock_id=f"TC-2024-{i + 1:03d}",
                defaults={
                    "name": name,
                    "user": user,
                    "role": role,
                    "phone": f"059-{9001000 + i}",
                    "kind": (
                        Worker.KIND_EMPLOYEE if i < 6 else Worker.KIND_WORKER
                    ),
                    "active": True,
                    "daily_cost": (
                        None if i < 6 else Decimal(str(120 + i * 10))
                    ),
                    "monthly_salary": salary if i < 6 else None,
                    "notes": "",
                },
            )
            if user and password:
                user.email = f"{user.username}@samarqand.ps"
                user.save()
        for i in range(5):
            Worker.objects.update_or_create(
                time_clock_id=f"TC-TEMP-{i + 1:03d}",
                defaults={
                    "name": f"عامل مؤقت {i + 1}",
                    "user": None,
                    "role": "عامل",
                    "phone": f"059-{9010000 + i}",
                    "kind": Worker.KIND_WORKER,
                    "active": True,
                    "daily_cost": Decimal("110.00"),
                    "monthly_salary": None,
                    "notes": "",
                },
            )
        self.stdout.write(f"  Workers: {Worker.objects.count()}")

    def _seed_equipment(self) -> None:
        statuses = [
            Equipment.STATUS_AVAILABLE,
            Equipment.STATUS_ON_SITE,
            Equipment.STATUS_MAINTENANCE,
        ]
        for name, code, cost in EQUIPMENT_LIST:
            Equipment.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "status": random.choice(statuses),
                    "hourly_cost": Decimal(cost),
                    "notes": "",
                },
            )
        self.stdout.write(f"  Equipment: {Equipment.objects.count()}")

    def _seed_inventory(self) -> None:
        for name, unit, qty, reorder in INVENTORY_ITEMS:
            InventoryItem.objects.update_or_create(
                name=name,
                defaults={
                    "sku": f"SKU-{name[:3]}",
                    "unit": unit,
                    "current_qty": Decimal(qty),
                    "reorder_level": Decimal(reorder),
                    "notes": "",
                },
            )
        self.stdout.write(f"  Inventory items: {InventoryItem.objects.count()}")

    def _seed_vehicles(self) -> None:
        workers = list(Worker.objects.filter(active=True)[:6])
        projects = list(ProjectPage.objects.filter(live=True)[:6])
        statuses = [
            Vehicle.STATUS_AVAILABLE,
            Vehicle.STATUS_IN_USE,
            Vehicle.STATUS_MAINTENANCE,
        ]
        for i, (
            name,
            plate,
            vtype,
            brand,
            model_name,
            year,
        ) in enumerate(VEHICLE_DATA):
            Vehicle.objects.update_or_create(
                plate_number=plate,
                defaults={
                    "name": name,
                    "vehicle_type": vtype,
                    "brand": brand,
                    "model_name": model_name,
                    "year": year,
                    "color": random.choice(["أبيض", "فضي", "أسود", "أزرق"]),
                    "chassis_number": f"CHS-{random.randint(100000, 999999)}",
                    "engine_number": f"ENG-{random.randint(100000, 999999)}",
                    "status": random.choice(statuses),
                    "assigned_to": workers[i] if i < len(workers) else None,
                    "current_project": (
                        projects[i] if i < len(projects) else None
                    ),
                    "insurance_expiry": (
                        date.today() + timedelta(days=random.randint(30, 365))
                    ),
                    "registration_expiry": (
                        date.today() + timedelta(days=random.randint(60, 400))
                    ),
                    "fuel_type": (
                        "diesel"
                        if vtype in ("truck", "heavy_equipment")
                        else "petrol"
                    ),
                    "tank_capacity_liters": Decimal(
                        str(random.choice([50, 60, 80, 100, 200, 300]))
                    ),
                    "notes": "",
                },
            )
        self.stdout.write(f"  Vehicles: {Vehicle.objects.count()}")

    def _seed_clients(self) -> None:
        for name, phone, email, address in CLIENTS:
            Client.objects.update_or_create(
                name=name,
                defaults={
                    "phone": phone,
                    "email": email,
                    "address": address,
                    "notes": "",
                },
            )
        self.stdout.write(f"  Clients: {Client.objects.count()}")

    def _seed_subcontractors(self) -> None:
        for name, specialty, phone, email in SUBCONTRACTORS:
            Subcontractor.objects.update_or_create(
                name=name,
                defaults={
                    "specialty": specialty,
                    "phone": phone,
                    "email": email,
                    "address": "",
                    "notes": "",
                },
            )
        self.stdout.write(f"  Subcontractors: {Subcontractor.objects.count()}")

    def _seed_suppliers(self) -> None:
        for name, phone, email in SUPPLIERS:
            Supplier.objects.update_or_create(
                name=name,
                defaults={
                    "phone": phone,
                    "email": email,
                    "address": "",
                    "notes": "",
                },
            )
        self.stdout.write(f"  Suppliers: {Supplier.objects.count()}")

    def _seed_contracts(self) -> None:
        clients = list(Client.objects.all())
        projects = list(ProjectPage.objects.filter(live=True)[:10])
        statuses = [
            ProjectContract.STATUS_ACTIVE,
            ProjectContract.STATUS_ACTIVE,
            ProjectContract.STATUS_CLOSED,
            ProjectContract.STATUS_DRAFT,
        ]
        today = date.today()
        for i in range(min(8, len(projects))):
            project = projects[i]
            client = clients[i % len(clients)] if clients else None
            start = today - timedelta(days=random.randint(60, 300))
            end = start + timedelta(days=random.randint(180, 730))
            amount = Decimal(str(random.randint(150000, 2500000)))
            contract, _created = ProjectContract.objects.update_or_create(
                number=f"CNT-2024-{i + 1:03d}",
                defaults={
                    "project": project,
                    "client": client,
                    "title": f"عقد {project.title}",
                    "status": random.choice(statuses),
                    "start_date": start,
                    "end_date": end,
                    "amount": amount,
                    "notes": "",
                },
            )
            # Create payment schedule
            for p in range(3):
                due = start + timedelta(days=(p + 1) * 90)
                paid = random.random() > 0.3
                ContractPayment.objects.update_or_create(
                    contract=contract,
                    title=f"دفعة {p + 1}",
                    defaults={
                        "due_date": due,
                        "amount": amount / 3,
                        "paid_amount": (amount / 3) if paid else Decimal("0"),
                        "paid_date": (due if paid else None),
                        "status": (
                            ContractPayment.STATUS_PAID
                            if paid
                            else ContractPayment.STATUS_PENDING
                        ),
                        "notes": "",
                    },
                )
        self.stdout.write(f"  Contracts: {ProjectContract.objects.count()}")

    def _seed_purchase_orders(self, _users: list[Any]) -> None:
        suppliers = list(Supplier.objects.all())
        for i in range(6):
            supplier = suppliers[i % len(suppliers)] if suppliers else None
            PurchaseOrder.objects.update_or_create(
                number=f"PO-2024-{i + 1:03d}",
                defaults={
                    "supplier": supplier,
                    "project": None,
                    "status": random.choice(
                        [
                            PurchaseOrder.STATUS_DRAFT,
                            PurchaseOrder.STATUS_SENT,
                            PurchaseOrder.STATUS_RECEIVED,
                        ]
                    ),
                    "date": (
                        date.today() - timedelta(days=random.randint(1, 60))
                    ),
                    "total_amount": Decimal(str(random.randint(5000, 50000))),
                    "notes": "",
                },
            )
        self.stdout.write(f"  Purchase orders: {PurchaseOrder.objects.count()}")

    def _seed_attendance(self) -> None:
        workers = list(Worker.objects.filter(active=True))
        today = timezone.localdate()
        approver = User.objects.filter(username="demo_manager").first()
        statuses = [
            WorkerAttendance.STATUS_PRESENT,
            WorkerAttendance.STATUS_PRESENT,
            WorkerAttendance.STATUS_PRESENT,
            WorkerAttendance.STATUS_ABSENT,
            WorkerAttendance.STATUS_HALF_DAY,
        ]
        for worker in workers:
            for i in range(14):
                d = today - timedelta(days=i)
                st = random.choice(statuses)
                hours = {
                    WorkerAttendance.STATUS_PRESENT: "8.00",
                    WorkerAttendance.STATUS_HALF_DAY: "4.00",
                    WorkerAttendance.STATUS_ABSENT: None,
                }.get(st, "8.00")
                WorkerAttendance.objects.update_or_create(
                    worker=worker,
                    date=d,
                    defaults={
                        "status": st,
                        "hours": (
                            Decimal(hours) if hours is not None else None
                        ),
                        "project": None,
                        "notes": "",
                        "state": WorkerAttendance.STATE_APPROVED,
                        "approved_by": approver,
                        "approved_at": timezone.now() if approver else None,
                    },
                )
        self.stdout.write(
            f"  Attendance records: {WorkerAttendance.objects.count()}"
        )

    def _seed_payroll(self) -> None:
        workers = list(
            Worker.objects.filter(active=True, monthly_salary__isnull=False)
        )
        today = timezone.localdate()
        for worker in workers:
            for month_offset in range(3):
                period = today.replace(day=1) - timedelta(
                    days=month_offset * 30
                )
                base = worker.monthly_salary or Decimal("0")
                allowances = Decimal(str(random.randint(200, 800)))
                deduction = Decimal(str(random.randint(0, 300)))
                overtime = Decimal(str(random.randint(0, 1500)))
                net = base + allowances - deduction + overtime
                WorkerPayrollEntry.objects.update_or_create(
                    worker=worker,
                    year=period.year,
                    month=period.month,
                    defaults={
                        "kind": WorkerPayrollEntry.KIND_SALARY,
                        "amount": base,
                        "allowances": {"بدل مواصلات": str(allowances)},
                        "deductions": {"ضريبة": str(deduction)},
                        "overtime_amount": overtime,
                        "net_salary": net,
                        "status": (
                            WorkerPayrollEntry.STATUS_PAID
                            if month_offset > 0
                            else WorkerPayrollEntry.STATUS_DRAFT
                        ),
                        "date": period,
                        "notes": "",
                    },
                )
        self.stdout.write(
            f"  Payroll entries: {WorkerPayrollEntry.objects.count()}"
        )

    def _seed_leave_requests(self, users: list[Any]) -> None:
        worker_user_map = {
            w.user_id: w for w in Worker.objects.filter(user__isnull=False)
        }
        approver = users[0] if users else None
        kinds = [
            LeaveRequest.LEAVE_ANNUAL,
            LeaveRequest.LEAVE_SICK,
            LeaveRequest.LEAVE_UNPAID,
        ]
        statuses = [
            LeaveRequest.STATUS_PENDING,
            LeaveRequest.STATUS_APPROVED,
            LeaveRequest.STATUS_REJECTED,
        ]
        today = date.today()
        for uid, worker in worker_user_map.items():
            for i in range(2):
                start = today + timedelta(days=random.randint(-30, 60))
                end = start + timedelta(days=random.randint(1, 7))
                days = max(1, (end - start).days)
                LeaveRequest.objects.update_or_create(
                    worker=worker,
                    start_date=start,
                    defaults={
                        "end_date": end,
                        "total_days": days,
                        "leave_type": random.choice(kinds),
                        "status": random.choice(statuses),
                        "reason": "سبب شخصي" if i == 0 else "ظروف صحية",
                        "approved_by": (
                            approver
                            if approver and random.random() > 0.3
                            else None
                        ),
                    },
                )
        self.stdout.write(f"  Leave requests: {LeaveRequest.objects.count()}")

    def _seed_overtime(self, _users: list[Any]) -> None:
        workers = list(Worker.objects.filter(active=True)[:8])
        today = date.today()
        for worker in workers:
            for i in range(3):
                d = today - timedelta(days=random.randint(1, 30))
                OvertimeRecord.objects.update_or_create(
                    worker=worker,
                    date=d,
                    defaults={
                        "hours": Decimal(str(random.randint(2, 6))),
                        "multiplier": Decimal(
                            str(random.choice([1.25, 1.5, 2.0]))
                        ),
                        "approved": random.random() > 0.3,
                    },
                )
        self.stdout.write(
            f"  Overtime records: {OvertimeRecord.objects.count()}"
        )

    def _seed_resource_assignments(self) -> None:
        workers = list(Worker.objects.filter(active=True)[:8])
        equipment = list(Equipment.objects.all()[:6])
        projects = list(ProjectPage.objects.filter(live=True)[:6])
        today = date.today()
        for i, worker in enumerate(workers):
            project = projects[i % len(projects)] if projects else None
            ResourceAssignment.objects.update_or_create(
                worker=worker,
                project=project,
                defaults={
                    "resource_type": ResourceAssignment.RESOURCE_WORKER,
                    "start_date": today
                    - timedelta(days=random.randint(10, 90)),
                    "end_date": (
                        today + timedelta(days=random.randint(30, 180))
                        if random.random() > 0.3
                        else None
                    ),
                    "hours_per_day": Decimal("8.00"),
                    "notes": "",
                },
            )
        for i, eq in enumerate(equipment):
            project = projects[i % len(projects)] if projects else None
            ResourceAssignment.objects.update_or_create(
                equipment=eq,
                project=project,
                defaults={
                    "resource_type": ResourceAssignment.RESOURCE_EQUIPMENT,
                    "start_date": today - timedelta(days=random.randint(5, 60)),
                    "end_date": (
                        today + timedelta(days=random.randint(30, 120))
                        if random.random() > 0.3
                        else None
                    ),
                    "notes": "",
                },
            )
        self.stdout.write(
            f"  Resource assignments: {ResourceAssignment.objects.count()}"
        )

    def _seed_fuel_logs(self) -> None:
        vehicles = list(Vehicle.objects.all())
        workers = list(Worker.objects.filter(active=True)[:6])
        for i, vehicle in enumerate(vehicles):
            base_odometer = random.randint(10000, 80000)
            for step in range(3):
                FuelLog.objects.create(
                    vehicle=vehicle,
                    date=date.today() - timedelta(days=(2 - step) * 20),
                    liters=Decimal(str(random.randint(20, 100))),
                    cost=Decimal(str(random.randint(150, 800))),
                    odometer_km=base_odometer + step * random.randint(200, 900),
                    station=random.choice(
                        ["محطة النور", "محطة القدس", "محطة الأمل"]
                    ),
                    filled_by=workers[i % len(workers)] if workers else None,
                    notes="",
                )
        self.stdout.write(f"  Fuel logs: {FuelLog.objects.count()}")

    def _seed_vehicle_maintenance(self) -> None:
        vehicles = list(Vehicle.objects.all())
        for i, vehicle in enumerate(vehicles):
            VehicleMaintenance.objects.create(
                vehicle=vehicle,
                date=date.today() - timedelta(days=random.randint(1, 90)),
                maintenance_type=random.choice(
                    [
                        VehicleMaintenance.MAINTENANCE_OIL,
                        VehicleMaintenance.MAINTENANCE_REPAIR,
                        VehicleMaintenance.MAINTENANCE_INSPECTION,
                    ]
                ),
                description=random.choice(
                    [
                        "تغيير زيت وفلتر",
                        "تبديل إطارات",
                        "فحص دوري",
                        "إصلاح مكابح",
                        "تبديل بطارية",
                    ]
                ),
                cost=Decimal(str(random.randint(200, 3000))),
                garage=random.choice(
                    ["ورشة الخالدي", "ورشة النجار", "مركز الصيانة"]
                ),
                notes="",
            )
        self.stdout.write(
            f"  Vehicle maintenance: {VehicleMaintenance.objects.count()}"
        )

    def _seed_emails(self, users: list[Any]) -> None:
        if len(users) < 3:
            return
        sender = users[0]
        recipients = [u.id for u in users[1:3]]
        subjects = [
            "اجتماع فريق المشاريع غداً",
            "تقرير التقدم الأسبوعي",
            "طلب مواد لموقع رام الله",
            "تحديث جدول المناقصات",
            "موافقة على دفعة جديدة",
        ]
        bodies = [
            "السلام عليكم، نرجو حضوركم في الاجتماع المقرر غداً الساعة العاشرة صباحاً.",
            "مرفق تقرير التقدم الأسبوعي لموقع البيرة. نرجو المراجعة.",
            "نحتاج إلى إسمنت إضافي بكمية 20 طن لموقع رام الله. نرجو التنسيق.",
            "تم تحديث جدول المناقصات وإضافة بندين جديدين. يمكنكم الاطلاع.",
            "تمت الموافقة على الدفعة رقم 3 للعقد CNT-2024-001. شكراً لكم.",
        ]
        for i, (subj, body) in enumerate(zip(subjects, bodies)):
            msg = EmailMessage.objects.create(
                sender=sender,
                recipients=recipients,
                cc=[],
                bcc=[],
                subject=subj,
                body=body,
                folder=EmailMessage.FOLDER_SENT,
                is_draft=False,
                is_read=True,
            )
            for rid in recipients:
                EmailMessage.objects.create(
                    sender=sender,
                    recipients=[rid],
                    subject=subj,
                    body=body,
                    folder=EmailMessage.FOLDER_INBOX,
                    is_draft=False,
                    is_read=random.random() > 0.5,
                    parent=msg,
                )
        self.stdout.write(f"  Email messages: {EmailMessage.objects.count()}")
