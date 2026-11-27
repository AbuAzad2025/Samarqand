import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deleteAdminMediaDocument,
  deleteAdminMediaImage,
  fetchAdminMediaDocuments,
  fetchAdminMediaImages,
  uploadAdminDocument,
  uploadAdminImage,
  type AdminMediaDocument,
  type AdminMediaImage,
} from "@/react-app/api/site";

type Tab = "images" | "documents";

// حدود الرفع الافتراضية على الخادم؛ تُعرض للمستخدم قبل الإرسال
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const DOCUMENT_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".rtf", ".odt", ".ods", ".odp", ".zip",
];
const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.join(",");

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${bytes} بايت`;
}

export default function ControlMedia() {
  const [tab, setTab] = useState<Tab>("images");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const limit = 48;

  const [images, setImages] = useState<AdminMediaImage[]>([]);
  const [imagesTotal, setImagesTotal] = useState(0);
  const [docs, setDocs] = useState<AdminMediaDocument[]>([]);
  const [docsTotal, setDocsTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ name: string; size: number; url: string | null } | null>(null);

  const offset = page * limit;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(((tab === "images" ? imagesTotal : docsTotal) || 0) / limit)), [docsTotal, imagesTotal, tab]);

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  function clearNotice() {
    setNotice(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "images") {
        const res = await fetchAdminMediaImages({ q: q.trim() || undefined, limit, offset });
        setImages(res.items);
        setImagesTotal(res.total);
      } else {
        const res = await fetchAdminMediaDocuments({ q: q.trim() || undefined, limit, offset });
        setDocs(res.items);
        setDocsTotal(res.total);
      }
    } catch {
      notify("error", "تعذر تحميل المكتبة. يرجى الضغط على «تحديث».");
    } finally {
      setLoading(false);
    }
  }, [limit, offset, q, tab]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [tab, q]);

  // تنظيف رابط المعاينة المؤقت عند تغيير الملف أو مغادرة الصفحة
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">المكتبة</h1>
          <p className="text-slate-300 mt-1">إدارة الصور والملفات المستخدمة في الموقع.</p>
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
          <button
            type="button"
            onClick={() => { setTab("images"); setPreview(null); }}
            className={`px-4 py-2 rounded-lg font-semibold border transition ${
              tab === "images" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            }`}
          >
            الصور
          </button>
          <button
            type="button"
            onClick={() => { setTab("documents"); setPreview(null); }}
            className={`px-4 py-2 rounded-lg font-semibold border transition ${
              tab === "documents" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            }`}
          >
            الملفات
          </button>
          <div className="flex-1 min-w-[240px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالعنوان..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2"
            />
          </div>
          {tab === "images" ? (
            <label className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition cursor-pointer">
              {uploading ? "جارٍ الرفع..." : "رفع صورة"}
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const name = file.name.toLowerCase();
                  const validType =
                    IMAGE_MIMES.includes(file.type) ||
                    [".jpg", ".jpeg", ".png", ".webp"].some((ext) => name.endsWith(ext));
                  if (!validType) {
                    e.target.value = "";
                    notify("error", "صيغة الصورة غير مقبولة. استخدم JPG أو PNG أو WebP.");
                    return;
                  }
                  if (file.size > IMAGE_MAX_BYTES) {
                    e.target.value = "";
                    notify("error", `حجم الصورة (${formatBytes(file.size)}) يتجاوز الحد المسموح: 5 ميغابايت.`);
                    return;
                  }
                  setPreview({ name: file.name, size: file.size, url: URL.createObjectURL(file) });
                  setUploading(true);
                  clearNotice();
                  try {
                    const up = await uploadAdminImage(file, file.name);
                    if (!up.ok) {
                      notify("error", "تعذر رفع الصورة. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    notify("success", "تم رفع الصورة وإضافتها إلى المكتبة.");
                    await load();
                    setPreview(null);
                  } catch {
                    notify("error", "تعذر رفع الصورة. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          ) : (
            <label className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition cursor-pointer">
              {uploading ? "جارٍ الرفع..." : "رفع ملف"}
              <input
                type="file"
                accept={DOCUMENT_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
                  if (!DOCUMENT_EXTENSIONS.includes(ext)) {
                    e.target.value = "";
                    notify("error", "صيغة الملف غير مقبولة. راجع الصيغ الموضحة أدناه.");
                    return;
                  }
                  if (file.size > DOCUMENT_MAX_BYTES) {
                    e.target.value = "";
                    notify("error", `حجم الملف (${formatBytes(file.size)}) يتجاوز الحد المسموح: 20 ميغابايت.`);
                    return;
                  }
                  setPreview({ name: file.name, size: file.size, url: null });
                  setUploading(true);
                  clearNotice();
                  try {
                    const up = await uploadAdminDocument(file, file.name);
                    if (!up.ok) {
                      notify("error", "تعذر رفع الملف. يرجى المحاولة مرة أخرى.");
                      return;
                    }
                    notify("success", "تم رفع الملف وإضافته إلى المكتبة.");
                    await load();
                    setPreview(null);
                  } catch {
                    notify("error", "تعذر رفع الملف. يرجى المحاولة مرة أخرى.");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-3">
          {tab === "images"
            ? "الصور المقبولة: JPG / PNG / WebP • الحد الأقصى للحجم: 5 ميغابايت."
            : `الصيغ المقبولة: ${DOCUMENT_EXTENSIONS.join(" / ")} • الحد الأقصى للحجم: 20 ميغابايت.`}
        </p>
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

      {preview ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-6">
          <div className="text-sm font-bold text-gray-900 mb-3">معاينة قبل الرفع</div>
          <div className="flex items-center gap-4 flex-wrap">
            {preview.url ? (
              <img src={preview.url} alt="معاينة الصورة المحددة" className="w-24 h-24 rounded-xl border border-gray-200 object-cover bg-gray-50" />
            ) : (
              <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-3xl" aria-hidden="true">📄</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate" dir="ltr">{preview.name}</div>
              <div className="text-xs text-gray-600 mt-1">{formatBytes(preview.size)}</div>
              {uploading ? (
                <div className="text-sm text-sq-green font-semibold mt-2" role="status">جارٍ الرفع...</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "images" ? (
        loading ? (
          <div className="text-gray-600">جارٍ التحميل...</div>
        ) : !images.length ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">🖼️</div>
            <div className="font-bold text-gray-900">لا توجد صور في المكتبة</div>
            <p className="text-sm text-gray-600 mt-2">ارفع صورة من الزر أعلاه؛ الصور المقبولة JPG / PNG / WebP وبحد أقصى 5 ميغابايت.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {images.map((img) => (
              <div key={img.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="aspect-square bg-gray-50 border-b border-gray-200 overflow-hidden">
                  {img.url ? <img loading="lazy" decoding="async" src={img.url} alt={img.title} className="w-full h-full object-cover" /> : null}
                </div>
                <div className="p-3">
                  <div className="text-sm font-bold text-gray-900 truncate">{img.title || `#${img.id}`}</div>
                  <div className="text-xs text-gray-600 mt-1" dir="ltr">
                    {img.width}×{img.height} • #{img.id}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`فتح الصورة ${img.title || `#${img.id}`}`}
                      className="flex-1 bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition text-center"
                    >
                      فتح
                    </a>
                    <button
                      type="button"
                      aria-label={`حذف الصورة ${img.title || `#${img.id}`}`}
                      onClick={async () => {
                        if (!window.confirm("حذف الصورة؟ قد تتأثر عناصر مرتبطة بها.")) return;
                        clearNotice();
                        try {
                          const res = await deleteAdminMediaImage(img.id);
                          if (!res.ok) {
                            notify("error", "تعذر حذف الصورة. يرجى المحاولة مرة أخرى.");
                            return;
                          }
                          notify("success", "تم حذف الصورة.");
                          await load();
                        } catch {
                          notify("error", "تعذر حذف الصورة. يرجى المحاولة مرة أخرى.");
                        }
                      }}
                      className="bg-white border border-red-200 text-red-700 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <div className="text-gray-600">جارٍ التحميل...</div>
      ) : !docs.length ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">📁</div>
          <div className="font-bold text-gray-900">لا توجد ملفات في المكتبة</div>
          <p className="text-sm text-gray-600 mt-2">ارفع ملفاً من الزر أعلاه؛ الحد الأقصى للحجم 20 ميغابايت.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y">
            {docs.map((d) => (
              <div key={d.id} className="p-5 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 truncate">{d.title || `#${d.id}`}</div>
                  <div className="text-xs text-gray-600 mt-1" dir="ltr">
                    #{d.id} • {Math.round((d.fileSize || 0) / 1024)} KB
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate" dir="ltr">
                    {d.url}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`فتح الملف ${d.title || `#${d.id}`}`}
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    فتح
                  </a>
                  <button
                    type="button"
                    aria-label={`حذف الملف ${d.title || `#${d.id}`}`}
                    onClick={async () => {
                      if (!window.confirm("حذف الملف؟")) return;
                      clearNotice();
                      try {
                        const res = await deleteAdminMediaDocument(d.id);
                        if (!res.ok) {
                          notify("error", "تعذر حذف الملف. يرجى المحاولة مرة أخرى.");
                          return;
                        }
                        notify("success", "تم حذف الملف.");
                        await load();
                      } catch {
                        notify("error", "تعذر حذف الملف. يرجى المحاولة مرة أخرى.");
                      }
                    }}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mt-8">
        <div className="text-sm text-gray-600">
          صفحة {page + 1} من {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            السابق
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      </div>
    </div>
  );
}
