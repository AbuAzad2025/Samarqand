import { useState, useEffect } from 'react';
import { Phone, X } from 'lucide-react';

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";
import { useFooterVisible } from "@/react-app/utils/useFooterVisible";

export default function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const footerVisible = useFooterVisible();

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
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showFloatingCTA ?? true)) return null;

  if (isDismissed || !isVisible || footerVisible) return null;

  const waLink =
    whatsappUrl(company?.phone1, "مرحباً، أريد الحصول على استشارة مجانية") || "/contact";

  return (
    <div className="fixed bottom-6 left-20 z-40 animate-slide-up max-w-[calc(100vw-6rem)]" dir="rtl">
      <div className="card-corp bg-white p-4 max-w-[15rem] relative">
        <button
          onClick={() => {
            setIsDismissed(true);
            setIsVisible(false);
          }}
          aria-label="إغلاق بطاقة الاستشارة"
          className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-lg"
        >
          <X size={16} className="text-white" />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Phone size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">استشارة مجانية!</h3>
            <p className="text-sm text-white/90">احصل على تقييم مجاني لمشروعك</p>
          </div>
        </div>

        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-white text-sq-green text-center py-3 rounded-lg font-bold hover:bg-gray-100 transition"
        >
          اتصل الآن
        </a>

        <p className="text-xs text-white/80 text-center mt-3">
          متاح على مدار الساعة
        </p>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
