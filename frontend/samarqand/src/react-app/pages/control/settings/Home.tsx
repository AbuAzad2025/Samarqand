import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminHomeSettings,
  updateAdminHomeSettings,
  uploadAdminImage,
  type AdminHomeSettingsPayload,
} from "@/react-app/api/site";

const INPUT =
  "w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green";

export default function ControlHomeSettings() {
  const [data, setData] = useState<AdminHomeSettingsPayload | null>(null);
  const [saved, setSaved] = useState<AdminHomeSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const payload = await fetchAdminHomeSettings();
      setData(payload);
      setSaved(payload);
    } catch {
      setData(null);
      setSaved(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !!data && !!saved && JSON.stringify(data) !== JSON.stringify(saved);

  async function onSave() {
    if (!data || saving) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminHomeSettings(data);
      if (res.ok) {
        setSaved(data);
        setStatus("saved");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (saved) setData(saved);
    setStatus("idle");
  }

  async function onUploadHeroImage(file: File) {
    if (!data) return;
    setUploading(true);
    try {
      const up = await uploadAdminImage(file, "hero");
      if (up.ok && up.id) {
        setData({
          ...data,
          heroBackgroundImageId: up.id,
          heroBackgroundUrl: up.url || "",
        });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ تحميل إعدادات الصفحة الرئيسية…
      </p>
    );
  }
  if (loadError || !data) {
    return (
      <div role="alert" className="bg-white border border-red-200 rounded-2xl p-6">
        <p className="font-bold text-red-700">تعذر تحميل إعدادات الصفحة الرئيسية.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 bg-white border border-gray-200 text-gray-900 px-5 py-2 rounded-lg font-bold"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">إعدادات الصفحة الرئيسية</h1>
          <p className="text-slate-300 mt-1">
            الهيرو، الأزرار، والنشرة. لا تُحفظ التعديلات إلا بعد الضغط على حفظ.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || !dirty}
            className="bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            aria-busy={saving}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {status === "saved" && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800"
        >
          تم حفظ إعدادات الصفحة الرئيسية بنجاح.
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700"
        >
          تعذر الحفظ. لم يتم حفظ التعديلات، حاول مرة أخرى.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section
          aria-labelledby="home-hero-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 id="home-hero-title" className="text-lg font-bold text-gray-900">
              قسم الهيرو
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              العنوان والنص التعريفي وأزرار القسم الأول في الصفحة الرئيسية.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="hero-line1" className="block text-sm font-semibold text-gray-700 mb-2">
                عنوان 1
              </label>
              <input
                id="hero-line1"
                value={data.heroTitleLine1}
                onChange={(e) => setData({ ...data, heroTitleLine1: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="hero-line2" className="block text-sm font-semibold text-gray-700 mb-2">
                عنوان 2
              </label>
              <input
                id="hero-line2"
                value={data.heroTitleLine2}
                onChange={(e) => setData({ ...data, heroTitleLine2: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label htmlFor="hero-lead" className="block text-sm font-semibold text-gray-700 mb-2">
              النص التعريفي
            </label>
            <input
              id="hero-lead"
              value={data.heroLead}
              onChange={(e) => setData({ ...data, heroLead: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="hero-primary-label" className="block text-sm font-semibold text-gray-700 mb-2">
                زر أساسي (النص)
              </label>
              <input
                id="hero-primary-label"
                value={data.heroPrimaryCtaLabel}
                onChange={(e) => setData({ ...data, heroPrimaryCtaLabel: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="hero-primary-url" className="block text-sm font-semibold text-gray-700 mb-2">
                زر أساسي (الرابط)
              </label>
              <input
                id="hero-primary-url"
                value={data.heroPrimaryCtaUrl}
                onChange={(e) => setData({ ...data, heroPrimaryCtaUrl: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="hero-secondary-label" className="block text-sm font-semibold text-gray-700 mb-2">
                زر ثانوي (النص)
              </label>
              <input
                id="hero-secondary-label"
                value={data.heroSecondaryCtaLabel}
                onChange={(e) => setData({ ...data, heroSecondaryCtaLabel: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="hero-secondary-url" className="block text-sm font-semibold text-gray-700 mb-2">
                زر ثانوي (الرابط)
              </label>
              <input
                id="hero-secondary-url"
                value={data.heroSecondaryCtaUrl}
                onChange={(e) => setData({ ...data, heroSecondaryCtaUrl: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hero-bg-id" className="block text-sm font-semibold text-gray-700 mb-2">
              رقم صورة خلفية الهيرو (اختياري)
            </label>
            <input
              id="hero-bg-id"
              value={data.heroBackgroundImageId ?? ""}
              onChange={(e) =>
                setData({
                  ...data,
                  heroBackgroundImageId: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              className={INPUT}
              dir="ltr"
              placeholder="مثال: 12"
            />
          </div>

          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="font-bold text-gray-900 mb-3">صورة خلفية الهيرو</div>
            {data.heroBackgroundUrl ? (
              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 mb-3">
                <img loading="lazy" decoding="async" src={data.heroBackgroundUrl} alt="صورة خلفية الهيرو" className="w-full h-48 object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-gray-600 mb-3">
                لا توجد صورة حالياً.
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <label className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition cursor-pointer">
                {uploading ? "جارٍ الرفع..." : "رفع صورة"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUploadHeroImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                disabled={uploading}
                onClick={() =>
                  setData({
                    ...data,
                    heroBackgroundImageId: null,
                    heroBackgroundUrl: "",
                  })
                }
                className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
              >
                إزالة
              </button>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-newsletter-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 id="home-newsletter-title" className="text-lg font-bold text-gray-900">
              النشرة البريدية
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              النص الذي يظهر في قسم الاشتراك بالنشرة في نهاية الصفحة.
            </p>
          </div>

          <div>
            <label htmlFor="newsletter-title" className="block text-sm font-semibold text-gray-700 mb-2">
              عنوان النشرة
            </label>
            <input
              id="newsletter-title"
              value={data.newsletterTitle}
              onChange={(e) => setData({ ...data, newsletterTitle: e.target.value })}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="newsletter-subtitle" className="block text-sm font-semibold text-gray-700 mb-2">
              وصف النشرة
            </label>
            <textarea
              id="newsletter-subtitle"
              value={data.newsletterSubtitle}
              onChange={(e) => setData({ ...data, newsletterSubtitle: e.target.value })}
              className={`${INPUT} min-h-28`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
