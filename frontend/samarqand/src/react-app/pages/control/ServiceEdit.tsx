import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  deleteAdminService,
  fetchAdminServiceDetail,
  publishAdminService,
  unpublishAdminService,
  updateAdminService,
  uploadAdminImage,
  type AdminServiceDetail,
} from "@/react-app/api/site";

function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef<string>("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== lastValueRef.current && el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    lastValueRef.current = value;
  }, [value]);

  const exec = useCallback(
    (cmd: string, arg?: string) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      try {
        document.execCommand(cmd, false, arg);
      } catch {
        return;
      }
      onChange(el.innerHTML);
    },
    [onChange],
  );

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <div className="flex flex-wrap gap-2 p-3 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => exec("bold")} className="px-3 py-1 rounded-lg border bg-white font-bold">
          B
        </button>
        <button type="button" onClick={() => exec("italic")} className="px-3 py-1 rounded-lg border bg-white italic">
          I
        </button>
        <button type="button" onClick={() => exec("underline")} className="px-3 py-1 rounded-lg border bg-white underline">
          U
        </button>
        <button type="button" onClick={() => exec("formatBlock", "h2")} className="px-3 py-1 rounded-lg border bg-white font-semibold">
          H2
        </button>
        <button type="button" onClick={() => exec("formatBlock", "h3")} className="px-3 py-1 rounded-lg border bg-white font-semibold">
          H3
        </button>
        <button type="button" onClick={() => exec("insertUnorderedList")} className="px-3 py-1 rounded-lg border bg-white font-semibold">
          •
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className="px-3 py-1 rounded-lg border bg-white font-semibold">
          1.
        </button>
        <button type="button" onClick={() => exec("createLink", prompt("أدخل الرابط") || "")} className="px-3 py-1 rounded-lg border bg-white font-semibold">
          رابط
        </button>
        <button type="button" onClick={() => exec("unlink")} className="px-3 py-1 rounded-lg border bg-white font-semibold">
          إزالة رابط
        </button>
      </div>
      <div
        ref={ref}
        className="min-h-[260px] p-4 outline-none"
        contentEditable
        onInput={() => {
          const el = ref.current;
          if (!el) return;
          onChange(el.innerHTML);
        }}
      />
    </div>
  );
}

export default function ControlServiceEdit() {
  const params = useParams();
  const navigate = useNavigate();
  const id = Number(params.id || 0);

  const [data, setData] = useState<AdminServiceDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploadingCover, setUploadingCover] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverImageId, setCoverImageId] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  const load = useCallback(async () => {
    const d = await fetchAdminServiceDetail(id);
    setData(d);
    setTitle(d.title || "");
    setSlug(d.slug || "");
    setShortDescription(d.shortDescription || "");
    setBodyHtml(d.bodyHtml || "");
    setCoverImageId(d.coverImageId ?? null);
    setCoverUrl(d.coverUrl || "");
  }, [id]);

  useEffect(() => {
    if (!id) return;
    load().catch(() => {});
  }, [id, load]);

  const hasChanges =
    data &&
    (title !== data.title ||
      slug !== data.slug ||
      shortDescription !== data.shortDescription ||
      bodyHtml !== data.bodyHtml ||
      coverImageId !== (data.coverImageId ?? null));

  const onSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminService(id, {
        title,
        slug,
        shortDescription,
        bodyHtml,
        coverImageId,
      });
      setStatus(res.ok ? "saved" : "error");
      await load();
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 1500);
    }
  }, [bodyHtml, coverImageId, id, load, shortDescription, slug, title]);

  if (!data) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{data.title}</h1>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                data.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              {data.live ? "منشور" : "مسودة"}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
            <Link to="/control/services" className="text-[#4A90E2] font-semibold hover:underline">
              الخدمات
            </Link>
            <span className="text-gray-300">/</span>
            <span dir="ltr" className="truncate">
              {data.slug}
            </span>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={async () => {
              if (data.live) await unpublishAdminService(id);
              else await publishAdminService(id);
              await load();
            }}
            className={`px-5 py-3 rounded-lg font-bold transition ${
              data.live ? "bg-white border border-gray-200 text-gray-800 hover:shadow-sm" : "bg-emerald-600 text-white hover:shadow-lg"
            }`}
          >
            {data.live ? "إلغاء النشر" : "نشر"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !hasChanges}
            className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>

      {status === "saved" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      ) : status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر الحفظ.
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">وصف مختصر</label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] min-h-[110px]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">المحتوى</div>
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">صورة الغلاف</div>
            {coverUrl ? (
              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 mb-4">
                <img src={coverUrl} alt={title || "cover"} className="w-full h-56 object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-gray-600 mb-4">
                لا توجد صورة غلاف.
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <label className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition cursor-pointer">
                {uploadingCover ? "جارٍ الرفع..." : "رفع صورة"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingCover}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingCover(true);
                    try {
                      const res = await uploadAdminImage(file, title || file.name);
                      if (res.ok && res.id) {
                        setCoverImageId(res.id);
                        setCoverUrl(res.url || "");
                      }
                    } finally {
                      setUploadingCover(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setCoverImageId(null);
                  setCoverUrl("");
                }}
                className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
              >
                إزالة
              </button>
            </div>
          </div>

          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-red-900 mb-2">حذف الخدمة</div>
            <p className="text-red-800 mb-4">سيتم حذف الخدمة نهائياً.</p>
            <button
              type="button"
              onClick={async () => {
                const ok = window.confirm("هل أنت متأكد من الحذف؟");
                if (!ok) return;
                const res = await deleteAdminService(id).catch(() => ({ ok: false }));
                if (res.ok) {
                  navigate("/control/services", { replace: true });
                }
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition"
            >
              حذف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
