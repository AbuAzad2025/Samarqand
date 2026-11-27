import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search as SearchIcon } from "lucide-react";

import {
  fetchProjects,
  fetchServices,
  fetchSiteContentList,
  type ServicePayload,
  type ProjectPayload,
  type SiteContentItem,
} from "@/react-app/api/site";
import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";

type Hit = { title: string; text: string; url: string; group: string };
type LoadState = "loading" | "ready" | "error";

const GROUP_ORDER = ["المشاريع", "الخدمات", "المقالات", "الفعاليات", "مواقعنا"];

function Suggestions({
  items,
  onPick,
}: {
  items: string[];
  onPick: (term: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-sm font-bold text-gray-700">اقتراحات للبحث:</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {items.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => onPick(term)}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-sq-green hover:text-sq-green transition"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") || "").trim();
  const [input, setInput] = useState(query);
  const [items, setItems] = useState<Hit[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoadState("loading");

    Promise.allSettled([
      fetchProjects(),
      fetchServices(),
      fetchSiteContentList("articles"),
      fetchSiteContentList("events"),
      fetchSiteContentList("locations"),
    ]).then(([projects, services, articles, events, locations]) => {
      if (!active) return;

      const hits: Hit[] = [];
      const push = (
        rows: { title: string; description?: string; excerpt?: string; url: string }[],
        group: string,
      ) => {
        rows.forEach((row) =>
          hits.push({
            title: row.title,
            text: (row.description || row.excerpt || "").slice(0, 220),
            url: row.url,
            group,
          }),
        );
      };

      if (projects.status === "fulfilled") {
        push(projects.value as ProjectPayload[], "المشاريع");
      }
      if (services.status === "fulfilled") {
        push(services.value as ServicePayload[], "الخدمات");
      }
      const content = [articles, events, locations];
      const groups = ["المقالات", "الفعاليات", "مواقعنا"];
      content.forEach((res, i) => {
        if (res.status === "fulfilled") {
          push(res.value as SiteContentItem[], groups[i]);
        }
      });

      const anyLoaded = [projects, services, ...content].some(
        (result) => result.status === "fulfilled",
      );
      setItems(hits);
      setLoadState(anyLoaded ? "ready" : "error");
    });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const results = useMemo(() => {
    if (!query) return [];
    const q = query.toLocaleLowerCase("ar");
    return items.filter(
      (hit) =>
        hit.title.toLocaleLowerCase("ar").includes(q) ||
        hit.text.toLocaleLowerCase("ar").includes(q),
    );
  }, [items, query]);

  const groupedResults = useMemo(() => {
    const present = [...new Set(results.map((hit) => hit.group))];
    present.sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "ar");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return present.map((group) => ({
      group,
      hits: results.filter((hit) => hit.group === group),
    }));
  }, [results]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const picked: string[] = [];
    for (const hit of items) {
      const title = hit.title.trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      picked.push(title.length > 40 ? `${title.slice(0, 40)}…` : title);
      if (picked.length === 6) break;
    }
    return picked;
  }, [items]);

  const runSearch = (term: string) => {
    const next = term.trim();
    setInput(next);
    setParams(next ? { q: next } : {});
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />
      <div className="min-h-[60vh]">
        <section className="bg-[var(--corp-dark)] text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">البحث في الموقع</h1>
            <form
              className="mx-auto max-w-2xl flex flex-wrap gap-2 justify-center"
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(input);
              }}
            >
              <label htmlFor="site-search" className="sr-only">
                كلمة البحث
              </label>
              <div className="relative flex-1 min-w-[220px]">
                <SearchIcon
                  size={20}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  id="site-search"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ابحث عن مشروع أو خدمة..."
                  className="w-full rounded-xl px-4 py-3 pr-11 text-gray-900 placeholder:text-gray-600"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-white text-sq-green px-6 py-3 font-bold hover:bg-gray-100 transition"
              >
                بحث
              </button>
            </form>
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl space-y-8 text-right">
            {loadState === "loading" ? (
              <p role="status" className="text-center text-gray-600">
                جارٍ تجهيز البحث…
              </p>
            ) : loadState === "error" ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
              >
                <h2 className="text-xl font-extrabold text-red-800 mb-2">
                  تعذّر تحميل محتوى البحث
                </h2>
                <p className="text-red-700 mb-5">
                  تحقق من اتصالك بالإنترنت ثم أعد المحاولة.
                </p>
                <button
                  type="button"
                  onClick={() => setReloadToken((token) => token + 1)}
                  className="rounded-xl bg-red-700 px-5 py-2 font-bold text-white hover:bg-red-800 transition"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : !query ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <SearchIcon size={36} className="mx-auto mb-4 text-sq-green" aria-hidden="true" />
                <h2 className="text-xl font-extrabold text-gray-800 mb-2">
                  ماذا تبحث عنه؟
                </h2>
                <p className="text-gray-600">
                  اكتب كلمة للبحث في المشاريع والخدمات والمحتوى المنشور.
                </p>
                <Suggestions items={suggestions} onPick={runSearch} />
              </div>
            ) : results.length === 0 ? (
              <div
                role="status"
                className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
              >
                <h2 className="text-xl font-extrabold text-gray-800 mb-2">
                  لا توجد نتائج لـ «{query}»
                </h2>
                <p className="text-gray-600">
                  جرّب كلمة مختلفة أو اختر أحد الاقتراحات أدناه.
                </p>
                <Suggestions items={suggestions} onPick={runSearch} />
              </div>
            ) : (
              <>
                <p role="status" className="text-sm font-bold text-gray-600">
                  عدد النتائج: {results.length}
                </p>
                {groupedResults.map(({ group, hits }) => (
                  <div key={group}>
                    <h2 className="text-xl font-extrabold text-sq-green mb-4">
                      {group}{" "}
                      <span className="text-sm font-semibold text-gray-600">
                        ({hits.length})
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {hits.map((hit, i) => (
                        <Link
                          key={`${group}-${i}`}
                          to={hit.url}
                          className="block rounded-xl border border-gray-200 bg-white p-5 text-right hover:border-sq-green hover:shadow-md transition"
                        >
                          <div className="font-bold text-gray-900">{hit.title}</div>
                          {hit.text ? (
                            <p className="mt-1 text-sm leading-relaxed text-gray-600">
                              {hit.text}
                            </p>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
