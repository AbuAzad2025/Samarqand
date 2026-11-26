# خطة الإصلاح والتطوير — شركة سمرقند للمقاولات
# Samarqand Contracting Co. — Development & Improvement Plan

> هذا الملف يوثق خطة التطوير الكاملة للمشروع. كل مرحلة مبنية على التي تسبقها.
> الترتيب مهم: لا ننتقل للمرحلة التالية إلا بعد أن تكون المرحلة الحالية منجزة ومختبرة.
> يتم تحديث هذا الملف بعد كل commit.

## تحديث: التنظيف المحلي وإعادة الهيكلة (2026-11-26)

- تدقيق أمني كامل: **لا توجد برمجيات خبيثة أو backdoors**.
- حذف 17 قالب HTML ثابت غير مستخدم من `website/static/website/constra/` كان يحتوي على مفتاح Google Maps مسرّب (تمت إزالة المفتاح بالكامل).
- حذف مكتبة `adminlte/` غير المستخدمة (~2000 ملف) وإزالتها من `STATICFILES_DIRS`.
- حذف نسخ البناء القديمة من `samarqand_spa/assets/` والاحتفاظ بالنسخة المشار إليها في `index.html`.
- إلغاء تتبع `db.sqlite3` وإعادة توليده نظيفاً (حسابات `demo_*` فقط، صفر جلسات، لا بيانات اعتماد حقيقية).
- استبدال روابط Mocha الخارجية بصور محلية في `website/static/website/images/`.
- إصلاح النص العربي المشوّه في `frontend/samarqand/index.html` و `spa_shell.html`.
- تقسيم `contracting_site/urls.py` إلى حزمة `contracting_site/urls/` مقسّمة حسب مجال المسارات (351 مساراً محفوظاً).
- تبسيط التشغيل المحلي على SQLite في `.env.example` و `run_local.ps1` و `README.md`.

---

## جدول التقدم — Progress Tracker

| المرحلة | المحتوى | الحالة | commit |
|---------|---------|--------|--------|
| **0** | Fix Critical Bugs | ✅ مكتمل | `a89b733` |
| **1A** | Split models.py → models/ package | ✅ مكتمل | `3158794` |
| **1B** | Split api_views.py → api/ package | ✅ مكتمل | `3158794` |
| **1C** | Split admin.py → 6 thematic admin_*.py files | ✅ مكتمل | `3158794` |
| **1D** | Cleanup + CI fixes (Ruff, MyPy, Black, Django check) | ✅ مكتمل | `f3d81de`, `e7a329c` |
| **1E** | Move gunicorn.conf.py into contracting_site/ | ✅ مكتمل | `564c01e` |
| **2A** | Accounting — Chart of Accounts + Journal Entry | ✅ مكتمل | `7e1cf6a` |
| **2B** | Accounting — Bank, Checks, Tax | ✅ مكتمل | `7e1cf6a` |
| **2C** | Accounting — Link with existing ERP | ✅ مكتمل | `f588de3` |
| **3A** | BOQ Items + Payment Applications | ✅ مكتمل | `87b1448` |
| **3B** | Variation Orders + Final Account | ✅ مكتمل | `87b1448` |
| **3C** | BOQ Frontend | ✅ مكتمل | `c9831d5` |
| **4** | Field Documentation | ✅ مكتمل | `4826054` |
| **5** | HR (Leave, Contracts, Overtime, Social Security) | ✅ مكتمل | `ba8e793` |
| **6** | Fleet Management | ✅ مكتمل | `564c01e` |
| **7** | Tests & DevOps | ✅ مكتمل | `564c01e` |
| **Fix** | Login page + CSRF dev fix | ✅ مكتمل | `bdd23b4` |
| **UI** | Control layout cleanup + Fleet fix | ✅ مكتمل | `4d50ac7` |

---

## المرحلة 0: فوراً — Fix Critical Bugs (✅ مكتمل — `a89b733`)
**الهدف: تصحيح أخطاء إنتاجية حقيقية تمنع تشغيل الموقع بشكل صحيح**

| # | المهمة | الملف | التفاصيل | الحالة |
|---|--------|-------|----------|--------|
| 0.1 | **Timezone** | `contracting_site/settings/base.py` | `TIME_ZONE = "America/New_York"` → `"Asia/Gaza"` | ✅ |
| 0.2 | **Language** | `contracting_site/settings/base.py` | `LANGUAGE_CODE = "en-us"` → `"ar"`، `USE_I18N = False` → `True` | ✅ |
| 0.3 | **Wagtail site name** | `contracting_site/settings/base.py` | `WAGTAIL_SITE_NAME = "Contracting Co"` → `"سمرقند للمقاولات"` | ✅ |
| 0.4 | **Static HTML files** | `website/static/website/constra/*.html` | فحص: هل أي منها لا يزال مستخدم؟ لو لا → حذف. لو مستخدم → نقل لقوالب Django | ✅ |
| 0.5 | **URL catch-all regex** | `contracting_site/urls/spa.py` | ضبط regex الـ SPA shell عشان ما يتعارض مع مسارات Wagtail — crx_urls قبل catch-all | ✅ |
| 0.6 | **pyproject.toml تنظيف** | `pyproject.toml` | إزالة `[tool.pytest.ini_options]` (ما فيه tests) | ✅ |
| 0.7 | **Vite output path** | `frontend/samarqand/vite.config.ts` | تغيير `build.outDir` إلى `../../website/static/website/samarqand_spa/` → إلغاء الحاجة لأمر `sync_samarqand_spa` | ✅ |
| 0.8 | **Remove temp files** | `webbridge-*.json`, `samarqand-*.png`, cache dirs | تأكيد أن `.gitignore` يغطيها | ✅ |

**اختبار المرحلة 0:** `python manage.py check --deploy --fail-level=ERROR` و `python manage.py runserver` وتأكد من أن الموقع يفتح ويعرض الصفحات.

---

## المرحلة 1: تقسيم الكود — Code Structure (✅ مكتمل)
**الهدف: جعل الكود قابل للصيانة والتوسع قبل إضافة أي ميزات جديدة**

