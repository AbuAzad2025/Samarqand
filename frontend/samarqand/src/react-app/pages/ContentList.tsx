import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AlertCircle, ArrowLeft, Calendar, MapPin } from "lucide-react";

import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import Footer from "@/react-app/components/Footer";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import {
  fetchSiteContentList,
  type SiteContentItem,
  type SiteContentKind,
} from "@/react-app/api/site";

const LABELS: Record<SiteContentKind, { title: string; intro: string; path: string; type: string }> = {
  projects: {
    title: "مشاريعنا",
    intro: "نفخر بإنجازاتنا ومشاريعنا المنجزة والجارية",
    path: "/projects",
    type: "مشروع",
  },
  articles: {
    title: "المقالات والأخبار",
    intro: "آخر المستجدات والمقالات الهندسية من شركة سمر قند",
    path: "/blog",
    type: "مقال",
  },
  events: {
    title: "الفعاليات",
    intro: "ورش العمل والمعارض والفعاليات القادمة",
    path: "/events",
    type: "فعالية",
  },
  locations: {
    title: "مواقعنا",
    intro: "فروع ومواقع العمل الخاصة بالشركة",
    path: "/locations",
    type: "موقع",
  },
};

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar");
}

export default function ContentList({ kind }: { kind: SiteContentKind }) {
  const [items, setItems] = useState<SiteContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const label = LABELS[kind];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchSiteContentList(kind)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, reloadKey]);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <TopBar />
      <Navigation />
      <div className="container mx-auto px-4 py-16">
        <header className="mb-10 text-center">
          <h1 className="mb-3 text-4xl font-extrabold text-slate-900">{label.title}</h1>
          <p className="mx-auto max-w-2xl text-slate-600">{label.intro}</p>
        </header>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="جارٍ التحميل">
            {[0, 1, 2].map((index) => (
              <div key={index} className="card-corp animate-pulse overflow-hidden">
                <div className="h-52 w-full bg-slate-200" />
                <div className="space-y-3 p-6">
                  <div className="h-5 w-2/3 rounded bg-slate-200" />
                  <div className="h-4 w-full rounded bg-slate-200" />
                  <div className="h-4 w-5/6 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <AlertCircle size={36} className="mx-auto mb-3 text-sq-red" aria-hidden="true" />
            <p className="mb-4 text-slate-700">تعذّر تحميل العناصر. يرجى المحاولة مرة أخرى.</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="btn-corp-secondary"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : items.length ? (
          <>
            <p role="status" aria-live="polite" className="mb-5 text-sm font-semibold text-slate-600">
              عدد العناصر المعروضة: {items.length}
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  aria-labelledby={`content-item-${item.id}`}
                  className="card-corp flex flex-col overflow-hidden transition hover:shadow-lg"
                >
                  <div className="relative h-52 overflow-hidden bg-[var(--corp-surface)]">
                    {item.imageUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        width={800}
                        height={500}
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-full w-full bg-gradient-to-br from-sq-green via-sq-black to-sq-red"
                      />
                    )}
                    <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-sq-green shadow-sm">
                      {label.type}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {item.date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} aria-hidden="true" />
                          <time dateTime={item.date}>{formatDate(item.date)}</time>
                        </span>
                      ) : null}
                      {kind === "locations" ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} aria-hidden="true" />موقع
                        </span>
                      ) : null}
                    </div>
                    <h2 id={`content-item-${item.id}`} className="mb-2 text-lg font-bold text-slate-900">
                      {item.title}
                    </h2>
                    {item.excerpt ? (
                      <p className="mb-4 text-sm leading-relaxed text-slate-600">{item.excerpt}</p>
                    ) : null}
                    <Link
                      to={`${label.path}/${item.slug}`}
                      aria-label={`عرض التفاصيل: ${label.type} ${item.title}`}
                      className="btn-corp-link mt-auto inline-flex items-center gap-2 self-start"
                    >
                      عرض التفاصيل <ArrowLeft size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-600">لا توجد عناصر لعرضها حالياً.</p>
          </div>
        )}
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
