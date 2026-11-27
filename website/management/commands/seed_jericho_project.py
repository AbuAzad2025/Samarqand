"""Seed the genuine Jericho Rest House project from committed WebP assets.

Idempotent: safe to run again on another environment.
"""

from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from wagtail.images import get_image_model
from wagtail.models import Site

from website.models import ProjectGalleryImage
from website.models import ProjectPage

BUDGET = Decimal("2000000")
TIMELINE = """2026-10-01 | التأسيس والهياكل | توريد البلاط، وتسليح الجسر الجنوبي للقاعة، وتصفيح الأعمدة تمهيداً لصب الخرسانة.
2026-10-08 | القصارة والواجهات | بدء القصارة للوجه الأساسي واستكمال قواطع الطوب والشبكات المعدنية.
2026-10-12 | التمديدات والوحدة الصحية | حفر وتأسيس المواسير وبناء جدران وحدة الجمارك وتجهيز الوحدة الصحية الجنوبية.
2026-10-17 | التبليط والقصارة الداخلية | تركيب بلاط الأرضيات والقصارة الخشنة للقواطع وأعمال الطوب.
2026-10-25 | تشطيب الواجهات والقاعة | القصارة والبطانة للواجهات وداخل القاعة ووحدة الجمارك.
2026-11-03 | التبليط والأساسات الكهربائية | تبليط الأرضيات والجدران وتأسيس الكهرباء والمعلومات.
2026-11-09 | إغلاق الفتحات والمظلة الحديدية | إغلاق الفتحات القديمة وتركيب الأعمدة والجسور الفولاذية للمظلة الجنوبية.
2026-11-18 | التشطيبات النهائية | القصارة والمعجونة والدهان والأسقف المستعارة والإنترلوك وأطر الأبواب والنوافذ.
"""

IMAGES = [
    ("cover.webp", "أعمال الحفر والتأسيس لقاعة الوصول"),
    ("site.webp", "موقع العمل خلال مرحلة التأسيس"),
    ("steel.webp", "تجهيز الوحدة الصحية لصب الخرسانة"),
    ("canopy.webp", "تركيب هياكل المظلة الحديدية الجنوبية"),
    ("finishes.webp", "استكمال أعمال البلاط لأرضية القاعة"),
]


class Command(BaseCommand):
    help = (
        "Add the genuine Jericho Hall rehabilitation project with its photos."
    )

    def handle(self, *args, **options):
        Image = get_image_model()
        folder = (
            Path(settings.BASE_DIR)
            / "website"
            / "static"
            / "website"
            / "images"
            / "jericho"
        )

        saved = []
        for filename, caption in IMAGES:
            path = folder / filename
            if not path.exists():
                self.stderr.write(f"missing asset: {path}")
                continue
            title = f"أريحا - {caption}"
            image = Image.objects.filter(title=title).first()
            if not image:
                with path.open("rb") as fh:
                    image = Image(
                        title=title, file=File(fh, name=f"jericho-{filename}")
                    )
                    image.save()
            saved.append((image, caption))

        root = Site.objects.get(is_default_site=True).root_page
        index = root.get_children().live().filter(slug="projects").first()
        if not index:
            self.stderr.write("projects index missing")
            return

        page = ProjectPage.objects.filter(slug="jericho-hall").first()
        if page:
            self.stdout.write(f"already exists: {page.id} {page.title}")
            return

        page = ProjectPage(
            title="تأهيل قاعة الوصول - استراحة أريحا",
            slug="jericho-hall",
            short_description="مشروع جاري لتأهيل قاعة الوصول في استراحة أريحا",
            status=ProjectPage.STATUS_ONGOING,
            pmp_phase=ProjectPage.PHASE_EXECUTING,
            project_location="أريحا",
            budget_amount=BUDGET,
            management_notes=TIMELINE,
            scope_statement=(
                "أعمال تأهيل قاعة الوصول تشمل الحفر والتأسيس، وتسليح الأعمدة والوحدة الصحية، "
                "وأعمال البلاط والقصارة والدهان، وتمديدات التكييف والكهرباء، وتركيب المظلات الحديدية."
            ),
        )
        index.add_child(instance=page)
        for order, (image, caption) in enumerate(saved):
            ProjectGalleryImage.objects.create(
                page=page, image=image, caption=caption, sort_order=order
            )
        page.save_revision().publish()
        page.move(index, pos="first-child")
        self.stdout.write(
            f"created: {page.id} {page.title} ({len(saved)} images)"
        )
