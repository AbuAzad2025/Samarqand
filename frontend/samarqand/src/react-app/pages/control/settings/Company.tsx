import { useEffect, useState } from "react";

import {
  fetchAdminCompanySettings,
  updateAdminCompanySettings,
  uploadAdminImage,
  type AdminCompanySettingsPayload,
} from "@/react-app/api/site";

export default function ControlCompanySettings() {
  const [data, setData] = useState<AdminCompanySettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetchAdminCompanySettings().then(setData).catch(() => {});
  }, []);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminCompanySettings(data);
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  if (!data) {
    return null;
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات الشركة</h1>
          <p className="text-gray-600 mt-1">اسم الشركة، التواصل، الروابط، والتصنيف.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>

      {status === "saved" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر الحفظ.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-lg font-bold text-gray-900">الهوية</div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الشعار</label>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-28 h-28 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="شعار الشركة" className="w-full h-full object-contain" />
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingLogo(true);
                      setStatus("idle");
                      try {
                        const up = await uploadAdminImage(file, data.brandTitle || data.name || file.name);
                        if (up.ok && up.id) {
                          const next = {
                            ...data,
                            logoImageId: up.id,
                            logoUrl: up.url || data.logoUrl,
                          };
                          setData(next);
                          const saved = await updateAdminCompanySettings({ logoImageId: up.id });
                          setStatus(saved.ok ? "saved" : "error");
                          if (saved.ok) {
                            const fresh = await fetchAdminCompanySettings();
                            setData(fresh);
                          }
                          setTimeout(() => setStatus("idle"), 1500);
                        }
                      } finally {
                        setUploadingLogo(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={async () => {
                    setUploadingLogo(true);
                    setStatus("idle");
                    try {
                      const saved = await updateAdminCompanySettings({ logoImageId: null });
                      if (saved.ok) {
                        setData({ ...data, logoImageId: null, logoUrl: "" });
                      }
                      setStatus(saved.ok ? "saved" : "error");
                      setTimeout(() => setStatus("idle"), 1500);
                    } catch {
                      setStatus("error");
                      setTimeout(() => setStatus("idle"), 1500);
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                >
                  إزالة
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الشركة</label>
            <input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان البراند</label>
              <input
                value={data.brandTitle}
                onChange={(e) => setData({ ...data, brandTitle: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان فرعي</label>
              <input
                value={data.brandSubtitle}
                onChange={(e) => setData({ ...data, brandSubtitle: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الشعار النصي</label>
            <input
              value={data.slogan}
              onChange={(e) => setData({ ...data, slogan: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">وصف مختصر</label>
            <textarea
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-28"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-lg font-bold text-gray-900">التواصل والترخيص</div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف 1</label>
              <input
                value={data.phone1}
                onChange={(e) => setData({ ...data, phone1: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف 2</label>
              <input
                value={data.phone2}
                onChange={(e) => setData({ ...data, phone2: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
            <input
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
            <input
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">التصنيف</label>
              <input
                value={data.classification}
                onChange={(e) => setData({ ...data, classification: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">حالة التسجيل</label>
              <input
                value={data.registrationStatus}
                onChange={(e) => setData({ ...data, registrationStatus: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">عضوية الغرفة</label>
            <input
              value={data.chamberMembership}
              onChange={(e) => setData({ ...data, chamberMembership: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>

          <div className="pt-2">
            <div className="text-sm font-bold text-gray-900 mb-3">روابط التواصل</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Facebook</label>
                <input
                  value={data.facebookUrl}
                  onChange={(e) => setData({ ...data, facebookUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Instagram</label>
                <input
                  value={data.instagramUrl}
                  onChange={(e) => setData({ ...data, instagramUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">LinkedIn</label>
                <input
                  value={data.linkedinUrl}
                  onChange={(e) => setData({ ...data, linkedinUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
