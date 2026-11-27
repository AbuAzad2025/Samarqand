import { Fragment, useCallback, useEffect, useState } from "react";

import {
  fetchAdminLeads,
  fetchLeadAssignees,
  updateAdminLead,
  type LeadPayload,
} from "@/react-app/api/site";

const STATUS_ORDER = ["new", "contacted", "qualified", "won", "lost"] as const;

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  won: "مُحوّل لعميل",
  lost: "مفقود",
};

const STATUS_HINTS: Record<string, string> = {
  new: "لم تتم متابعته بعد",
  contacted: "جاري التواصل",
  qualified: "جاهز لعرض السعر",
  won: "أُغلق بنجاح",
  lost: "أُغلق دون تحويل",
};

const SOURCE_LABELS: Record<string, string> = {
  website: "موقع الويب",
  quote: "طلب عرض سعر",
  whatsapp: "واتساب",
};

export default function ControlLeads() {
  const [items, setItems] = useState<LeadPayload[]>([]);
  const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);

  const hasFilters = Boolean(status || search);

  const loadCounts = useCallback(async () => {
    try {
      const all = await fetchAdminLeads();
      const next: Record<string, number> = {};
      for (const it of all) {
        next[it.status] = (next[it.status] || 0) + 1;
      }
      setStatusCounts(next);
    } catch {
      // إحصاء الحالات affected by network errors; لا نوقف باقي الصفحة.
    }
  }, []);

  useEffect(() => {
    fetchLeadAssignees().then(setUsers).catch(() => {});
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    setLoading(true);
    setMessage("");
    fetchAdminLeads(status, search)
      .then(setItems)
      .catch(() => {
        setItems([]);
        setMessage("تعذر تحميل الطلبات. حاول التحديث عبر إعادة اختيار الحالة.");
      })
      .finally(() => setLoading(false));
  }, [status, search]);

  function resetFilters() {
    setStatus("");
    setSearch("");
    setSearchInput("");
    setExpanded(null);
  }

  async function change(
    id: number,
    payload: Partial<LeadPayload> & { assignedTo?: number | null },
  ) {
    setMessage("");
    setNotice("");
    const res = await updateAdminLead(id, payload);
    if (!res.ok) {
      setMessage("تعذر حفظ التعديل. حاول مرة أخرى.");
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...payload } : it)),
    );
    if (Object.prototype.hasOwnProperty.call(payload, "status")) {
      loadCounts();
      setNotice("تم تحديث حالة الطلب.");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "assignedTo")) {
      setNotice("تم تحديث المسؤول.");
    }
    if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
      setSavedNoteId(id);
      setNotice("تم حفظ الملاحظة.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">العملاء المحتملون</h1>
          <p className="text-slate-300 mt-1">
            الطلبات الواردة من الموقع، جاهزة للمتابعة والإسناد.
          </p>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-white/15 bg-white/5 text-white/80 px-4 py-2 text-sm font-bold hover:bg-white/10 transition"
          >
            عرض كل الطلبات
          </button>
        ) : null}
      </div>

      {/* مسار الحالات: نظرة سريعة وتصفية مباشرة */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="text-sm font-bold text-white">مسار الحالات</div>
          <div className="text-xs text-white/70">
            اضغط على أي حالة لعرض طلباتها. الأرقام لكل الطلبات وليس للنتائج المعروضة فقط.
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STATUS_ORDER.map((key, index) => {
            const active = status === key;
            const isExit = key === "lost";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(active ? "" : key)}
                aria-pressed={active}
                className={`text-right rounded-xl px-3 py-3 border transition ${
                  active
                    ? "bg-emerald-500/15 border-emerald-400/50"
                    : isExit
                      ? "bg-red-500/5 border-red-400/20 hover:bg-red-500/10"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-white/70 font-bold" dir="ltr">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xl font-extrabold text-white">
                    {statusCounts[key] || 0}
                  </span>
                </div>
                <div className="font-bold text-sm text-white mt-1">
                  {STATUS_LABELS[key]}
                </div>
                <div className="text-[11px] text-white/70 mt-0.5">
                  {STATUS_HINTS[key]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <form
          className="flex flex-wrap gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <label className="block flex-1 min-w-[220px]">
            <span className="block text-sm font-bold text-gray-700 mb-2">
              بحث بالاسم أو الهاتف
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="اكتب الاسم أو رقم الهاتف"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-2">
              تصفية حسب الحالة
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900"
            >
              <option value="">كل الحالات</option>
              {STATUS_ORDER.map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-6 py-2.5 font-bold text-white"
          >
            بحث
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              مسح التصفية
            </button>
          ) : null}
        </form>
      </div>

      {message ? (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {message}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          {notice}
        </p>
      ) : null}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">جارٍ تحميل الطلبات…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-bold text-gray-800">
              {hasFilters ? "لا توجد طلبات مطابقة للتصفية" : "لا توجد طلبات حالياً"}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {hasFilters
                ? "جرّب تغيير الحالة أو عبارة البحث."
                : "ستظهر هنا الطلبات الواردة من الموقع بشكل مباشر."}
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-xl bg-gray-100 text-gray-800 font-bold px-5 py-2 hover:bg-gray-200 transition"
              >
                إزالة التصفية
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th scope="col" className="p-3 text-right font-bold">العميل</th>
                  <th scope="col" className="p-3 text-right font-bold">المشروع والمصدر</th>
                  <th scope="col" className="p-3 text-right font-bold">التاريخ</th>
                  <th scope="col" className="p-3 text-right font-bold">الحالة</th>
                  <th scope="col" className="p-3 text-right font-bold">المسؤول</th>
                  <th scope="col" className="p-3 text-right font-bold">ملاحظات المتابعة</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isExpanded = expanded === it.id;
                  const assigneeKnown = users.some((u) => u.id === it.assignedToId);
                  return (
                    <Fragment key={it.id}>
                      <tr className="border-t border-gray-100 align-top">
                        <td className="p-3">
                          <div className="font-bold text-gray-900">{it.name}</div>
                          {it.phone ? (
                            <a
                              dir="ltr"
                              href={`tel:${it.phone}`}
                              className="text-xs text-sq-green font-semibold mt-1 block w-fit"
                            >
                              {it.phone}
                            </a>
                          ) : (
                            <div className="text-xs text-gray-600 mt-1">لا يوجد هاتف</div>
                          )}
                          {it.email ? (
                            <a
                              dir="ltr"
                              href={`mailto:${it.email}`}
                              className="text-xs text-gray-500 mt-0.5 block w-fit break-all"
                            >
                              {it.email}
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setExpanded(isExpanded ? null : it.id)}
                            aria-expanded={isExpanded}
                            className="text-xs text-sq-green font-bold mt-2 underline underline-offset-2"
                          >
                            {isExpanded ? "إخفاء التفاصيل" : "تفاصيل العميل والرسالة"}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-gray-800">
                            {it.projectType || "نوع المشروع غير محدد"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            المصدر: {SOURCE_LABELS[it.source] || it.source || "—"}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div dir="ltr">
                            {it.createdAt
                              ? new Date(it.createdAt).toLocaleDateString("ar")
                              : "—"}
                          </div>
                          {it.updatedAt && it.updatedAt !== it.createdAt ? (
                            <div className="text-gray-600 mt-1" dir="ltr">
                              تحديث: {new Date(it.updatedAt).toLocaleDateString("ar")}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <label className="sr-only" htmlFor={`lead-status-${it.id}`}>
                            حالة الطلب
                          </label>
                          <select
                            id={`lead-status-${it.id}`}
                            value={it.status}
                            onChange={(e) =>
                              change(it.id, { status: e.target.value })
                            }
                            className="rounded-lg border border-gray-300 px-2 py-1.5"
                          >
                            {STATUS_ORDER.map((key) => (
                              <option key={key} value={key}>
                                {STATUS_LABELS[key]}
                              </option>
                            ))}
                            {!STATUS_ORDER.includes(it.status as (typeof STATUS_ORDER)[number]) && it.status ? (
                              <option value={it.status}>{it.status}</option>
                            ) : null}
                          </select>
                        </td>
                        <td className="p-3">
                          <label className="sr-only" htmlFor={`lead-assignee-${it.id}`}>
                            المسؤول
                          </label>
                          <select
                            id={`lead-assignee-${it.id}`}
                            value={it.assignedToId || ""}
                            onChange={(e) =>
                              change(it.id, {
                                assignedTo: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="rounded-lg border border-gray-300 px-2 py-1.5"
                          >
                            <option value="">بدون إسناد</option>
                            {!assigneeKnown && it.assignedToId ? (
                              <option value={it.assignedToId}>
                                {it.assignedToName || `#${it.assignedToId}`}
                              </option>
                            ) : null}
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.username}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <textarea
                            rows={2}
                            aria-label={`ملاحظات المتابعة لـ ${it.name}`}
                            value={notes[it.id] ?? it.notes ?? ""}
                            onChange={(e) => {
                              setNotes((prev) => ({
                                ...prev,
                                [it.id]: e.target.value,
                              }));
                              setSavedNoteId(null);
                            }}
                            placeholder="اكتب ملاحظة متابعة..."
                            className="w-44 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                          />
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                change(it.id, {
                                  notes: notes[it.id] ?? it.notes ?? "",
                                })
                              }
                              className="text-xs font-bold text-sq-green"
                            >
                              حفظ الملاحظة
                            </button>
                            {savedNoteId === it.id ? (
                              <span className="text-[11px] font-bold text-emerald-700">
                                تم الحفظ
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-t border-gray-100 bg-gray-50/60">
                          <td colSpan={6} className="p-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="text-sm font-bold text-gray-900 mb-2">
                                  بيانات العميل
                                </div>
                                <dl className="text-xs text-gray-700 space-y-1.5">
                                  <div className="flex gap-2">
                                    <dt className="font-semibold text-gray-500 w-24 shrink-0">الاسم</dt>
                                    <dd>{it.name}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="font-semibold text-gray-500 w-24 shrink-0">الهاتف</dt>
                                    <dd dir="ltr">{it.phone || "—"}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="font-semibold text-gray-500 w-24 shrink-0">البريد</dt>
                                    <dd dir="ltr" className="break-all">{it.email || "—"}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="font-semibold text-gray-500 w-24 shrink-0">المشروع</dt>
                                    <dd>{it.projectType || "—"}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="font-semibold text-gray-500 w-24 shrink-0">المصدر</dt>
                                    <dd>{SOURCE_LABELS[it.source] || it.source || "—"}</dd>
                                  </div>
                                  <div className="flex gap-2">
                                    <dt className="font-semibold text-gray-500 w-24 shrink-0">المسؤول</dt>
                                    <dd>{it.assignedToName || "بدون إسناد"}</dd>
                                  </div>
                                </dl>
                              </div>
                              <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <div className="text-sm font-bold text-gray-900 mb-2">
                                  رسالة العميل
                                </div>
                                <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                                  {it.message || "لم يرفق العميل رسالة مع طلبه."}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-4">
                              {it.phone ? (
                                <a
                                  href={`tel:${it.phone}`}
                                  className="rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-xs font-bold hover:bg-gray-50 transition"
                                >
                                  اتصال هاتفي
                                </a>
                              ) : null}
                              {it.email ? (
                                <a
                                  href={`mailto:${it.email}`}
                                  className="rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-xs font-bold hover:bg-gray-50 transition"
                                >
                                  إرسال بريد
                                </a>
                              ) : null}
                              {STATUS_ORDER.filter((key) => key !== it.status).map((key) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => change(it.id, { status: key })}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-xs font-bold hover:bg-emerald-100 transition"
                                >
                                  نقل إلى: {STATUS_LABELS[key]}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
