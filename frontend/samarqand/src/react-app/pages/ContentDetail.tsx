import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Calendar, MapPin, Phone, Globe } from "lucide-react";

import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import Footer from "@/react-app/components/Footer";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import {
  fetchSiteContentDetail,
  type SiteContentDetail,
  type SiteContentKind,
} from "@/react-app/api/site";

const PATHS: Record<SiteContentKind, string> = {
  articles: "/blog",
  events: "/events",
  locations: "/locations",
  projects: "/projects",
};

export default function ContentDetail({ kind }: { kind: SiteContentKind }) {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<SiteContentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSiteContentDetail(kind, slug)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, slug]);

  useEffect(() => {
    if (!item) return;
    document.title = item.seoTitle || item.title;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = item.description || item.excerpt || "";
  }, [item]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <TopBar />
        <Navigation />
        <div className="text-center py-24 text-slate-500">جارٍ التحميل…</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">المحتوى غير موجود</h1>
          <Link to={PATHS[kind]} className="text-sq-green font-bold underline">
            العودة للقائمة
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <TopBar />
      <Navigation />
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link
          to={PATHS[kind]}
          className="inline-flex items-center gap-2 text-sq-green font-bold mb-6 hover:underline"
        >
          <ArrowLeft size={16} /> العودة
        </Link>
        <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {item.imageUrl ? (
            <img
              loading="lazy"
              decoding="async"
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-72 object-cover rounded-xl mb-8"
            />
          ) : null}
          <h1 className="text-3xl font-extrabold text-slate-900 mb-4">{item.title}</h1>
          {kind === "projects" && (item.location || item.status) ? (
            <div className="mb-5 flex flex-wrap gap-2 text-sm">
              {item.status === "ongoing" ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-sq-green">
                  مشروع جاري
                </span>
              ) : null}
              {item.location ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  <MapPin size={14} /> {item.location}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-8">
            {item.date ? (
              <span className="flex items-center gap-1">
                <Calendar size={15} />
                {new Date(item.date).toLocaleDateString("ar")}
              </span>
            ) : null}
            {item.author ? <span>{item.author}</span> : null}
          </div>

          {item.bodyHtml ? (
            <div
              className="prose prose-slate max-w-none leading-loose text-slate-700"
              dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
            />
          ) : (
            <p className="text-slate-600 leading-loose">{item.description}</p>
          )}

          {kind === "projects" && item.gallery?.length ? (
            <div className="mt-10">
              <h2 className="text-xl font-bold text-slate-900 mb-4">معرض المشروع</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {item.gallery.map((image, index) => (
                  <figure key={index} className="overflow-hidden rounded-xl border border-slate-200">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={image.url}
                      alt={image.caption || item.title}
                      className="h-56 w-full object-cover"
                    />
                    {image.caption ? (
                      <figcaption className="px-3 py-2 text-xs text-slate-600">
                        {image.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </div>
          ) : null}

          {kind === "events" && item.occurrences?.length ? (
            <div className="mt-8 rounded-xl bg-emerald-50 p-5">
              <h2 className="font-bold mb-3">مواعيد الفعالية</h2>
              {item.occurrences.map((occ, idx) => (
                <p key={idx} className="text-sm text-slate-700">
                  {occ.start} — {occ.end}
                </p>
              ))}
            </div>
          ) : null}

          {kind === "locations" ? (
            <div className="mt-8 space-y-2 text-slate-700">
              {item.address ? <p className="flex items-center gap-2"><MapPin size={16} />{item.address}</p> : null}
              {item.phone ? <p className="flex items-center gap-2"><Phone size={16} />{item.phone}</p> : null}
              {item.website ? <p className="flex items-center gap-2"><Globe size={16} />{item.website}</p> : null}
              {item.latitude != null && item.longitude != null ? (
                <a
                  className="inline-flex items-center gap-2 text-sq-green font-bold underline"
                  href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={16} /> عرض على الخريطة
                </a>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
