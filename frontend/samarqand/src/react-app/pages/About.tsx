import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import InteractiveTeam from "@/react-app/components/InteractiveTeam";
import AIChatbot from "@/react-app/components/AIChatbot";
import { Target, Eye, Award } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
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

  const values = content.values;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative bg-[var(--corp-dark)] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">من نحن</h1>
          <p className="text-xl max-w-3xl mx-auto">
            {company?.description || "خبرة محلية، تنفيذ متقن، والتزام بالمواعيد."}
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
              <div className="grid md:grid-cols-2 gap-8 mb-16">
                <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Eye className="text-white" size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">رؤيتنا</h2>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{company?.vision || ""}</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Target className="text-white" size={24} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">رسالتنا</h2>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{company?.mission || ""}</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-lg shadow-lg">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                    <Award className="text-white" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">قيمنا</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {values.map((value, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-sq-green rounded-full mt-2"></div>
                      <p className="text-gray-600">{value}</p>
                    </div>
                  ))}
                </div>
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
