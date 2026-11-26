import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import BrandMark from "@/react-app/components/BrandMark";

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
    <footer className="bg-[#0B0F19] text-white" dir="rtl">
      <div className="h-1 bg-gradient-to-r from-[#CE1126] via-[#0B0F19] to-[#007A3D]" />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-12">
          <div className="md:col-span-2 lg:col-span-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126] p-[2px] rounded-2xl">
                <div className="rounded-2xl bg-[#0B0F19] p-2 border border-white/10">
                  <BrandMark
                    logoUrl={company?.logoUrl || undefined}
                    label={company?.name || "شعار الشركة"}
                    size={56}
                    className="w-12 h-12 object-contain"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xl font-extrabold bg-gradient-to-r from-[#007A3D] to-[#CE1126] bg-clip-text text-transparent leading-tight">
                  {company?.brandTitle || "سمر قند"}
                </div>
                <div className="text-sm text-white/70 mt-1 leading-6">
                  {company?.brandSubtitle ||
                    company?.slogan ||
                    "مقاولات عامة • استشارات هندسية • تصاميم معمارية"}
                </div>
              </div>
            </Link>

            {company?.description && (
              <p className="mt-4 text-sm text-white/60 leading-6">
                {company.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2.5">
              {(v?.showContact ?? true) && (
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-semibold bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] hover:opacity-95 transition focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                >
                  اطلب عرض سعر
                </Link>
              )}
              {company?.phone1 && (
                <a
                  href={`tel:${company.phone1}`}
                  className="inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                  dir="ltr"
                >
                  {company.phone1}
                </a>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="text-base font-bold mb-3">روابط سريعة</div>
            <ul className="space-y-1.5">
              <li>
                <Link to="/" className="text-white/75 hover:text-white transition">
                  الرئيسية
                </Link>
              </li>
              {(v?.showAbout ?? true) && (
                <li>
                  <Link to="/about" className="text-white/75 hover:text-white transition">
                    من نحن
                  </Link>
                </li>
              )}
              {(v?.showProjects ?? true) && (
                <li>
                  <Link to="/projects" className="text-white/75 hover:text-white transition">
                    مشاريعنا
                  </Link>
                </li>
              )}
              {(v?.showServices ?? true) && (
                <li>
                  <Link to="/services" className="text-white/75 hover:text-white transition">
                    خدماتنا
                  </Link>
                </li>
              )}
              {(v?.showTools ?? true) && (
                <li>
                  <Link to="/tools" className="text-white/75 hover:text-white transition">
                    الأدوات الذكية
                  </Link>
                </li>
              )}
              {(v?.showShowcase ?? true) && (
                <li>
                  <Link to="/showcase" className="text-white/75 hover:text-white transition">
                    معرض الأعمال
                  </Link>
                </li>
              )}
              {(v?.showRfqTemplates ?? true) && (
                <li>
                  <Link to="/#rfq-templates" className="text-white/75 hover:text-white transition">
                    نماذج عروض الأسعار
                  </Link>
                </li>
              )}
              {(v?.showContact ?? true) && (
                <li>
                  <Link to="/contact" className="text-white/75 hover:text-white transition">
                    تواصل معنا
                  </Link>
                </li>
              )}
              <li>
                <Link to="/admin" className="text-white/75 hover:text-white transition">
                  دخول الادمن
                </Link>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <div className="text-base font-bold mb-3">معلومات التواصل</div>
            <ul className="space-y-3">
              {company?.phone1 && (
                <li className="flex items-start gap-3">
                  <Phone size={16} className="text-[#007A3D] mt-0.5" />
                  <a
                    href={`tel:${company.phone1}`}
                    className="text-white/75 hover:text-white transition"
                    dir="ltr"
                  >
                    {company.phone1}
                  </a>
                </li>
              )}
              {company?.phone2 && (
                <li className="flex items-start gap-3">
                  <Phone size={16} className="text-[#007A3D] mt-0.5" />
                  <a
                    href={`tel:${company.phone2}`}
                    className="text-white/75 hover:text-white transition"
                    dir="ltr"
                  >
                    {company.phone2}
                  </a>
                </li>
              )}
              {company?.email && (
                <li className="flex items-start gap-3">
                  <Mail size={16} className="text-[#007A3D] mt-0.5" />
                  <a
                    href={`mailto:${company.email}`}
                    className="text-white/75 hover:text-white transition"
                    dir="ltr"
                  >
                    {company.email}
                  </a>
                </li>
              )}
              {company?.address && (
                <li className="flex items-start gap-3">
                  <MapPin size={16} className="text-[#007A3D] mt-0.5" />
                  <span className="text-white/75 leading-6">
                    {company.address}
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <div className="text-base font-bold mb-3">تابعنا</div>
            <div className="flex gap-2.5">
              {company?.facebookUrl && (
                <a
                  href={company.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-[#007A3D] hover:border-[#007A3D]/30 transition focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                >
                  <Facebook size={18} />
                </a>
              )}
              {company?.instagramUrl && (
                <a
                  href={company.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-[#007A3D] hover:border-[#007A3D]/30 transition focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                >
                  <Instagram size={18} />
                </a>
              )}
              {company?.linkedinUrl && (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center hover:bg-[#007A3D] hover:border-[#007A3D]/30 transition focus:outline-none focus:ring-2 focus:ring-[#007A3D]/40"
                >
                  <Linkedin size={18} />
                </a>
              )}
            </div>

            {(company?.registrationStatus || company?.chamberMembership || company?.classification) && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-bold mb-2">التصنيف والترخيص</div>
                <ul className="space-y-1.5 text-white/75 text-sm leading-6">
                  {company?.registrationStatus && <li>{company.registrationStatus}</li>}
                  {company?.chamberMembership && <li>{company.chamberMembership}</li>}
                  {company?.classification && <li>{company.classification}</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#CE1126]" />
              <span className="w-2 h-2 rounded-full bg-[#0B0F19] ring-1 ring-white/20" />
              <span className="w-2 h-2 rounded-full bg-white" />
              <span className="w-2 h-2 rounded-full bg-[#007A3D]" />
              <p className="text-xs text-white/65">
                © {currentYear} {company?.name || "شركة سمر قند للمقاولات"}. جميع الحقوق محفوظة.
              </p>
            </div>
            <div className="text-xs text-white/55">
              بلمسة فلسطينية • جودة، التزام، وإتقان
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
