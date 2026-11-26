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
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [savingKey, setSavingKey] = useState<string | null>(null);

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
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  function bumpStatusSaved() {
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
  }

  async function moveItem<T extends { id: number; sortOrder: number }>(
    list: T[],
    setList: (items: T[]) => void,
    fromIndex: number,
    dir: -1 | 1,
    reorder: (input: { ids: number[] }) => Promise<{ ok: boolean }>,
  ) {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= list.length) return;
    const next = [...list];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    const normalized = next.map((m, idx) => ({ ...m, sortOrder: idx }));
    setList(normalized);
    setStatus("idle");
    try {
      const res = await reorder({ ids: normalized.map((m) => m.id) });
      if (!res.ok) {
        setStatus("error");
        await loadAll();
        return;
      }
      await loadAll();
      bumpStatusSaved();
    } catch {
      setStatus("error");
      await loadAll();
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">محتوى الصفحة الرئيسية</h1>
          <p className="text-gray-600 mt-1">إدارة ميزات الثقة والإحصاءات وخطوات العمل ومزايا AI.</p>
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

      {status === "saved" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      ) : status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر تنفيذ العملية.
        </div>
      ) : null}

      <div className="space-y-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-xl font-bold text-gray-900">ميزات الثقة</div>
              <div className="text-sm text-gray-600 mt-1">{trustBadges.length} عنصر</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={tbTitle} onChange={(e) => setTbTitle(e.target.value)} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={tbIconClass} onChange={(e) => setTbIconClass(e.target.value)} placeholder="iconClass (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <textarea value={tbDescription} onChange={(e) => setTbDescription(e.target.value)} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const title = tbTitle.trim();
                  if (!title) return;
                  setSavingKey("tb-create");
                  setStatus("idle");
                  try {
                    const res = await createAdminHomeTrustBadge({
                      title,
                      description: tbDescription,
                      iconClass: tbIconClass || undefined,
                    });
                    if (!res.ok) {
                      setStatus("error");
                      return;
                    }
                    setTbTitle("");
                    setTbDescription("");
                    setTbIconClass("");
                    await loadAll();
                    bumpStatusSaved();
                  } catch {
                    setStatus("error");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "tb-create"}
                className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
                      <button type="button" onClick={() => moveItem(trustBadges, setTrustBadges, idx, -1, reorderAdminHomeTrustBadges)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => moveItem(trustBadges, setTrustBadges, idx, 1, reorderAdminHomeTrustBadges)} disabled={idx === trustBadges.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = m.title.trim();
                          if (!title) return;
                          setSavingKey(`tb-${m.id}`);
                          setStatus("idle");
                          try {
                            const res = await updateAdminHomeTrustBadge(m.id, {
                              sortOrder: m.sortOrder,
                              title,
                              description: m.description,
                              iconClass: m.iconClass,
                            });
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                          setStatus("idle");
                          try {
                            const res = await deleteAdminHomeTrustBadge(m.id);
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            await loadAll();
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                    <input value={m.title} onChange={(e) => setTrustBadges((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
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
              <div className="text-sm text-gray-600 mt-1">{stats.length} عنصر</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={stLabel} onChange={(e) => setStLabel(e.target.value)} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={stValue} onChange={(e) => setStValue(e.target.value)} placeholder="القيمة" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <input value={stIconClass} onChange={(e) => setStIconClass(e.target.value)} placeholder="iconClass (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" dir="ltr" />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const label = stLabel.trim();
                  const value = stValue.trim();
                  if (!label || !value) return;
                  setSavingKey("st-create");
                  setStatus("idle");
                  try {
                    const res = await createAdminHomeStat({ label, value, iconClass: stIconClass || undefined });
                    if (!res.ok) {
                      setStatus("error");
                      return;
                    }
                    setStLabel("");
                    setStValue("");
                    setStIconClass("");
                    await loadAll();
                    bumpStatusSaved();
                  } catch {
                    setStatus("error");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "st-create"}
                className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
                      <button type="button" onClick={() => moveItem(stats, setStats, idx, -1, reorderAdminHomeStats)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => moveItem(stats, setStats, idx, 1, reorderAdminHomeStats)} disabled={idx === stats.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const label = m.label.trim();
                          const value = m.value.trim();
                          if (!label || !value) return;
                          setSavingKey(`st-${m.id}`);
                          setStatus("idle");
                          try {
                            const res = await updateAdminHomeStat(m.id, {
                              sortOrder: m.sortOrder,
                              label,
                              value,
                              iconClass: m.iconClass,
                            });
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                          setStatus("idle");
                          try {
                            const res = await deleteAdminHomeStat(m.id);
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            await loadAll();
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                    <input value={m.label} onChange={(e) => setStats((prev) => prev.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
                    <input value={m.value} onChange={(e) => setStats((prev) => prev.map((x) => (x.id === m.id ? { ...x, value: e.target.value } : x)))} placeholder="القيمة" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
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
              <div className="text-sm text-gray-600 mt-1">{timeline.length} عنصر</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={tlTitle} onChange={(e) => setTlTitle(e.target.value)} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={tlIconClass} onChange={(e) => setTlIconClass(e.target.value)} placeholder="iconClass (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <textarea value={tlDescription} onChange={(e) => setTlDescription(e.target.value)} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const title = tlTitle.trim();
                  if (!title) return;
                  setSavingKey("tl-create");
                  setStatus("idle");
                  try {
                    const res = await createAdminHomeTimelineStep({
                      title,
                      description: tlDescription,
                      iconClass: tlIconClass || undefined,
                    });
                    if (!res.ok) {
                      setStatus("error");
                      return;
                    }
                    setTlTitle("");
                    setTlDescription("");
                    setTlIconClass("");
                    await loadAll();
                    bumpStatusSaved();
                  } catch {
                    setStatus("error");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "tl-create"}
                className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
                      <button type="button" onClick={() => moveItem(timeline, setTimeline, idx, -1, reorderAdminHomeTimeline)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => moveItem(timeline, setTimeline, idx, 1, reorderAdminHomeTimeline)} disabled={idx === timeline.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = m.title.trim();
                          if (!title) return;
                          setSavingKey(`tl-${m.id}`);
                          setStatus("idle");
                          try {
                            const res = await updateAdminHomeTimelineStep(m.id, {
                              sortOrder: m.sortOrder,
                              title,
                              description: m.description,
                              iconClass: m.iconClass,
                            });
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                          setStatus("idle");
                          try {
                            const res = await deleteAdminHomeTimelineStep(m.id);
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            await loadAll();
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                    <input value={m.title} onChange={(e) => setTimeline((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
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
              <div className="text-sm text-gray-600 mt-1">{aiFeatures.length} عنصر</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={afTitle} onChange={(e) => setAfTitle(e.target.value)} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
              <input value={afBadgeText} onChange={(e) => setAfBadgeText(e.target.value)} placeholder="Badge (اختياري)" className="border border-gray-200 rounded-xl px-4 py-3" />
              <textarea value={afDescription} onChange={(e) => setAfDescription(e.target.value)} placeholder="الوصف" className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2" rows={3} />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const title = afTitle.trim();
                  if (!title) return;
                  setSavingKey("af-create");
                  setStatus("idle");
                  try {
                    const res = await createAdminHomeAIFeature({
                      title,
                      description: afDescription,
                      badgeText: afBadgeText || undefined,
                    });
                    if (!res.ok) {
                      setStatus("error");
                      return;
                    }
                    setAfTitle("");
                    setAfDescription("");
                    setAfBadgeText("AI");
                    await loadAll();
                    bumpStatusSaved();
                  } catch {
                    setStatus("error");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "af-create"}
                className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
                      <button type="button" onClick={() => moveItem(aiFeatures, setAiFeatures, idx, -1, reorderAdminHomeAIFeatures)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => moveItem(aiFeatures, setAiFeatures, idx, 1, reorderAdminHomeAIFeatures)} disabled={idx === aiFeatures.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const title = m.title.trim();
                          if (!title) return;
                          setSavingKey(`af-${m.id}`);
                          setStatus("idle");
                          try {
                            const res = await updateAdminHomeAIFeature(m.id, {
                              sortOrder: m.sortOrder,
                              title,
                              description: m.description,
                              badgeText: m.badgeText,
                            });
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                          setStatus("idle");
                          try {
                            const res = await deleteAdminHomeAIFeature(m.id);
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            await loadAll();
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                    <input value={m.title} onChange={(e) => setAiFeatures((prev) => prev.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
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
              <div className="text-sm text-gray-600 mt-1">{aiMetrics.length} عنصر</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="font-bold text-gray-900 mb-4">إضافة عنصر</div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={amValue} onChange={(e) => setAmValue(e.target.value)} placeholder="القيمة" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
              <input value={amLabel} onChange={(e) => setAmLabel(e.target.value)} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
            </div>
            <div className="flex items-center justify-end mt-4">
              <button
                type="button"
                onClick={async () => {
                  const value = amValue.trim();
                  const label = amLabel.trim();
                  if (!value || !label) return;
                  setSavingKey("am-create");
                  setStatus("idle");
                  try {
                    const res = await createAdminHomeAIMetric({ value, label });
                    if (!res.ok) {
                      setStatus("error");
                      return;
                    }
                    setAmValue("");
                    setAmLabel("");
                    await loadAll();
                    bumpStatusSaved();
                  } catch {
                    setStatus("error");
                  } finally {
                    setSavingKey(null);
                  }
                }}
                disabled={savingKey === "am-create"}
                className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
                      <button type="button" onClick={() => moveItem(aiMetrics, setAiMetrics, idx, -1, reorderAdminHomeAIMetrics)} disabled={idx === 0} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↑</button>
                      <button type="button" onClick={() => moveItem(aiMetrics, setAiMetrics, idx, 1, reorderAdminHomeAIMetrics)} disabled={idx === aiMetrics.length - 1} className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50">↓</button>
                      <button
                        type="button"
                        onClick={async () => {
                          const value = m.value.trim();
                          const label = m.label.trim();
                          if (!value || !label) return;
                          setSavingKey(`am-${m.id}`);
                          setStatus("idle");
                          try {
                            const res = await updateAdminHomeAIMetric(m.id, {
                              sortOrder: m.sortOrder,
                              value,
                              label,
                            });
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                          setStatus("idle");
                          try {
                            const res = await deleteAdminHomeAIMetric(m.id);
                            if (!res.ok) {
                              setStatus("error");
                              return;
                            }
                            await loadAll();
                            bumpStatusSaved();
                          } catch {
                            setStatus("error");
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
                    <input value={m.value} onChange={(e) => setAiMetrics((prev) => prev.map((x) => (x.id === m.id ? { ...x, value: e.target.value } : x)))} placeholder="القيمة" className="border border-gray-200 rounded-xl px-4 py-3" dir="ltr" />
                    <input value={m.label} onChange={(e) => setAiMetrics((prev) => prev.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))} placeholder="العنوان" className="border border-gray-200 rounded-xl px-4 py-3" />
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
