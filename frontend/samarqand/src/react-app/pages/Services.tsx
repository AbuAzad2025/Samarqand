import { Link } from "react-router";
import { useEffect, useState } from "react";

import { useSiteContent, heading } from "@/react-app/utils/content";
import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import ProcessTimeline from "@/react-app/components/ProcessTimeline";
import Services from "@/react-app/components/Services";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import AIChatbot from "@/react-app/components/AIChatbot";

import { fetchSiteConfig, type SiteConfigPayload } from "@/react-app/api/site";

export default function ServicesPage() {
  const content = useSiteContent();
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  useEffect(() => {
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;
  const subtitle =
    content.headings.services.subtitle ||
    "تصفّح الخدمات المتاحة وأرسل تفاصيل مشروعك لطلب عرض سعر.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />

      <section className="relative bg-[var(--corp-dark)] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {heading(content, "services", "خدماتنا")}
          </h1>
          <p className="text-xl max-w-3xl mx-auto">{subtitle}</p>
          <Link
            to="/request-quote"
            className="mt-6 inline-block rounded-xl border border-white/40 px-6 py-3 text-sm font-bold hover:bg-white/10 transition"
          >
            اطلب عرض سعر
          </Link>
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
          {/* Card titles are h3 while the component's own h2 is hidden here,
              so supply the parent heading to keep h1 -> h2 -> h3 order. */}
          <h2 className="sr-only">الخدمات المتاحة</h2>
          <Services showHeading={false} />
          <ProcessTimeline />
          <section className="py-12 bg-white border-t border-gray-200">
            <div className="container mx-auto px-4 max-w-3xl text-center">
              <h2 className="text-2xl font-extrabold text-gray-800 mb-3">
                لم تجد ما تبحث عنه؟
              </h2>
              <p className="text-gray-600 mb-5 leading-relaxed">
                أرسل تفاصيل مشروعك عبر نموذج طلب عرض السعر لمراجعتها.
              </p>
              <Link
                to="/request-quote"
                className="btn-corp-primary font-bold hover:shadow-lg transition"
              >
                اطلب عرض سعر
              </Link>
            </div>
          </section>
        </>
      )}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