### 1A: تقسيم models.py → `website/models/` package (✅ مكتمل — `3158794`)

```
website/models/
├── __init__.py        # يستورد كل الموديلات من الملفات الفرعية
├── pages.py           # ArticlePage, ArticleIndexPage, EventPage, EventIndexPage,
│                      # EventOccurrence, FormPage, FormPageField, FormConfirmEmail,
│                      # LocationPage, LocationIndexPage, WebPage,
│                      # ServiceIndexPage, ServicePage,
│                      # ProjectIndexPage, ProjectPage, ProjectGalleryImage, ProjectDocument,
│                      # CertificationIndexPage, CertificationPage,
│                      # ContactPage, QuoteRequestPage,
│                      # ToolsIndexPage, AIDesignAnalyzerPage, ConstructionCalculatorPage,
│                      # ArchitecturalVisualizerPage, AIContentGeneratorPage
├── settings.py        # CompanySettings, HomePageSettings, SiteVisibilitySettings,
│                      # AISettings, CalculatorSettings
├── snippets.py        # TeamMember, Testimonial, HomeAIFeature, HomeAIMetric,
│                      # HomeTrustBadge, HomeStat, HomeTimelineStep
└── operations.py      # RFQDocument, CompanyDocument, Client, ClientContactLog,
                       # Supplier, Subcontractor, ProjectContract, ContractAddendum,
                       # ContractPayment, PurchaseOrder, InventoryItem,
                       # InventoryTransaction, Equipment, Worker, WorkerAttendance,
                       # WorkerPayrollEntry, ResourceAssignment, OpsAuditLog,
                       # OpsPermissionRule, OpsTimeclockImportRun
```

**تم التنفيذ:**
- إنشاء مجلد `website/models/` وملف `__init__.py`
- قص كل `class` حسب الفئة للملف المناسب
- استيراد المكتبات اللازمة لكل ملف
- في `__init__.py`، استيراد كل الموديلات عبر `from .operations import *`، `from .pages import *` إلخ
- تحديث `website/api/` لتستورد من `website.models`
- `python manage.py check` و `python manage.py makemigrations --check --dry-run` يمرّان

### 1B: تقسيم api_views.py → `website/api/` package (✅ مكتمل — `3158794`)

```
website/api/
├── __init__.py          # re-export كل الـ API views
├── admin.py             # thin re-export من الملفات المواضيعية
├── admin_settings.py    # الإعدادات + المستخدمين
├── admin_content.py     # الفريق، الشهادات، الخدمات، الصفحات، المقالات، RFQ
├── admin_projects.py    # المشاريع، المعرض، المستندات، الوسائط
├── admin_crm.py         # العملاء، الموردون، العقود، أوامر الشراء
├── admin_hr.py          # العمال، الحضور، الرواتب
├── admin_ops.py         # المخزون، المعدات، التكليفات، التدقيق، KPI
├── auth.py              # auth_access, auth_login, auth_me, auth_logout, auth_change_password, csrf_failure
├── public.py            # الـ public site endpoints + AI
└── common.py            # 76+ helper function + ROLE_GROUPS + _user_role
```

**تم التنفيذ:**
- إنشاء مجلد `website/api/` وملف `__init__.py`
- نقل كل helper functions إلى `common.py`
- تقسيم الـ views حسب الموضوع إلى 6 ملفات `admin_*.py`
- تحديث `contracting_site/urls.py`: `from website import api as api_views`
- تحديث `seed_demo_users.py` ليستورد `ROLE_GROUPS` و `_user_role` من `website.api`

### 1C: تقسيم admin.py → 6 ملفات مواضيعية (✅ مكتمل — `3158794`)

كان `website/admin.py` واحداً بحجم 7548 سطر. تم تقسيمه إلى:
- `admin_settings.py` (732 سطر)
- `admin_content.py` (1681 سطر)
- `admin_projects.py` (1597 سطر)
- `admin_crm.py` (1107 سطر)
- `admin_hr.py` (1293 سطر)
- `admin_ops.py` (1071 سطر)

### 1D: تنظيف الكود + إصلاح CI (✅ مكتمل — `f3d81de`, `e7a329c`)

**تم التنفيذ:**
- إزالة التعليقات من `common.py`، `pages.py`، `0002_initial_data.py`
- تقصير النص العربي الطويل في `models/settings.py`
- تنسيق Black لـ 11 ملفاً
- نقل ملفات `.bak` خارج المشروع إلى `D:\Data\Samar Qand\Samarqand_backups\`
- إصلاح 666 خطأ F401 (unused imports) عبر Ruff auto-fix
- إصلاح F821 (`ProjectPage` غير معرّف في `operations.py`)
- تحويل `__all__` في `common.py` من dynamic إلى static list (78 اسماً) حتى mypy يفهم star imports
- إصلاح خطأ حقيقي: `admin_ops_subcontractors_delete` كان ينقصه `return _api_ok()`
- جميع فحوصات CI تمر: `ruff check`، `ruff format --check`، `black --check`، `mypy --show-error-codes`، `django check --deploy --fail-level=ERROR`، `makemigrations --check --dry-run`

### 1E: نقل gunicorn.conf.py (✅ مكتمل — `564c01e`)

```
gunicorn.conf.py  →  contracting_site/gunicorn.conf.py
```

**تم التنفيذ:**
- نقل الملف إلى `contracting_site/gunicorn.conf.py`
- تحديث الأمر في `README.md` إلى `gunicorn -c contracting_site/gunicorn.conf.py ...`

---

## المرحلة 2: النظام المحاسبي — Accounting System (✅ مكتمل)
**الهدف: إضافة محاسبة double-entry متكاملة. هذا هو العمود الفقري لشركة المقاولات.**

> **الحالة:** 2A و 2B و 2C مكتملات (`7e1cf6a`، `f588de3`).

> **لماذا هذا هو الأولوية القصوى؟** لأن بدون محاسبة:
> - صاحب الشركة لا يعرف كم ربح كل مشروع
> - لا يمكن تقديم إقرار ضريبي (VAT + خصم)
> - لا يمكن تسوية الحسابات مع العملاء والموردين
> - لا يوجد ميزانية عمومية أو قائمة دخل

### 2.1: شجرة الحسابات — Chart of Accounts

**موديل: `Account`**

```python
class Account(models.Model):
    TYPE_ASSET = "asset"
    TYPE_LIABILITY = "liability"
    TYPE_EQUITY = "equity"
    TYPE_INCOME = "income"
    TYPE_EXPENSE = "expense"
    TYPE_CHOICES = [...]

    code: CharField(max_length=20, unique=True)        # رقم الحساب (مثلاً: 110001)
    name: CharField(max_length=255)                     # اسم الحساب (مثلاً: صندوق النثريات)
    name_ar: CharField(max_length=255)                  # الاسم بالعربي
    account_type: CharField(choices=TYPE_CHOICES)
    parent: ForeignKey('self', null, blank)             # حساب أبوي
    is_active: BooleanField(default=True)
    is_control: BooleanField(default=False)             # حساب رقابي (له أبناء)
    description: TextField(blank=True)
