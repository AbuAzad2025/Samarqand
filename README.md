# موقع شركة سمرقند للمقاولات — نسخة محلية

مشروع Django + Wagtail (CodeRed CMS) مع واجهة أمامية React/Vite. هذا الإعداد **محلي بالكامل**: يستخدم SQLite ولا يحتاج خادم قاعدة بيانات أو خدمات خارجية.

## التشغيل السريع (Windows / PowerShell)

```powershell
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_samarqand
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

`python manage.py seed_demo_users` ينشئ حسابات `demo_*` (منها `demo_superadmin`). كلمة المرور الافتراضية `demo1234` ويمكن تغييرها عبر:

```powershell
python manage.py seed_demo_users --password YOUR_PASSWORD --reset-passwords
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

## الاختبارات

```powershell
python manage.py test
```
