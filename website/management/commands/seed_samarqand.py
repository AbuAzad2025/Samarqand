import json
from pathlib import Path

from coderedcms.models.wagtailsettings_models import LayoutSettings
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from wagtail.models import Page
from wagtail.models import Site

from website.models import AIContentGeneratorPage
from website.models import AIDesignAnalyzerPage
from website.models import AISettings
from website.models import ArchitecturalVisualizerPage
from website.models import CalculatorSettings
from website.models import CompanySettings
from website.models import ConstructionCalculatorPage
from website.models import ContactPage
from website.models import FormPageField
from website.models import HomeAIFeature
from website.models import HomeAIMetric
from website.models import HomePageSettings
from website.models import HomeStat
from website.models import HomeTimelineStep
from website.models import HomeTrustBadge
from website.models import ProjectIndexPage
from website.models import ProjectPage
from website.models import QuoteRequestPage
from website.models import ServiceIndexPage
from website.models import ServicePage
from website.models import TeamMember
from website.models import Testimonial
from website.models import ToolsIndexPage
from website.models import WebPage


def _unique_child_slug(parent: Page, base_slug: str) -> str:
    base_slug = (base_slug or "item").strip("-")[:60]
    existing = set(parent.get_children().values_list("slug", flat=True))
    if base_slug not in existing:
        return base_slug
    for i in range(2, 500):
        candidate = f"{base_slug}-{i}"
        if candidate not in existing:
            return candidate
    return f"{base_slug}-x"