```

**شجرة حسابات مقترحة (تبسيطية لأول مرة):**

```
1 — الأصول (Assets)
├── 11 — أصول متداولة
│   ├── 1101 — صندوق النثريات
│   ├── 1102 — البنك (بنك فلسطين)
│   ├── 1103 — البنك (البنك العربي)
│   ├── 1104 — شيكات تحت التحصيل
│   └── 1105 — ذمم مدينة (عملاء)
├── 12 — أصول ثابتة
│   ├── 1201 — معدات
│   ├── 1202 — مركبات
│   └── 1203 — أثاث
└── 13 — أصول غير ملموسة

2 — الخصوم (Liabilities)
├── 21 — خصوم متداولة
│   ├── 2101 — ذمم دائنة (موردين)
│   ├── 2102 — شيكات صادرة
│   ├── 2103 — ضريبة خصم (%10)
│   └── 2104 — ضريبة قيمة مضافة (VAT 16%)
└── 22 — خصوم طويلة الأجل

3 — حقوق الملكية (Equity)
├── 31 — رأس المال
├── 32 — أرباح مبقاة
└── 33 — أرباح/خسائر السنة

4 — الإيرادات (Income)
└── 41 — إيرادات المشاريع

5 — المصروفات (Expenses)
├── 51 — مصروفات المشاريع المباشرة
│   ├── 5101 — مواد
│   ├── 5102 — عمال
│   ├── 5103 — عقود مقاولين فرعيين
│   └── 5104 — تأجير معدات
└── 52 — مصروفات إدارية وعمومية
```

### 2.2: القيود اليومية — Journal Entry (Double-Entry)

**موديل: `JournalEntry` + `JournalEntryLine`**

```python
class JournalEntry(models.Model):
    number: CharField(max_length=32, unique=True)       # رقم القيد (auto)
    date: DateField()                                    # تاريخ القيد
    description: TextField(blank=True)                   # شرح القيد
    entry_type: CharField(choices=[...])                 # نوع القيد: (receipt/payment/journal)
    ref_number: CharField(max_length=64, blank=True)     # رقم المرجع (رقم الشيك/رقم الفاتورة)
    created_by: ForeignKey(User)
    created_at: DateTimeField(auto_now_add=True)
    is_posted: BooleanField(default=False)               # ترحيل/إغلاق القيد
    posted_at: DateTimeField(null, blank)
    total_debit: DecimalField(max_digits=14, decimal_places=2, default=0)
    total_credit: DecimalField(max_digits=14, decimal_places=2, default=0)

class JournalEntryLine(models.Model):
    entry: ForeignKey(JournalEntry, related_name="lines")
    account: ForeignKey(Account)
    description: TextField(blank=True)
    debit: DecimalField(max_digits=14, decimal_places=2, default=0)
    credit: DecimalField(max_digits=14, decimal_places=2, default=0)
    project: ForeignKey(ProjectPage, null, blank)       # لربط المصاريف بمشروع محدد
```

**قاعدة: كل قيد لازم `sum(debit) == sum(credit)` — الـ validation في `clean()`**

### 2.3: الحسابات البنكية و الصندوق — Bank & Cash

**موديل: `BankAccount`**

```python
class BankAccount(models.Model):
    account: OneToOneField(Account)                      # الحساب المحاسبي المرتبط
    bank_name: CharField(max_length=255)                 # اسم البنك
    branch: CharField(max_length=255, blank=True)        # الفرع
    account_number: CharField(max_length=64)             # رقم الحساب
    iban: CharField(max_length=34, blank=True)           # IBAN
    currency: CharField(max_length=3, default="ILS")     # ILS / USD / JOD
    opening_balance: DecimalField(default=0)             # الرصيد الافتتاحي
    current_balance: DecimalField(default=0)             # الرصيد الحالي (يحسب من القيود)
    is_active: BooleanField(default=True)
```

### 2.4: الشيكات — Checks

**موديل: `Check`**

```python
class Check(models.Model):
    DIRECTION_ISSUED = "issued"      # شيك صادر (دفع لمورد)
    DIRECTION_RECEIVED = "received"  # شيك وارد (استلام من عميل)
    DIRECTION_CHOICES = [...]

    STATUS_PENDING = "pending"        # تحت التحصيل / لم يصرف
    STATUS_CLEARED = "cleared"        # صرف
    STATUS_BOUNCED = "bounced"        # مرتجع
    STATUS_CANCELLED = "cancelled"    # ملغي
    STATUS_CHOICES = [...]

    direction: CharField(choices=DIRECTION_CHOICES)
    check_number: CharField(max_length=64)
    bank_name: CharField(max_length=255)
    issue_date: DateField()
    maturity_date: DateField()                           # تاريخ الاستحقاق
    amount: DecimalField(max_digits=14, decimal_places=2)
    payee: CharField(max_length=255)                     # المستفيد (صادر) / الدافع (وارد)
    project: ForeignKey(ProjectPage, null, blank)
    journal_entry: ForeignKey(JournalEntry, null, blank) # القيد المحاسبي
    status: CharField(choices=STATUS_CHOICES, default=STATUS_PENDING)
    notes: TextField(blank=True)
    cleared_date: DateField(null, blank)
    image_front: ImageField(null, blank)                 # صورة الشيك (وجه)
