import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminCompanySettings,
  updateAdminCompanySettings,
  uploadAdminImage,
  type AdminCompanySettingsPayload,
} from "@/react-app/api/site";

const INPUT =
  "w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green";

export default function ControlCompanySettings() {
  const [data, setData] = useState<AdminCompanySettingsPayload | null>(null);
  const [saved, setSaved] = useState<AdminCompanySettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const payload = await fetchAdminCompanySettings();
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
      const res = await updateAdminCompanySettings(data);
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

  async function onUploadLogo(file: File) {
    if (!data) return;
    setUploadingLogo(true);
    setStatus("idle");
    try {
      const up = await uploadAdminImage(
        file,
        data.brandTitle || data.name || file.name,
      );
      if (!up.ok || !up.id) {
        setStatus("error");
        return;
      }
      const res = await updateAdminCompanySettings({ logoImageId: up.id });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      await load();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onRemoveLogo() {
    setUploadingLogo(true);
    setStatus("idle");
    try {
      const res = await updateAdminCompanySettings({ logoImageId: null });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      await load();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (loading) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ تحميل إعدادات الشركة…
      </p>
    );
  }
  if (loadError || !data) {
    return (
      <div role="alert" className="bg-white border border-red-200 rounded-2xl p-6">
        <p className="font-bold text-red-700">تعذر تحميل إعدادات الشركة.</p>
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
          <h1 className="text-2xl font-bold text-white">إعدادات الشركة</h1>
          <p className="text-slate-300 mt-1">
            الاسم، التواصل، الروابط، والتصنيف. لا تُحفظ التعديلات إلا بعد الضغط
            على حفظ.
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
          تم حفظ إعدادات الشركة بنجاح.
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
          aria-labelledby="company-identity-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 id="company-identity-title" className="text-lg font-bold text-gray-900">
              الهوية والشعار
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              الاسم والشعار والنصوص التي تمثل الشركة في جوانب الموقع المختلفة.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              الشعار
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-28 h-28 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                {data.logoUrl ? (
                  <img loading="lazy" decoding="async" src={data.logoUrl} alt="شعار الشركة" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-gray-500 text-sm">لا يوجد</div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition cursor-pointer">
                  {uploadingLogo ? "جارٍ الرفع..." : "رفع شعار"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUploadLogo(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={uploadingLogo || !data.logoImageId}
                  onClick={() => void onRemoveLogo()}
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                >
                  إزالة
                </button>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="company-name" className="block text-sm font-semibold text-gray-700 mb-2">
              اسم الشركة
            </label>
            <input
              id="company-name"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-brand-title" className="block text-sm font-semibold text-gray-700 mb-2">
                عنوان البراند
              </label>
              <input
                id="company-brand-title"
                value={data.brandTitle}
                onChange={(e) => setData({ ...data, brandTitle: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="company-brand-subtitle" className="block text-sm font-semibold text-gray-700 mb-2">
                عنوان فرعي
              </label>
              <input
                id="company-brand-subtitle"
                value={data.brandSubtitle}
                onChange={(e) => setData({ ...data, brandSubtitle: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label htmlFor="company-slogan" className="block text-sm font-semibold text-gray-700 mb-2">
              الشعار النصي
            </label>
            <input
              id="company-slogan"
              value={data.slogan}
              onChange={(e) => setData({ ...data, slogan: e.target.value })}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="company-description" className="block text-sm font-semibold text-gray-700 mb-2">
              وصف مختصر
            </label>
            <textarea
              id="company-description"
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              className={`${INPUT} min-h-28`}
            />
          </div>
        </section>

        <section
          aria-labelledby="company-contact-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 id="company-contact-title" className="text-lg font-bold text-gray-900">
              التواصل والترخيص
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              وسائل التواصل والعنوان ومعلومات التسجيل التي تظهر للزوار.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-phone1" className="block text-sm font-semibold text-gray-700 mb-2">
                الهاتف 1
              </label>
              <input
                id="company-phone1"
                value={data.phone1}
                onChange={(e) => setData({ ...data, phone1: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="company-phone2" className="block text-sm font-semibold text-gray-700 mb-2">
                الهاتف 2
              </label>
              <input
                id="company-phone2"
                value={data.phone2}
                onChange={(e) => setData({ ...data, phone2: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label htmlFor="company-email" className="block text-sm font-semibold text-gray-700 mb-2">
              البريد الإلكتروني
            </label>
            <input
              id="company-email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              className={INPUT}
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="company-address" className="block text-sm font-semibold text-gray-700 mb-2">
              العنوان
            </label>
            <input
              id="company-address"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-classification" className="block text-sm font-semibold text-gray-700 mb-2">
                التصنيف
              </label>
              <input
                id="company-classification"
                value={data.classification}
                onChange={(e) => setData({ ...data, classification: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="company-registration" className="block text-sm font-semibold text-gray-700 mb-2">
                حالة التسجيل
              </label>
              <input
                id="company-registration"
                value={data.registrationStatus}
                onChange={(e) => setData({ ...data, registrationStatus: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label htmlFor="company-chamber" className="block text-sm font-semibold text-gray-700 mb-2">
              عضوية الغرفة
            </label>
            <input
              id="company-chamber"
              value={data.chamberMembership}
              onChange={(e) => setData({ ...data, chamberMembership: e.target.value })}
              className={INPUT}
            />
          </div>
        </section>

        <section
          aria-labelledby="company-social-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-2"
        >
          <div>
            <h2 id="company-social-title" className="text-lg font-bold text-gray-900">
              روابط التواصل الاجتماعي
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              روابط الحسابات الرسمية التي تظهر في الموقع. اترك الحقل فارغاً لإخفاء الرابط.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="company-facebook" className="block text-sm font-semibold text-gray-700 mb-2">
                Facebook
              </label>
              <input
                id="company-facebook"
                value={data.facebookUrl}
                onChange={(e) => setData({ ...data, facebookUrl: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="company-instagram" className="block text-sm font-semibold text-gray-700 mb-2">
                Instagram
              </label>
              <input
                id="company-instagram"
                value={data.instagramUrl}
                onChange={(e) => setData({ ...data, instagramUrl: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="company-linkedin" className="block text-sm font-semibold text-gray-700 mb-2">
                LinkedIn
              </label>
              <input
                id="company-linkedin"
                value={data.linkedinUrl}
                onChange={(e) => setData({ ...data, linkedinUrl: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
