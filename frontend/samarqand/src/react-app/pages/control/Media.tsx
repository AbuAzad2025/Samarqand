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
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);

  const offset = page * limit;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(((tab === "images" ? imagesTotal : docsTotal) || 0) / limit)), [docsTotal, imagesTotal, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
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
      setStatus("error");
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

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المكتبة</h1>
          <p className="text-gray-600 mt-1">إدارة الصور والملفات المستخدمة في الموقع.</p>
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
            onClick={() => setTab("images")}
            className={`px-4 py-2 rounded-lg font-semibold border transition ${
              tab === "images" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            }`}
          >
            الصور
          </button>
          <button
            type="button"
            onClick={() => setTab("documents")}
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
            <label className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition cursor-pointer">
              {uploading ? "جارٍ الرفع..." : "رفع صورة"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setStatus("idle");
                  try {
                    const up = await uploadAdminImage(file, file.name);
                    if (!up.ok) {
                      setStatus("error");
                      return;
                    }
                    setStatus("saved");
                    setTimeout(() => setStatus("idle"), 1500);
                    await load();
                  } catch {
                    setStatus("error");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          ) : (
            <label className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition cursor-pointer">
              {uploading ? "جارٍ الرفع..." : "رفع ملف"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setStatus("idle");
                  try {
                    const up = await uploadAdminDocument(file, file.name);
                    if (!up.ok) {
                      setStatus("error");
                      return;
                    }
                    setStatus("saved");
                    setTimeout(() => setStatus("idle"), 1500);
                    await load();
                  } catch {
                    setStatus("error");
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          )}
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

      {tab === "images" ? (
        loading ? (
          <div className="text-gray-600">جارٍ التحميل...</div>
        ) : !images.length ? (
          <div className="text-gray-600">لا يوجد صور.</div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {images.map((img) => (
              <div key={img.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="aspect-square bg-gray-50 border-b border-gray-200 overflow-hidden">
                  {img.url ? <img src={img.url} alt={img.title} className="w-full h-full object-cover" /> : null}
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
                      className="flex-1 bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition text-center"
                    >
                      فتح
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = window.confirm("حذف الصورة؟ قد تتأثر عناصر مرتبطة بها.");
                        if (!ok) return;
                        setStatus("idle");
                        const res = await deleteAdminMediaImage(img.id).catch(() => ({ ok: false }));
                        if (!res.ok) {
                          setStatus("error");
                          return;
                        }
                        setStatus("saved");
                        setTimeout(() => setStatus("idle"), 1500);
                        await load();
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
        <div className="text-gray-600">لا يوجد ملفات.</div>
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
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    فتح
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = window.confirm("حذف الملف؟");
                      if (!ok) return;
                      setStatus("idle");
                      const res = await deleteAdminMediaDocument(d.id).catch(() => ({ ok: false }));
                      if (!res.ok) {
                        setStatus("error");
                        return;
                      }
                      setStatus("saved");
                      setTimeout(() => setStatus("idle"), 1500);
                      await load();
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