```

### 2.5: ضريبة الخصم & VAT — Withholding Tax & VAT

**موديل: `TaxRecord`**

```python
class TaxRecord(models.Model):
    TAX_WITHHOLDING = "withholding"    # ضريبة خصم منبع (10% توريدات، 5% خدمات)
    TAX_VAT = "vat"                    # ضريبة قيمة مضافة (16%)
    TAX_CHOICES = [...]

    tax_type: CharField(choices=TAX_CHOICES)
    project: ForeignKey(ProjectPage, null, blank)
    transaction_date: DateField()
    description: TextField()
    gross_amount: DecimalField()                          # المبلغ الإجمالي
    tax_rate: DecimalField()                              # النسبة (0.10, 0.05, 0.16)
    tax_amount: DecimalField()                            # مبلغ الضريبة
    net_amount: DecimalField()                            # الصافي
    journal_entry: ForeignKey(JournalEntry, null, blank)  # القيد المحاسبي
    paid: BooleanField(default=False)
    paid_date: DateField(null, blank)
    return_period: CharField(max_length=7, blank=True)    # الفترة الضريبية: "2026-01"
```

**API Endpoints:**
- `api/admin/accounts/accounts/` — CRUD شجرة الحسابات
- `api/admin/accounts/journal-entries/` — CRUD + POST للقيود مع الـ lines
- `api/admin/accounts/bank-accounts/` — CRUD حسابات بنكية
- `api/admin/accounts/checks/` — CRUD شيكات (مع تغيير الحالة clear/bounce/cancel)
- `api/admin/accounts/tax/` — CRUD سجلات ضريبية + تقارير
- `api/admin/accounts/trial-balance/` — ميزان المراجعة
- `api/admin/accounts/project-pl/` — أرباح وخسائر كل مشروع
- `api/admin/accounts/balance-sheet/` — ميزانية عمومية
- `api/admin/accounts/income-statement/` — قائمة دخل

**مثال: قيد استلام شيك من عميل:**
```
دائن: ذمم مدينة (عميل)    ← 100,000
مدين: شيكات تحت التحصيل    ← 100,000
```

**مثال: قيد صرف شيك لمورد:**
```
دائن: البنك (بنك فلسطين)   ← 50,000
مدين: ذمم دائنة (مورد)     ← 45,000
مدين: ضريبة خصم (10%)      ← 5,000
```

### 2.6: ربط القيود بالـ ERP الموجود

كل عملية مالية في النظام الحالي لازم تولّد قيد محاسبي تلقائي:
- **ContractPayment (مستخلص عميل)** → قيد ذمم مدينة + إيراد المشروع
- **PurchaseOrder** → قيد مشتريات + ذمم دائنة
- **PayrollEntry** → قيد مصروف رواتب + صندوق/بنك

---

## المرحلة 3: BOQ والمستخلصات — Bill of Quantities & Payment Applications (✅ مكتمل)
**الهدف: ربط كل مشروع ببنود الكميات الخاصة به + مستخلصات دورية**

> **الحالة:** 3A، 3B، 3C مكتملات (`87b1448`، `c9831d5`).

### 3.1: بنود الكميات لكل مشروع — ProjectBOQItem (✅)

```python
class ProjectBOQItem(models.Model):
    project: ForeignKey(ProjectPage, related_name="boq_items")
    sort_order: PositiveIntegerField(default=0)
    item_code: CharField(max_length=32, blank=True)       # رقم البند (مثلاً: 1.1.1)
    description: TextField()                               # وصف البند
    unit: CharField(max_length=32)                         # وحدة القياس (م³, م², طن, عدد)
    quantity: DecimalField(max_digits=14, decimal_places=3) # الكمية حسب العقد
    unit_price: DecimalField(max_digits=12, decimal_places=2) # سعر الوحدة حسب العقد
    total_price: DecimalField(max_digits=14, decimal_places=2) # unit_price × quantity
    account: ForeignKey(Account, null, blank)              # الحساب المحاسبي المرتبط
```

### 3.2: مستخلصات — PaymentApplication (✅)

```python
class PaymentApplication(models.Model):
    project: ForeignKey(ProjectPage, related_name="payment_applications")
    application_number: CharField(max_length=32)           # رقم المستخلص: "الأول", "الثاني"...
    application_date: DateField()
    period_from: DateField()
    period_to: DateField()

    # إجمالي الأعمال المنفذة
    total_works_done: DecimalField(default=0)              # إجمالي بنود الكميات المنفذة
    previous_applications_total: DecimalField(default=0)   # إجمالي المستخلصات السابقة
    current_due: DecimalField(default=0)                   # total_works_done - previous

    # الخصومات
    retention_percent: DecimalField(default=10)            # حبس ضمان %
    retention_amount: DecimalField(default=0)
    withholding_tax_percent: DecimalField(default=10)      # ضريبة خصم %
    withholding_tax_amount: DecimalField(default=0)
    previous_deductions: DecimalField(default=0)
    net_amount: DecimalField(default=0)                    # الصافي النهائي

    status: CharField(choices=[draft, submitted, approved, paid, rejected])
    submitted_to_consultant: BooleanField(default=False)
    consultant_approved: BooleanField(default=False)
    consultant_notes: TextField(blank=True)

    created_by: ForeignKey(User)
    created_at: DateTimeField(auto_now_add=True)
    journal_entry: ForeignKey(JournalEntry, null, blank)   # القيد المحاسبي المرتبط

class PaymentApplicationItem(models.Model):
    payment: ForeignKey(PaymentApplication, related_name="items")
    boq_item: ForeignKey(ProjectBOQItem)
    contracted_quantity: DecimalField()                    # كمية العقد
    previously_done_quantity: DecimalField(default=0)      # أنجز سابقاً
    current_quantity: DecimalField(default=0)              # هذا المستخلص
    total_done_quantity: DecimalField()                    # الإجمالي المنجز
    done_percent: DecimalField()                           # % total_done / contracted
    unit_price: DecimalField()                             # من الـ BOQ
    total_amount: DecimalField()                           # total_done × unit_price
    previously_certified: DecimalField(default=0)
    current_amount: DecimalField()                         # total_amount - previously_certified
