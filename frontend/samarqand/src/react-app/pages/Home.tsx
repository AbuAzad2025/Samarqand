import TopBar from '@/react-app/components/TopBar';
import Navigation from '@/react-app/components/Navigation';
import ParallaxHero from '@/react-app/components/ParallaxHero';
import WhatsAppButton from '@/react-app/components/WhatsAppButton';
import FloatingCTA from '@/react-app/components/FloatingCTA';
import Footer from '@/react-app/components/Footer';
import AnimatedStats from '@/react-app/components/AnimatedStats';
import TrustBadges from '@/react-app/components/TrustBadges';
import AIChatbot from '@/react-app/components/AIChatbot';
import AIFeaturesBanner from '@/react-app/components/AIFeaturesBanner';
import Services from "@/react-app/components/Services";
import ProcessTimeline from "@/react-app/components/ProcessTimeline";
import BeforeAfterSlider from "@/react-app/components/BeforeAfterSlider";
import InteractiveTeam from "@/react-app/components/InteractiveTeam";
import AIContentShowcase from "@/react-app/components/AIContentShowcase";
import NewsletterSignup from "@/react-app/components/NewsletterSignup";
import { MapPin, Calendar, Wrench, Layers, Sparkles, FileText } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useEffect, useMemo, useState } from "react";

import { fetchProjects, fetchSiteConfig, fetchTestimonials, type ProjectPayload, type SiteConfigPayload, type TestimonialPayload } from "@/react-app/api/site";
import { Star } from "lucide-react";
import { groupRfqTemplatesByCategory, RFQ_TEMPLATES } from "@/react-app/rfqTemplates";

