import { Phone } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";

import {
  fetchCompany,
  fetchSiteConfig,
  type CompanyPayload,
  type SiteConfigPayload,
} from "@/react-app/api/site";
import { BRAND } from "@/react-app/brand";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showFooter ?? true)) return null;

  return (
    <footer className="bg-sq-black text-white" dir="rtl">
      <div className="h-[3px] bg-gradient-to-l from-sq-green via-sq-black to-sq-red" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" aria-label={BRAND.samarqand.name} className="shrink-0">
              <img
                src={BRAND.samarqand.wordmarkDark}
                alt={BRAND.samarqand.name}
                className="h-11 w-auto md:h-14"
                loading="lazy"
                decoding="async"
              />
            </Link>
            <div className="hidden sm:block text-sm text-white/70 leading-relaxed">
              <div>
                {company?.brandSubtitle ||
                  company?.slogan ||
                  "مقاولات عامة • استشارات هندسية • تصاميم معمارية"}
              </div>
              {company?.phone1 ? (
                <a
                  href={`tel:${company.phone1}`}
                  dir="ltr"
                  className="mt-1 inline-flex items-center gap-2 text-white/90 hover:text-white transition"
                >
                  <Phone size={14} aria-hidden="true" />
                  {company.phone1}
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left text-xs text-white/60 leading-relaxed">
              <div>تطوير وبرمجة</div>
              <a
                href={`tel:${BRAND.azad.phone}`}
                dir="ltr"
                className="text-white/90 hover:text-white transition"
              >
                {BRAND.azad.phone}
              </a>
            </div>
            <a
              href={`tel:${BRAND.azad.phone}`}
              aria-label={BRAND.azad.name}
              className="shrink-0"
            >
              <img
                src={BRAND.azad.wordmarkDark}
                alt={BRAND.azad.name}
                className="h-9 w-auto md:h-11"
                loading="lazy"
                decoding="async"
              />
            </a>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/60">
          <span>
            © {currentYear} {BRAND.samarqand.name}. جميع الحقوق محفوظة.
          </span>
          <span className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-white transition">
              الخصوصية
            </Link>
            <Link to="/terms" className="hover:text-white transition">
              الشروط
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