```

### 3.3: أوامر تغييرية — VariationOrder (✅)

```python
class VariationOrder(models.Model):
    project: ForeignKey(ProjectPage, related_name="variation_orders")
    variation_number: CharField(max_length=32)
    title: CharField(max_length=255)
    reason: CharField(choices=[client_request, design_change, site_condition, error, other])
    description: TextField()
    status: CharField(choices=[draft, submitted, approved, rejected, implemented])

    # أثر مالي
    cost_impact: DecimalField(max_digits=14, decimal_places=2)
    schedule_impact_days: IntegerField(default=0)

    submitted_by: ForeignKey(User)
    submitted_at: DateTimeField(auto_now_add=True)
    approved_by: ForeignKey(User, null, blank)
    approved_at: DateTimeField(null, blank)
    document_file: FileField(upload_to="variations/", blank=True)

class VariationOrderItem(models.Model):
    variation: ForeignKey(VariationOrder, related_name="items")
    boq_item: ForeignKey(ProjectBOQItem, null, blank)
    description: TextField()
    unit: CharField(max_length=32)
    quantity_change: DecimalField()                        # +50 أو -30
    unit_price: DecimalField()
    total: DecimalField()
```

### 3.4: حساب ختامي — FinalAccount (✅)

```python
class FinalAccount(models.Model):
    project: OneToOneField(ProjectPage, related_name="final_account")
    contract_amount: DecimalField()                        # قيمة العقد الأصلي
    total_variations: DecimalField(default=0)              # إجمالي التغييرات
    revised_contract_amount: DecimalField()                # contract + variations
    total_previous_applications: DecimalField(default=0)   # إجمالي المستخلصات سابقة
    total_retention_released: DecimalField(default=0)      # حبس ضمان منصرف
    total_withholding_tax: DecimalField(default=0)         # إجمالي ضريبة خصم
    net_due: DecimalField()                                # المبلغ المتبقي
    status: CharField(choices=[draft, submitted, agreed, closed])
    closed_at: DateTimeField(null, blank)
```

---

## المرحلة 4: التوثيق الميداني — Field Documentation (✅ مكتمل — `4826054`)
**الهدف: توثيق كل ما يحدث في الموقع — أساسي لـ ISO وجودة المشاريع**

### 4.1: سجل وارد/صادر — CorrespondenceRegister (⏳)

```python
class CorrespondenceRegister(models.Model):
    DIRECTION_INCOMING = "incoming"
    DIRECTION_OUTGOING = "outgoing"
    DIRECTION_CHOICES = [...]

    project: ForeignKey(ProjectPage, related_name="correspondence")
    direction: CharField(choices=DIRECTION_CHOICES)
    reference_number: CharField(max_length=64)             # رقم المرجع
    date: DateField()
    from_entity: CharField(max_length=255)                 # من: (الاستشاري، العميل، مقاول فرعي...)
    to_entity: CharField(max_length=255)                   # إلى:
    subject: CharField(max_length=255)
    description: TextField(blank=True)
    document_file: ForeignKey(wagtaildocs.Document, null, blank)
    received_by: ForeignKey(User, null, blank)
    response_due_date: DateField(null, blank)
    status: CharField(choices=[pending_reply, replied, closed])
    responded_at: DateTimeField(null, blank)
    response_ref: CharField(max_length=64, blank=True)
```

### 4.2: محاضر اجتماعات — MeetingMinutes

```python
class MeetingMinutes(models.Model):
    project: ForeignKey(ProjectPage, related_name="meeting_minutes")
    meeting_number: CharField(max_length=32)
    meeting_date: DateField()
    meeting_type: CharField(choices=[site, progress, technical, coordination, safety])
    location: CharField(max_length=255, blank=True)
    chairperson: CharField(max_length=255)
    attendees: TextField()                                  # الحاضرون
    apologies: TextField(blank=True)                        # المعتذرون
    minutes_by: CharField(max_length=255)                   # محرر المحضر

    # النقاش
    summary: TextField(blank=True)

    status: CharField(choices=[draft, reviewed, approved])
    document_file: FileField(upload_to="meeting_minutes/", blank=True)

class MeetingActionItem(models.Model):
    meeting: ForeignKey(MeetingMinutes, related_name="action_items")
    item_number: CharField(max_length=16)
    description: TextField()
    responsible: CharField(max_length=255)                  # المسؤول
    due_date: DateField(null, blank)
    status: CharField(choices=[open, in_progress, completed, closed])
    completed_at: DateTimeField(null, blank)
```

### 4.3: تقارير يومية — DailySiteReport

```python
class DailySiteReport(models.Model):
    project: ForeignKey(ProjectPage, related_name="daily_reports")
    date: DateField()
    weather: CharField(max_length=64, blank=True)
    temperature: CharField(max_length=16, blank=True)

    # العمالة
    total_workers: PositiveIntegerField(default=0)
    workers_breakdown: JSONField(default=dict, blank=True)   # مثلاً: {"نجارين": 5, "حدادين": 3}

    # المعدات
    equipment_used: TextField(blank=True)
    equipment_hours: JSONField(default=dict, blank=True)

    # الإنجاز
    work_done_summary: TextField()
    quantities_executed: TextField(blank=True)               # كميات منفذة
    materials_received: TextField(blank=True)

    # المشاكل
    issues_encountered: TextField(blank=True)
    delays: TextField(blank=True)
    safety_observations: TextField(blank=True)

    # الخطة
    plan_for_next_day: TextField()

    photos: ManyToManyField(wagtailimages.Image, blank=True)
    submitted_by: ForeignKey(User)
    submitted_at: DateTimeField(auto_now_add=True)
```

### 4.4: مذكرة استلام مواد — MaterialDeliveryNote (GRN)

```python
class MaterialDeliveryNote(models.Model):
    purchase_order: ForeignKey(PurchaseOrder, null, blank)
    project: ForeignKey(ProjectPage, related_name="delivery_notes")
    delivery_date: DateField()
    supplier: ForeignKey(Supplier)
    vehicle_plate: CharField(max_length=32, blank=True)
    driver_name: CharField(max_length=255, blank=True)
    notes: TextField(blank=True)
    received_by: ForeignKey(User)
    created_at: DateTimeField(auto_now_add=True)

