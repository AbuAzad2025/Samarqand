import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Globe,
  MapPin,
  Phone,
  Printer,
} from "lucide-react";

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

const BACK_LABELS: Record<SiteContentKind, string> = {
  articles: "المقالات والأخبار",
  events: "الفعاليات",
  locations: "مواقعنا",
  projects: "المشاريع",
};

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar");
}

function formatTimelineDate(value: string): string {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function monthLabel(value: string): string {
  const date = new Date(`${value}-01`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar", { month: "long", year: "numeric" });
}

export default function ContentDetail({ kind }: { kind: SiteContentKind }) {
  const { slug = "" } = useParams();
  const [item, setItem] = useState<SiteContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setItem(null);
    fetchSiteContentDetail(kind, slug)
      .then((data) => {
        if (!cancelled) setItem(data);
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
  }, [kind, slug, reloadKey]);

  useEffect(() => {
    setSelectedMonth("all");
  }, [item]);

  useEffect(() => {
    if (!item) return;
    document.title = item.seoTitle || item.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = item.description || item.excerpt || "";
  }, [item]);

  const months = useMemo(
    () =>
      Array.from(new Set((item?.timeline ?? []).map((step) => step.date.slice(0, 7)))).sort((a, b) =>
        b.localeCompare(a),
      ),
    [item],
  );

  const timelineSteps = useMemo(() => {
    const steps = item?.timeline ?? [];
    return selectedMonth === "all" ? steps : steps.filter((step) => step.date.startsWith(selectedMonth));
  }, [item, selectedMonth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <TopBar />
        <Navigation />
        <div className="container mx-auto max-w-4xl px-4 py-12" role="status" aria-label="جارٍ التحميل">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-2/3 rounded bg-slate-200" />
            <div className="h-72 w-full rounded-xl bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-5/6 rounded bg-slate-200" />
            <div className="h-40 w-full rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <TopBar />
        <Navigation />
        <div className="container mx-auto max-w-2xl px-4 py-20">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <AlertCircle size={36} className="mx-auto mb-3 text-sq-red" aria-hidden="true" />
            <h1 className="mb-3 text-2xl font-bold text-slate-900">تعذّر تحميل المحتوى</h1>
            <p className="mb-6 text-slate-600">يرجى المحاولة مرة أخرى بعد قليل.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
                className="btn-corp-primary"
              >
                إعادة المحاولة
              </button>
              <Link to={PATHS[kind]} className="btn-corp-secondary">
                العودة إلى {BACK_LABELS[kind]}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <TopBar />
        <Navigation />
        <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="mb-4 text-2xl font-bold text-slate-900">المحتوى غير موجود</h1>
          <Link to={PATHS[kind]} className="text-sq-green font-bold underline">
            العودة إلى {BACK_LABELS[kind]}
          </Link>
        </div>
      </div>
    );
  }

  const projectFacts: { label: string; value: string; ltr?: boolean; note?: string }[] = [];
  if (kind === "projects") {
    if (item.title) projectFacts.push({ label: "اسم المشروع", value: item.title });
    if (item.location) projectFacts.push({ label: "الموقع", value: item.location });
    if (item.budgetAmount != null) {
      projectFacts.push({
        label: "قيمة العقد",
        value: item.budgetAmount.toLocaleString("en-US"),
        ltr: true,
        note: "دون البنود التغييرية",
      });
    }
    if (item.contract) projectFacts.push({ label: "رقم العقد", value: item.contract, ltr: true });
    if (item.documentedDays != null) {
      projectFacts.push({ label: "عدد الأيام الموثّقة", value: `${item.documentedDays} يوماً` });
    }
    if (item.documentedPhotos != null) {
      projectFacts.push({ label: "عدد الصور التوثيقية", value: `${item.documentedPhotos} صورة` });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <TopBar />
      <Navigation />
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            to={PATHS[kind]}
            aria-label={`العودة إلى ${BACK_LABELS[kind]}`}
            className="inline-flex items-center gap-2 text-sq-green font-bold hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" /> العودة إلى {BACK_LABELS[kind]}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-corp-secondary print:hidden"
          >
            <Printer size={16} aria-hidden="true" /> طباعة الصفحة
          </button>
        </div>

        <article className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8" aria-labelledby="content-title">
          <h1 id="content-title" className="mb-5 text-3xl font-extrabold text-slate-900">
            {item.title}
          </h1>

          {item.imageUrl ? (
            <figure className="mb-8">
              <img
                loading="lazy"
                decoding="async"
                width={1200}
                height={800}
                src={item.imageUrl}
                alt={kind === "projects" ? `صورة مشروع ${item.title}` : item.title}
                className="w-full max-h-96 object-cover rounded-xl"
              />
            </figure>
          ) : null}

          {projectFacts.length ? (
            <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projectFacts.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-bold text-slate-500">{fact.label}</dt>
                  <dd className="mt-1 text-lg font-extrabold text-slate-900" dir={fact.ltr ? "ltr" : undefined}>
                    {fact.value}
                    {fact.note ? (
                      <span className="mt-1 block text-xs font-normal text-slate-500">{fact.note}</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {kind === "projects" && item.status === "ongoing" ? (
            <div className="mb-5 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-bold text-sq-green">مشروع جاري</span>
            </div>
          ) : null}

          <div className="mb-8 flex flex-wrap gap-4 text-sm text-slate-500">
            {item.date ? (
              <span className="flex items-center gap-1">
                <Calendar size={15} aria-hidden="true" />
                <time dateTime={item.date}>{formatDate(item.date)}</time>
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

          {kind === "projects" && months.length ? (
            <section className="mt-10" aria-labelledby="timeline-heading">
              <h2 id="timeline-heading" className="mb-2 text-xl font-bold text-slate-900">
                التسلسل الزمني للأعمال بالصور
              </h2>
              <p className="mb-5 text-xs text-slate-500">
                صورة ممثلة عن كل يوم من أيام العمل؛ الأرقام تشير إلى عدد الصور التوثيقية في اليوم.
              </p>
              <div
                role="group"
                aria-label="تصفية التسلسل الزمني حسب الشهر"
                className="mb-5 flex flex-wrap gap-2"
              >
                <button
                  type="button"
                  aria-pressed={selectedMonth === "all"}
                  onClick={() => setSelectedMonth("all")}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                    selectedMonth === "all"
                      ? "bg-sq-green text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  كل الأشهر
                </button>
                {months.map((month) => (
                  <button
                    key={month}
                    type="button"
                    aria-pressed={selectedMonth === month}
                    onClick={() => setSelectedMonth(month)}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                      selectedMonth === month
                        ? "bg-sq-green text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {monthLabel(month)}
                  </button>
                ))}
              </div>
              {timelineSteps.length ? (
                <ol className="space-y-5 border-r-2 border-slate-100 pr-4" aria-live="polite">
                  {timelineSteps.map((step, index) => (
                    <li key={`${step.date}-${index}`} className="grid gap-3 sm:grid-cols-[180px_1fr]">
                      {step.imageUrl ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          width={400}
                          height={224}
                          src={step.imageUrl}
                          alt={`صورة العمل بتاريخ ${formatTimelineDate(step.date)}: ${step.title}`}
                          className="h-28 w-full rounded-lg object-cover"
                        />
                      ) : null}
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-3 text-xs">
                          <time dateTime={step.date} className="font-bold text-sq-green" dir="ltr">
                            {formatTimelineDate(step.date)}
                          </time>
                          {step.photos ? <span className="text-slate-500">{step.photos} صورة</span> : null}
                        </div>
                        <div className="font-bold text-slate-900">{step.title}</div>
                        <p className="text-sm leading-relaxed text-slate-600">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">لا توجد خطوات في هذا الشهر.</p>
              )}
            </section>
          ) : null}

          {kind === "projects" && item.gallery?.length ? (
            <section className="mt-10" aria-labelledby="gallery-heading">
              <h2 id="gallery-heading" className="mb-4 text-xl font-bold text-slate-900">معرض المشروع</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {item.gallery.map((image, index) => (
                  <figure key={index} className="overflow-hidden rounded-xl border border-slate-200">
                    <img
                      loading="lazy"
                      decoding="async"
                      width={800}
                      height={500}
                      src={image.url}
                      alt={image.caption ? `صورة من ${item.title}: ${image.caption}` : `صورة من ${item.title}`}
                      className="h-56 w-full object-cover"
                    />
                    {image.caption ? (
                      <figcaption className="px-3 py-2 text-xs text-slate-600">{image.caption}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {kind === "events" && item.occurrences?.length ? (
            <div className="mt-8 rounded-xl bg-emerald-50 p-5">
              <h2 className="mb-3 font-bold">مواعيد الفعالية</h2>
              {item.occurrences.map((occ, idx) => (
                <p key={idx} className="text-sm text-slate-700">
                  {occ.start} — {occ.end}
                </p>
              ))}
            </div>
          ) : null}

          {kind === "locations" ? (
            <div className="mt-8 space-y-2 text-slate-700">
              {item.address ? (
                <p className="flex items-center gap-2"><MapPin size={16} aria-hidden="true" />{item.address}</p>
              ) : null}
              {item.phone ? (
                <p className="flex items-center gap-2"><Phone size={16} aria-hidden="true" />{item.phone}</p>
              ) : null}
              {item.website ? (
                <p className="flex items-center gap-2"><Globe size={16} aria-hidden="true" />{item.website}</p>
              ) : null}
              {item.latitude != null && item.longitude != null ? (
                <a
                  className="inline-flex items-center gap-2 text-sq-green font-bold underline"
                  href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={16} aria-hidden="true" /> عرض على الخريطة
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
