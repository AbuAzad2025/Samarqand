import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

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

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") || "").trim();
  const [input, setInput] = useState(query);
  const [items, setItems] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchProjects(),
      fetchServices(),
      fetchSiteContentList("articles"),
      fetchSiteContentList("events"),
      fetchSiteContentList("locations"),
    ])
      .then(([projects, services, articles, events, locations]) => {
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
        setItems(hits);
      })
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    if (!query) return [];
    const q = query.toLocaleLowerCase();
    return items.filter(
      (hit) =>
        hit.title.toLocaleLowerCase().includes(q) ||
        hit.text.toLocaleLowerCase().includes(q),
    );
  }, [items, query]);

  const groups = [...new Set(results.map((hit) => hit.group))];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />
      <main className="min-h-[60vh]">
        <section className="bg-gradient-to-l from-sq-green via-sq-black to-sq-red text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">البحث في الموقع</h1>
            <form
              className="mx-auto max-w-2xl flex flex-wrap gap-2 justify-center"
              onSubmit={(e) => {
                e.preventDefault();
                setParams(input.trim() ? { q: input.trim() } : {});
              }}
            >
              <label htmlFor="site-search" className="sr-only">
                كلمة البحث
              </label>
              <input
                id="site-search"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ابحث عن مشروع أو خدمة..."
                className="flex-1 min-w-[220px] rounded-xl px-4 py-3 text-gray-900"
              />
              <button
                type="submit"
                className="rounded-xl bg-white text-sq-green px-6 py-3 font-bold"
              >
                بحث
              </button>
            </form>
          </div>
        </section>
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl space-y-8">
            {loading ? (
              <p role="status" className="text-center text-gray-500">
                جارٍ البحث…
              </p>
            ) : !query ? (
              <p className="text-center text-gray-500">
                اكتب كلمة للبحث في المشاريع والخدمات والمحتوى.
              </p>
            ) : results.length === 0 ? (
              <p role="status" className="text-center text-gray-500">
                لا توجد نتائج مطابقة.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group}>
                  <h2 className="text-xl font-extrabold text-sq-green mb-4">{group}</h2>
                  <div className="space-y-3">
                    {results
                      .filter((hit) => hit.group === group)
                      .map((hit, i) => (
                        <Link
                          key={`${group}-${i}`}
                          to={hit.url}
                          className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
                        >
                          <div className="font-bold text-gray-900">{hit.title}</div>
                          {hit.text ? (
                            <p className="text-sm text-gray-600 mt-1">{hit.text}</p>
                          ) : null}
                        </Link>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
