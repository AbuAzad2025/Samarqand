import { useEffect, useMemo, useState } from "react";

import {
  createAdminTestimonial,
  deleteAdminTestimonial,
  fetchAdminTestimonials,
  reorderAdminTestimonials,
  updateAdminTestimonial,
  type AdminTestimonial,
} from "@/react-app/api/site";

export default function ControlTestimonials() {
  const [items, setItems] = useState<AdminTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminTestimonials();
      const sorted = [...data].sort((a, b) => a.sortOrder - b.sortOrder);
      setItems(sorted);
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const publishedCount = useMemo(() => items.length, [items]);

  async function onCreate() {
    const n = name.trim();
    const t = text.trim();
    if (!n || !t) return;
    setCreating(true);
    setStatus("idle");
    try {
      const res = await createAdminTestimonial({
        name: n,
        project: project || undefined,
        text: t,
        rating,
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setName("");
      setProject("");
      setRating(5);
      setText("");
      await load();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    } finally {
      setCreating(false);
    }
  }

  async function onSave(item: AdminTestimonial) {
    const n = item.name.trim();
    const t = item.text.trim();
    if (!n || !t) return;
    setSavingId(item.id);
    setStatus("idle");
    try {
      const res = await updateAdminTestimonial(item.id, {
        sortOrder: item.sortOrder,
        name: n,
        project: item.project,
        text: t,
        rating: item.rating,
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    } finally {
      setSavingId(null);
    }
  }

  async function onDelete(itemId: number) {
    if (!window.confirm("هل تريد حذف رأي العميل؟")) return;
    setStatus("idle");
    try {
      const res = await deleteAdminTestimonial(itemId);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      await load();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  async function onMove(fromIndex: number, dir: -1 | 1) {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= items.length) return;
    const next = [...items];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    const normalized = next.map((m, idx) => ({ ...m, sortOrder: idx }));
    setItems(normalized);
    setStatus("idle");
    try {
      const res = await reorderAdminTestimonials({ ids: normalized.map((m) => m.id) });
      if (!res.ok) {
        setStatus("error");
        await load();
        return;
      }
      await load();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      await load();
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">آراء العملاء</h1>
          <p className="text-gray-600 mt-1">{publishedCount} عنصر</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
        >
          تحديث
        </button>
      </div>

      {status === "saved" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      ) : status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر تنفيذ العملية.
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="text-lg font-bold text-gray-900 mb-4">إضافة رأي جديد</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم العميل"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="المشروع (اختياري)"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-4 py-3"
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                التقييم: {r}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="نص الرأي"
            className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2"
            rows={4}
          />
        </div>
        <div className="flex items-center justify-end mt-4">
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {creating ? "جارٍ الإضافة..." : "إضافة"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">القائمة</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : !items.length ? (
          <div className="p-6 text-gray-600">لا يوجد آراء.</div>
        ) : (
          <div className="divide-y">
            {items.map((m, idx) => (
              <div key={m.id} className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-bold text-gray-900">{m.name || "—"}</div>
                    <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onMove(idx, -1)}
                      disabled={idx === 0}
                      className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(idx, 1)}
                      disabled={idx === items.length - 1}
                      className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onSave(m)}
                      disabled={savingId === m.id}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                    >
                      {savingId === m.id ? "حفظ..." : "حفظ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(m.id)}
                      className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 mt-4">
                  <input
                    value={m.name}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="اسم العميل"
                    className="border border-gray-200 rounded-xl px-4 py-3"
                  />
                  <input
                    value={m.project}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, project: e.target.value } : x)))
                    }
                    placeholder="المشروع"
                    className="border border-gray-200 rounded-xl px-4 py-3"
                  />
                  <select
                    value={m.rating}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, rating: Number(e.target.value) } : x)))
                    }
                    className="border border-gray-200 rounded-xl px-4 py-3"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        التقييم: {r}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={m.text}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)))
                    }
                    placeholder="نص الرأي"
                    className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2"
                    rows={4}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
