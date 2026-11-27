import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  deleteAdminPage,
  fetchAdminPageDetail,
  publishAdminPage,
  unpublishAdminPage,
  updateAdminPage,
  uploadAdminImage,
  type AdminPageDetail,
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

export default function ControlPageEdit() {
  const params = useParams();
  const navigate = useNavigate();
  const id = Number(params.id || 0);

  const [data, setData] = useState<AdminPageDetail | null>(null);
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

  const [certIssuer, setCertIssuer] = useState("");
  const [certId, setCertId] = useState("");
  const [certYear, setCertYear] = useState<number | null>(null);

  const [toAddress, setToAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [replyAddress, setReplyAddress] = useState("");

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  const hasCover = useMemo(() => typeof data?.coverImageId !== "undefined", [data?.coverImageId]);
  const isCertification = useMemo(() => typeof data?.issuedYear !== "undefined" || typeof data?.issuer !== "undefined", [data?.issuedYear, data?.issuer]);
  const isForm = useMemo(() => typeof data?.toAddress !== "undefined" || typeof data?.subject !== "undefined", [data?.toAddress, data?.subject]);

  const load = useCallback(async () => {
    try {
      const d = await fetchAdminPageDetail(id);
      setData(d);
      setTitle(d.title || "");
      setSlug(d.slug || "");
      setSearchDescription(d.searchDescription || "");
      setBodyHtml(d.bodyHtml || "");
      setCoverImageId((d.coverImageId ?? null) as number | null);
      setCoverUrl(d.coverUrl || "");
      setCertIssuer(d.issuer || "");
      setCertId(d.certificateId || "");
      setCertYear(typeof d.issuedYear === "number" ? d.issuedYear : null);
      setToAddress(d.toAddress || "");
      setSubject(d.subject || "");
      setReplyAddress(d.replyAddress || "");
    } catch {
      notify("error", "تعذر تحميل بيانات الصفحة. يرجى الرجوع والمحاولة مرة أخرى.");
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    load().catch(() => {});
  }, [id, load]);

  const hasChanges = useMemo(() => {
    if (!data) return false;
    if (title !== data.title) return true;
    if (slug !== data.slug) return true;
    if (searchDescription !== data.searchDescription) return true;
    if (bodyHtml !== data.bodyHtml) return true;
    if ((coverImageId ?? null) !== ((data.coverImageId ?? null) as number | null)) return true;
    if (isCertification) {
      if (certIssuer !== (data.issuer || "")) return true;
      if (certId !== (data.certificateId || "")) return true;
      const dy = typeof data.issuedYear === "number" ? data.issuedYear : null;
      if ((certYear ?? null) !== dy) return true;
    }
    if (isForm) {
      if (toAddress !== (data.toAddress || "")) return true;
      if (subject !== (data.subject || "")) return true;
      if (replyAddress !== (data.replyAddress || "")) return true;
    }
    return false;
  }, [bodyHtml, certId, certIssuer, certYear, coverImageId, data, isCertification, isForm, replyAddress, searchDescription, slug, subject, title, toAddress]);

  const onSave = useCallback(async () => {
    if (!id) return;
    if (!title.trim()) {
      notify("error", "العنوان مطلوب قبل الحفظ.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const payload: Partial<AdminPageDetail> = {
        title: title.trim(),
        slug,
        searchDescription,
        bodyHtml,
      };
      if (hasCover) {
        payload.coverImageId = coverImageId;
      }
      if (isCertification) {
        payload.issuer = certIssuer;
        payload.certificateId = certId;
        payload.issuedYear = certYear;
      }
      if (isForm) {
        payload.toAddress = toAddress;
        payload.subject = subject;
        payload.replyAddress = replyAddress;
      }
      const res = await updateAdminPage(id, payload);
      if (!res.ok) {
        notify("error", "تعذر حفظ الصفحة. يرجى المحاولة مرة أخرى.");
        return;
      }
      await load();
      notify("success", "تم حفظ الصفحة بنجاح.");
    } catch {
      notify("error", "تعذر حفظ الصفحة. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }, [bodyHtml, certId, certIssuer, certYear, coverImageId, hasCover, id, isCertification, isForm, load, replyAddress, searchDescription, slug, subject, title, toAddress]);

  function discardChanges() {
    if (!data) return;
    setTitle(data.title || "");
    setSlug(data.slug || "");
    setSearchDescription(data.searchDescription || "");
    setBodyHtml(data.bodyHtml || "");
    setCoverImageId((data.coverImageId ?? null) as number | null);
    setCoverUrl(data.coverUrl || "");
    setCertIssuer(data.issuer || "");
    setCertId(data.certificateId || "");
    setCertYear(typeof data.issuedYear === "number" ? data.issuedYear : null);
    setToAddress(data.toAddress || "");
    setSubject(data.subject || "");
    setReplyAddress(data.replyAddress || "");
    setNotice(null);
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
        <div className="text-gray-600">جارٍ تحميل بيانات الصفحة...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{data.title}</h1>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-800">
              {data.typeName}
            </span>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                data.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              {data.live ? "منشور" : "مسودة"}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
            <Link to="/control/pages" className="text-sq-green font-semibold hover:underline">
              الصفحات
            </Link>
            <span className="text-gray-300">/</span>
            <span dir="ltr" className="truncate">
              {data.slug}
            </span>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {data.url ? (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition"
            >
              فتح
            </a>
          ) : null}
          <button
            type="button"
            disabled={busy || saving}
            aria-label={data.live ? "إلغاء نشر الصفحة" : "نشر الصفحة"}
            onClick={async () => {
              setBusy(true);
              setNotice(null);
              try {
                const res = data.live ? await unpublishAdminPage(id) : await publishAdminPage(id);
                if (!res.ok) {
                  notify("error", "تعذر تغيير حالة النشر. يرجى المحاولة مرة أخرى.");
                  return;
                }
                await load();
                notify("success", data.live ? "تم إلغاء النشر." : "تم نشر الصفحة.");
              } catch {
                notify("error", "تعذر تغيير حالة النشر. يرجى المحاولة مرة أخرى.");
              } finally {
                setBusy(false);
              }
            }}
            className={`px-5 py-3 rounded-lg font-bold transition disabled:opacity-50 ${
              data.live ? "bg-white border border-gray-200 text-gray-800 hover:shadow-sm" : "bg-emerald-600 text-white hover:shadow-lg"
            }`}
          >
            {busy ? "جارٍ التنفيذ..." : data.live ? "إلغاء النشر" : "نشر"}
          </button>
          <button
            type="button"
            onClick={discardChanges}
            disabled={!hasChanges || saving || busy}
            aria-label="إلغاء التعديلات والعودة للبيانات المحفوظة"
            className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || busy || !hasChanges || !title.trim()}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
                <label htmlFor="page-title" className="block text-sm font-semibold text-gray-700 mb-2">العنوان *</label>
                <input
                  id="page-title"
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

          {isCertification ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="text-lg font-bold text-gray-900 mb-4">تفاصيل الاعتماد</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الجهة المانحة</label>
                  <input
                    value={certIssuer}
                    onChange={(e) => setCertIssuer(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">رقم/معرّف</label>
                  <input
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">سنة الإصدار</label>
                  <input
                    value={certYear ?? ""}
                    onChange={(e) => setCertYear(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {isForm ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="text-lg font-bold text-gray-900 mb-4">إعدادات النموذج</div>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">إرسال إلى</label>
                  <input
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الموضوع</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Reply-To</label>
                  <input
                    value={replyAddress}
                    onChange={(e) => setReplyAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">معاينة موجزة</div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="font-bold text-gray-900">{title.trim() || "بدون عنوان"}</div>
              <div className="text-xs text-gray-600 mt-1" dir="ltr">/{slug || "—"}</div>
              <p className="text-sm text-gray-700 mt-3">{searchDescription.trim() || "لا يوجد وصف مختصر."}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">معاينة سريعة لما يظهر في القوائم ونتائج البحث.</p>
          </div>

          {hasCover ? (
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
          ) : null}

          <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-red-900 mb-2">حذف الصفحة</div>
            <p className="text-red-800 mb-4">سيتم حذف الصفحة نهائياً وقد تُحذف صفحات فرعية.</p>
            <button
              type="button"
              disabled={busy}
              aria-label={`حذف الصفحة ${data.title}`}
              onClick={async () => {
                if (!window.confirm(`سيتم حذف «${data.title}» نهائياً. هل أنت متأكد؟`)) return;
                setBusy(true);
                try {
                  const res = await deleteAdminPage(id);
                  if (res.ok) {
                    navigate("/control/pages", { replace: true });
                  } else {
                    notify("error", "تعذر حذف الصفحة. يرجى المحاولة مرة أخرى.");
                  }
                } catch {
                  notify("error", "تعذر حذف الصفحة. يرجى المحاولة مرة أخرى.");
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

