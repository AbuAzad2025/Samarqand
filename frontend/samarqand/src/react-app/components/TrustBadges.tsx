import {
  Award,
  Building2,
  HardHat,
  RefreshCw,
  Shield,
  ThumbsUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

type Badge = { id: number; title: string; description: string; iconClass: string };
type LoadState = "loading" | "ready" | "error";

export default function TrustBadges() {
  const [items, setItems] = useState<Badge[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const requestId = useRef(0);

  const icons = useMemo(() => [Shield, Award, Users, ThumbsUp], []);
  const iconMap: Record<string, LucideIcon> = useMemo(
    () => ({
      shield: Shield,
      award: Award,
      users: Users,
      thumbsup: ThumbsUp,
      building: Building2,
      hardhat: HardHat,
    }),
    [],
  );

  const load = useCallback(() => {
    const id = ++requestId.current;
    setState("loading");
    fetchHomeSections()
      .then((data) => {
        if (id !== requestId.current) return;
        setItems(Array.isArray(data?.trustBadges) ? data.trustBadges : []);
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
    <section
      className="border-y border-gray-200 bg-gradient-to-r from-gray-50 to-white py-12"
      dir="rtl"
      aria-labelledby="trust-heading"
    >
      <div className="container mx-auto px-4">
        <h2 id="trust-heading" className="sr-only">لماذا تختار سمر قند</h2>

        {state === "loading" && (
          <p role="status" className="text-center text-sm text-[var(--corp-muted)]">
            جارٍ تحميل معلومات الثقة...
          </p>
        )}

        {state === "error" && (
          <div role="alert" className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center">
            <p className="text-sm text-[var(--corp-muted)]">تعذّر عرض معلومات الثقة حالياً.</p>
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

        {state === "ready" && items.length === 0 && (
          <p className="text-center text-sm text-[var(--corp-muted)]">
            لا توجد معلومات معروضة حالياً.
          </p>
        )}

        {state === "ready" && items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((badge, index) => {
              // "fas fa-thumbs-up" -> "thumbsup"
              const key = (badge.iconClass || "")
                .trim()
                .split(/\s+/)
                .pop()
                ?.toLowerCase()
                .replace(/[^a-z]/g, "") || "";
              const Icon = iconMap[key] ?? icons[index % icons.length] ?? Shield;
              return (
                <div
                  key={badge.id}
                  className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                    <Icon size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-bold text-gray-800">{badge.title}</h3>
                    <p className="text-xs text-gray-600">{badge.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
