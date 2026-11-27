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
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverImageId, setCoverImageId] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  const load = useCallback(async () => {
    try {
      const d = await fetchAdminArticleDetail(id);
      setData(d);
      setTitle(d.title || "");
      setSlug(d.slug || "");
      setSearchDescription(d.searchDescription || "");
      setBodyHtml(d.bodyHtml || "");
      setCoverImageId(d.coverImageId ?? null);
      setCoverUrl(d.coverUrl || "");
    } catch {
      notify("error", "تعذر تحميل بيانات المقال. يرجى الرجوع والمحاولة مرة أخرى.");
    }
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
    if (!title.trim()) {
      notify("error", "عنوان المقال مطلوب قبل الحفظ.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await updateAdminArticle(id, {
        title: title.trim(),
        slug,
        searchDescription,
        bodyHtml,
        coverImageId,
      });
      if (!res.ok) {
        notify("error", "تعذر حفظ المقال. يرجى المحاولة مرة أخرى.");
        return;
      }
      await load();
      notify("success", "تم حفظ المقال بنجاح.");
    } catch {
      notify("error", "تعذر حفظ المقال. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }, [bodyHtml, coverImageId, id, load, searchDescription, slug, title]);

  function discardChanges() {
    if (!data) return;
    setTitle(data.title || "");
    setSlug(data.slug || "");
    setSearchDescription(data.searchDescription || "");
    setBodyHtml(data.bodyHtml || "");
    setCoverImageId(data.coverImageId ?? null);
    setCoverUrl(data.coverUrl || "");
    setNotice(null);
  }

  if (!id) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="text-gray-700">معرّف المقال غير صحيح.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center" role="status">
        <div className="text-gray-600">جارٍ تحميل بيانات المقال...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">تحرير مقال</h1>
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
          <button
            type="button"
            disabled={busy || saving}
            aria-label={data.live ? "إلغاء نشر المقال" : "نشر المقال"}
            onClick={async () => {
              setBusy(true);
              setNotice(null);
              try {
                const res = data.live ? await unpublishAdminArticle(id) : await publishAdminArticle(id);
                if (!res.ok) {
                  notify("error", "تعذر تغيير حالة النشر. يرجى المحاولة مرة أخرى.");
                  return;
                }
                await load();
                notify("success", data.live ? "تم إلغاء النشر." : "تم نشر المقال.");
              } catch {
                notify("error", "تعذر تغيير حالة النشر. يرجى المحاولة مرة أخرى.");
              } finally {
                setBusy(false);
              }
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50 ${
              data.live
                ? "bg-white border border-gray-200 text-gray-800 hover:shadow-sm"
                : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-sm"
            }`}
          >
            {busy ? "جارٍ التنفيذ..." : data.live ? "إلغاء النشر" : "نشر"}
          </button>
          <button
            type="button"
            onClick={discardChanges}
            disabled={!hasChanges || saving || busy}
            aria-label="إلغاء التعديلات والعودة للبيانات المحفوظة"
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges || saving || busy || !title.trim()}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
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

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="grid gap-4">
              <div>
                <label htmlFor="article-title" className="block text-sm font-semibold text-gray-700 mb-2">العنوان *</label>
                <input
                  id="article-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">وصف مختصر</label>
                <textarea
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green min-h-[110px]"
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
            <div className="text-lg font-bold text-gray-900 mb-4">معاينة موجزة</div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="font-bold text-gray-900">{title.trim() || "بدون عنوان"}</div>
              <div className="text-xs text-gray-600 mt-1" dir="ltr">/{slug || "—"}</div>
              <p className="text-sm text-gray-700 mt-3">{searchDescription.trim() || "لا يوجد وصف مختصر."}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">معاينة سريعة لما يظهر في قائمة المقالات ونتائج البحث.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">صورة الغلاف</div>
            {coverUrl ? (
              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 mb-4">
                <img loading="lazy" decoding="async" src={coverUrl} alt={title || "cover"} className="w-full h-56 object-cover" />
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
                    setNotice(null);
                    try {
                      const res = await uploadAdminImage(file, title || file.name);
                      if (res.ok && res.id) {
                        setCoverImageId(res.id);
                        setCoverUrl(res.url || "");
                        notify("success", "تم رفع الصورة. اضغط «حفظ» لتثبيتها.");
                      } else {
                        notify("error", "تعذر رفع الصورة. تأكد من النوع (JPG/PNG/WebP) والحجم (حتى 5 ميغابايت).");
                      }
                    } catch {
                      notify("error", "تعذر رفع الصورة. يرجى المحاولة مرة أخرى.");
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
            <p className="text-xs text-gray-500 mt-3">الصور المقبولة: JPG / PNG / WebP، وبحد أقصى 5 ميغابايت.</p>
          </div>

          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-red-900 mb-2">حذف المقال</div>
            <p className="text-red-800 mb-4">سيتم حذف المقال نهائياً.</p>
            <button
              type="button"
              disabled={busy}
              aria-label={`حذف المقال ${data.title}`}
              onClick={async () => {
                if (!window.confirm(`سيتم حذف «${data.title}» نهائياً. هل أنت متأكد؟`)) return;
                setBusy(true);
                try {
                  const res = await deleteAdminArticle(id);
                  if (res.ok) {
                    navigate("/control/blogs", { replace: true });
                  } else {
                    notify("error", "تعذر حذف المقال. يرجى المحاولة مرة أخرى.");
                  }
                } catch {
                  notify("error", "تعذر حذف المقال. يرجى المحاولة مرة أخرى.");
                } finally {
                  setBusy(false);
                }
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50"
            >
              {busy ? "جارٍ الحذف..." : "حذف"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
