import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { createAdminService, fetchAdminServices, type AdminServiceListItem } from "@/react-app/api/site";

export default function ControlServices() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminServiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminServices();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const liveCount = useMemo(() => items.filter((i) => i.live).length, [items]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await createAdminService({ title, slug: slug || undefined });
      if (res.ok && res.id) {
        setTitle("");
        setSlug("");
        navigate(`/control/services/${res.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الخدمات</h1>
          <p className="text-gray-600 mt-1">
            {items.length} خدمة • {liveCount} منشور
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
        >
          تحديث
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="text-lg font-bold text-gray-900 mb-4">إضافة خدمة</div>
        <form onSubmit={onCreate} className="grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Slug (اختياري)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {creating ? "جارٍ الإنشاء..." : "إنشاء"}
          </button>
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
                    <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
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
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                >
                  تحرير
                </Link>
              </div>
            ))}
            {!items.length && <div className="p-6 text-gray-600">لا يوجد خدمات.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
