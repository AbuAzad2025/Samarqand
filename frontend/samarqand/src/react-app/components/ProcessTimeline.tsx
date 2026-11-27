import { CheckCircle, FileSearch, HardHat, PenTool, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

type Step = { id: number; title: string; description: string };
type LoadState = "loading" | "ready" | "error";

export default function ProcessTimeline() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const requestId = useRef(0);
  const icons = useMemo(() => [FileSearch, PenTool, HardHat, CheckCircle], []);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setState("loading");
    fetchHomeSections()
      .then((data) => {
        if (id !== requestId.current) return;
        setSteps(Array.isArray(data?.timelineSteps) ? data.timelineSteps : []);
        setState("ready");
      })
      .catch(() => {
        if (id === requestId.current) setState("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="section-corp" dir="rtl" aria-labelledby="timeline-heading">
      <div className="container mx-auto px-4">
        <div className="mb-10 text-center">
          <div className="eyebrow-corp mb-2">منهج العمل</div>
          <h2 id="timeline-heading" className="mb-3 text-3xl font-bold text-slate-900 md:text-4xl">
            كيف نعمل
          </h2>
          <p className="mx-auto max-w-2xl text-slate-600">
            عملية واضحة وشفافة من البداية حتى النهاية
          </p>
        </div>

        {state === "loading" && (
          <p role="status" className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-6 text-center text-sm text-[var(--corp-muted)]">
            جارٍ تحميل مراحل العمل...
          </p>
        )}

        {state === "error" && (
          <div role="alert" className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-6 text-center">
            <p className="text-sm text-[var(--corp-muted)]">تعذّر عرض مراحل العمل حالياً.</p>
            <button
              type="button"
              onClick={load}
              className="btn-corp-secondary mt-3 inline-flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
            >
              <RefreshCw size={15} aria-hidden="true" />
              إعادة المحاولة
            </button>
          </div>
        )}

        {state === "ready" && steps.length === 0 && (
          <p className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-6 text-center text-sm text-[var(--corp-muted)]">
            لا توجد مراحل معروضة حالياً.
          </p>
        )}

        {state === "ready" && steps.length > 0 && (
          <div className="relative">
            <div className="absolute inset-x-0 top-8 hidden h-px bg-slate-200 md:block" aria-hidden="true" />
            <div className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => {
                const Icon = icons[index % icons.length] ?? FileSearch;
                return (
                  <article key={step.id ?? index} className="card-corp flex flex-col p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      <span className="text-xs font-bold text-slate-400">المرحلة {index + 1}</span>
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-slate-900">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
