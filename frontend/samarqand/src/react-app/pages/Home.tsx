import TopBar from '@/react-app/components/TopBar';
import Navigation from '@/react-app/components/Navigation';
import ParallaxHero from '@/react-app/components/ParallaxHero';
import LandingQuickNav from '@/react-app/components/LandingQuickNav';
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
import { MapPin, Calendar } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useEffect, useMemo, useState } from "react";

import { fetchProjects, fetchSiteConfig, fetchTestimonials, type ProjectPayload, type SiteConfigPayload, type TestimonialPayload } from "@/react-app/api/site";
import { Star } from "lucide-react";
import { groupRfqTemplatesByCategory, RFQ_TEMPLATES } from "@/react-app/rfqTemplates";

export default function Home() {
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialPayload[]>([]);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [showAllRfq, setShowAllRfq] = useState(false);
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
  const groupedRfqTemplates = useMemo(
    () =>
      showAllRfq
        ? groupRfqTemplatesByCategory(RFQ_TEMPLATES)
        : groupRfqTemplatesByCategory(RFQ_TEMPLATES).slice(0, 2),
    [showAllRfq],
  );

  return (
    <div className="home-compact min-h-screen bg-white">
      <TopBar />
      <Navigation />
      <div id="home"><ParallaxHero /></div>
      <LandingQuickNav />
      <div id="tools">{(v?.showHomeAIBanner ?? true) && <AIFeaturesBanner />}</div>
      {(v?.showHomeTrustBadges ?? true) && <TrustBadges />}
      {(v?.showHomeStats ?? true) && <AnimatedStats />}
      {(v?.showServices ?? true) && <Services />}
      {(v?.showHomeTimeline ?? true) && <ProcessTimeline />}
      
      {(v?.showHomeQuickLinks ?? true) && (
        <nav
          aria-label="وصول سريع"
          className="border-b border-slate-200 bg-white"
          dir="rtl"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-3">
            <a href="#services" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-sq-green">خدماتنا</a>
            <a href="#projects" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-sq-green">مشاريعنا</a>
            <a href="#tools" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-sq-green">الأدوات الذكية</a>
            <a href="#rfq-templates" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-sq-green">نماذج الأسعار</a>
            <a href="#testimonials" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-sq-green">آراء العملاء</a>
            <a href="#contact" className="rounded-full bg-sq-green px-4 py-2 text-sm font-bold text-white">تواصل معنا</a>
          </div>
        </nav>
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
                            <Icon size={22} className="text-sq-green" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{t.title}</h3>
                          <p className="text-gray-600">{t.description}</p>
                          <div className="mt-5">
                            <Link
                              to={`/contact?rfqTemplate=${encodeURIComponent(t.key)}`}
                              className="inline-flex items-center justify-center w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition"
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
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowAllRfq((value) => !value)}
                className="rounded-full border border-sq-green px-5 py-2 text-sm font-bold text-sq-green hover:bg-emerald-50"
              >
                {showAllRfq ? "عرض أقل" : "عرض كل القوالب"}
              </button>
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
                    <img loading="lazy" decoding="async"                       src={project.imageUrl}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-sq-green via-sq-black to-sq-red" />
                  )}
                  <div className="absolute top-4 right-4 bg-sq-red text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {project.category}
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">{project.title}</h3>
                  <p className="text-gray-600 mb-4">{project.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-sq-green" />
                      <span>{project.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-sq-green" />
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
                className="inline-block bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
              >
                عرض جميع المشاريع
              </Link>
              <Link
                to="/contact"
                className="inline-block bg-white text-sq-green px-8 py-3 rounded-lg font-semibold border border-sq-green hover:bg-emerald-50 transition"
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
              before="/static/website/images/before-renovation.webp"
              after="/static/website/images/after-renovation.webp"
              title="تجديد واجهات المباني"
            />
            <BeforeAfterSlider
              before="/static/website/images/before-interior.webp"
              after="/static/website/images/after-interior.webp"
              title="تجديد التصميم الداخلي"
            />
          </div>

          <div className="text-center mt-12">
            <Link
              to="/showcase"
              className="inline-block bg-white text-sq-green px-8 py-3 rounded-lg font-semibold border border-sq-green hover:bg-emerald-50 transition"
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
              className="inline-block bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
            >
              قراءة المزيد
            </Link>
          </div>
        </div>
      </section>
      )}

      {(v?.showTools ?? true) && <AIContentShowcase />}
      {(v?.showNewsletter ?? true) && <div id="contact"><NewsletterSignup /></div>}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
