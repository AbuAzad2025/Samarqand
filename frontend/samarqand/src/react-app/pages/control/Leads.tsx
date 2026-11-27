import { useEffect, useState } from "react";

import {
  fetchAdminLeads,
  fetchLeadAssignees,
  updateAdminLead,
  type LeadPayload,
} from "@/react-app/api/site";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  won: "مُحوّل لعميل",
  lost: "مفقود",
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
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchLeadAssignees().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAdminLeads(status, search)
      .then(setItems)
      .catch(() => setMessage("تعذر تحميل الطلبات."))
      .finally(() => setLoading(false));
  }, [status, search]);

  async function change(
    id: number,
    payload: Partial<LeadPayload> & { assignedTo?: number | null },
  ) {
    setMessage("");
    const res = await updateAdminLead(id, payload);
    if (!res.ok) {
      setMessage("تعذر حفظ التعديل.");
      return;
    }
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...payload } : it)),
    );
  }

  const counts = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.status] = (acc[it.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">العملاء المحتملون</h1>
        <p className="text-slate-300 mt-1">
          الطلبات الواردة من الموقع، جاهزة للمتابعة والإسناد.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div
            key={key}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
          >
            <div className="text-xs text-white/60">{label}</div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {counts[key] || 0}
            </div>
          </div>
        ))}
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
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-2">
              الحالة
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900"
            >
              <option value="">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
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
        </form>
      </div>

      {message ? <p className="text-sm text-red-300">{message}</p> : null}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">جارٍ التحميل…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            لا توجد طلبات حالياً.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3 text-right font-bold">العميل</th>
                  <th className="p-3 text-right font-bold">نوع المشروع</th>
                  <th className="p-3 text-right font-bold">المصدر</th>
                  <th className="p-3 text-right font-bold">التاريخ</th>
                  <th className="p-3 text-right font-bold">الحالة</th>
                  <th className="p-3 text-right font-bold">المسؤول</th>
                  <th className="p-3 text-right font-bold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100">
                    <td className="p-3 align-top">
                      <div className="font-bold">{it.name}</div>
                      <div dir="ltr" className="text-xs text-gray-500">
                        {it.phone}
                      </div>
                      {it.email ? (
                        <div className="text-xs text-gray-500">{it.email}</div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(expanded === it.id ? null : it.id)
                        }
                        className="text-xs text-sq-green font-bold mt-1"
                      >
                        {expanded === it.id ? "إخفاء الرسالة" : "عرض الرسالة"}
                      </button>
                      {expanded === it.id ? (
                        <p className="mt-2 text-xs leading-relaxed bg-gray-50 rounded-lg p-2 max-w-xs">
                          {it.message || "—"}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3 align-top">{it.projectType || "—"}</td>
                    <td className="p-3 align-top">
                      {SOURCE_LABELS[it.source] || it.source}
                    </td>
                    <td className="p-3 align-top text-xs">
                      {it.createdAt
                        ? new Date(it.createdAt).toLocaleDateString("ar")
                        : "—"}
                    </td>
                    <td className="p-3 align-top">
                      <select
                        value={it.status}
                        onChange={(e) =>
                          change(it.id, { status: e.target.value })
                        }
                        className="rounded-lg border border-gray-300 px-2 py-1.5"
                      >
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 align-top">
                      <select
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
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 align-top">
                      <textarea
                        rows={2}
                        value={notes[it.id] ?? it.notes}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [it.id]: e.target.value }))
                        }
                        className="w-44 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => change(it.id, { notes: notes[it.id] ?? it.notes })}
                        className="mt-1 text-xs font-bold text-sq-green"
                      >
                        حفظ الملاحظة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
