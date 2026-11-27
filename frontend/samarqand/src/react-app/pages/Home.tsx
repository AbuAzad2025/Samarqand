import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Building2, Calendar, MapPin, RefreshCw, Star } from "lucide-react";

import { useSiteContent, heading } from "@/react-app/utils/content";
import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import ParallaxHero from "@/react-app/components/ParallaxHero";
import LandingSidebar from "@/react-app/components/LandingSidebar";
import LandingQuickNav from "@/react-app/components/LandingQuickNav";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import Footer from "@/react-app/components/Footer";
import AnimatedStats from "@/react-app/components/AnimatedStats";
import TrustBadges from "@/react-app/components/TrustBadges";
import AIChatbot from "@/react-app/components/AIChatbot";
import AIFeaturesBanner from "@/react-app/components/AIFeaturesBanner";
import Services from "@/react-app/components/Services";
import ProcessTimeline from "@/react-app/components/ProcessTimeline";
import BeforeAfterSlider from "@/react-app/components/BeforeAfterSlider";
import InteractiveTeam from "@/react-app/components/InteractiveTeam";
import AIContentShowcase from "@/react-app/components/AIContentShowcase";
import NewsletterSignup from "@/react-app/components/NewsletterSignup";

import {
  fetchProjects,
  fetchSiteConfig,
  fetchTestimonials,
  type ProjectPayload,
  type SiteConfigPayload,
  type TestimonialPayload,
} from "@/react-app/api/site";
import { groupRfqTemplatesByCategory, RFQ_TEMPLATES } from "@/react-app/rfqTemplates";

type LoadState = "loading" | "ready" | "error";

