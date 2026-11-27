import { Link } from "react-router";
import { Images, MessageSquare, Star } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useSiteContent, heading } from "@/react-app/utils/content";
import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import AIChatbot from "@/react-app/components/AIChatbot";
import BeforeAfterSlider from "@/react-app/components/BeforeAfterSlider";
import InteractiveTeam from "@/react-app/components/InteractiveTeam";
import NewsletterSignup from "@/react-app/components/NewsletterSignup";

import { fetchSiteConfig, fetchTestimonials, type SiteConfigPayload, type TestimonialPayload } from "@/react-app/api/site";

/** Existing sample assets only — no new images are introduced here. */
const galleryItems = [
  {
    before: "/static/website/images/before-renovation.webp",
    after: "/static/website/images/after-renovation.webp",
    title: "تجديد واجهات المباني",
    caption: "صور قبل وبعد لواجهة المبنى بعد أعمال التجديد.",
  },
  {
    before: "/static/website/images/before-interior.webp",
    after: "/static/website/images/after-interior.webp",
    title: "تجديد التصميم الداخلي",
    caption: "صور قبل وبعد للمساحات الداخلية بعد أعمال التجديد.",
  },
] as const;

function imageAvailable(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

function Notice({
  icon,
  title,
  message,
  withContact = false,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  withContact?: boolean;
}) {
  return (
    <div role="status" className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        {icon}
      </span>
      <h3 className="text-lg font-bold text-gray-800">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{message}</p>
      {withContact ? (
        <Link to="/contact" className="btn-corp-link">تواصل معنا</Link>
      ) : null}
    </div>
  );
}

export default function ShowcasePage() {
  const content = useSiteContent();
  const [testimonials, setTestimonials] = useState<TestimonialPayload[]>([]);
  const [testimonialsStatus, setTestimonialsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [galleryReady, setGalleryReady] = useState<boolean[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    setTestimonialsStatus("loading");
    fetchTestimonials()
      .then((data) => {
        if (!cancelled) {
          setTestimonials(data);
          setTestimonialsStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setTestimonialsStatus("error");
      });

    fetchSiteConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Sample images may be removed later; hide broken pairs instead of showing broken images.
  useEffect(() => {
    let cancelled = false;

    Promise.all(
      galleryItems.map(async (item) => {
        const results = await Promise.all([
          imageAvailable(item.before),
          imageAvailable(item.after),
        ]);
        return results.every(Boolean);
      }),
    ).then((results) => {
      if (!cancelled) setGalleryReady(results);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const v = config?.visibility;
  const visibleGallery = galleryItems.filter((_, index) => galleryReady?.[index] === true);

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <TopBar />
      <Navigation />

      <section className="relative bg-[var(--corp-dark)] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading(content, "showcase", "معرض الأعمال")}</h1>
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
          <section className="py-16 sm:py-20 bg-white" aria-labelledby="showcase-gallery-heading">
            <div className="container mx-auto px-4">
              <div className="mb-10 text-center">
                <p className="eyebrow-corp mb-2">معرض الصور</p>
                <h2 id="showcase-gallery-heading" className="text-3xl md:text-4xl font-bold text-gray-800">
                  شاهد التحول
                </h2>
                <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
                  صور قبل وبعد لأعمال التجديد والتصميم الداخلي.
                </p>
              </div>

              {galleryReady === null ? (
                <p role="status" className="text-center text-sm text-gray-500">
                  جارٍ تحميل صور المعرض…
                </p>
              ) : visibleGallery.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-8">
                  {visibleGallery.map((item) => (
                    <figure key={item.title} className="card-corp overflow-hidden">
                      <BeforeAfterSlider
                        before={item.before}
                        after={item.after}
                        title={item.title}
                      />
                      <figcaption className="border-t border-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-600">
                        {item.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <Notice
                  icon={<Images size={24} aria-hidden="true" />}
                  title="لا توجد صور لعرضها حالياً"
                  message="ستظهر هنا صور المشاريع عند توفرها."
                />
              )}
            </div>
          </section>

          {(v?.showTeam ?? true) && <InteractiveTeam />}

          {(v?.showTestimonials ?? true) && (
            <section className="py-16 bg-white" id="testimonials" aria-labelledby="testimonials-heading">
              <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                  <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-bold text-gray-800">
                    آراء عملائنا
                  </h2>
                  <p className="text-gray-600 max-w-2xl mx-auto mt-3">
                    ما يقوله عملاؤنا عن خدماتنا
                  </p>
                </div>

                {testimonialsStatus === "loading" ? (
                  <p role="status" className="text-center text-sm text-gray-500">
                    جارٍ تحميل الآراء…
                  </p>
                ) : testimonialsStatus === "error" ? (
                  <Notice
                    icon={<MessageSquare size={24} aria-hidden="true" />}
                    title="تعذّر تحميل الآراء"
                    message="يمكنك المحاولة مرة أخرى لاحقاً أو التواصل معنا."
                    withContact
                  />
                ) : testimonials.length === 0 ? (
                  <Notice
                    icon={<MessageSquare size={24} aria-hidden="true" />}
                    title="لا توجد آراء لعرضها حالياً"
                    message="ستظهر هنا آراء العملاء عند توفرها."
                  />
                ) : (
                  <div className="grid md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial) => {
                      const rating = Math.max(
                        0,
                        Math.min(5, Math.round(Number(testimonial.rating) || 0)),
                      );
                      return (
                        <figure key={testimonial.id} className="card-corp flex flex-col p-6">
                          <div className="flex gap-1 mb-4" aria-hidden="true">
                            {Array.from({ length: rating }, (_, index) => (
                              <Star
                                key={index}
                                size={20}
                                className="fill-yellow-400 text-yellow-400"
                              />
                            ))}
                          </div>
                          <span className="sr-only">تقييم {rating} من 5</span>
                          <blockquote className="mb-4 flex-1 text-gray-600 italic">
                            "{testimonial.text}"
                          </blockquote>
                          <figcaption className="border-t pt-4">
                            <p className="font-bold text-gray-800">{testimonial.name}</p>
                            <p className="text-sm text-gray-500">{testimonial.project}</p>
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                )}
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
