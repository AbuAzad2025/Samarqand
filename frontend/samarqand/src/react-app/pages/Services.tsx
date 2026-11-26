import { useSiteContent, heading } from "@/react-app/utils/content";
import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import ProcessTimeline from "@/react-app/components/ProcessTimeline";
import Services from "@/react-app/components/Services";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import AIChatbot from "@/react-app/components/AIChatbot";
import { useEffect, useState } from "react";

import { fetchSiteConfig, type SiteConfigPayload } from "@/react-app/api/site";

export default function ServicesPage() {
  const content = useSiteContent();
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  useEffect(() => {
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />

      <section className="relative bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading(content, "services", "خدماتنا")}</h1>
          <p className="text-xl max-w-3xl mx-auto">
            نقدم خدمات شاملة من الفكرة حتى التسليم النهائي
          </p>
        </div>
      </section>

      {!(v?.showServices ?? true) ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء صفحة الخدمات من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div id="services">
            <Services showHeading={false} />
          </div>
          <ProcessTimeline />
        </>
      )}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
