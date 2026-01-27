import { useEffect, useState } from "react";

import {
  fetchAdminHomeSettings,
  updateAdminHomeSettings,
  uploadAdminImage,
  type AdminHomeSettingsPayload,
} from "@/react-app/api/site";

export default function ControlHomeSettings() {
  const [data, setData] = useState<AdminHomeSettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetchAdminHomeSettings().then(setData).catch(() => {});
  }, []);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminHomeSettings(data);
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات الصفحة الرئيسية</h1>
          <p className="text-gray-600 mt-1">الهيرو، الأزرار، والنشرة.</p>
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
          <div className="text-lg font-bold text-gray-900">الهيرو</div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان 1</label>
              <input
                value={data.heroTitleLine1}
                onChange={(e) => setData({ ...data, heroTitleLine1: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان 2</label>
              <input
                value={data.heroTitleLine2}
                onChange={(e) => setData({ ...data, heroTitleLine2: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">النص التعريفي</label>
            <input
              value={data.heroLead}
              onChange={(e) => setData({ ...data, heroLead: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">زر أساسي (نص)</label>
              <input
                value={data.heroPrimaryCtaLabel}
                onChange={(e) => setData({ ...data, heroPrimaryCtaLabel: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">زر أساسي (رابط)</label>
              <input
                value={data.heroPrimaryCtaUrl}
                onChange={(e) => setData({ ...data, heroPrimaryCtaUrl: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">زر ثانوي (نص)</label>
              <input
                value={data.heroSecondaryCtaLabel}
                onChange={(e) =>
                  setData({ ...data, heroSecondaryCtaLabel: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">زر ثانوي (رابط)</label>
              <input
                value={data.heroSecondaryCtaUrl}
                onChange={(e) =>
                  setData({ ...data, heroSecondaryCtaUrl: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              رقم صورة خلفية الهيرو (اختياري)
            </label>
            <input
              value={data.heroBackgroundImageId ?? ""}
              onChange={(e) =>
                setData({
                  ...data,
                  heroBackgroundImageId: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              dir="ltr"
              placeholder="مثال: 12"
            />
          </div>
          <div className="border border-gray-200 rounded-2xl p-4">
            <div className="font-bold text-gray-900 mb-3">صورة خلفية الهيرو</div>
            {data.heroBackgroundUrl ? (
              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 mb-3">
                <img
                  src={data.heroBackgroundUrl}
                  alt="hero"
                  className="w-full h-48 object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-gray-600 mb-3">
                لا توجد صورة حالياً.
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <label className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition cursor-pointer">
                رفع صورة
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const up = await uploadAdminImage(file, "hero");
                    if (up.ok && up.id) {
                      setData({
                        ...data,
                        heroBackgroundImageId: up.id,
                        heroBackgroundUrl: up.url || "",
                      });
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setData({
                    ...data,
                    heroBackgroundImageId: null,
                    heroBackgroundUrl: "",
                  })
                }
                className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
              >
                إزالة
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-lg font-bold text-gray-900">النشرة</div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان النشرة</label>
            <input
              value={data.newsletterTitle}
              onChange={(e) => setData({ ...data, newsletterTitle: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">وصف النشرة</label>
            <textarea
              value={data.newsletterSubtitle}
              onChange={(e) => setData({ ...data, newsletterSubtitle: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-28"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
