# موقع شركة سمرقند للمقاولات — نسخة محلية

مشروع Django + Wagtail (CodeRed CMS) مع واجهة أمامية React/Vite. هذا الإعداد **محلي بالكامل**: يستخدم SQLite ولا يحتاج خادم قاعدة بيانات أو خدمات خارجية.

## التشغيل السريع (Windows / PowerShell)

```powershell
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_samarqand
$env:DEMO_USERS_PASSWORD = "choose-a-strong-local-password"
python manage.py seed_demo_users
python manage.py runserver
```

ثم افتح:

- الموقع: http://127.0.0.1:8000/
- لوحة التحكم (Control SPA): http://127.0.0.1:8000/control/dashboard
- إدارة Django: http://127.0.0.1:8000/django-admin/

أو ببساطة: `.\run_local.ps1`

> قاعدة البيانات `db.sqlite3` **محلية وغير متتبعة في Git**. يتم توليدها من الـ migrations + بيانات البذر. لا تحتوي على حسابات حقيقية أو جلسات.

## الحسابات التجريبية

`python manage.py seed_demo_users` ينشئ حسابات `demo_*` (منها `demo_superadmin`). **لا توجد كلمة مرور افتراضية**؛ يجب ضبط `DEMO_USERS_PASSWORD` أو تمرير `--password`. الأوامر التجريبية ترفض العمل عند `DEBUG=False` حمايةً للنشر.

لتغيير كلمة المرور لاحقاً:

```powershell
python manage.py seed_demo_users --password YOUR_NEW_PASSWORD --reset-passwords
```

أو أنشئ مديراً عبر متغيرات البيئة `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_PASSWORD` ثم `python manage.py ensure_superuser`.

## البنية بعد إعادة الهيكلة

```
contracting_site/
  settings/           base.py + dev.py + prod.py
  urls/               مسارات API مقسّمة حسب المجال
    system.py           django-admin، robots، sitemap، docs، search
    ai.py               تحليل التصميم، توليد المحتوى، المحادثة
    auth.py             تسجيل الدخول/الخروج/كلمة المرور
    admin_content.py    المحتوى، الصفحات، الوسائط، النسخ الاحتياطي
    admin_ops.py        العملاء، العقود، المخزون، العمال، الحضور
    admin_accounts.py   المحاسبة
    admin_boq.py        جدول الكميات والدفعات
    admin_field_docs.py مراسلات الموقع، التقارير، النماذج
    admin_hr.py         الإجازات، العقود، الرواتب
    admin_fleet.py      المركبات، الوقود، الصيانة
    admin_mail.py       البريد الداخلي
    site.py             واجهات الموقع العامة + الحاسبة
    vite.py             توافق Vite في التطوير
    spa.py              مسارات الواجهة (يجب أن تبقى أخيراً)
    _views.py           دوال عرض مشتركة
website/
  api/                 دوال العرض (مقسّمة أصلاً حسب المجال)
  models/              النماذج (مقسّمة حسب المجال)
  management/commands  أوامر البذر والمزامنة
  seed_data/           البيانات الأساسية للشركة
  static/website/      أصول الواجهة والصور المحلية
  templates/           قوالب Wagtail والبريد
frontend/samarqand/   مصدر واجهة React/Vite
```

## إعادة بناء واجهة React (اختياري)

الواجهة المبنية موجودة مسبقاً في `website/static/website/samarqand_spa/`. إذا عدّلت المصدر:

```powershell
python manage.py sync_samarqand_spa
```

هذا ينفّذ `npm install` ثم `vite build` وينسخ الناتج إلى مجلد الثابتات.

## ملاحظات أمنية

- لا توجد مفاتيح أو كلمات مرور حقيقية في المستودع. القيم في `.env.example` أمثلة فقط.
- مفتاح Gemini يُقرأ من متغير البيئة `GEMINI_API_KEY` عند توفره فقط.
- SMTP/IMAP اختيارية وتُعطّل عند ترك إعداداتها فارغة.
- صور "قبل/بعد" أصبحت محلية في `website/static/website/images/` بدلاً من روابط طرف ثالث.

## النشر

هذا التطبيق يحتاج خادم Django ( راجع قسم Production deployment في الوثائق الأصلية أو استخدم `Dockerfile` + `docker-compose.yml`). **النشر الثابت على Vercel غير مدعوم**: الواجهة تعتمد على `/api/*` و`/media/*` التي يقدّمها Django، وأي إعادة توجيه شاملة إلى `index.html` ستبتلع طلبات API وتُفرغ الصفحات. لذلك أُزيل `vercel.json`.

إذا احتجت نشراً تحت مسار فرعي (sub-path)، تأكد من ضبط `STATIC_URL` و`CSRF_TRUSTED_ORIGINS` و`VITE_API_BASE_URL` وفقاً للبادئة; قالب SPA يُعيد كتابة مسارات الأصول تلقائياً عبر `STATIC_URL`.

## الاختبارات

```powershell
python manage.py test
```
