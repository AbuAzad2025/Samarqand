import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  deleteAdminArticle,
  fetchAdminArticleDetail,
  publishAdminArticle,
  unpublishAdminArticle,
  updateAdminArticle,
  uploadAdminImage,
  type AdminArticleDetail,
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

  const exec = useCallback((cmd: string, arg?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      return;
    }
    onChange(el.innerHTML);
  }, [onChange]);

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
        <button type="button" onClick={() => exec("formatBlock", "p")} className="px-3 py-1 rounded-lg border bg-white">
          P
        </button>
        <button type="button" onClick={() => exec("insertUnorderedList")} className="px-3 py-1 rounded-lg border bg-white">
          • قائمة
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className="px-3 py-1 rounded-lg border bg-white">
          1. قائمة
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("الرابط:");
            if (!url) return;
            exec("createLink", url);
          }}
          className="px-3 py-1 rounded-lg border bg-white"
        >
          رابط
        </button>
        <button type="button" onClick={() => exec("removeFormat")} className="px-3 py-1 rounded-lg border bg-white">
          إزالة تنسيق
        </button>
      </div>
      <div
        ref={ref}
        className="min-h-[240px] p-4 prose max-w-none focus:outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          const el = ref.current;
          if (!el) return;
          onChange(el.innerHTML);
        }}
      />
    </div>
  );
}

export default function ControlBlogEdit() {
  const params = useParams();
  const navigate = useNavigate();
  const id = Number(params.id || 0);
  const [data, setData] = useState<AdminArticleDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploadingCover, setUploadingCover] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverImageId, setCoverImageId] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  const load = useCallback(async () => {
    const d = await fetchAdminArticleDetail(id);
    setData(d);
    setTitle(d.title || "");
    setSlug(d.slug || "");
    setSearchDescription(d.searchDescription || "");
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
      searchDescription !== data.searchDescription ||
      bodyHtml !== data.bodyHtml ||
      coverImageId !== (data.coverImageId ?? null));

  const onSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminArticle(id, { title, slug, searchDescription, bodyHtml, coverImageId });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      await load();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [bodyHtml, coverImageId, id, load, searchDescription, slug, title]);

  if (!id) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="text-gray-700">معرّف المقال غير صحيح.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="text-gray-700">جارٍ التحميل...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">تحرير مقال</h1>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                data.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              {data.live ? "منشور" : "مسودة"}
            </span>
          </div>
          <p className="text-gray-600 mt-1" dir="ltr">
            {data.slug}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/control/blogs"
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            رجوع
          </Link>
          {data.live ? (
            <button
              type="button"
              onClick={async () => {
                await unpublishAdminArticle(id).catch(() => {});
                await load().catch(() => {});
              }}
              className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
            >
              إلغاء النشر
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await publishAdminArticle(id).catch(() => {});
                await load().catch(() => {});
              }}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
            >
              نشر
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges || saving}
            className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>

      {status === "saved" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800 font-semibold">
          تم الحفظ بنجاح.
        </div>
      ) : null}
      {status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-800 font-semibold">
          حصل خطأ أثناء الحفظ.
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
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
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
            <div className="text-lg font-bold text-red-900 mb-2">حذف المقال</div>
            <p className="text-red-800 mb-4">سيتم حذف المقال نهائياً.</p>
            <button
              type="button"
              onClick={async () => {
                const ok = window.confirm("هل أنت متأكد من الحذف؟");
                if (!ok) return;
                const res = await deleteAdminArticle(id).catch(() => ({ ok: false }));
                if (res.ok) {
                  navigate("/control/blogs", { replace: true });
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