export default function Home() {
  const content = useSiteContent();
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialPayload[]>([]);
  const [projectsState, setProjectsState] = useState<LoadState>("loading");
  const [testimonialsState, setTestimonialsState] = useState<LoadState>("loading");
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [showAllRfq, setShowAllRfq] = useState(false);
  const projectRequest = useRef(0);
  const testimonialRequest = useRef(0);
  const location = useLocation();

  const loadProjects = useCallback(() => {
    const id = ++projectRequest.current;
    setProjectsState("loading");
    fetchProjects()
      .then((data) => {
        if (id !== projectRequest.current) return;
        setProjects(Array.isArray(data) ? data : []);
        setProjectsState("ready");
      })
      .catch(() => {
        if (id === projectRequest.current) setProjectsState("error");
      });
  }, []);

  const loadTestimonials = useCallback(() => {
    const id = ++testimonialRequest.current;
    setTestimonialsState("loading");
    fetchTestimonials()
      .then((data) => {
        if (id !== testimonialRequest.current) return;
        setTestimonials(Array.isArray(data) ? data : []);
        setTestimonialsState("ready");
      })
      .catch(() => {
        if (id === testimonialRequest.current) setTestimonialsState("error");
      });
  }, []);

  useEffect(() => {
    loadProjects();
    loadTestimonials();
    let active = true;
    fetchSiteConfig().then((data) => { if (active) setConfig(data); }).catch(() => {});
    return () => { active = false; };
  }, [loadProjects, loadTestimonials]);

  useEffect(() => {
    const hash = (location.hash || "").replace("#", "").trim();
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const timer = window.setTimeout(() => {
      const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (el instanceof HTMLElement) {
        el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    }, 50);
    return () => window.clearTimeout(timer);
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-sq-green focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        تخطَّ إلى المحتوى الرئيسي
      </a>

      <TopBar />
      <Navigation />
      <LandingSidebar visibility={v} />

      <main id="main-content" tabIndex={-1}>
        <div id="home"><ParallaxHero /></div>

        {(v?.showHomeQuickLinks ?? true) && <LandingQuickNav visibility={v} />}

        {(v?.showHomeAIBanner ?? true) && (
          <div id="tools">
            <AIFeaturesBanner />
            <p className="border-b border-slate-200 bg-[var(--corp-surface)] px-4 py-2 text-center text-xs text-[var(--corp-muted)]">
              عرض تعريفي لإمكانيات الأدوات الرقمية؛ قد لا تكون بعض الميزات مُفعّلة في هذه النسخة.
            </p>
          </div>
        )}

        {(v?.showHomeTrustBadges ?? true) && <TrustBadges />}
        {(v?.showHomeStats ?? true) && <AnimatedStats />}
        {(v?.showServices ?? true) && <Services />}
        {(v?.showHomeTimeline ?? true) && <ProcessTimeline />}

        {(v?.showRfqTemplates ?? true) && (
          <section id="rfq-templates" className="section-corp-muted" aria-labelledby="rfq-heading">
            <div className="container mx-auto px-4" dir="rtl">
              <div className="mb-10 text-center">
                <h2 id="rfq-heading" className="mb-3 text-3xl font-bold text-gray-800">
                  {heading(content, "rfq", "نماذج عروض الأسعار")}
                </h2>
                <p className="mx-auto max-w-2xl text-gray-600">
                  اختر قالبًا مناسبًا واطلب عرض سعر بسرعة عبر واتساب مع تفاصيل واضحة.
                </p>
              </div>

              <div id="rfq-groups" className="space-y-10">
                {groupedRfqTemplates.map((g) => (
                  <div key={g.category}>
                    <div className="mb-4 text-xl font-black text-gray-900">{g.category}</div>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {g.templates.map((t) => {
                        const Icon = t.icon;
                        return (
                          <div
                            key={t.key}
                            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-lg"
                          >
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                              <Icon size={22} className="text-sq-green" aria-hidden="true" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-gray-800">{t.title}</h3>
                            <p className="text-gray-600">{t.description}</p>
                            <div className="mt-5">
                              <Link
                                to={`/contact?rfqTemplate=${encodeURIComponent(t.key)}`}
                                aria-label={`ابدأ طلب ${t.title}`}
                                className="btn-corp-primary w-full font-bold hover:shadow-lg transition"
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
                  aria-expanded={showAllRfq}
                  aria-controls="rfq-groups"
                  className="rounded-full border border-sq-green px-5 py-2 text-sm font-bold text-sq-green transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
                >
                  {showAllRfq ? "عرض أقل" : "عرض كل القوالب"}
                </button>
              </div>
            </div>
          </section>
        )}

        {(v?.showProjects ?? true) && (
          <section id="projects" className="section-corp-muted" aria-labelledby="projects-heading">
            <div className="container mx-auto px-4" dir="rtl">
              <div className="mb-10 text-center">
                <h2 id="projects-heading" className="mb-3 text-3xl font-bold text-gray-800">
                  {heading(content, "projects", "مشاريعنا المميزة")}
                </h2>
                <p className="mx-auto max-w-2xl text-gray-600">نفخر بإنجازاتنا ونسعى دائماً لتقديم الأفضل</p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {projectsState === "loading" && (
                  <p role="status" className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center text-sm text-[var(--corp-muted)] md:col-span-3">
                    جارٍ تحميل المشاريع...
                  </p>
                )}
                {projectsState === "error" && (
                  <div role="alert" className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center md:col-span-3">
                    <p className="text-sm text-[var(--corp-muted)]">تعذّر عرض المشاريع حالياً.</p>
                    <button
                      type="button"
                      onClick={loadProjects}
                      className="btn-corp-secondary mt-3 inline-flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      إعادة المحاولة
                    </button>
                  </div>
                )}
                {projectsState === "ready" && featuredProjects.length === 0 && (
                  <p className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center text-sm text-[var(--corp-muted)] md:col-span-3">
                    لا توجد مشاريع معروضة حالياً.
                  </p>
                )}
                {projectsState === "ready" &&
                  featuredProjects.map((project) => (
                    <article key={project.id} className="overflow-hidden rounded-lg bg-white shadow-lg transition hover:shadow-xl">
                      <div className="relative h-52 overflow-hidden">
                        {project.imageUrl ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={project.imageUrl}
                            alt={project.title}
                            className="h-full w-full object-cover transition duration-500 hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--corp-surface)] text-slate-400">
                            <Building2 size={44} strokeWidth={1.2} aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute right-4 top-4 rounded-full bg-sq-red px-4 py-2 text-sm font-semibold text-white">
                          {project.category}
                        </div>
                      </div>

                      <div className="p-6">
                        <h3 className="mb-3 text-xl font-bold text-gray-800">{project.title}</h3>
                        <p className="mb-4 text-gray-600">{project.description}</p>
                        <Link to={`/projects/${project.slug}`} className="btn-corp-link mt-4 inline-flex">
                          تفاصيل المشروع ←
                        </Link>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-sq-green" aria-hidden="true" />
                            <span>{project.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-sq-green" aria-hidden="true" />
                            <span>{project.year}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>

              <div className="mt-10 text-center">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link to="/projects" className="btn-corp-primary font-semibold hover:shadow-lg transition">
                    عرض جميع المشاريع
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-block rounded-lg border border-sq-green bg-white px-8 py-3 font-semibold text-sq-green transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
                  >
                    اطلب عرض سعر
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {(v?.showShowcase ?? true) && (
          <section id="showcase" className="section-corp" aria-labelledby="showcase-heading">
            <div className="container mx-auto px-4" dir="rtl">
              <div className="mb-10 text-center">
                <h2 id="showcase-heading" className="mb-3 text-3xl font-bold text-gray-800 md:text-4xl">
                  شاهد التحول
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-gray-600">
                  نماذج قبل/بعد لأعمال الترميم والتجديد
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  صور توضيحية لأغراض العرض، وليست توثيقاً لمشروع محدد.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
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

              <div className="mt-10 text-center">
                <Link
                  to="/showcase"
                  className="inline-block rounded-lg border border-sq-green bg-white px-8 py-3 font-semibold text-sq-green transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
                >
                  فتح المعرض الكامل
                </Link>
              </div>
            </div>
          </section>
        )}

        {(v?.showTeam ?? true) && <InteractiveTeam />}

        {(v?.showTestimonials ?? true) && (
          <section id="testimonials" className="section-corp" aria-labelledby="testimonials-heading">
            <div className="container mx-auto px-4" dir="rtl">
              <div className="mb-10 text-center">
                <h2 id="testimonials-heading" className="mb-3 text-3xl font-bold text-gray-800">
                  {heading(content, "testimonials", "آراء عملائنا")}
                </h2>
                <p className="mx-auto max-w-2xl text-gray-600">
                  {content.headings.testimonials?.subtitle || "ما يقوله عملاؤنا عن خدماتنا"}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {testimonialsState === "loading" && (
                  <p role="status" className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-6 text-center text-sm text-[var(--corp-muted)] md:col-span-3">
                    جارٍ تحميل الآراء...
                  </p>
                )}
                {testimonialsState === "error" && (
                  <div role="alert" className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-6 text-center md:col-span-3">
                    <p className="text-sm text-[var(--corp-muted)]">تعذّر عرض آراء العملاء حالياً.</p>
                    <button
                      type="button"
                      onClick={loadTestimonials}
                      className="btn-corp-secondary mt-3 inline-flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      إعادة المحاولة
                    </button>
                  </div>
                )}
                {testimonialsState === "ready" && testimonials.length === 0 && (
                  <p className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-6 text-center text-sm text-[var(--corp-muted)] md:col-span-3">
                    لا توجد آراء معروضة حالياً.
                  </p>
                )}
                {testimonialsState === "ready" &&
                  testimonials.slice(0, 3).map((testimonial) => (
                    <article key={testimonial.id} className="rounded-lg bg-white p-6 shadow-lg transition hover:shadow-xl">
                      <div
                        role="img"
                        aria-label={`تقييم ${Math.min(Math.max(Number(testimonial.rating) || 0, 0), 5)} من 5`}
                        className="mb-4 flex gap-1"
                      >
                        {Array.from({ length: Math.min(Math.max(Number(testimonial.rating) || 0, 0), 5) }).map((_, i) => (
                          <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" aria-hidden="true" />
                        ))}
                      </div>
                      <p className="mb-4 leading-loose text-slate-600">"{testimonial.text}"</p>
                      <div className="border-t pt-4">
                        <p className="font-bold text-gray-800">{testimonial.name}</p>
                        <p className="text-sm text-gray-500">{testimonial.project}</p>
                      </div>
                    </article>
                  ))}
              </div>

              {testimonials.length > 0 && (
                <div className="mt-10 text-center">
                  <Link to="/showcase" className="btn-corp-primary font-semibold hover:shadow-lg transition">
                    قراءة المزيد
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {(v?.showTools ?? true) && (
          <div>
            <p className="border-b border-slate-200 bg-[var(--corp-surface)] px-4 py-2 text-center text-xs text-[var(--corp-muted)]">
              عرض تعريفي لأدوات الذكاء الاصطناعي؛ تشغيلها الفعلي يعتمد على إعدادات الموقع.
            </p>
            <AIContentShowcase />
          </div>
        )}

        {(v?.showNewsletter ?? true) && <div id="contact"><NewsletterSignup /></div>}
      </main>

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
