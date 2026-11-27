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
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  function clearNotice() {
    setNotice(null);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminTestimonials();
      const sorted = [...data].sort((a, b) => a.sortOrder - b.sortOrder);
      setItems(sorted);
    } catch {
      notify("error", "تعذر تحميل الآراء. يرجى الضغط على «تحديث».");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fetch only; refresh uses the explicit button
  }, []);

  const publishedCount = useMemo(() => items.length, [items]);

  async function onCreate() {
    const n = name.trim();
    const t = text.trim();
    if (!n || !t) { notify("error", "اسم العميل ونص الرأي مطلوبان."); return; }
    setCreating(true);
    clearNotice();
    try {
      const res = await createAdminTestimonial({
        name: n,
        project: project || undefined,
        text: t,
        rating,
      });
      if (!res.ok) {
        notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
        return;
      }
      setName("");
      setProject("");
      setRating(5);
      setText("");
      await load();
      notify("success", "تم الحفظ بنجاح.");
    } catch {
      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
    } finally {
      setCreating(false);
    }
  }

  async function onSave(item: AdminTestimonial) {
    const n = item.name.trim();
    const t = item.text.trim();
    if (!n || !t) { notify("error", "اسم العميل ونص الرأي مطلوبان."); return; }
    setSavingId(item.id);
    clearNotice();
    try {
      const res = await updateAdminTestimonial(item.id, {
        sortOrder: item.sortOrder,
        name: n,
        project: item.project,
        text: t,
        rating: item.rating,
      });
      if (!res.ok) {
        notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
        return;
      }
      notify("success", "تم الحفظ بنجاح.");
    } catch {
      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
    } finally {
      setSavingId(null);
    }
  }

  async function onDelete(itemId: number) {
    if (!window.confirm("هل تريد حذف رأي العميل؟")) return;
    clearNotice();
    try {
      const res = await deleteAdminTestimonial(itemId);
      if (!res.ok) {
        notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
        return;
      }
      await load();
      notify("success", "تم الحفظ بنجاح.");
    } catch {
      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
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
    clearNotice();
    try {
      const res = await reorderAdminTestimonials({ ids: normalized.map((m) => m.id) });
      if (!res.ok) {
        notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
        await load();
        return;
      }
      await load();
      notify("success", "تم الحفظ بنجاح.");
    } catch {
      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
      await load();
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">آراء العملاء</h1>
          <p className="text-slate-300 mt-1">{publishedCount} عنصر</p>
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

      <div role="note" className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-6 text-sky-900">
        <div className="font-bold">آراء حقيقية فقط</div>
        <p className="text-sm mt-1">
          تُعرض هنا آراء العملاء الحقيقية فقط. لا تُضاف آراء وهمية أو تجريبية؛ أدخل رأياً صادراً عن عميل تعامل فعلياً مع الشركة.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="text-lg font-bold text-gray-900">إضافة رأي جديد</div>
        <p className="text-sm text-gray-600 mt-1 mb-4">الحقول المميزة بـ * إلزامية. أضف رأياً حقيقياً فقط.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onCreate();
          }}
          className="grid md:grid-cols-2 gap-4"
        >
          <div>
            <label htmlFor="testimonial-name" className="block text-sm font-semibold text-gray-700 mb-2">اسم العميل *</label>
            <input
              id="testimonial-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم العميل"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
              required
            />
          </div>
          <div>
            <label htmlFor="testimonial-project" className="block text-sm font-semibold text-gray-700 mb-2">المشروع (اختياري)</label>
            <input
              id="testimonial-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="المشروع (اختياري)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
            />
          </div>
          <div>
            <label htmlFor="testimonial-rating" className="block text-sm font-semibold text-gray-700 mb-2">التقييم</label>
            <select
              id="testimonial-rating"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  التقييم: {r}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="testimonial-text" className="block text-sm font-semibold text-gray-700 mb-2">نص الرأي *</label>
            <textarea
              id="testimonial-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="نص الرأي"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
              rows={4}
              required
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { setName(""); setProject(""); setRating(5); setText(""); clearNotice(); }}
              className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim() || !text.trim()}
              className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
            >
              {creating ? "جارٍ الإضافة..." : "إضافة"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">القائمة</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : !items.length ? (
          <div className="p-10 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">💬</div>
            <div className="font-bold text-gray-900">لا توجد آراء معروضة حالياً</div>
            <p className="text-sm text-gray-600 mt-2">
              لا يتم إنشاء آراء وهمية لتعبئة هذه المساحة. عند ورود رأٍ حقيقي من عميل، أضفه من النموذج أعلاه وسيظهر هنا.
            </p>
          </div>
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
                      aria-label={`تحريك رأي ${m.name || "العميل"} للأعلى`}
                      title="تحريك للأعلى"
                      className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(idx, 1)}
                      disabled={idx === items.length - 1}
                      aria-label={`تحريك رأي ${m.name || "العميل"} للأسفل`}
                      title="تحريك للأسفل"
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
                    placeholder="اسم العميل *"
                    aria-label="اسم العميل (مطلوب)"
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
                    placeholder="نص الرأي *"
                    aria-label="نص الرأي (مطلوب)"
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
