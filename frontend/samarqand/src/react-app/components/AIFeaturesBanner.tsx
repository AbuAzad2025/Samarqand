import { Brain, Sparkles, Zap, MessageSquare, FileText, BarChart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

export default function AIFeaturesBanner() {
  const [features, setFeatures] = useState<
    { id: number; title: string; description: string; badgeText: string }[]
  >([]);
  useEffect(() => {
    fetchHomeSections()
      .then((data) => setFeatures(data.aiFeatures))
      .catch(() => {});
  }, []);

  const icons = useMemo(
    () => [MessageSquare, Brain, FileText, Zap, BarChart, Sparkles],
    [],
  );

  return (
    <section className="border-t-2 border-[var(--corp-green)] bg-[var(--corp-dark)] text-white" dir="rtl">
      <div className="container mx-auto px-4 py-16">
        <div className="mb-12 max-w-3xl">
          <div className="eyebrow-corp mb-3 !text-emerald-300">تقنيات ذكية لخدمة مشاريعك</div>
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            أدوات رقمية تساعدك على التخطيط واتخاذ القرار
          </h2>
          <p className="text-white/70 leading-loose">
            نستخدم الأدوات الرقمية لدعم التخطيط وتحليل المعلومات وتسريع التواصل مع عملائنا، ضمن إمكانيات مُحدّدة وواضحة.
          </p>
        </div>

        {features.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.slice(0, 6).map((feature, index) => {
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
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                        {feature.badgeText}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-white/60">
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