class MaterialDeliveryNoteItem(models.Model):
    note: ForeignKey(MaterialDeliveryNote, related_name="items")
    inventory_item: ForeignKey(InventoryItem, null, blank)
    description: CharField(max_length=255)
    quantity: DecimalField(max_digits=14, decimal_places=3)
    unit: CharField(max_length=32)
    unit_price: DecimalField(max_digits=12, decimal_places=2)
    total: DecimalField(max_digits=14, decimal_places=2)
```

### 4.5: طلب معلومات — Request For Information (RFI)

```python
class RFI(models.Model):
    project: ForeignKey(ProjectPage, related_name="rfis")
    rfi_number: CharField(max_length=32)
    subject: CharField(max_length=255)
    question: TextField()
    category: CharField(choices=[design, specification, site_condition, material, other])
    priority: CharField(choices=[low, medium, high, urgent], default="medium")
    status: CharField(choices=[open, answered, closed], default="open")
    submitted_to: CharField(max_length=255)                 # إلى: الاستشاري / المهندس
    submitted_by: ForeignKey(User)
    submitted_at: DateTimeField(auto_now_add=True)
    response: TextField(blank=True)
    responded_by: CharField(max_length=255, blank=True)
    responded_at: DateTimeField(null, blank)
    days_to_respond: PositiveIntegerField(default=0)
    document_file: FileField(upload_to="rfis/", blank=True)
```

### 4.6: مخالفات جودة — Non-Conformance Report (NCR)

```python
class NCR(models.Model):
    SEVERITY_MINOR = "minor"
    SEVERITY_MAJOR = "major"
    SEVERITY_CRITICAL = "critical"
    SEVERITY_CHOICES = [...]

    project: ForeignKey(ProjectPage, related_name="ncrs")
    ncr_number: CharField(max_length=32)
    date: DateField()
    location: CharField(max_length=255)
    severity: CharField(choices=SEVERITY_CHOICES)
    description: TextField()
    clause_ref: CharField(max_length=64, blank=True)       # مرجع المواصفة
    status: CharField(choices=[open, action_taken, closed])
    raised_by: ForeignKey(User)
    corrective_action: TextField(blank=True)
    action_deadline: DateField(null, blank)
    closed_by: ForeignKey(User, null, blank, related_name="ncr_closed")
    closed_at: DateTimeField(null, blank)
    photos: ManyToManyField(wagtailimages.Image, blank=True)
```

### 4.7: مذكرة تسليم مستندات — Submittal

```python
class Submittal(models.Model):
    project: ForeignKey(ProjectPage, related_name="submittals")
    submittal_number: CharField(max_length=32)
    title: CharField(max_length=255)
    category: CharField(choices=[material_sample, shop_drawing, method_statement, test_report, certificate])
    status: CharField(choices=[submitted, under_review, approved, approved_with_comments, rejected])
    submitted_to: CharField(max_length=255)                 # الاستشاري / العميل
    submitted_by: ForeignKey(User)
    submitted_at: DateTimeField(auto_now_add=True)
    response: TextField(blank=True)
    responded_at: DateTimeField(null, blank)
    document_file: ForeignKey(wagtaildocs.Document, null, blank)
```

---

## المرحلة 5: HR متكامل — Human Resources (✅ مكتمل — `ba8e793`)
**الهدف: إدارة كاملة للموظفين والعمال حسب قانون العمل الفلسطيني**

> **تم التنفيذ:**
> - إضافة نماذج `LeaveRequest`، `EmployeeContract`، `OvertimeRecord`، `SocialSecurityRecord`
> - تحديث `WorkerPayrollEntry` بحقول `overtime_amount`، `allowances`، `deductions`، `net_salary` وطريقة `calculate_net_salary()`
> - إنشاء migration `0032_workerpayrollentry_allowances_and_more.py`
> - إضافة endpoints كاملة في `website/api/admin_hr.py` للإجازات (CRUD + approve/reject + رصيد)، العقود، الوقت الإضافي، التأمينات
> - ربط المسارات في `contracting_site/urls.py`
> - بناء واجهة React متكاملة في `frontend/samarqand/src/react-app/pages/control/HR.tsx` مع API client `hr.ts`
> - ربط الصفحة في `App.tsx` وشريط التنقل في `ControlLayout.tsx`
> - بناء static assets واجتياز CI: ruff/black/mypy/django check/makemigrations

### 5.1: الإجازات — LeaveRequest (⏳)

```python
class LeaveRequest(models.Model):
    LEAVE_ANNUAL = "annual"          # إجازة سنوية
    LEAVE_SICK = "sick"              # إجازة مرضية
    LEAVE_EMERGENCY = "emergency"    # إجازة طارئة
    LEAVE_MATERNITY = "maternity"    # إجازة أمومة
    LEAVE_HAJJ = "hajj"              # إجازة حج
    LEAVE_UNPAID = "unpaid"          # إجازة بدون راتب
    LEAVE_CHOICES = [...]

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [...]

    worker: ForeignKey(Worker, related_name="leave_requests")
    leave_type: CharField(choices=LEAVE_CHOICES)
    start_date: DateField()
    end_date: DateField()
    total_days: PositiveIntegerField()                      # تحسب أوتوماتيك
    reason: TextField(blank=True)
    status: CharField(choices=STATUS_CHOICES, default=STATUS_PENDING)
    approved_by: ForeignKey(User, null, blank)
    approved_at: DateTimeField(null, blank)
    created_by: ForeignKey(User)
    created_at: DateTimeField(auto_now_add=True)
