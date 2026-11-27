import { useEffect, useState } from "react";
import { Link } from "react-router";
import { MapPin, Calendar, ArrowLeft } from "lucide-react";

import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import Footer from "@/react-app/components/Footer";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import {
  fetchSiteContentList,
  type SiteContentItem,
  type SiteContentKind,
} from "@/react-app/api/site";

const LABELS: Record<SiteContentKind, { title: string; intro: string; path: string }> = {
  projects: {
    title: "مشاريعنا",
    intro: "نفخر بإنجازاتنا ومشاريعنا المنجزة والجارية",
    path: "/projects",
  },
  articles: {
    title: "المقالات والأخبار",
    intro: "آخر المستجدات والمقالات الهندسية من شركة سمر قند",
    path: "/blog",
  },
  events: {
    title: "الفعاليات",
    intro: "ورش العمل والمعارض والفعاليات القادمة",
    path: "/events",
  },
  locations: {
    title: "مواقعنا",
    intro: "فروع ومواقع العمل الخاصة بالشركة",
    path: "/locations",
  },
};

export default function ContentList({ kind }: { kind: SiteContentKind }) {
  const [items, setItems] = useState<SiteContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const label = LABELS[kind];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSiteContentList(kind)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <TopBar />
      <Navigation />
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-3">{label.title}</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">{label.intro}</p>
        </header>

        {loading ? (
          <div className="text-center text-slate-500 py-16">جارٍ التحميل…</div>
        ) : items.length ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition"
              >
                {item.imageUrl ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-52 object-cover"
                  />
                ) : (
                  <div className="w-full h-52 bg-gradient-to-br from-sq-green via-sq-black to-sq-red" />
                )}
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    {item.date ? <span className="flex items-center gap-1"><Calendar size={14} />{item.date}</span> : null}
                    {kind === "locations" ? <span className="flex items-center gap-1"><MapPin size={14} />موقع</span> : null}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h2>
                  {item.excerpt ? (
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{item.excerpt}</p>
                  ) : null}
                  <Link
                    to={`${label.path}/${item.slug}`}
                    className="inline-flex items-center gap-2 text-sq-green font-bold hover:underline"
                  >
                    عرض التفاصيل <ArrowLeft size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-slate-600">لا توجد عناصر لعرضها حالياً.</p>
          </div>
        )}
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
