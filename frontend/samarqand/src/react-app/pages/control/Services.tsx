import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { createAdminService, fetchAdminServices, type AdminServiceListItem } from "@/react-app/api/site";

export default function ControlServices() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminServiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminServices();
      setItems(data);
    } catch {
      notify("error", "تعذر تحميل الخدمات. يرجى الضغط على «تحديث».");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fetch only; refresh uses the explicit button
  }, []);

  const liveCount = useMemo(() => items.filter((i) => i.live).length, [items]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      notify("error", "عنوان الخدمة مطلوب.");
      return;
    }
    setCreating(true);
    setNotice(null);
    try {
      const res = await createAdminService({ title, slug: slug || undefined });
      if (!res.ok || !res.id) {
        notify("error", "تعذر إنشاء الخدمة. يرجى المحاولة مرة أخرى.");
        return;
      }
      setTitle("");
      setSlug("");
      navigate(`/control/services/${res.id}`);
    } catch {
      notify("error", "تعذر إنشاء الخدمة. يرجى المحاولة مرة أخرى.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">إدارة الخدمات</h1>
          <p className="text-slate-300 mt-1">
            {items.length} خدمة • {liveCount} منشور
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          aria-label="تحديث قائمة الخدمات"
          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
        >
          {loading ? "جارٍ التحديث..." : "تحديث"}
        </button>
      </div>

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`border rounded-2xl p-4 mb-6 font-semibold ${
            notice.kind === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="text-lg font-bold text-gray-900">إضافة خدمة</div>
        <p className="text-sm text-gray-600 mt-1 mb-4">الحقل المميز بـ * إلزامي؛ تُنشأ الخدمة كمسودة ثم تُكمل تحريرها.</p>
        <form onSubmit={onCreate} className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label htmlFor="new-service-title" className="block text-sm font-semibold text-gray-700 mb-2">العنوان *</label>
            <input
              id="new-service-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
              required
            />
          </div>
          <div>
            <label htmlFor="new-service-slug" className="block text-sm font-semibold text-gray-700 mb-2">Slug (اختياري)</label>
            <input
              id="new-service-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
              dir="ltr"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setTitle(""); setSlug(""); setNotice(null); }}
              className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-lg font-semibold hover:shadow-sm transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
            >
              {creating ? "جارٍ الإنشاء..." : "إنشاء"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">قائمة الخدمات</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : (
          <div className="divide-y">
            {items.map((s) => (
              <div key={s.id} className="p-6 flex items-center gap-5">
                <div className="w-24 h-16 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0">
                  {s.coverUrl ? (
                    <img loading="lazy" decoding="async" src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-bold text-gray-900 truncate">{s.title}</div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        s.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {s.live ? "منشور" : "مسودة"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate" dir="ltr">
                    {s.slug}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate">
                    {s.shortDescription || "—"}
                  </div>
                </div>
                <Link
                  to={`/control/services/${s.id}`}
                  aria-label={`تحرير الخدمة ${s.title}`}
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                >
                  تحرير
                </Link>
              </div>
            ))}
            {!items.length && (
              <div className="p-10 text-center">
                <div className="text-3xl mb-2" aria-hidden="true">🧰</div>
                <div className="font-bold text-gray-900">لا توجد خدمات بعد</div>
                <p className="text-sm text-gray-600 mt-2">استخدم النموذج أعلاه لإضافة خدمة جديدة وتحرير تفاصيلها.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
