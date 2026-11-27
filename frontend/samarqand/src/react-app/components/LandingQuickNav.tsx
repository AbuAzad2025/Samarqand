import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowUp, Phone } from "lucide-react";

import type { SiteConfigPayload } from "@/react-app/api/site";

const LINKS = [
  { href: "#home", label: "الرئيسية", show: true },
  { href: "#services", label: "خدماتنا", show: "showServices" },
  { href: "#projects", label: "مشاريعنا", show: "showProjects" },
  { href: "#tools", label: "الأدوات الذكية", show: "showTools" },
  { href: "#rfq-templates", label: "نماذج الأسعار", show: "showRfqTemplates" },
  { href: "#testimonials", label: "آراء العملاء", show: "showTestimonials" },
  { href: "#contact", label: "تواصل معنا", show: "showNewsletter" },
] as const;

const SECTION_IDS = LINKS.map((link) => link.href.slice(1));

export default function LandingQuickNav({
  visibility,
}: {
  visibility?: SiteConfigPayload["visibility"];
}) {
  const links = LINKS.filter(
    (link) => link.show === true || visibility?.[link.show] !== false,
  );
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("#home");

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(`#${hit.target.id}`);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="sticky top-[84px] z-30 border-y border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div
        className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 sm:px-4"
        dir="rtl"
      >
        <nav aria-label="التنقل السريع بين أقسام الصفحة" className="flex items-center gap-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={active === link.href ? "location" : undefined}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-1 sm:text-sm ${
                active === link.href
                  ? "bg-emerald-50 text-sq-green"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-sq-green"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Link
          to="/request-quote"
          className="ms-auto flex shrink-0 items-center gap-1 rounded-full bg-sq-green px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2 sm:text-sm"
        >
          <Phone size={14} aria-hidden="true" />
          عرض سعر
        </Link>
        <a
          href="#home"
          aria-label="العودة إلى بداية الصفحة"
          className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sq-green"
        >
          <ArrowUp size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
