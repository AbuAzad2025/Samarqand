"""Replace demonstration homepage figures with verified counts.

Run after seeding a fresh database; idempotent.
"""

from django.core.management.base import BaseCommand

from website.models import HomeAIMetric
from website.models import HomeStat
from website.models import ProjectPage
from website.models import TeamMember
from website.models import Testimonial

TRUTH = [
    ("مشروعاً", str(ProjectPage.objects.live().count())),
    ("عضواً في الفريق", str(TeamMember.objects.count())),
    ("رأي عميل", str(Testimonial.objects.count())),
    ("يوماً عمل موثقاً", "70"),
]


class Command(BaseCommand):
    help = "Set homepage statistics from verified database/project data."

    def handle(self, *args, **options):
        rows = list(HomeStat.objects.order_by("sort_order", "id"))
        for index, (label, value) in enumerate(TRUTH):
            if index < len(rows):
                row = rows[index]
                row.label = label
                row.value = value
                row.save(update_fields=["label", "value"])
            else:
                HomeStat.objects.create(
                    sort_order=index, label=label, value=value
                )
        self.stdout.write(f"updated {len(TRUTH)} statistics")

        removed = HomeAIMetric.objects.count()
        HomeAIMetric.objects.all().delete()
        self.stdout.write(f"removed {removed} unverified AI metrics")
