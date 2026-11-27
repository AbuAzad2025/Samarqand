import { useEffect, useState } from "react";

import {
  createAdminHomeAIFeature,
  createAdminHomeAIMetric,
  createAdminHomeStat,
  createAdminHomeTimelineStep,
  createAdminHomeTrustBadge,
  deleteAdminHomeAIFeature,
  deleteAdminHomeAIMetric,
  deleteAdminHomeStat,
  deleteAdminHomeTimelineStep,
  deleteAdminHomeTrustBadge,
  fetchAdminHomeAIFeatures,
  fetchAdminHomeAIMetrics,
  fetchAdminHomeStats,
  fetchAdminHomeTimeline,
  fetchAdminHomeTrustBadges,
  reorderAdminHomeAIFeatures,
  reorderAdminHomeAIMetrics,
  reorderAdminHomeStats,
  reorderAdminHomeTimeline,
  reorderAdminHomeTrustBadges,
  updateAdminHomeAIFeature,
  updateAdminHomeAIMetric,
  updateAdminHomeStat,
  updateAdminHomeTimelineStep,
  updateAdminHomeTrustBadge,
  type AdminHomeAIFeature,
  type AdminHomeAIMetric,
  type AdminHomeStat,
  type AdminHomeTimelineStep,
  type AdminHomeTrustBadge,
} from "@/react-app/api/site";

