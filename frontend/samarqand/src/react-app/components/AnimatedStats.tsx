import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Users, Award, Briefcase } from 'lucide-react';

interface Stat {
  icon: typeof Building2;
  value: number;
  suffix: string;
  label: string;
  color: string;
}

import { fetchHomeSections } from "@/react-app/api/site";

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000;
    const steps = 60;
    const stepValue = target / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(stepValue * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isVisible, target]);

  return (
    <div ref={counterRef} className="text-5xl font-bold">
      {count}{suffix}
    </div>
  );
}

export default function AnimatedStats() {
  const [raw, setRaw] = useState<{ id: number; label: string; value: string }[]>(
    [],
  );

  useEffect(() => {
    fetchHomeSections()
      .then((data) => setRaw(data.stats))
      .catch(() => {});
  }, []);

  const stats: Stat[] = useMemo(() => {
    const icons = [Building2, Users, Award, Briefcase] as const;
    const colors = [
      "from-sq-green via-sq-black to-sq-red",
      "from-emerald-600 to-emerald-700",
      "from-emerald-700 to-emerald-800",
      "from-teal-700 to-emerald-800",
    ];

    return raw.slice(0, 4).map((s, idx) => {
      const num = parseFloat(String(s.value).replace(/[^\d.]/g, ""));
      const suffix = String(s.value).replace(/[\d.\s]/g, "") || "+";
      return {
        icon: icons[idx % icons.length] ?? Building2,
        value: Number.isFinite(num) ? num : 0,
        suffix,
        label: s.label,
        color: colors[idx % colors.length] ?? colors[0]!,
      };
    });
  }, [raw]);

  return (
    <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10" dir="rtl">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            إنجازاتنا بالأرقام
          </h2>
          <p className="text-gray-300 text-lg">نفخر بما حققناه من نجاحات</p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center"
            >
              <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                <stat.icon className="text-white" size={22} strokeWidth={1.8} aria-hidden="true" />
              </div>
              
              <div className="text-white mb-2">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              
              <p className="text-gray-300 text-lg font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(20px);
          }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </section>
  );
}