```

**API:**
- `api/admin/hr/leave-requests/` — CRUD + approve/reject
- `api/admin/hr/leave-balance/<worker_id>/` — رصيد الإجازات المتبقي

### 5.2: عقود الموظفين — EmployeeContract

```python
class EmployeeContract(models.Model):
    worker: ForeignKey(Worker, related_name="contracts")
    contract_number: CharField(max_length=64)
    contract_type: CharField(choices=[full_time, part_time, fixed_term, seasonal])
    start_date: DateField()
    end_date: DateField(null, blank)
    basic_salary: DecimalField()
    transportation_allowance: DecimalField(default=0)
    housing_allowance: DecimalField(default=0)
    position: CharField(max_length=255)
    department: CharField(max_length=255, blank=True)
    probation_period_days: PositiveIntegerField(default=90)
    is_active: BooleanField(default=True)
    document_file: FileField(upload_to="contracts/employee/", blank=True)
```

### 5.3: ساعات إضافية — Overtime

```python
class OvertimeRecord(models.Model):
    worker: ForeignKey(Worker, related_name="overtime")
    project: ForeignKey(ProjectPage, null, blank)
    date: DateField()
    hours: DecimalField(max_digits=5, decimal_places=2)
    multiplier: DecimalField(default=1.5)                   # 1.25 يوم عادي، 1.50 جمعة، 2.00 عطلة
    amount: DecimalField()                                   # hours × hourly_rate × multiplier
    approved: BooleanField(default=False)
    approved_by: ForeignKey(User, null, blank)
```

### 5.4: التأمين الاجتماعي — SocialSecurity

```python
class SocialSecurityRecord(models.Model):
    worker: ForeignKey(Worker, related_name="social_security")
    year: PositiveIntegerField()
    month: PositiveIntegerField()
    gross_salary: DecimalField()
    employee_share: DecimalField()                           # نسبة الموظف (7.5%)
    employer_share: DecimalField()                           # نسبة الشركة (7.5% أو 12.5%)
    total: DecimalField()                                    # employee + employer
    paid: BooleanField(default=False)
    paid_date: DateField(null, blank)
