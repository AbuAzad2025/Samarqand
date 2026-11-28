import { useSiteContent, heading } from "@/react-app/utils/content";
import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Calculator,
  RefreshCw,
} from "lucide-react";

import { fetchSiteConfig, type SiteConfigPayload } from "@/react-app/api/site";

// Split into a separate chunk and mounted only when the user approaches the
// section, so the file is not fetched/parsed during the initial page load.
const ConstructionCalculator = lazy(
  () => import("@/react-app/components/ConstructionCalculator"),
);

function ToolLoadingFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-[640px] flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--corp-green)]"
        aria-hidden="true"
      />
      <p className="text-gray-700">{label}</p>
    </div>
  );
}

type DeferredSectionProps = {
  id: string;
  fallbackLabel: string;
  children: ReactNode;
};

function DeferredSection({ id, fallbackLabel, children }: DeferredSectionProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldLoad) return;
    const node = anchorRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={anchorRef} id={id}>
      {shouldLoad ? (
        <Suspense fallback={<ToolLoadingFallback label={fallbackLabel} />}>
          {children}
        </Suspense>
      ) : (
        <ToolLoadingFallback label={fallbackLabel} />
      )}
    </div>
  );
}

type ToolOverview = {
  id: string;
  title: string;
  description: string;
  icon: typeof Calculator;
};

const toolOverviews: ToolOverview[] = [
  {
    id: "calculator",
    title: "حاسبة الكميات والتكاليف",
    description: "حساب تقديري للكميات والتكاليف حسب نوع المشروع والمساحة وعدد الطوابق.",
    icon: Calculator,
  },
];

export default function ToolsPage() {
  const content = useSiteContent();
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(false);

    fetchSiteConfig()
      .then((siteConfig) => {
        if (!active) return;
        if (siteConfig === null) {
          setLoadError(true);
          return;
        }
        setConfig(siteConfig);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const v = config?.visibility;

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <TopBar />
      <Navigation />

      <section className="relative bg-[var(--corp-dark)] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading(content, "tools", "الأدوات")}</h1>
          <p className="text-xl max-w-3xl mx-auto">
            أدوات تساعد في تقدير الكميات والتكاليف
          </p>
        </div>
      </section>

      {isLoading ? (
        <section className="py-16 bg-white" aria-busy="true">
          <div className="container mx-auto px-4">
            <div role="status" className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[var(--corp-green)]" aria-hidden="true" />
              <p className="text-gray-700">جارٍ تجهيز الأدوات...</p>
            </div>
          </div>
        </section>
      ) : loadError ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <AlertCircle className="mx-auto mb-4 text-red-500" size={40} />
              <h2 className="mb-3 text-2xl font-bold text-gray-900">تعذّر تحميل الأدوات</h2>
              <p className="mx-auto max-w-2xl text-gray-600">
                لم نتمكن من جلب إعدادات الصفحة حالياً. يرجى المحاولة مرة أخرى.
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--corp-green)] px-6 py-3 font-semibold text-white transition hover:shadow-lg"
              >
                <RefreshCw size={18} />
                إعادة المحاولة
              </button>
            </div>
          </div>
        </section>
      ) : !(v?.showTools ?? true) ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء صفحة الأدوات من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="border-b border-gray-100 bg-white py-12">
            <div className="container mx-auto px-4">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">اختر الأداة المناسبة</h2>
              <p className="mb-8 text-gray-600">
                بطاقات مختصرة توضّح ما تقدّمه كل أداة قبل استخدامها
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {toolOverviews.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <article
                      key={tool.id}
                      className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                        <Icon size={22} aria-hidden="true" />
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-gray-900">{tool.title}</h3>
                      <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-600">
                        {tool.description}
                      </p>
                      <a
                        href={`#${tool.id}`}
                        className="text-sm font-semibold text-[var(--corp-green)] hover:underline"
                      >
                        انتقل إلى الأداة ↓
                      </a>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <DeferredSection id="calculator" fallbackLabel="جارٍ تجهيز الحاسبة...">
            <ConstructionCalculator />
          </DeferredSection>
        </>
      )}

      <WhatsAppButton />
      <FloatingCTA />
      <Footer />
    </div>
  );
}
