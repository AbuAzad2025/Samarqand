import os
import shutil
import subprocess
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default="",
            help="Path to the سمرقند frontend project (folder containing package.json).",
        )
        parser.add_argument(
            "--skip-install",
            action="store_true",
            help="Skip npm install.",
        )

    def handle(self, *args, **options):
        project_root = Path(__file__).resolve().parents[3]
        default_source = project_root / "frontend" / "samarqand"
        source = Path(options["source"]).resolve() if options["source"] else default_source

        package_json = source / "package.json"
        if not package_json.exists():
            raise SystemExit(f"package.json not found at: {package_json}")

        npm = shutil.which("npm") or shutil.which("npm.cmd") or "npm.cmd"
        npx = shutil.which("npx") or shutil.which("npx.cmd") or "npx.cmd"

        env = os.environ.copy()
        env.setdefault("NODE_OPTIONS", "--max-old-space-size=4096")
        env.setdefault("NODE_ENV", "development")
        env.setdefault("NPM_CONFIG_PRODUCTION", "false")

        if not options["skip_install"]:
            self.stdout.write("Installing frontend dependencies...")
            subprocess.run(
                [npm, "install", "--include=dev", "--legacy-peer-deps"],
                cwd=str(source),
                check=True,
                env=env,
            )

        target = project_root / "website" / "static" / "website" / "samarqand_spa"
        target.parent.mkdir(parents=True, exist_ok=True)

        self.stdout.write("Building frontend...")
        subprocess.run(
            [
                npx,
                "vite",
                "build",
                "--outDir",
                str(target),
                "--emptyOutDir",
            ],
            cwd=str(source),
            check=True,
            env=env,
        )

        self.stdout.write(self.style.SUCCESS(f"Synced SPA to: {target}"))