def _get_or_create_child(parent: Page, model, slug: str, title: str):
    existing = parent.get_children().filter(slug=slug).first()
    if existing:
        return existing.specific
    page = model(title=title, slug=slug)
    parent.add_child(instance=page)
    page.save_revision().publish()
    return page


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            "--data",
            default=str(
                Path(__file__).resolve().parents[3]
                / "website"
                / "seed_data"
                / "samarqand_profile.json"
            ),
        )

    def handle(self, *args, **options):
        data_path = Path(options["data"]).resolve()
        payload = json.loads(data_path.read_text(encoding="utf-8"))

        site = Site.objects.filter(is_default_site=True).first()
        if not site:
            raise SystemExit("Default site not found.")

        home = site.root_page.specific
        if not isinstance(home, WebPage):
            home = WebPage.objects.get(pk=home.pk)

        services_index = _get_or_create_child(home, ServiceIndexPage, "services", "الخدمات")
        projects_index = _get_or_create_child(home, ProjectIndexPage, "projects", "المشاريع")
        about_page = _get_or_create_child(home, WebPage, "about", "من نحن")
        contact_page = _get_or_create_child(home, ContactPage, "contact", "اتصل بنا")
        quote_page = _get_or_create_child(home, QuoteRequestPage, "request-quote", "طلب عرض سعر")
        tools_index = _get_or_create_child(home, ToolsIndexPage, "tools", "الأدوات الذكية")
        _get_or_create_child(
            tools_index, AIDesignAnalyzerPage, "ai-design-analyzer", "محلل التصاميم بالذكاء الاصطناعي"
        )
        _get_or_create_child(
            tools_index, ConstructionCalculatorPage, "construction-calculator", "حاسبة الكميات والتكاليف"
        )
        _get_or_create_child(
            tools_index, ArchitecturalVisualizerPage, "architectural-visualizer", "تخيل مشروعك قبل البناء"
        )
        _get_or_create_child(
            tools_index, AIContentGeneratorPage, "ai-content-generator", "مولّد المحتوى التسويقي بالذكاء الاصطناعي"
        )

        if not Page.objects.child_of(services_index).type(ServicePage).exists():
            services_seed = [
                (
                    "المقاولات العامة",
                    "تنفيذ مشاريع البناء والتشييد من الأساس حتى التسليم النهائي",
                    "general-contracting",
                ),
                (
                    "الاستشارات الهندسية",
                    "تقديم الاستشارات الهندسية المتخصصة لجميع أنواع المشاريع",
                    "engineering-consulting",
                ),
                (
                    "التصاميم المعمارية",
                    "تصميم مخططات معمارية عملية وجمالية وفق احتياجاتك",
                    "architectural-design",
                ),
            ]
            for title, desc, slug in services_seed:
                page = ServicePage(
                    title=title,
                    slug=_unique_child_slug(services_index, slug),
                    short_description=desc,
                )
                services_index.add_child(instance=page)
                page.save_revision().publish()

        if not Page.objects.child_of(projects_index).type(ProjectPage).exists():
            projects_seed = [
                (
                    "مشروع سكني",
                    "تنفيذ مشروع سكني بمعايير جودة عالية",
                    "فئة سكني",
                    "فلسطين",
                    2024,
                    "residential-project",
                ),
                (
                    "مشروع تجاري",
                    "تشطيب وتنفيذ مشروع تجاري وفق أفضل الممارسات",
                    "فئة تجاري",
                    "فلسطين",
                    2023,
                    "commercial-project",
                ),
                (
                    "ترميم وتجديد",
                    "ترميم مبنى قائم وتحسين الواجهات والتشطيبات",
                    "فئة ترميم",
                    "فلسطين",
                    2022,
                    "renovation-project",
                ),
            ]
            for title, desc, client, location, year, slug in projects_seed:
                page = ProjectPage(
                    title=title,
                    slug=_unique_child_slug(projects_index, slug),
                    short_description=desc,
                    client_name=client,
                    project_location=location,
                    completion_year=year,
                )
                projects_index.add_child(instance=page)
                page.save_revision().publish()

        company = payload.get("company", {})
        company_settings = CompanySettings.for_site(site)
        company_settings.name = company.get("name") or company_settings.name
        company_settings.slogan = company.get("slogan", company_settings.slogan)
        company_settings.description = company.get("description", company_settings.description)
        company_settings.founded_year = company.get("founded_year")
        company_settings.headquarters = company.get("headquarters", company_settings.headquarters)
        company_settings.address = company.get("address", company_settings.address)
        company_settings.founders = "، ".join(company.get("founders") or [])
        company_settings.classification = company.get(
            "classification", company_settings.classification
        )
        company_settings.registration_status = company.get(
            "registration_status", company_settings.registration_status
        )
        company_settings.chamber_membership = company.get(
            "chamber_membership", company_settings.chamber_membership
        )
        company_settings.mission = company.get("mission", company_settings.mission)
        company_settings.vision = company.get("vision_2024", company_settings.vision)

        contact = company.get("contact", {})
        company_settings.email = contact.get("email", company_settings.email)
        phones = contact.get("phones") or []
        if phones:
            company_settings.phone_1 = phones[0]
        if len(phones) > 1:
            company_settings.phone_2 = phones[1]
        company_settings.fax = contact.get("fax", company_settings.fax)
        company_settings.topbar_slogan = company.get(
            "topbar_slogan", company_settings.topbar_slogan
        )
        company_settings.footer_about = company.get(
            "footer_about", company_settings.footer_about
        )
        company_settings.brand_subtitle = company.get(
            "brand_subtitle", company_settings.brand_subtitle
        )
        company_settings.save()

        layout_settings = LayoutSettings.for_site(site)
        if company_settings.email:
            layout_settings.from_email_address = company_settings.email
        layout_settings.save()

        to_email = (company_settings.email or "").strip()
        if to_email:
            contact_page.to_address = to_email
            contact_page.subject = "رسالة تواصل من الموقع"
            contact_page.save_revision().publish()

            quote_page.to_address = to_email
            quote_page.subject = "طلب عرض سعر من الموقع"
            quote_page.save_revision().publish()

        if not contact_page.form_fields.exists():
            contact_page.form_fields.add(
                FormPageField(
                    label="الاسم",
                    required=True,
                    field_type="singleline",
                )
            )
            contact_page.form_fields.add(
                FormPageField(
                    label="البريد الإلكتروني",
                    required=True,
                    field_type="email",
                )
            )
            contact_page.form_fields.add(
                FormPageField(
                    label="رقم الهاتف",
                    required=False,
                    field_type="singleline",
                )
            )
            contact_page.form_fields.add(
                FormPageField(
                    label="الرسالة",
                    required=True,
                    field_type="multiline",
                )
            )
            contact_page.save_revision().publish()

        if not quote_page.form_fields.exists():
            quote_page.form_fields.add(
                FormPageField(
                    label="الاسم",
                    required=True,
                    field_type="singleline",
                )
            )
            quote_page.form_fields.add(
                FormPageField(
                    label="البريد الإلكتروني",
                    required=True,
                    field_type="email",
                )
            )
            quote_page.form_fields.add(
                FormPageField(
                    label="رقم الهاتف",
                    required=False,
                    field_type="singleline",
                )
            )
            quote_page.form_fields.add(
                FormPageField(
                    label="نوع المشروع",
                    required=True,
                    field_type="dropdown",
                    choices="منزل سكني\nفيلا\nعمارة سكنية\nمبنى تجاري\nمحل تجاري\nمكتب\nمستودع",
                )
            )
            quote_page.form_fields.add(
                FormPageField(
                    label="المساحة (متر مربع)",
                    required=True,
                    field_type="number",
                )
            )
            quote_page.form_fields.add(
                FormPageField(
                    label="عدد الطوابق",
                    required=False,
                    field_type="number",
                    default_value="1",
                )
            )
            quote_page.form_fields.add(
                FormPageField(
                    label="تفاصيل إضافية",
                    required=False,
                    field_type="multiline",
                )
            )
            quote_page.save_revision().publish()

        contact_email_field = contact_page.form_fields.filter(field_type="email").first()
        if contact_email_field:
            contact_page.reply_address = "{{ " + contact_email_field.clean_name + " }}"
            contact_page.save_revision().publish()

        quote_email_field = quote_page.form_fields.filter(field_type="email").first()
        if quote_email_field:
            quote_page.reply_address = "{{ " + quote_email_field.clean_name + " }}"
            quote_page.save_revision().publish()

        home_settings = HomePageSettings.for_site(site)
        home_settings.hero_title_line_1 = company.get("hero_title_line_1", home_settings.hero_title_line_1)
        home_settings.hero_title_line_2 = company.get("hero_title_line_2", home_settings.hero_title_line_2)
        home_settings.hero_lead = company.get("hero_lead", home_settings.hero_lead)
        home_settings.hero_primary_cta_label = company.get(
            "hero_primary_cta_label", home_settings.hero_primary_cta_label
        )
        if company_settings.phone_1 and not home_settings.hero_primary_cta_url:
            home_settings.hero_primary_cta_url = f"tel:{company_settings.phone_1}"
        home_settings.save()

        CalculatorSettings.for_site(site).save()
        AISettings.for_site(site).save()

        about_page.search_description = company.get("mission", "")[:255]
        about_page.save_revision().publish()

        if not HomeAIFeature.objects.exists():
            for i, item in enumerate(
                [
                    {"title": "مساعد ذكي", "description": "محادثة فورية مع AI", "badge_text": "AI"},
                    {"title": "تحليل التصميم", "description": "تقييم دقيق للمشاريع", "badge_text": "AI"},
                    {"title": "إنشاء المحتوى", "description": "محتوى احترافي سريع", "badge_text": "AI"},
                    {"title": "استجابة فورية", "description": "نتائج في ثوانٍ", "badge_text": "AI"},
                    {"title": "تحليل ذكي", "description": "توصيات مبنية على البيانات", "badge_text": "AI"},
                    {"title": "تقنية متقدمة", "description": "مدعوم بأحدث الأنظمة", "badge_text": "AI"},
                ],
                start=1,
            ):
                HomeAIFeature.objects.create(sort_order=i, **item)

        if not HomeAIMetric.objects.exists():
            for i, item in enumerate(
                [
                    {"value": "99.9%", "label": "دقة التحليل"},
                    {"value": "<2s", "label": "وقت الاستجابة"},
                    {"value": "24/7", "label": "متاح دائماً"},
                    {"value": "∞", "label": "إمكانيات لا محدودة"},
                ],
                start=1,
            ):
                HomeAIMetric.objects.create(sort_order=i, **item)

        if not HomeTrustBadge.objects.exists():
            for i, item in enumerate(
                [
                    {
                        "title": "ضمان الجودة",
                        "description": "ضمان 5 سنوات على جميع أعمالنا",
                        "icon_class": "fas fa-shield-alt",
                    },
                    {
                        "title": "معتمد ومرخص",
                        "description": "شركة مسجلة ومعتمدة رسمياً",
                        "icon_class": "fas fa-award",
                    },
                    {
                        "title": "فريق محترف",
                        "description": "طاقم من أفضل المهندسين والفنيين",
                        "icon_class": "fas fa-users",
                    },
                    {
                        "title": "رضا العملاء",
                        "description": "98% من عملائنا راضون عن خدماتنا",
                        "icon_class": "fas fa-thumbs-up",
                    },
                ],
                start=1,
            ):
                HomeTrustBadge.objects.create(sort_order=i, **item)

        if not HomeStat.objects.exists():
            for i, item in enumerate(
                [
                    {
                        "label": "مشروع منجز",
                        "value": "150+",
                        "icon_class": "fas fa-building",
                    },
                    {
                        "label": "عميل راضٍ",
                        "value": "50+",
                        "icon_class": "fas fa-users",
                    },
                    {
                        "label": "جائزة وشهادة",
                        "value": "15+",
                        "icon_class": "fas fa-award",
                    },
                    {
                        "label": "سنوات خبرة",
                        "value": "8+",
                        "icon_class": "fas fa-briefcase",
                    },
                ],
                start=1,
            ):
                HomeStat.objects.create(sort_order=i, **item)

        if not HomeTimelineStep.objects.exists():
            for i, item in enumerate(
                [
                    {
                        "title": "الاستشارة الأولية",
                        "description": "نجتمع معك لفهم رؤيتك ومتطلباتك بشكل كامل",
                        "icon_class": "fas fa-file-search",
                    },
                    {
                        "title": "التصميم والتخطيط",
                        "description": "نضع التصاميم الهندسية والمعمارية بأحدث التقنيات",
                        "icon_class": "fas fa-pen-nib",
                    },
                    {
                        "title": "التنفيذ والبناء",
                        "description": "نبدأ العمل بطواقم محترفة ومواد عالية الجودة",
                        "icon_class": "fas fa-hard-hat",
                    },
                    {
                        "title": "التسليم والضمان",
                        "description": "نسلم المشروع مع ضمان شامل ومتابعة ما بعد التسليم",
                        "icon_class": "fas fa-check-circle",
                    },
                ],
                start=1,
            ):
                HomeTimelineStep.objects.create(sort_order=i, **item)

        if not TeamMember.objects.exists():
            TeamMember.objects.create(
                sort_order=1,
                name="م. أحمد الخالدي",
                position="المدير التنفيذي",
                specialization="هندسة مدنية",
                experience="خبرة 15 سنة في إدارة المشاريع الكبرى",
            )
            TeamMember.objects.create(
                sort_order=2,
                name="م. سارة النجار",
                position="رئيسة قسم التصميم",
                specialization="هندسة معمارية",
                experience="خبرة 12 سنة في التصميم المعماري",
            )
            TeamMember.objects.create(
                sort_order=3,
                name="م. محمد السعدي",
                position="مدير المشاريع",
                specialization="إدارة وتنفيذ المشاريع",
                experience="خبرة 10 سنوات في الإشراف الهندسي",
            )

        if not Testimonial.objects.exists():
            Testimonial.objects.create(
                sort_order=1,
                name="محمد أحمد",
                project="فيلا سكنية في رام الله",
                text="تجربة ممتازة من البداية للنهاية. فريق محترف والتزام بالمواعيد والجودة عالية.",
                rating=5,
            )
            Testimonial.objects.create(
                sort_order=2,
                name="عمر خليل",
                project="مبنى تجاري في نابلس",
                text="شركة موثوقة وأسعار منافسة. أنصح بالتعامل معهم.",
                rating=5,
            )
            Testimonial.objects.create(
                sort_order=3,
                name="فاطمة يوسف",
                project="عمارة سكنية في الخليل",
                text="تصميم رائع وتنفيذ متقن. سعيدة جداً بالنتيجة النهائية.",
                rating=5,
            )

        projects_payload = payload.get("projects", {})
        completed = projects_payload.get("completed", [])
        ongoing = projects_payload.get("ongoing", [])
        all_projects = [*completed, *ongoing]

        created = 0
        updated = 0

        for item in all_projects:
            title = (item.get("title") or "").strip()
            if not title:
                continue

            base_slug = slugify(title, allow_unicode=True)[:60] or "project"
            existing = projects_index.get_children().filter(title=title).first()

            if existing:
                page = existing.specific
                updated += 1
            else:
                slug = _unique_child_slug(projects_index, base_slug)
                page = ProjectPage(title=title, slug=slug)
                projects_index.add_child(instance=page)
                created += 1

            amount = item.get("amount") or {}
            currency = (amount.get("currency") or "").strip()
            value = amount.get("value")
            amount_text = ""
            if value is not None and currency:
                amount_text = f"{value:,} {currency}".replace(",", ",")

            notes = (item.get("notes") or "").strip()
            location = (item.get("location") or "").strip()
            client = (item.get("client") or "").strip()

            short_parts = []
            if amount_text:
                short_parts.append(amount_text)
            if notes:
                short_parts.append(notes)
            page.short_description = " — ".join(short_parts)[:255]

            if location:
                page.project_location = location
            if client:
                page.client_name = client

            progress = item.get("progress_percent")
            if isinstance(progress, int):
                page.company_role = f"قيد التنفيذ ({progress}%)"

            page.save_revision().publish()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded pages. Created: {created}, Updated: {updated}. "
                f"About: /{about_page.slug}/, Services: /{services_index.slug}/, "
                f"Projects: /{projects_index.slug}/, Contact: /{contact_page.slug}/"
            )
        )
