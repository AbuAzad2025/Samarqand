import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { createAdminProject, fetchAdminProjects, reorderAdminProjects, type AdminProjectListItem } from "@/react-app/api/site";

type SortKey = "default" | "title" | "live" | "year";

export default function ControlProjects() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [createError, setCreateError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminProjects();
      setItems(data);
    } catch {
      setCreateError("تعذر تحميل المشاريع.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const liveCount = useMemo(
    () => items.filter((i) => i.live).length,
    [items],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (!term) return true;
      return [i.title, i.slug, i.projectLocation]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
    if (sort === "title") {
      list = [...list].sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ar"));
    } else if (sort === "live") {
      list = [...list].sort((a, b) => Number(b.live) - Number(a.live));
    } else if (sort === "year") {
      list = [...list].sort((a, b) => Number(b.completionYear || 0) - Number(a.completionYear || 0));
    }
    return list;
  }, [items, q, sort]);

  const canReorder = useMemo(() => !q.trim() && sort === "default" && !reordering, [q, sort, reordering]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setCreateError("العنوان مطلوب.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const res = await createAdminProject({ title: title.trim(), slug: slug.trim() || undefined });
      if (res.ok && res.id) {
        setTitle("");
        setSlug("");
        navigate(`/control/projects/${res.id}`);
      } else {
        setCreateError("تعذر إنشاء المشروع.");
      }
    } catch {
      setCreateError("تعذر إنشاء المشروع.");
    } finally {
      setCreating(false);
    }
  }

  async function moveItem(id: number, dir: -1 | 1) {
    if (!canReorder) return;
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    const reordered = [...items];
    const tmp = reordered[idx];
    reordered[idx] = reordered[nextIdx];
    reordered[nextIdx] = tmp;
    setItems(reordered);
    setReordering(true);
    try {
      const res = await reorderAdminProjects({ ids: reordered.map((x) => x.id) });
      if (!res.ok) {
        await load();
      }
    } catch {
      await load().catch(() => {});
    } finally {
      setReordering(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">إدارة المشاريع</h1>
          <p className="text-slate-300 mt-1">
            {items.length} مشروع • {liveCount} منشور
            {q.trim() || sort !== "default" ? ` • عرض ${filtered.length} من ${items.length}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white/20 transition print:hidden"
          >
            طباعة
          </button>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            {loading ? "جارٍ التحميل..." : "تحديث"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8 print:hidden">
        <div className="text-lg font-bold text-gray-900 mb-4">إضافة مشروع</div>
        <form onSubmit={onCreate} className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Slug (اختياري)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {creating ? "جارٍ الإنشاء..." : "إنشاء"}
          </button>
        </form>
        {createError ? (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {createError}
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="font-bold text-gray-900">قائمة المشاريع</div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان أو الرابط أو الموقع..."
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 print:hidden"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white print:hidden"
              aria-label="ترتيب المشاريع"
            >
              <option value="default">الترتيب اليدوي</option>
              <option value="title">العنوان (أ–ي)</option>
              <option value="live">المنشورة أولاً</option>
              <option value="year">سنة الإنجاز (الأحدث)</option>
            </select>
            {reordering ? <div className="text-sm text-gray-600">جارٍ حفظ الترتيب...</div> : null}
          </div>
        </div>
        {!canReorder ? (
          <div className="px-6 py-2 text-xs text-gray-500 border-b border-gray-100 print:hidden">
            أزرار الترتيب معطلة أثناء البحث أو الترتيب. أعد الضبط على «الترتيب اليدوي» لتغيير الترتيب.
          </div>
        ) : null}

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : (
          <div className="divide-y">
            {filtered.map((p) => (
              <div key={p.id} className="p-6 flex items-center gap-4 flex-wrap">
                <div className="w-24 h-16 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                  {p.coverUrl ? (
                    <img loading="lazy" decoding="async" src={p.coverUrl} alt={p.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-bold text-gray-900 break-words">{p.title}</div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                        p.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {p.live ? "منشور" : "مسودة"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate" dir="ltr">
                    {p.slug}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {p.projectLocation || "—"} {p.completionYear ? `• ${p.completionYear}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => moveItem(p.id, -1)}
                    disabled={!canReorder}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    aria-label="تحريك المشروع لأعلى"
                  >
                    أعلى
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(p.id, 1)}
                    disabled={!canReorder}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    aria-label="تحريك المشروع لأسفل"
                  >
                    أسفل
                  </button>
                  <Link
                    to={`/control/projects/${p.id}`}
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    تحرير
                  </Link>
                </div>
              </div>
            ))}
            {!filtered.length ? (
              <div className="p-6 text-gray-600">
                {q.trim() ? "لا توجد مشاريع مطابقة للبحث." : "لا يوجد مشاريع."}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
