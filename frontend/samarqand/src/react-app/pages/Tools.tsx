import { useSiteContent, heading } from "@/react-app/utils/content";
import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import FloatingCTA from "@/react-app/components/FloatingCTA";
import AIChatbot from "@/react-app/components/AIChatbot";
import AIDesignAnalyzer from "@/react-app/components/AIDesignAnalyzer";
import ConstructionCalculator from "@/react-app/components/ConstructionCalculator";
import ArchitecturalVisualizer from "@/react-app/components/ArchitecturalVisualizer";
import AIContentShowcase from "@/react-app/components/AIContentShowcase";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Brain,
  Calculator,
  FileText,
  Image as ImageIcon,
  Lock,
  RefreshCw,
} from "lucide-react";

import { fetchAuthAccess, fetchSiteConfig, type SiteConfigPayload } from "@/react-app/api/site";

type ToolOverview = {
  id: string;
  title: string;
  description: string;
  icon: typeof Calculator;
  restricted?: boolean;
  ai?: boolean;
};

const toolOverviews: ToolOverview[] = [
  {
    id: "ai-analyzer",
    title: "محلل التصاميم",
    description: "أدخل مواصفات مشروعك للحصول على تحليل منظّم للتكلفة والمدة والمواد.",
    icon: Brain,
    ai: true,
  },
  {
    id: "calculator",
    title: "حاسبة الكميات والتكاليف",
    description: "حساب تقديري للكميات والتكاليف حسب نوع المشروع والمساحة وعدد الطوابق.",
    icon: Calculator,
  },
  {
    id: "visualizer",
    title: "تخيّل مشروعك",
    description: "اطلب تصوراً بصرياً لواجهة مشروعك أو تصميمه الداخلي وفق الطراز الذي تختاره.",
    icon: ImageIcon,
    restricted: true,
    ai: true,
  },
  {
    id: "content-generator",
    title: "مولّد المحتوى",
    description: "صياغة مسودة لمقالة أو منشور تسويقي حول موضوع تختاره.",
    icon: FileText,
    restricted: true,
    ai: true,
  },
];

export default function ToolsPage() {
  const content = useSiteContent();
  const [canUseRestrictedTools, setCanUseRestrictedTools] = useState(false);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(false);

    Promise.all([
      fetchAuthAccess()
        .then((data) => Boolean(data.canUseRestrictedTools))
        .catch(() => null),
      fetchSiteConfig().catch(() => null),
    ])
      .then(([access, siteConfig]) => {
        if (!active) return;
        if (access === null || siteConfig === null) {
          setLoadError(true);
          return;
        }
        setCanUseRestrictedTools(access);
        setConfig(siteConfig);
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading(content, "tools", "الأدوات الذكية")}</h1>
          <p className="text-xl max-w-3xl mx-auto">
            أدوات تساعدك على اتخاذ قرارات أسرع وأكثر دقة قبل التنفيذ
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
                تم إخفاء صفحة الأدوات الذكية من لوحة التحكم.
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
                  const locked = Boolean(tool.restricted && !canUseRestrictedTools);
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
                      <div className="flex flex-wrap items-center gap-2">
                        {tool.ai ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            غير مُفعّل حالياً
                          </span>
                        ) : null}
                        {locked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            <Lock size={12} aria-hidden="true" />
                            تتطلب صلاحية
                          </span>
                        ) : (
                          <a
                            href={`#${tool.id}`}
                            className="text-sm font-semibold text-[var(--corp-green)] hover:underline"
                          >
                            انتقل إلى الأداة ↓
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                الأدوات التي تعتمد على الذكاء الاصطناعي غير مُفعّلة حالياً؛ حاسبة الكميات والتكاليف تعمل بشكل طبيعي.
              </p>
            </div>
          </section>

          <AIDesignAnalyzer />
          <ConstructionCalculator />
          {canUseRestrictedTools ? (
            <>
              <ArchitecturalVisualizer />
              <AIContentShowcase />
            </>
          ) : (
            <section className="py-16 bg-white">
              <div className="container mx-auto px-4">
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    أدوات مخصصة للمدراء
                  </h2>
                  <p className="text-gray-600 max-w-2xl mx-auto">
                    مولّد المحتوى وتخيل مشروعك مخصصان للمدراء والسوبر أدمن، وهما غير مُفعّلين حالياً.
                  </p>
                  <a
                    href="/control/login"
                    className="inline-block mt-6 bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
                  >
                    تسجيل الدخول للإدارة
                  </a>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <WhatsAppButton />
      <FloatingCTA />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
