import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Briefcase, Building2, Users } from "lucide-react";

import { fetchHomeSections } from "@/react-app/api/site";

interface Stat {
  id: number;
  icon: typeof Building2;
  value: number;
  suffix: string;
  label: string;
  color: string;
}

type RawStat = { id: number; label: string; value: string };

/** Verified fallback figures, used only when the API returns nothing usable. */
const FALLBACK_STATS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "مشروعاً", value: 19 },
  { label: "عضواً في الفريق", value: 3 },
  { label: "رأي عميل", value: 3 },
  { label: "يوماً عمل موثقاً", value: 70 },
];

const ICONS = [Building2, Users, Award, Briefcase] as const;
const COLORS = [
  "from-sq-green via-sq-black to-sq-red",
  "from-emerald-600 to-emerald-700",
  "from-emerald-700 to-emerald-800",
  "from-teal-700 to-emerald-800",
] as const;

// Fixed positions keep server and client markup identical (no hydration flicker).
const PARTICLES = [
  { left: "12%", top: "18%", delay: "0s", duration: "11s" },
  { left: "28%", top: "72%", delay: "2s", duration: "14s" },
  { left: "44%", top: "30%", delay: "4s", duration: "12s" },
  { left: "61%", top: "82%", delay: "1s", duration: "16s" },
  { left: "78%", top: "24%", delay: "3s", duration: "13s" },
  { left: "91%", top: "64%", delay: "5s", duration: "15s" },
] as const;

function parseStatValue(raw: string | undefined, fallback: number) {
  const text = String(raw ?? "").trim();
  const match = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(text);
  const num = match ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(num) || num < 0 || num > 100000) {
    return { value: fallback, suffix: "" };
  }
  return {
    value: Math.round(num),
    suffix: (match?.[2] ?? "").replace(/\s+/g, " ").trim().slice(0, 4),
  };
}

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.round(target)) : 0;
  const counterRef = useRef<HTMLSpanElement>(null);
  const firstSample = useRef(true);
  // `null` means "not started yet" — render the real value instead of a false 0.
  const [count, setCount] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = counterRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setCount(safeTarget);
      return;
    }

    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!active || !entry) return;
        const intersecting = entry.isIntersecting;

        if (firstSample.current) {
          firstSample.current = false;
          // Already on screen at mount: show the final value, never flash a zero.
          if (intersecting) {
            active = false;
            observer.disconnect();
            setCount(safeTarget);
          }
          return;
        }

        if (!intersecting) return;
        active = false;
        observer.disconnect();
        setAnimate(true);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [safeTarget]);

  useEffect(() => {
    if (!animate) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

    if (safeTarget <= 0 || reduceMotion) {
      setCount(safeTarget);
      return;
    }

    const duration = 1200;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.max(1, Math.round(safeTarget * eased)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, safeTarget]);

  return (
    <span ref={counterRef}>
      {count === null ? safeTarget : count}
      {suffix}
    </span>
  );
}

export default function AnimatedStats() {
  const [raw, setRaw] = useState<RawStat[]>([]);

  useEffect(() => {
    let active = true;
    fetchHomeSections()
      .then((data) => {
        if (active) setRaw(Array.isArray(data?.stats) ? data.stats : []);
      })
      .catch(() => {
        // Keep the verified fallback figures below.
      });
    return () => {
      active = false;
    };
  }, []);

  const stats: Stat[] = useMemo(
    () =>
      FALLBACK_STATS.map((fallback, index) => {
        const source = raw[index];
        const parsed = parseStatValue(source?.value, fallback.value);
        return {
          id: source?.id ?? index + 1,
          icon: ICONS[index % ICONS.length] ?? Building2,
          value: parsed.value,
          suffix: parsed.suffix,
          label: String(source?.label || fallback.label),
          color: COLORS[index % COLORS.length] ?? COLORS[0],
        };
      }),
    [raw],
  );

  return (
    <section
      aria-labelledby="stats-heading"
      className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        {PARTICLES.map((particle) => (
          <div
            key={particle.left}
            className="absolute h-2 w-2 animate-float rounded-full bg-white"
            style={{
              left: particle.left,
              top: particle.top,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10" dir="rtl">
        <div className="mb-12 text-center">
          <h2 id="stats-heading" className="text-3xl md:text-4xl font-bold text-white mb-3">
            إنجازاتنا بالأرقام
          </h2>
          <p className="text-gray-200">نفخر بما حققناه من نجاحات</p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
            >
              <dt className="mb-2 text-4xl font-bold text-white">
                <div
                  className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}
                >
                  <stat.icon className="text-white" size={22} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </dt>
              <dd className="text-base font-semibold text-gray-200">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(20px); }
        }
        .animate-float { animation: float linear infinite; }
      `}</style>
    </section>
  );
}
