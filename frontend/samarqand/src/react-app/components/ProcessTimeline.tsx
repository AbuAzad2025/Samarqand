import { CheckCircle, FileSearch, HardHat, PenTool } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

export default function ProcessTimeline() {
  const [steps, setSteps] = useState<
    { id: number; title: string; description: string }[]
  >([]);

  useEffect(() => {
    fetchHomeSections()
      .then((data) => setSteps(data.timelineSteps))
      .catch(() => {});
  }, []);

  const icons = useMemo(() => [FileSearch, PenTool, HardHat, CheckCircle], []);

  return (
    <section className="section-corp" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="eyebrow-corp mb-2">منهج العمل</div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            كيف نعمل
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            عملية واضحة وشفافة من البداية حتى النهاية
          </p>
        </div>

        <div className="relative">
          <div className="hidden md:block absolute inset-x-0 top-8 h-px bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 relative">
            {steps.map((step, index) => {
              const Icon = icons[index % icons.length] ?? FileSearch;
              return (
                <article key={step.id ?? index} className="card-corp flex flex-col p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      المرحلة {index + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
