import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Calendar, MapPin, Search } from "lucide-react";

import { useSiteContent, heading } from "@/react-app/utils/content";
import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import AIChatbot from "@/react-app/components/AIChatbot";

import {
  fetchCompany,
  fetchProjects,
  fetchSiteConfig,
  type CompanyPayload,
  type ProjectPayload,
  type SiteConfigPayload,
} from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";

type SortOption = "newest" | "oldest" | "title";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "الأحدث",
  oldest: "الأقدم",
  title: "حسب الاسم",
};

function yearNumber(year: string): number {
  const match = year.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

export default function Projects() {
  const content = useSiteContent();
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchProjects()
      .then((data) => {
        if (!cancelled) setProjects(data);
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
  }, [reloadKey]);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;

  const categories = useMemo(
    () =>
      Array.from(new Set(projects.map((project) => project.category).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ar"),
      ),
    [projects],
  );

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      if (category && project.category !== category) return false;
      if (!term) return true;
      return [project.title, project.description, project.location, project.category, project.year].some(
        (value) => value.toLowerCase().includes(term),
      );
    });
    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ar");
      const byYear = yearNumber(b.year) - yearNumber(a.year);
      if (byYear !== 0) return sort === "newest" ? byYear : -byYear;
      return a.title.localeCompare(b.title, "ar");
    });
  }, [projects, query, category, sort]);

  const hasFilters = query.trim() !== "" || category !== "";
  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setSort("newest");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-[var(--corp-dark)] text-white py-14">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{heading(content, "projects", "مشاريعنا")}</h1>
          <p className="text-xl max-w-3xl mx-auto">نفخر بإنجازاتنا ونلتزم بتقديم أفضل الخدمات</p>
        </div>
      </section>

      {/* Projects Grid */}
      {!(v?.showProjects ?? true) ? (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">هذا القسم مخفي حالياً</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">تم إخفاء صفحة المشاريع من لوحة التحكم.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-12" aria-labelledby="projects-results-heading">
          <div className="container mx-auto px-4">
            {/* Search, filter, sort */}
            <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
              <div>
                <label htmlFor="project-search" className="mb-2 block text-sm font-bold text-gray-700">
                  البحث في المشاريع
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="project-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ابحث بالاسم أو الموقع أو التصنيف"
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-10 pl-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-sq-green focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="project-category" className="mb-2 block text-sm font-bold text-gray-700">
                  التصنيف
                </label>
                <select
                  id="project-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-sq-green focus:outline-none"
                >
                  <option value="">كل التصنيفات</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="project-sort" className="mb-2 block text-sm font-bold text-gray-700">
                  الترتيب
                </label>
                <select
                  id="project-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-sq-green focus:outline-none"
                >
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                    <option key={option} value={option}>
                      {SORT_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 id="projects-results-heading" className="sr-only">
                نتائج المشاريع
              </h2>
              <p role="status" aria-live="polite" className="text-sm font-semibold text-gray-600">
                {loading
                  ? "جارٍ تحميل المشاريع…"
                  : `عرض ${visibleProjects.length} من ${projects.length} مشروع`}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  مسح التصفية
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="جارٍ تحميل المشاريع">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="card-corp animate-pulse overflow-hidden">
                    <div className="h-52 w-full bg-gray-200" />
                    <div className="space-y-3 p-6">
                      <div className="h-6 w-2/3 rounded bg-gray-200" />
                      <div className="h-4 w-full rounded bg-gray-200" />
                      <div className="h-4 w-5/6 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                <AlertCircle size={36} className="mx-auto mb-3 text-sq-red" aria-hidden="true" />
                <p className="mb-4 text-gray-700">تعذّر تحميل المشاريع. يرجى المحاولة مرة أخرى.</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="btn-corp-secondary"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : visibleProjects.length ? (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {visibleProjects.map((project) => (
                  <article key={project.id} className="card-corp flex flex-col overflow-hidden transition group">
                    <div className="relative h-52 overflow-hidden bg-[var(--corp-surface)]">
                      {project.imageUrl ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={project.imageUrl}
                          alt={project.category ? `${project.title} - ${project.category}` : project.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Building2 size={44} strokeWidth={1.2} aria-hidden="true" />
                        </div>
                      )}
                      {project.category ? (
                        <div className="absolute right-4 top-4 rounded-full bg-sq-green px-4 py-2 text-sm font-semibold text-white">
                          {project.category}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="mb-3 text-xl font-bold text-gray-800">{project.title}</h3>
                      <p className="mb-4 line-clamp-3 text-gray-600">{project.description}</p>
                      <div className="mt-auto">
                        <Link
                          to={`/projects/${project.slug}`}
                          aria-label={`عرض تفاصيل مشروع ${project.title}`}
                          className="btn-corp-link mt-2 inline-flex items-center gap-2"
                        >
                          تفاصيل المشروع ←
                        </Link>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                          {project.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-sq-green" aria-hidden="true" />
                              <span>{project.location}</span>
                            </div>
                          ) : null}
                          {project.year ? (
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-sq-green" aria-hidden="true" />
                              <span dir="ltr">{project.year}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                <p className="mb-2 text-lg font-bold text-gray-800">
                  {hasFilters ? "لا توجد نتائج مطابقة" : "لا توجد مشاريع منشورة حالياً"}
                </p>
                <p className="text-gray-600">
                  {hasFilters ? "جرّب تعديل كلمات البحث أو التصفية لعرض المزيد من النتائج." : "نرحب بتواصلكم معنا للاستفسار عن أعمالنا."}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    مسح التصفية
                  </button>
                ) : null}
              </div>
            )}

            {/* Add More Projects Info */}
            <div className="mt-12 text-center">
              <p className="mb-4 text-gray-600">هل تريد رؤية المزيد من مشاريعنا؟</p>
              <a
                href={
                  whatsappUrl(
                    company?.phone1,
                    "مرحباً، أريد الاستفسار عن مشاريعكم",
                  ) || "/contact"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-8 py-3 font-semibold text-white rounded-lg transition hover:shadow-lg"
              >
                تواصل معنا
              </a>
            </div>
          </div>
        </section>
      )}

      <WhatsAppButton />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
