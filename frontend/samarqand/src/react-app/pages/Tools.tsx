import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import AIChatbot from "@/react-app/components/AIChatbot";
import AIDesignAnalyzer from "@/react-app/components/AIDesignAnalyzer";
import ConstructionCalculator from "@/react-app/components/ConstructionCalculator";
import ArchitecturalVisualizer from "@/react-app/components/ArchitecturalVisualizer";
import AIContentShowcase from "@/react-app/components/AIContentShowcase";
import { useEffect, useState } from "react";

import { fetchAuthAccess, fetchSiteConfig, type SiteConfigPayload } from "@/react-app/api/site";

export default function ToolsPage() {
  const [canUseRestrictedTools, setCanUseRestrictedTools] = useState(false);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchAuthAccess()
      .then((data) => setCanUseRestrictedTools(Boolean(data.canUseRestrictedTools)))
      .catch(() => setCanUseRestrictedTools(false));
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <TopBar />
      <Navigation />

      <section className="relative bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">الأدوات الذكية</h1>
          <p className="text-xl max-w-3xl mx-auto">
            أدوات تساعدك على اتخاذ قرارات أسرع وأكثر دقة قبل التنفيذ
          </p>
        </div>
      </section>

      {!(v?.showTools ?? true) ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء صفحة الأدوات الذكية من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <AIDesignAnalyzer />
          <ConstructionCalculator />
      {canUseRestrictedTools ? (
        <>
          <ArchitecturalVisualizer />
          <AIContentShowcase />
        </>
      ) : (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                أدوات مخصصة للمدراء
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                مولّد المحتوى التسويقي بالذكاء الاصطناعي وتخيل مشروعك قبل البناء
                متاحان فقط للمدراء والسوبر أدمن.
              </p>
              <a
                href="/admin/"
                className="inline-block mt-6 bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
              >
                تسجيل الدخول للإدارة
              </a>
            </div>
          </div>
        </section>
      )}
        </>
      )}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
