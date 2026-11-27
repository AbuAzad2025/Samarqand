import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Phone, X } from "lucide-react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";
import { useFooterVisible } from "@/react-app/utils/useFooterVisible";

const DISMISS_KEY = "sq-floating-cta-dismissed";

export default function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const footerVisible = useFooterVisible();

  useEffect(() => {
    try {
      setIsDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // Storage can be unavailable; the card is still closable in this session.
    }
  }, []);

  useEffect(() => {
    // Appear only once the visitor has scrolled past the hero, so it never
    // covers the headline or primary call-to-action.
    const onScroll = () => setIsVisible(window.scrollY > 1200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isVisible || isDismissed) return;
    const timer = window.setTimeout(() => setIsVisible(false), 12000);
    return () => window.clearTimeout(timer);
  }, [isVisible, isDismissed]);

  useEffect(() => {
    let active = true;
    fetchCompany().then((data) => { if (active) setCompany(data); }).catch(() => {});
    fetchSiteConfig().then((data) => { if (active) setConfig(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  function dismiss() {
    setIsDismissed(true);
    setIsVisible(false);
    setAnnouncement("تم إخفاء بطاقة التواصل السريع.");
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
  }

  const v = config?.visibility;
  if (!(v?.showFloatingCTA ?? true)) return null;

  const waLink = whatsappUrl(
    company?.phone1,
    "مرحباً، أود التواصل معكم بخصوص مشروعي",
  );

  return (
    <>
      <p role="status" className="sr-only">{announcement}</p>
      {!isDismissed && isVisible && !footerVisible && (
        <aside
          aria-label="بطاقة تواصل سريعة"
          dir="rtl"
          className="animate-slide-up fixed bottom-28 left-4 z-30 max-w-[min(15rem,calc(100vw-7rem))] sm:bottom-24 sm:left-6"
        >
          <div className="card-corp relative max-w-[15rem] p-4">
            <button
              type="button"
              onClick={dismiss}
              aria-label="إغلاق بطاقة التواصل"
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sq-green"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                <Phone size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">تواصل معنا</h2>
                <p className="text-xs text-[var(--corp-muted)]">للاستفسار عن الخدمات والمشاريع</p>
              </div>
            </div>

            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-corp-primary w-full text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
              >
                تواصل عبر واتساب
              </a>
            ) : (
              <Link
                to="/contact"
                className="btn-corp-primary w-full text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
              >
                تواصل معنا
              </Link>
            )}

            <p className="mt-2 text-center text-[11px] text-[var(--corp-muted)]">
              {waLink
                ? "يفتح الرابط محادثة واتساب مع الشركة."
                : "رقم واتساب غير متاح حالياً؛ استخدم صفحة التواصل."}
            </p>
          </div>
        </aside>
      )}

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
      `}</style>
    </>
  );
}
