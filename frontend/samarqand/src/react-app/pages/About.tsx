import { Link } from "react-router";
import { Award, Eye, Target } from "lucide-react";
import { useEffect, useState } from "react";
import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import InteractiveTeam from "@/react-app/components/InteractiveTeam";
import AIChatbot from "@/react-app/components/AIChatbot";

import {
  fetchCompany,
  fetchSiteConfig,
  type CompanyPayload,
  type SiteConfigPayload,
} from "@/react-app/api/site";
import { useSiteContent } from "@/react-app/utils/content";

export default function About() {
  const content = useSiteContent();
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;

  // Only show cards that have published content; no invented claims.
  const infoCards = [
    { title: "رؤيتنا", Icon: Eye, text: (company?.vision || "").trim() },
    { title: "رسالتنا", Icon: Target, text: (company?.mission || "").trim() },
  ].filter((card) => card.text.length > 0);
  const values = content.values.map((value) => value.trim()).filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-[var(--corp-dark)] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">من نحن</h1>
          <p className="text-xl max-w-3xl mx-auto">
            {company?.description?.trim() ||
              "معلومات عن الشركة ورسالتها ورؤيتها كما تظهر في الموقع."}
          </p>
        </div>
      </section>

      {!(v?.showAbout ?? true) ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء صفحة من نحن من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-extrabold text-gray-800 mb-8 text-center">
                رسالتنا ورؤيتنا
              </h2>

              {infoCards.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-8 mb-12">
                  {infoCards.map(({ title, Icon, text }) => (
                    <article
                      key={title}
                      className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sq-green text-white">
                          <Icon size={24} aria-hidden="true" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
                      </div>
                      <p className="text-gray-600 leading-relaxed">{text}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center mb-12">
                  لا توجد معلومات منشورة عن الرؤية والرسالة حالياً.
                </p>
              )}

              <article className="bg-white p-8 rounded-lg shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sq-green text-white">
                    <Award size={24} aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">قيمنا</h2>
                </div>
                {values.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {values.map((value, index) => (
                      <div key={`${value}-${index}`} className="flex items-start gap-3">
                        <span
                          className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sq-green"
                          aria-hidden="true"
                        />
                        <p className="text-gray-600 leading-relaxed">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">لا توجد قيم منشورة حالياً.</p>
                )}
              </article>

              <div className="mt-12 flex flex-wrap justify-center gap-3">
                <Link
                  to="/services"
                  className="btn-corp-primary font-bold hover:shadow-lg transition"
                >
                  تعرّف على خدماتنا
                </Link>
                <Link
                  to="/contact"
                  className="rounded-xl border border-gray-300 px-6 py-3 font-bold text-gray-800 hover:bg-gray-50 transition"
                >
                  تواصل معنا
                </Link>
              </div>
            </div>
          </section>

          {(v?.showTeam ?? true) && <InteractiveTeam />}
        </>
      )}

      <WhatsAppButton />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
