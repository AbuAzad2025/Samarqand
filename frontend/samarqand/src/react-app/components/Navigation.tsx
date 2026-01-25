import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import BrandMark from "@/react-app/components/BrandMark";

export default function Navigation() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;

  return (
    <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Search Icon */}
          <button className="p-2 hover:bg-sky-50 rounded-full transition">
            <Search size={22} className="text-gray-600" />
          </button>

          {/* Navigation Menu */}
          <div className="hidden lg:flex items-center gap-8">
            <Link to="/" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
              الصفحة الرئيسية
            </Link>
            {(v?.showAbout ?? true) && (
              <Link to="/about" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                من نحن
              </Link>
            )}
            {(v?.showProjects ?? true) && (
              <Link to="/projects" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                مشاريعنا
              </Link>
            )}
            {(v?.showServices ?? true) && (
              <Link to="/services" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                خدماتنا
              </Link>
            )}
            {(v?.showRfqTemplates ?? true) && (
              <Link to="/#rfq-templates" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                نماذج عروض الأسعار
              </Link>
            )}
            {(v?.showTools ?? true) && (
              <Link to="/tools" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                الأدوات الذكية
              </Link>
            )}
            {(v?.showShowcase ?? true) && (
              <Link to="/showcase" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                معرض الأعمال
              </Link>
            )}
            {(v?.showContact ?? true) && (
              <Link to="/contact" className="text-gray-700 hover:text-[#4A90E2] transition font-semibold text-base">
                اتصل بنا
              </Link>
            )}
            
            {/* Language Selector */}
            <div className="flex items-center gap-2 text-sm">
              <img src="https://flagcdn.com/w20/ps.png" alt="فلسطين" className="w-5 h-3" />
              <span className="text-gray-700">▼</span>
            </div>
          </div>

          {/* Logo and Company Info */}
          <Link to="/" className="flex items-center gap-5">
            <div className="text-right max-w-xs">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] bg-clip-text text-transparent mb-2">
                {company?.brandTitle || "سمر قند"}
              </h1>
              <p className="text-sm text-gray-600 font-medium leading-relaxed">
                {company?.brandSubtitle ||
                  "مقاولات عامة • استشارات هندسية • تصاميم معمارية"}
              </p>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg overflow-hidden bg-white border border-gray-100">
              <BrandMark
                logoUrl={company?.logoUrl || undefined}
                label={company?.name || "شعار الشركة"}
                size={64}
                className="w-14 h-14 object-contain"
              />
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
