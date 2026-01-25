import { useState, useEffect } from 'react';
import { Phone, X } from 'lucide-react';

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";

export default function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    // Show after 5 seconds of page load
    const timer = setTimeout(() => {
      if (!isDismissed) {
        setIsVisible(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isDismissed]);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showFloatingCTA ?? true)) return null;

  if (isDismissed || !isVisible) return null;

  const phone = (company?.phone1 || "").replace(/\D/g, "");

  return (
    <div className="fixed bottom-24 left-8 z-40 animate-slide-up" dir="rtl">
      <div className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white rounded-2xl shadow-2xl p-6 max-w-sm relative">
        {/* Close Button */}
        <button
          onClick={() => {
            setIsDismissed(true);
            setIsVisible(false);
          }}
          className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-lg"
        >
          <X size={16} className="text-white" />
        </button>

        {/* Content */}
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
          href={
            phone
              ? `https://wa.me/${phone}?text=${encodeURIComponent(
                  "مرحباً، أريد الحصول على استشارة مجانية",
                )}`
              : "/contact"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-white text-[#4A90E2] text-center py-3 rounded-lg font-bold hover:bg-gray-100 transition"
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
