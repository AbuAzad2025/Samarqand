import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchAdminCompanyDocuments,
  removeAdminCompanyDocument,
  reorderAdminCompanyDocuments,
  updateAdminCompanyDocument,
  uploadAdminCompanyDocument,
  type AdminCompanyDocument,
  type CompanyDocumentCategory,
} from "@/react-app/api/site";

const CATEGORIES: { key: CompanyDocumentCategory; label: string }[] = [
  { key: "template", label: "قوالب" },
  { key: "letterhead", label: "ترويسات" },
  { key: "invoice", label: "فواتير" },
  { key: "receipt", label: "سندات قبض" },
  { key: "company_document", label: "مستندات الشركة" },
  { key: "company_certificate", label: "وثائق الشركة" },
];

function formatBytes(n: number): string {
  const val = Number(n || 0);
  if (!val) return "—";
  const kb = 1024;
  const mb = kb * 1024;
  if (val >= mb) return `${(val / mb).toFixed(1)} MB`;
  if (val >= kb) return `${Math.round(val / kb)} KB`;
  return `${val} B`;
}

export default function ControlCompanyDocuments() {
  const [category, setCategory] = useState<CompanyDocumentCategory>("template");
  const [items, setItems] = useState<AdminCompanyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const [q, setQ] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const categoryLabel = useMemo(() => CATEGORIES.find((c) => c.key === category)?.label || "—", [category]);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetchAdminCompanyDocuments(category);
      setItems(res);
    } catch {
      setStatus("error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((x) => (x.title || "").toLowerCase().includes(qq));
  }, [items, q]);

  const canReorder = useMemo(() => !q.trim() && !reordering, [q, reordering]);

  async function onUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setStatus("idle");
    try {
      const res = await uploadAdminCompanyDocument({
        category,
        file: uploadFile,
        title: uploadTitle.trim() || undefined,
      });
      setStatus(res.ok ? "saved" : "error");
      setUploadFile(null);
      setUploadTitle("");
      await load();
    } catch {
      setStatus("error");
    } finally {
      setUploading(false);
      setTimeout(() => setStatus("idle"), 1500);
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
      const res = await reorderAdminCompanyDocuments({ category, ids: reordered.map((x) => x.id) });
      if (!res.ok) {
        await load();
      }
    } finally {
      setReordering(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">مستندات الشركة</h1>
          <p className="text-gray-600 mt-1 truncate">
            إدارة القوالب والترويسات والفواتير وسندات القبض والمستندات والوثائق.
          </p>
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

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                category === c.key ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </button>
          ))}
          <div className="flex-1 min-w-[240px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2"
            />
          </div>
        </div>
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

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="text-lg font-bold text-gray-900">{categoryLabel}</div>
            <div className="text-sm text-gray-600 mt-1">{items.length} ملف</div>
            {q.trim() ? <div className="text-xs text-gray-500 mt-1">الترتيب معطل أثناء البحث.</div> : null}
          </div>
        </div>

        <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">إضافة ملف</label>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان (اختياري)</label>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onUpload}
            disabled={!uploadFile || uploading}
            className="mt-4 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            {uploading ? "جارٍ الرفع..." : "رفع"}
          </button>
        </div>

        {loading ? (
          <div className="text-gray-600 mt-6">جارٍ التحميل...</div>
        ) : (
          <div className="mt-6 space-y-3">
            {filtered.map((d, idx) => (
              <div
                key={d.id}
                className="border border-gray-200 rounded-2xl bg-white px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <input
                    value={d.title || ""}
                    onChange={(e) => setItems((prev) => prev.map((x) => (x.id === d.id ? { ...x, title: e.target.value } : x)))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  />
                  <div className="text-sm text-gray-600 mt-1 flex items-center gap-3 flex-wrap">
                    <span dir="ltr">{formatBytes(d.fileSize)}</span>
                    <span className="text-gray-300">•</span>
                    <span dir="ltr">#{d.id}</span>
                    {d.createdAt ? (
                      <>
                        <span className="text-gray-300">•</span>
                        <span dir="ltr">{d.createdAt}</span>
                      </>
                    ) : null}
                    {!q.trim() ? (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs text-gray-500">الترتيب: {idx + 1}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => moveItem(d.id, -1)}
                    disabled={!canReorder || items[0]?.id === d.id}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                  >
                    أعلى
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(d.id, 1)}
                    disabled={!canReorder || items[items.length - 1]?.id === d.id}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                  >
                    أسفل
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setStatus("idle");
                      const res = await updateAdminCompanyDocument(d.id, { title: d.title || "" }).catch(() => ({ ok: false }));
                      setStatus(res.ok ? "saved" : "error");
                      setTimeout(() => setStatus("idle"), 1500);
                      await load();
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    حفظ
                  </button>
                  {d.downloadUrl ? (
                    <a
                      href={d.downloadUrl}
                      className="text-[#007A3D] font-bold text-sm hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      تنزيل
                    </a>
                  ) : null}
                  {d.url ? (
                    <a
                      href={d.url}
                      className="text-gray-800 font-bold text-sm hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      فتح
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("حذف الملف؟")) return;
                      setStatus("idle");
                      const res = await removeAdminCompanyDocument(d.id).catch(() => ({ ok: false }));
                      setStatus(res.ok ? "saved" : "error");
                      setTimeout(() => setStatus("idle"), 1500);
                      await load();
                    }}
                    className="text-red-700 font-bold text-sm hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length ? <div className="text-gray-600">لا يوجد ملفات.</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
