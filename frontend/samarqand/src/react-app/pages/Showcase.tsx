import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import AIChatbot from "@/react-app/components/AIChatbot";
import BeforeAfterSlider from "@/react-app/components/BeforeAfterSlider";
import InteractiveTeam from "@/react-app/components/InteractiveTeam";
import NewsletterSignup from "@/react-app/components/NewsletterSignup";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchSiteConfig, fetchTestimonials, type SiteConfigPayload, type TestimonialPayload } from "@/react-app/api/site";

export default function ShowcasePage() {
  const [testimonials, setTestimonials] = useState<TestimonialPayload[]>([]);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchTestimonials().then(setTestimonials).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <TopBar />
      <Navigation />

      <section className="relative bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">معرض الأعمال</h1>
          <p className="text-xl max-w-3xl mx-auto">
            شاهد التحولات وآراء العملاء وفريق العمل
          </p>
        </div>
      </section>

      {!(v?.showShowcase ?? true) ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء معرض الأعمال من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              شاهد التحول
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              نحول المباني القديمة إلى تحف معمارية حديثة
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <BeforeAfterSlider
              before="https://019bef55-8da4-70bc-b1ca-7c96b6e469af.mochausercontent.com/before-renovation.png"
              after="https://019bef55-8da4-70bc-b1ca-7c96b6e469af.mochausercontent.com/after-renovation.png"
              title="تجديد واجهات المباني"
            />
            <BeforeAfterSlider
              before="https://019bef55-8da4-70bc-b1ca-7c96b6e469af.mochausercontent.com/before-interior.png"
              after="https://019bef55-8da4-70bc-b1ca-7c96b6e469af.mochausercontent.com/after-interior.png"
              title="تجديد التصميم الداخلي"
            />
          </div>
        </div>
      </section>

      {(v?.showTeam ?? true) && <InteractiveTeam />}

      {(v?.showTestimonials ?? true) && (
      <section className="py-16 bg-white" id="testimonials">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">آراء عملائنا</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              ما يقوله عملاؤنا عن خدماتنا
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className="fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-gray-600 mb-4 italic">"{testimonial.text}"</p>
                <div className="border-t pt-4">
                  <p className="font-bold text-gray-800">{testimonial.name}</p>
                  <p className="text-sm text-gray-500">{testimonial.project}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {(v?.showNewsletter ?? true) && <NewsletterSignup />}
        </>
      )}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