export default function ControlHomeSections() {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // الترتيب كما هو محفوظ في الخلفية، للمقارنة قبل حفظ الترتيب صراحةً
  const [savedOrders, setSavedOrders] = useState<Record<string, number[]>>({});

  const [trustBadges, setTrustBadges] = useState<AdminHomeTrustBadge[]>([]);
  const [stats, setStats] = useState<AdminHomeStat[]>([]);
  const [timeline, setTimeline] = useState<AdminHomeTimelineStep[]>([]);
  const [aiFeatures, setAiFeatures] = useState<AdminHomeAIFeature[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AdminHomeAIMetric[]>([]);

  const [tbTitle, setTbTitle] = useState("");
  const [tbDescription, setTbDescription] = useState("");
  const [tbIconClass, setTbIconClass] = useState("");

  const [stLabel, setStLabel] = useState("");
  const [stValue, setStValue] = useState("");
  const [stIconClass, setStIconClass] = useState("");

  const [tlTitle, setTlTitle] = useState("");
  const [tlDescription, setTlDescription] = useState("");
  const [tlIconClass, setTlIconClass] = useState("");

  const [afTitle, setAfTitle] = useState("");
  const [afDescription, setAfDescription] = useState("");
  const [afBadgeText, setAfBadgeText] = useState("AI");

  const [amValue, setAmValue] = useState("");
  const [amLabel, setAmLabel] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [a, b, c, d, e] = await Promise.all([
        fetchAdminHomeTrustBadges(),
        fetchAdminHomeStats(),
        fetchAdminHomeTimeline(),
        fetchAdminHomeAIFeatures(),
        fetchAdminHomeAIMetrics(),
      ]);
      setTrustBadges([...a].sort((x, y) => x.sortOrder - y.sortOrder));
      setStats([...b].sort((x, y) => x.sortOrder - y.sortOrder));
      setTimeline([...c].sort((x, y) => x.sortOrder - y.sortOrder));
      setAiFeatures([...d].sort((x, y) => x.sortOrder - y.sortOrder));
      setAiMetrics([...e].sort((x, y) => x.sortOrder - y.sortOrder));
      setSavedOrders({
        trustBadges: [...a].sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id),
        stats: [...b].sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id),
        timeline: [...c].sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id),
        aiFeatures: [...d].sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id),
        aiMetrics: [...e].sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.id),
      });
    } catch {
      notify("error", "تعذر تحميل الأقسام. يرجى الضغط على «تحديث».");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial fetch only; refresh uses the explicit button
  }, []);

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  function clearNotice() {
    setNotice(null);
  }

  function orderDirty(key: string, list: { id: number }[]): boolean {
    const saved = savedOrders[key] || [];
    if (saved.length !== list.length) return true;
    return list.some((item, idx) => saved[idx] !== item.id);
  }

  // التحريك محلي فقط؛ الحفظ النهائي يتم عبر زر «حفظ الترتيب» في كل قسم
  function moveItem<T extends { id: number; sortOrder: number }>(
    list: T[],
    setList: (items: T[]) => void,
    fromIndex: number,
    dir: -1 | 1,
  ) {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= list.length) return;
    const next = [...list];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    setList(next.map((m, idx) => ({ ...m, sortOrder: idx })));
    clearNotice();
  }

  async function saveOrder<T extends { id: number }>(
    key: string,
    list: T[],
    reorder: (input: { ids: number[] }) => Promise<{ ok: boolean }>,
  ) {
    if (!orderDirty(key, list)) {
      notify("error", "لا توجد تغييرات في الترتيب لحفظها.");
      return;
    }
    setSavingKey(`${key}-order`);
    clearNotice();
    try {
      const res = await reorder({ ids: list.map((m) => m.id) });
      if (!res.ok) {
        notify("error", "تعذر حفظ الترتيب. يرجى المحاولة مرة أخرى.");
        await loadAll();
        return;
      }
      setSavedOrders((prev) => ({ ...prev, [key]: list.map((m) => m.id) }));
      notify("success", "تم حفظ الترتيب بنجاح.");
    } catch {
      notify("error", "تعذر حفظ الترتيب. يرجى المحاولة مرة أخرى.");
      await loadAll();
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">محتوى الصفحة الرئيسية</h1>
          <p className="text-slate-300 mt-1">إدارة ميزات الثقة والإحصاءات وخطوات العمل ومزايا AI.</p>
        </div>
        <button
          type="button"
          onClick={() => loadAll()}
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

      <div className="space-y-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-xl font-bold text-gray-900">ميزات الثقة</div>
              <div className="text-sm text-gray-600 mt-1">{trustBadges.length} عنصر • رتّب بالأزرار ثم احفظ الترتيب</div>
            </div>
            <button
              type="button"
              onClick={() => saveOrder("trustBadges", trustBadges, reorderAdminHomeTrustBadges)}
              disabled={!orderDirty("trustBadges", trustBadges) || savingKey === "trustBadges-order"}
              aria-label="حفظ ترتيب ميزات الثقة"
              className="bg-sq-green text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
            >
              {savingKey === "trustBadges-order" ? "جارٍ الحفظ..." : "حفظ الترتيب"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={tbTitle} onChange={(e) => setTbTitle(e.target.value)} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={tbIconClass} onChange={(e) => setTbIconClass(e.target.value)} placeholder="iconClass (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <textarea value={tbDescription} onChange={(e) => setTbDescription(e.target.value)} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const title = tbTitle.trim();
                  if (!title) { notify("error", "العنوان مطلوب."); return; }
                  setSavingKey("tb-create");
                  clearNotice();
                  try {
                    const res = await createAdminHomeTrustBadge({
                      title,
                      description: tbDescription,
                      iconClass: tbIconClass || undefined,
                    });
                    if (!res.ok) {
                      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    setTbTitle("");
                    setTbDescription("");
                    setTbIconClass("");
                    await loadAll();
                    notify("success", "تم الحفظ بنجاح.");
                  } catch {
                    notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "tb-create"}
                className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
              >
                {savingKey === "tb-create" ? "جارٍ الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-600">جارٍ التحميل...</div>
          ) : !trustBadges.length ? (
            <div className="text-gray-600">لا يوجد عناصر.</div>
          ) : (
            <div className="space-y-4">
              {trustBadges.map((m, idx) => (
                <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-gray-900">{m.title || "—"}</div>
                      <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" aria-label={`تحريك «${m.title || "العنصر"}» للأعلى`} title="تحريك للأعلى" onClick={() => moveItem(trustBadges, setTrustBadges, idx, -1)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" aria-label={`تحريك «${m.title || "العنصر"}» للأسفل`} title="تحريك للأسفل" onClick={() => moveItem(trustBadges, setTrustBadges, idx, 1)} disabled={idx === trustBadges.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = m.title.trim();
                          if (!title) { notify("error", "العنوان مطلوب."); return; }
                          setSavingKey(`tb-${m.id}`);
                          clearNotice();
                          try {
                            const res = await updateAdminHomeTrustBadge(m.id, {
                              sortOrder: m.sortOrder,
                              title,
                              description: m.description,
                              iconClass: m.iconClass,
                            });
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        disabled={savingKey === `tb-${m.id}`}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                      >
                        {savingKey === `tb-${m.id}` ? "حفظ..." : "حفظ"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("حذف العنصر؟")) return;
                          setSavingKey(`tb-del-${m.id}`);
                          clearNotice();
                          try {
                            const res = await deleteAdminHomeTrustBadge(m.id);
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            await loadAll();
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <input value={m.title} onChange={(e) => setTrustBadges((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
                    <input value={m.iconClass} onChange={(e) => setTrustBadges((prev) => prev.map((x) => (x.id === m.id ? { ...x, iconClass: e.target.value } : x)))} placeholder="iconClass" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
                    <textarea value={m.description} onChange={(e) => setTrustBadges((prev) => prev.map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)))} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-xl font-bold text-gray-900">إحصاءات الهوم</div>
              <div className="text-sm text-gray-600 mt-1">{stats.length} عنصر • رتّب بالأزرار ثم احفظ الترتيب</div>
            </div>
            <button
              type="button"
              onClick={() => saveOrder("stats", stats, reorderAdminHomeStats)}
              disabled={!orderDirty("stats", stats) || savingKey === "stats-order"}
              aria-label="حفظ ترتيب الإحصاءات"
              className="bg-sq-green text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
            >
              {savingKey === "stats-order" ? "جارٍ الحفظ..." : "حفظ الترتيب"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={stLabel} onChange={(e) => setStLabel(e.target.value)} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={stValue} onChange={(e) => setStValue(e.target.value)} placeholder="القيمة *" aria-label="القيمة (مطلوبة)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <input value={stIconClass} onChange={(e) => setStIconClass(e.target.value)} placeholder="iconClass (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" dir="ltr" />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const label = stLabel.trim();
                  const value = stValue.trim();
                  if (!label || !value) { notify("error", "العنوان والقيمة مطلوبان."); return; }
                  setSavingKey("st-create");
                  clearNotice();
                  try {
                    const res = await createAdminHomeStat({ label, value, iconClass: stIconClass || undefined });
                    if (!res.ok) {
                      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    setStLabel("");
                    setStValue("");
                    setStIconClass("");
                    await loadAll();
                    notify("success", "تم الحفظ بنجاح.");
                  } catch {
                    notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "st-create"}
                className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
              >
                {savingKey === "st-create" ? "جارٍ الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-600">جارٍ التحميل...</div>
          ) : !stats.length ? (
            <div className="text-gray-600">لا يوجد عناصر.</div>
          ) : (
            <div className="space-y-4">
              {stats.map((m, idx) => (
                <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-gray-900">{m.label || "—"}</div>
                      <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" aria-label={`تحريك «${m.label || "العنصر"}» للأعلى`} title="تحريك للأعلى" onClick={() => moveItem(stats, setStats, idx, -1)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" aria-label={`تحريك «${m.label || "العنصر"}» للأسفل`} title="تحريك للأسفل" onClick={() => moveItem(stats, setStats, idx, 1)} disabled={idx === stats.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const label = m.label.trim();
                          const value = m.value.trim();
                          if (!label || !value) { notify("error", "العنوان والقيمة مطلوبان."); return; }
                          setSavingKey(`st-${m.id}`);
                          clearNotice();
                          try {
                            const res = await updateAdminHomeStat(m.id, {
                              sortOrder: m.sortOrder,
                              label,
                              value,
                              iconClass: m.iconClass,
                            });
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        disabled={savingKey === `st-${m.id}`}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                      >
                        {savingKey === `st-${m.id}` ? "حفظ..." : "حفظ"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("حذف العنصر؟")) return;
                          setSavingKey(`st-del-${m.id}`);
                          clearNotice();
                          try {
                            const res = await deleteAdminHomeStat(m.id);
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            await loadAll();
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <input value={m.label} onChange={(e) => setStats((prev) => prev.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
                    <input value={m.value} onChange={(e) => setStats((prev) => prev.map((x) => (x.id === m.id ? { ...x, value: e.target.value } : x)))} placeholder="القيمة *" aria-label="القيمة (مطلوبة)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
                    <input value={m.iconClass} onChange={(e) => setStats((prev) => prev.map((x) => (x.id === m.id ? { ...x, iconClass: e.target.value } : x)))} placeholder="iconClass" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" dir="ltr" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-xl font-bold text-gray-900">خطوات العمل</div>
              <div className="text-sm text-gray-600 mt-1">{timeline.length} عنصر • رتّب بالأزرار ثم احفظ الترتيب</div>
            </div>
            <button
              type="button"
              onClick={() => saveOrder("timeline", timeline, reorderAdminHomeTimeline)}
              disabled={!orderDirty("timeline", timeline) || savingKey === "timeline-order"}
              aria-label="حفظ ترتيب خطوات العمل"
              className="bg-sq-green text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
            >
              {savingKey === "timeline-order" ? "جارٍ الحفظ..." : "حفظ الترتيب"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={tlTitle} onChange={(e) => setTlTitle(e.target.value)} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={tlIconClass} onChange={(e) => setTlIconClass(e.target.value)} placeholder="iconClass (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <textarea value={tlDescription} onChange={(e) => setTlDescription(e.target.value)} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const title = tlTitle.trim();
                  if (!title) { notify("error", "العنوان مطلوب."); return; }
                  setSavingKey("tl-create");
                  clearNotice();
                  try {
                    const res = await createAdminHomeTimelineStep({
                      title,
                      description: tlDescription,
                      iconClass: tlIconClass || undefined,
                    });
                    if (!res.ok) {
                      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    setTlTitle("");
                    setTlDescription("");
                    setTlIconClass("");
                    await loadAll();
                    notify("success", "تم الحفظ بنجاح.");
                  } catch {
                    notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "tl-create"}
                className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
              >
                {savingKey === "tl-create" ? "جارٍ الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-600">جارٍ التحميل...</div>
          ) : !timeline.length ? (
            <div className="text-gray-600">لا يوجد عناصر.</div>
          ) : (
            <div className="space-y-4">
              {timeline.map((m, idx) => (
                <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-gray-900">{m.title || "—"}</div>
                      <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" aria-label={`تحريك «${m.title || "العنصر"}» للأعلى`} title="تحريك للأعلى" onClick={() => moveItem(timeline, setTimeline, idx, -1)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" aria-label={`تحريك «${m.title || "العنصر"}» للأسفل`} title="تحريك للأسفل" onClick={() => moveItem(timeline, setTimeline, idx, 1)} disabled={idx === timeline.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = m.title.trim();
                          if (!title) { notify("error", "العنوان مطلوب."); return; }
                          setSavingKey(`tl-${m.id}`);
                          clearNotice();
                          try {
                            const res = await updateAdminHomeTimelineStep(m.id, {
                              sortOrder: m.sortOrder,
                              title,
                              description: m.description,
                              iconClass: m.iconClass,
                            });
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        disabled={savingKey === `tl-${m.id}`}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                      >
                        {savingKey === `tl-${m.id}` ? "حفظ..." : "حفظ"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("حذف العنصر؟")) return;
                          setSavingKey(`tl-del-${m.id}`);
                          clearNotice();
                          try {
                            const res = await deleteAdminHomeTimelineStep(m.id);
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            await loadAll();
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <input value={m.title} onChange={(e) => setTimeline((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
                    <input value={m.iconClass} onChange={(e) => setTimeline((prev) => prev.map((x) => (x.id === m.id ? { ...x, iconClass: e.target.value } : x)))} placeholder="iconClass" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
                    <textarea value={m.description} onChange={(e) => setTimeline((prev) => prev.map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)))} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-xl font-bold text-gray-900">ميزات AI</div>
              <div className="text-sm text-gray-600 mt-1">{aiFeatures.length} عنصر • رتّب بالأزرار ثم احفظ الترتيب</div>
            </div>
            <button
              type="button"
              onClick={() => saveOrder("aiFeatures", aiFeatures, reorderAdminHomeAIFeatures)}
              disabled={!orderDirty("aiFeatures", aiFeatures) || savingKey === "aiFeatures-order"}
              aria-label="حفظ ترتيب ميزات AI"
              className="bg-sq-green text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
            >
              {savingKey === "aiFeatures-order" ? "جارٍ الحفظ..." : "حفظ الترتيب"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={afTitle} onChange={(e) => setAfTitle(e.target.value)} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={afBadgeText} onChange={(e) => setAfBadgeText(e.target.value)} placeholder="Badge (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3" />
              <textarea value={afDescription} onChange={(e) => setAfDescription(e.target.value)} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const title = afTitle.trim();
                  if (!title) { notify("error", "العنوان مطلوب."); return; }
                  setSavingKey("af-create");
                  clearNotice();
                  try {
                    const res = await createAdminHomeAIFeature({
                      title,
                      description: afDescription,
                      badgeText: afBadgeText || undefined,
                    });
                    if (!res.ok) {
                      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    setAfTitle("");
                    setAfDescription("");
                    setAfBadgeText("AI");
                    await loadAll();
                    notify("success", "تم الحفظ بنجاح.");
                  } catch {
                    notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "af-create"}
                className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
              >
                {savingKey === "af-create" ? "جارٍ الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-600">جارٍ التحميل...</div>
          ) : !aiFeatures.length ? (
            <div className="text-gray-600">لا يوجد عناصر.</div>
          ) : (
            <div className="space-y-4">
              {aiFeatures.map((m, idx) => (
                <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-gray-900">{m.title || "—"}</div>
                      <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" aria-label={`تحريك «${m.title || "العنصر"}» للأعلى`} title="تحريك للأعلى" onClick={() => moveItem(aiFeatures, setAiFeatures, idx, -1)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" aria-label={`تحريك «${m.title || "العنصر"}» للأسفل`} title="تحريك للأسفل" onClick={() => moveItem(aiFeatures, setAiFeatures, idx, 1)} disabled={idx === aiFeatures.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = m.title.trim();
                          if (!title) { notify("error", "العنوان مطلوب."); return; }
                          setSavingKey(`af-${m.id}`);
                          clearNotice();
                          try {
                            const res = await updateAdminHomeAIFeature(m.id, {
                              sortOrder: m.sortOrder,
                              title,
                              description: m.description,
                              badgeText: m.badgeText,
                            });
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        disabled={savingKey === `af-${m.id}`}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                      >
                        {savingKey === `af-${m.id}` ? "حفظ..." : "حفظ"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("حذف العنصر؟")) return;
                          setSavingKey(`af-del-${m.id}`);
                          clearNotice();
                          try {
                            const res = await deleteAdminHomeAIFeature(m.id);
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            await loadAll();
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <input value={m.title} onChange={(e) => setAiFeatures((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
                    <input value={m.badgeText} onChange={(e) => setAiFeatures((prev) => prev.map((x) => (x.id === m.id ? { ...x, badgeText: e.target.value } : x)))} placeholder="Badge" className="border border-gray-200 rounded-xl px-4 py-3" />
                    <textarea value={m.description} onChange={(e) => setAiFeatures((prev) => prev.map((x) => (x.id === m.id ? { ...x, description: e.target.value } : x)))} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-xl font-bold text-gray-900">مؤشرات AI</div>
              <div className="text-sm text-gray-600 mt-1">{aiMetrics.length} عنصر • رتّب بالأزرار ثم احفظ الترتيب</div>
            </div>
            <button
              type="button"
              onClick={() => saveOrder("aiMetrics", aiMetrics, reorderAdminHomeAIMetrics)}
              disabled={!orderDirty("aiMetrics", aiMetrics) || savingKey === "aiMetrics-order"}
              aria-label="حفظ ترتيب مؤشرات AI"
              className="bg-sq-green text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
            >
              {savingKey === "aiMetrics-order" ? "جارٍ الحفظ..." : "حفظ الترتيب"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={amValue} onChange={(e) => setAmValue(e.target.value)} placeholder="القيمة *" aria-label="القيمة (مطلوبة)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <input value={amLabel} onChange={(e) => setAmLabel(e.target.value)} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const value = amValue.trim();
                  const label = amLabel.trim();
                  if (!value || !label) { notify("error", "القيمة والعنوان مطلوبان."); return; }
                  setSavingKey("am-create");
                  clearNotice();
                  try {
                    const res = await createAdminHomeAIMetric({ value, label });
                    if (!res.ok) {
                      notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    setAmValue("");
                    setAmLabel("");
                    await loadAll();
                    notify("success", "تم الحفظ بنجاح.");
                  } catch {
                    notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "am-create"}
                className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
              >
                {savingKey === "am-create" ? "جارٍ الإضافة..." : "إضافة"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-600">جارٍ التحميل...</div>
          ) : !aiMetrics.length ? (
            <div className="text-gray-600">لا يوجد عناصر.</div>
          ) : (
            <div className="space-y-4">
              {aiMetrics.map((m, idx) => (
                <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-gray-900">{m.label || "—"}</div>
                      <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" aria-label={`تحريك «${m.label || "العنصر"}» للأعلى`} title="تحريك للأعلى" onClick={() => moveItem(aiMetrics, setAiMetrics, idx, -1)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" aria-label={`تحريك «${m.label || "العنصر"}» للأسفل`} title="تحريك للأسفل" onClick={() => moveItem(aiMetrics, setAiMetrics, idx, 1)} disabled={idx === aiMetrics.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const value = m.value.trim();
                          const label = m.label.trim();
                          if (!value || !label) { notify("error", "القيمة والعنوان مطلوبان."); return; }
                          setSavingKey(`am-${m.id}`);
                          clearNotice();
                          try {
                            const res = await updateAdminHomeAIMetric(m.id, {
                              sortOrder: m.sortOrder,
                              value,
                              label,
                            });
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        disabled={savingKey === `am-${m.id}`}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                      >
                        {savingKey === `am-${m.id}` ? "حفظ..." : "حفظ"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm("حذف العنصر؟")) return;
                          setSavingKey(`am-del-${m.id}`);
                          clearNotice();
                          try {
                            const res = await deleteAdminHomeAIMetric(m.id);
                            if (!res.ok) {
                              notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                              return;
                            }
                            await loadAll();
                            notify("success", "تم الحفظ بنجاح.");
                          } catch {
                            notify("error", "تعذر تنفيذ العملية. يرجى المحاولة مرة أخرى.");
                          } finally {
                            setSavingKey(null);
                          }
                        }}
                        className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 mt-4">
                    <input value={m.value} onChange={(e) => setAiMetrics((prev) => prev.map((x) => (x.id === m.id ? { ...x, value: e.target.value } : x)))} placeholder="القيمة *" aria-label="القيمة (مطلوبة)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
                    <input value={m.label} onChange={(e) => setAiMetrics((prev) => prev.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))} placeholder="العنوان *" aria-label="العنوان (مطلوب)" className="border border-gray-200 rounded-xl px-4 py-3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