export default function Home() {
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialPayload[]>([]);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const location = useLocation();

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => {});
    fetchTestimonials().then(setTestimonials).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  useEffect(() => {
    const hash = (location.hash || "").replace("#", "").trim();
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [location.hash]);

  const featuredProjects = useMemo(() => projects.slice(0, 3), [projects]);
  const v = config?.visibility;
  const groupedRfqTemplates = useMemo(() => groupRfqTemplatesByCategory(RFQ_TEMPLATES), []);

  return (
    <div className="min-h-screen bg-white">
      <TopBar />
      <Navigation />
      <ParallaxHero />
      {(v?.showHomeAIBanner ?? true) && <AIFeaturesBanner />}
      {(v?.showHomeTrustBadges ?? true) && <TrustBadges />}
      {(v?.showHomeStats ?? true) && <AnimatedStats />}
      {(v?.showServices ?? true) && <Services />}
      {(v?.showHomeTimeline ?? true) && <ProcessTimeline />}
      
      {(v?.showHomeQuickLinks ?? true) && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4" dir="rtl">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">روابط سريعة</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                اختر القسم الذي يهمك للوصول السريع بدون التمرير الطويل
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {(v?.showServices ?? true) && (
                <Link
                  to="/services"
                  className="group bg-gradient-to-b from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <Layers size={22} className="text-[#007A3D]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">خدماتنا</h3>
                  <p className="text-gray-600">
                    المقاولات، الاستشارات، التشطيبات، والتصميم المعماري
                  </p>
                  <div className="mt-4 text-[#007A3D] font-semibold group-hover:underline">
                    فتح الصفحة
                  </div>
                </Link>
              )}

              {(v?.showTools ?? true) && (
                <Link
                  to="/tools"
                  className="group bg-gradient-to-b from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <Wrench size={22} className="text-[#007A3D]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">الأدوات الذكية</h3>
                  <p className="text-gray-600">
                    محلل التصميم بالذكاء الاصطناعي، الحاسبة، والمصور المعماري
                  </p>
                  <div className="mt-4 text-[#007A3D] font-semibold group-hover:underline">
                    فتح الصفحة
                  </div>
                </Link>
              )}

              {(v?.showShowcase ?? true) && (
                <Link
                  to="/showcase"
                  className="group bg-gradient-to-b from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <Sparkles size={22} className="text-[#007A3D]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">معرض الأعمال</h3>
                  <p className="text-gray-600">
                    شاهد التحولات، فريق العمل، وآراء العملاء
                  </p>
                  <div className="mt-4 text-[#007A3D] font-semibold group-hover:underline">
                    فتح الصفحة
                  </div>
                </Link>
              )}

              {(v?.showRfqTemplates ?? true) && (
                <Link
                  to="/#rfq-templates"
                  className="group bg-gradient-to-b from-white to-gray-50 border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                    <FileText size={22} className="text-[#007A3D]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">نماذج عروض الأسعار</h3>
                  <p className="text-gray-600">
                    قوالب جاهزة لطلب عرض سعر بسرعة عبر واتساب
                  </p>
                  <div className="mt-4 text-[#007A3D] font-semibold group-hover:underline">
                    فتح القسم
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {(v?.showRfqTemplates ?? true) && (
        <section id="rfq-templates" className="py-16 bg-gray-50">
          <div className="container mx-auto px-4" dir="rtl">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">نماذج عروض الأسعار</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                اختر قالبًا مناسبًا واطلب عرض سعر بسرعة عبر واتساب مع تفاصيل واضحة.
              </p>
            </div>

            <div className="space-y-10">
              {groupedRfqTemplates.map((g) => (
                <div key={g.category}>
                  <div className="text-xl font-black text-gray-900 mb-4">{g.category}</div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {g.templates.map((t) => {
                      const Icon = t.icon;
                      return (
                        <div
                          key={t.key}
                          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
                        >
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                            <Icon size={22} className="text-[#007A3D]" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{t.title}</h3>
                          <p className="text-gray-600">{t.description}</p>
                          <div className="mt-5">
                            <Link
                              to={`/contact?rfqTemplate=${encodeURIComponent(t.key)}`}
                              className="inline-flex items-center justify-center w-full bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition"
                            >
                              ابدأ الطلب
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* Featured Projects Section */}
      {(v?.showProjects ?? true) && (
      <section className="py-16 bg-gray-50" id="projects">
        <div className="container mx-auto px-4" dir="rtl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">مشاريعنا المميزة</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">نفخر بإنجازاتنا ونسعى دائماً لتقديم الأفضل</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {featuredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition group">
                <div className="relative h-64 overflow-hidden">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126]" />
                  )}
                  <div className="absolute top-4 right-4 bg-[#CE1126] text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {project.category}
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">{project.title}</h3>
                  <p className="text-gray-600 mb-4">{project.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#007A3D]" />
                      <span>{project.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-[#007A3D]" />
                      <span>{project.year}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/projects"
                className="inline-block bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
              >
                عرض جميع المشاريع
              </Link>
              <Link
                to="/contact"
                className="inline-block bg-white text-[#007A3D] px-8 py-3 rounded-lg font-semibold border border-[#007A3D] hover:bg-emerald-50 transition"
              >
                اطلب عرض سعر
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {(v?.showShowcase ?? true) && (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4" dir="rtl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              شاهد التحول
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              نماذج قبل/بعد لأعمال الترميم والتجديد
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

          <div className="text-center mt-12">
            <Link
              to="/showcase"
              className="inline-block bg-white text-[#007A3D] px-8 py-3 rounded-lg font-semibold border border-[#007A3D] hover:bg-emerald-50 transition"
            >
              فتح المعرض الكامل
            </Link>
          </div>
        </div>
      </section>
      )}

      {(v?.showTeam ?? true) && <InteractiveTeam />}

      {(v?.showTestimonials ?? true) && (
      <section className="py-16 bg-white" id="testimonials">
        <div className="container mx-auto px-4" dir="rtl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">آراء عملائنا</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">ما يقوله عملاؤنا عن خدماتنا</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.slice(0, 3).map((testimonial) => (
              <div key={testimonial.id} className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />
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

          <div className="text-center mt-12">
            <Link
              to="/showcase"
              className="inline-block bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
            >
              قراءة المزيد
            </Link>
          </div>
        </div>
      </section>
      )}

      {(v?.showTools ?? true) && <AIContentShowcase />}
      {(v?.showNewsletter ?? true) && <NewsletterSignup />}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
