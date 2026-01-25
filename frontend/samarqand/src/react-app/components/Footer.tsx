import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";

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
    <footer className="bg-gray-800 text-white" dir="rtl">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">
              {company?.name || "شركة سمر قند للمقاولات"}
            </h3>
            <p className="text-gray-300 mb-4">{company?.slogan || ""}</p>
            <p className="text-gray-400 text-sm">{company?.description || ""}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-bold mb-4">روابط سريعة</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-300 hover:text-white transition">
                  الرئيسية
                </Link>
              </li>
              {(v?.showAbout ?? true) && (
                <li>
                  <Link to="/about" className="text-gray-300 hover:text-white transition">
                    من نحن
                  </Link>
                </li>
              )}
              {(v?.showProjects ?? true) && (
                <li>
                  <Link to="/projects" className="text-gray-300 hover:text-white transition">
                    مشاريعنا
                  </Link>
                </li>
              )}
              {(v?.showServices ?? true) && (
                <li>
                  <Link to="/services" className="text-gray-300 hover:text-white transition">
                    خدماتنا
                  </Link>
                </li>
              )}
              {(v?.showTools ?? true) && (
                <li>
                  <Link to="/tools" className="text-gray-300 hover:text-white transition">
                    الأدوات الذكية
                  </Link>
                </li>
              )}
              {(v?.showShowcase ?? true) && (
                <li>
                  <Link to="/showcase" className="text-gray-300 hover:text-white transition">
                    معرض الأعمال
                  </Link>
                </li>
              )}
              {(v?.showRfqTemplates ?? true) && (
                <li>
                  <Link to="/#rfq-templates" className="text-gray-300 hover:text-white transition">
                    نماذج عروض الأسعار
                  </Link>
                </li>
              )}
              {(v?.showContact ?? true) && (
                <li>
                  <Link to="/contact" className="text-gray-300 hover:text-white transition">
                    تواصل معنا
                  </Link>
                </li>
              )}
              <li>
                <Link to="/admin" className="text-gray-300 hover:text-white transition">
                  دخول الادمن
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">معلومات التواصل</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-[#4A90E2]" />
                <a
                  href={company?.phone1 ? `tel:${company.phone1}` : "#"}
                  className="text-gray-300 hover:text-white transition"
                  dir="ltr"
                >
                  {company?.phone1 || ""}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-[#4A90E2]" />
                <a
                  href={company?.email ? `mailto:${company.email}` : "#"}
                  className="text-gray-300 hover:text-white transition"
                >
                  {company?.email || ""}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={16} className="text-[#4A90E2]" />
                <span className="text-gray-300">{company?.address || ""}</span>
              </li>
            </ul>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="text-xl font-bold mb-4">تابعنا</h3>
            <div className="flex gap-4">
              {company?.facebookUrl && (
                <a
                  href={company.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-[#4A90E2] transition"
                >
                  <Facebook size={20} />
                </a>
              )}
              {company?.instagramUrl && (
                <a
                  href={company.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-[#4A90E2] transition"
                >
                  <Instagram size={20} />
                </a>
              )}
              {company?.linkedinUrl && (
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center hover:bg-[#4A90E2] transition"
                >
                  <Linkedin size={20} />
                </a>
              )}
            </div>

            {(company?.registrationStatus ||
              company?.chamberMembership ||
              company?.classification) && (
              <div className="mt-6">
                <h4 className="text-lg font-bold mb-3">التصنيف والترخيص</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  {company?.registrationStatus && (
                    <li>{company.registrationStatus}</li>
                  )}
                  {company?.chamberMembership && (
                    <li>{company.chamberMembership}</li>
                  )}
                  {company?.classification && <li>{company.classification}</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © {currentYear} {company?.name || "شركة سمر قند للمقاولات"}. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
}
