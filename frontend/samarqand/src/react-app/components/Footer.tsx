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

type Visibility = SiteConfigPayload["visibility"];

const CURRENT_YEAR = new Date().getFullYear();
const LINK_CLASS =
  "transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

const SITE_LINKS: readonly { to: string; label: string; visibilityKey?: keyof Visibility }[] = [
  { to: "/", label: "الرئيسية" },
  { to: "/about", label: "من نحن", visibilityKey: "showAbout" },
  { to: "/projects", label: "مشاريعنا", visibilityKey: "showProjects" },
  { to: "/showcase", label: "معرض الأعمال", visibilityKey: "showShowcase" },
  { to: "/services", label: "خدماتنا", visibilityKey: "showServices" },
  { to: "/tools", label: "الأدوات الذكية", visibilityKey: "showTools" },
  { to: "/contact", label: "تواصل معنا", visibilityKey: "showContact" },
];

export default function Footer() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showFooter ?? true)) return null;

  const logoLabel = company?.brandTitle || BRAND.samarqand.name;

  const siteLinks = SITE_LINKS.filter(
    (item) => !item.visibilityKey || v?.[item.visibilityKey] !== false,
  );

  return (
    <footer className="bg-sq-black text-white" dir="rtl">
      <div className="h-[3px] bg-gradient-to-l from-sq-green via-sq-black to-sq-red" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Samarqand — primary identity */}
          <section className="min-w-0 sm:col-span-2 lg:col-span-2" aria-label={BRAND.samarqand.name}>
            <Link
              to="/"
              className="inline-block max-w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <img
                src={BRAND.samarqand.wordmarkDark}
                alt={logoLabel}
                className="h-10 w-auto max-w-full sm:h-12"
                loading="lazy"
                decoding="async"
              />
            </Link>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              {company?.brandSubtitle ||
                company?.slogan ||
                "مقاولات عامة • استشارات هندسية • تصاميم معمارية"}
            </p>
            {company?.phone1 ? (
              <a
                href={`tel:${company.phone1.replace(/\s+/g, "")}`}
                dir="ltr"
                className={`mt-3 inline-flex items-center gap-2 text-sm text-white/90 ${LINK_CLASS}`}
              >
                <Phone size={15} aria-hidden="true" />
                {company.phone1}
              </a>
            ) : null}
          </section>

          {/* Grouped site links */}
          <nav aria-labelledby="footer-site-links-heading">
            <h2 id="footer-site-links-heading" className="mb-3 text-sm font-bold text-white">روابط الموقع</h2>
            <ul className="flex flex-col gap-2">
              {siteLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={`text-sm text-white/70 ${LINK_CLASS}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Developer credit — kept deliberately understated */}
          <section aria-labelledby="footer-developer-heading">
            <h2 id="footer-developer-heading" className="mb-3 text-sm font-bold text-white">تطوير وبرمجة</h2>
            <a
              href={`tel:${BRAND.azad.phone}`}
              className={`inline-flex max-w-full items-center gap-3 rounded-lg text-white/70 ${LINK_CLASS}`}
            >
              <img
                src={BRAND.azad.icon}
                alt=""
                aria-hidden="true"
                className="h-9 w-9 shrink-0 object-contain"
                loading="lazy"
                decoding="async"
              />
              <span className="min-w-0 text-xs leading-relaxed">
                <span className="block">{BRAND.azad.name}</span>
                <span dir="ltr" className="mt-1 block text-white/60">{BRAND.azad.phone}</span>
              </span>
            </a>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-4 text-[11px] text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {CURRENT_YEAR} {BRAND.samarqand.name}. جميع الحقوق محفوظة.
          </p>
          <nav aria-label="روابط قانونية" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/privacy" className={LINK_CLASS}>الخصوصية</Link>
            <Link to="/terms" className={LINK_CLASS}>الشروط</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
