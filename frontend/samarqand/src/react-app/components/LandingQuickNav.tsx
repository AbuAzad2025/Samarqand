import { useEffect, useState } from "react";
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

export default function LandingQuickNav({
  visibility,
}: {
  visibility?: SiteConfigPayload["visibility"];
}) {
  const links = LINKS.filter(
    (link) => link.show === true || visibility?.[link.show] !== false,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="sticky top-20 z-30 border-y border-slate-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2" dir="rtl">
        <nav aria-label="تنقل سريع" className="flex items-center gap-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-sq-green"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <a
          href="/request-quote"
          className="mr-auto flex shrink-0 items-center gap-1 rounded-full bg-sq-green px-3 py-1.5 text-xs font-bold text-white"
        >
          <Phone size={13} /> عرض سعر
        </a>
        <a
          href="#home"
          aria-label="العودة للأعلى"
          className="shrink-0 rounded-full border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
        >
          <ArrowUp size={14} />
        </a>
      </div>
    </div>
  );
}
