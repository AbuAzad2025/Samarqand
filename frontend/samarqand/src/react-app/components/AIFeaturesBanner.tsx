import {
  AlertCircle,
  BarChart,
  Brain,
  FileText,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

type Feature = { id: number; title: string; description: string; badgeText: string };

// Created once at module load instead of on every render.
const SKELETON_ITEMS = [1, 2, 3];

export default function AIFeaturesBanner() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(false);

    fetchHomeSections()
      .then((data) => {
        if (!active) return;
        setFeatures(data.aiFeatures ?? []);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const icons = useMemo(
    () => [MessageSquare, Brain, FileText, Zap, BarChart, Sparkles],
    [],
  );
  const visibleFeatures = useMemo(() => features.slice(0, 6), [features]);

  return (
    <section className="border-t-2 border-[var(--corp-green)] bg-[var(--corp-dark)] text-white" dir="rtl">
      <div className="container mx-auto px-4 py-16">
        <div className="mb-8 max-w-3xl">
          <div className="eyebrow-corp mb-3 !text-emerald-300">أدوات رقمية لخدمة مشاريعك</div>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            أدوات تساعدك على التخطيط واتخاذ القرار
          </h2>
          <p className="text-white leading-loose">
            نعرض هنا أدوات رقمية للتخطيط وتنظيم المعلومات وتسريع التواصل مع عملائنا، ضمن إمكانيات مُحدّدة وواضحة.
          </p>
        </div>

        <div
          role="status"
          className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300/30 bg-amber-400/10 p-4"
        >
          <span className="rounded-full bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-200">
            غير مُفعّل حالياً
          </span>
          <p className="text-sm leading-relaxed text-white">
            الميزات التي تعتمد على الذكاء الاصطناعي غير مُفعّلة حالياً حتى يتم ضبط مفتاح الخدمة. يمكنك التواصل معنا مباشرة لمناقشة احتياجاتك.
          </p>
        </div>

        {isLoading ? (
          <div role="status" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <span className="sr-only">جارٍ تحميل قائمة الأدوات...</span>
            {SKELETON_ITEMS.map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-red-300/30 bg-red-400/10 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 text-red-300" size={36} />
            <p className="mb-4 text-white">تعذّر تحميل قائمة الأدوات حالياً. يرجى المحاولة مرة أخرى.</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <RefreshCw size={16} />
              إعادة المحاولة
            </button>
          </div>
        ) : features.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white">
            لا توجد أدوات لعرضها حالياً.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleFeatures.map((feature, index) => {
              const Icon = icons[index % icons.length] ?? Sparkles;
              return (
                <article
                  key={feature.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold">{feature.title}</h3>
                    {feature.badgeText ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                        {feature.badgeText}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-white">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
