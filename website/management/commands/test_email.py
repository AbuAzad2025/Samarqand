from django.core.mail import EmailMessage
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("--to", required=True)
        parser.add_argument("--subject", default="اختبار البريد")
        parser.add_argument(
            "--body",
            default="هذه رسالة اختبار من نظام سمرقند. إذا وصلتك فالإعدادات صحيحة.",
        )

    def handle(self, *args, **options):
        msg = EmailMessage(
            subject=str(options["subject"]),
            body=str(options["body"]),
            to=[str(options["to"])],
        )
        msg.send()
        self.stdout.write(self.style.SUCCESS("Email sent."))