```

### 5.5: كشف رواتب كامل — Payroll Slip

إضافة لـ WorkerPayrollEntry الموجود:
- إضافة حقل `overtime_amount` (Decimal)
- إضافة حقل `deductions` (JSON) — تفصيل الخصومات: ضريبة دخل، تأمين اجتماعي، سلف، غياب
- إضافة حقل `allowances` (JSON) — بدل النقل/السكن/خطورة
- إضافة حقل `net_salary` (Decimal)
- تحديث API توليد الرواتب لحساب كل هذه البنود

---

## المرحلة 6: إدارة المركبات — Fleet Management (✅ مكتمل — `564c01e`)
**الهدف: تتبع كل مركبة في أسطول الشركة**

> **تم التنفيذ:**
> - إضافة نماذج `Vehicle`، `FuelLog`، `VehicleMaintenance` في `website/models/operations.py`
> - migration `0033_vehicle_fuellog_vehiclemaintenance.py`
> - إنشاء `website/api/admin_fleet.py` مع endpoints CRUD للمركبات والوقود والصيانة
> - ربط المسارات في `contracting_site/urls.py`
> - بناء واجهة React في `frontend/samarqand/src/react-app/pages/control/Fleet.tsx` مع API client `fleet.ts`
> - ربط الصفحة في `App.tsx` وشريط التنقل في `ControlLayout.tsx`

### 6.1: المركبات — Vehicle (✅)

```python
class Vehicle(models.Model):
    VEHICLE_TRUCK = "truck"
    VEHICLE_PICKUP = "pickup"
    VEHICLE_SEDAN = "sedan"
    VEHICLE_BUS = "bus"
    VEHICLE_FORKLIFT = "forklift"
    VEHICLE_TRAILER = "trailer"
    VEHICLE_HEAVY = "heavy_equipment"
    VEHICLE_CHOICES = [...]

    STATUS_AVAILABLE = "available"
    STATUS_IN_USE = "in_use"
    STATUS_MAINTENANCE = "maintenance"
    STATUS_OUT_OF_SERVICE = "out_of_service"
    STATUS_RETIRED = "retired"
    STATUS_CHOICES = [...]

    name: CharField(max_length=255)
    plate_number: CharField(max_length=32, unique=True)
    vehicle_type: CharField(choices=VEHICLE_CHOICES)
    brand: CharField(max_length=128, blank=True)
    model: CharField(max_length=128, blank=True)
    year: PositiveIntegerField(null, blank)
    color: CharField(max_length=64, blank=True)
    chassis_number: CharField(max_length=64, blank=True)
    engine_number: CharField(max_length=64, blank=True)
    status: CharField(choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    assigned_to: ForeignKey(Worker, null, blank, related_name="assigned_vehicles")
    current_project: ForeignKey(ProjectPage, null, blank)
    insurance_expiry: DateField(null, blank)
    registration_expiry: DateField(null, blank)
    fuel_type: CharField(max_length=32, blank=True)
    tank_capacity_liters: DecimalField(null, blank, max_digits=8, decimal_places=1)
    notes: TextField(blank=True)
```

### 6.2: سجل الوقود — FuelLog

```python
class FuelLog(models.Model):
    vehicle: ForeignKey(Vehicle, related_name="fuel_logs")
    date: DateField()
    liters: DecimalField(max_digits=10, decimal_places=2)
    cost: DecimalField(max_digits=12, decimal_places=2)
    odometer_km: PositiveIntegerField(null, blank)
    station: CharField(max_length=255, blank=True)
    receipt_image: ImageField(null, blank)
    filled_by: ForeignKey(Worker, null, blank)
    notes: TextField(blank=True)
```

### 6.3: سجل الصيانة — VehicleMaintenance

```python
class VehicleMaintenance(models.Model):
    MAINTENANCE_OIL = "oil_change"
    MAINTENANCE_TIRES = "tires"
    MAINTENANCE_REPAIR = "repair"
    MAINTENANCE_INSPECTION = "inspection"
    MAINTENANCE_INSURANCE = "insurance"
    MAINTENANCE_REGISTRATION = "registration"
    MAINTENANCE_OTHER = "other"
    MAINTENANCE_CHOICES = [...]

    vehicle: ForeignKey(Vehicle, related_name="maintenance_logs")
    date: DateField()
    type: CharField(choices=MAINTENANCE_CHOICES)
    description: TextField()
    cost: DecimalField(max_digits=12, decimal_places=2)
    odometer_km: PositiveIntegerField(null, blank)
    next_due_date: DateField(null, blank)
    garage: CharField(max_length=255, blank=True)
    receipt_image: ImageField(null, blank)
    notes: TextField(blank=True)
```

---

## المرحلة 7: تحسين الموجود — Improvements (✅ مكتمل — `564c01e`)
**الهدف: رفع جودة الكود والبنية التحتية**

> **تم التنفيذ:**
> - إنشاء `website/tests/` مع `test_models.py` و `test_api_fleet.py` — جميعها تمر عبر `python manage.py test`
> - إنشاء `.github/workflows/ci.yml` يشغل ruff/black/mypy/django checks/makemigrations/tests و frontend lint/build
> - إضافة `Dockerfile` و `docker-compose.yml` (PostgreSQL + Django + Redis)
> - تصحيح كل إنذارات `eslint` (ControlLayout/FieldDocs/HR/Fleet)
> - جميع فحوصات CI خضراء محلياً

### 7.1: Tests (✅)

```
website/tests/
├── __init__.py
├── test_models.py           # اختبار إنشاء النماذج الأساسية
└── test_api_fleet.py        # اختبار endpoints المركبات
```

### 7.2: CI & DevOps (✅)

- `.github/workflows/ci.yml` يشغل backend و frontend checks
- `Dockerfile` + `docker-compose.yml` جاهزان للتشغيل

### 7.3: تصحيح إنذارات ruff/mypy/eslint (✅)

- `ruff check .` خالٍ من الأخطاء
- `mypy --show-error-codes .` ناجح
- `npm run lint` خالٍ من الأخطاء والتحذيرات

---

## إصلاح: صفحة الدخول والـ CSRF في التطوير (✅ مكتمل — `bdd23b4`)

**المشكلة:**
- `/control/login` كانت صفحة بيضاء بسبب `ReferenceError: Cannot access 'canFieldDocs' before initialization` في `ControlLayout.tsx`.
- بعد إصلاح العرض، تسجيل الدخول عبر Vite proxy كان يرجع `403 Origin checking failed` لأن منافذ التطوير غير مدرجة في `CSRF_TRUSTED_ORIGINS`.

**الحل:**
- إزالة `canFieldDocs` من مصفوفة اعتماديات `useEffect` واستخدام `canBoq` المحسوب محلياً.
- إضافة `CSRF_TRUSTED_ORIGINS` في `contracting_site/settings/dev.py` لـ `127.0.0.1:8000/5173` و `localhost:8000/5173`.
- إعادة بناء أصول SPA وإزالة الملف المُحَزَّم القديم.
- إضافة `run_local.ps1` لتشغيل backend + frontend معاً.

**التحقق:**
- Playwright: فتح `/control/login` ← تسجيل الدخول كـ `admin` ← التوجيه إلى `/control/dashboard` بنجاح.
- Frontend: `npm run lint` و `npm run build` نظيفان.
- Backend: `ruff check .`, `black --check .`, `mypy --show-error-codes .`, `django check`, `makemigrations --check`, `python manage.py test` جميعها خضراء.

---

## تنظيم القالب والتحقق منه (✅ مكتمل — `4d50ac7`)

**المشكلة:**
- القالب كان مزدحمًا: روابط سريعة مكدسة في الهيدر، شريط جانبي طويل بمسارات، صندوق "وصول سريع" مكرر في المحتوى.
- تنبيهات لوحة التحكم كانت نصوصًا مشوهة (mojibake).
- صفحة `/control/fleet` كانت بيضاء بسبب خطأ `Cannot access 'showError' before initialization`.
- favicon 404.

**الحل:**
- إعادة تصميم `ControlLayout.tsx`: هيدر نظيف يحتوي على الشعار ومعلومات المستخدم فقط، شريط اختصارات منفصل أسفل الهيدر، شريط جانبي مرتب بدون مسارات، وإزالة الصندوق المكرر.
- تصحيح النصوص العربية في `admin_summary`.
- نقل تعريف `showError`/`showSuccess` قبل استخدامهما في `Fleet.tsx`.
- إنشاء favicon واحترافي للمشروع.
- إعادة بناء أصول SPA.

**التحقق:**
- Playwright جرب جميع روابط `/control/*` الرئيسية: كلها تُعرض بدون أخطاء JavaScript.
- جميع فحوصات CI خضراء.

---

## ملخص الجدول الزمني المقترح

| المرحلة | المحتوى | الوقت التقريبي |
|---------|---------|---------------|
| 0 | Fix Critical Bugs | 1-2 ساعات |
| 1A | Split models.py | 2-3 ساعات |
| 1B | Split api_views.py | 3-5 ساعات |
| 1C | Gunicorn config | 15 دقيقة |
| 2 | Accounting System | 1-2 أسبوع |
| 3 | BOQ & Payment Applications | 3-5 أيام |
| 4 | Field Documentation | 3-5 أيام |
| 5 | HR Integrated | 2-3 أيام |
| 6 | Fleet Management | 1-2 أيام |
| 7 | Tests & DevOps | 3-5 أيام |

**المراحل 0 + 1 + 2 هي الأساس. بدونهم، النظام ناقص ومش مهني.**

---

## ملاحظات فنية مهمة

### نمط التسمية
- كل الموديلات الجديدة تكتب بالإنجليزية مع `verbose_name` و `verbose_name_plural` بالعربي
- الـ API endpoints بنمط: `api/admin/accounts/accounts/`، `api/admin/hr/leave-requests/`
- تابع نمط `api_views.py` الحالي: function-based views مع `require_GET` / `require_POST`

### Migration strategy
- كل Phase تنتهي بـ `python manage.py makemigrations && python manage.py migrate`
- التأكد من أن الـ migrations الجديدة لا تتعارض مع الموجودة
- اختبار الـ backwards migration

### Git workflow
- كل مرحلة = commit منفصل
- Commit message: `phase-0: fix timezone and language settings`
- الدفع بعد كل مرحلة مكتملة ومختبرة
