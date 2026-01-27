import { useEffect, useState } from "react";

import {
  fetchAdminVisibilitySettings,
  updateAdminVisibilitySettings,
  type AdminVisibilitySettingsPayload,
} from "@/react-app/api/site";

export default function ControlVisibilitySettings() {
  const [data, setData] = useState<AdminVisibilitySettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetchAdminVisibilitySettings().then(setData).catch(() => {});
  }, []);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminVisibilitySettings(data);
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  if (!data) return null;
  const d = data;

  function toggle(label: string, key: keyof AdminVisibilitySettingsPayload) {
    const enabled = d[key];
    return (
      <button
        key={key}
        type="button"
        onClick={() =>
          setData((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev))
        }
        className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
      >
        <div className="font-semibold text-gray-900">{label}</div>
        <span
          className={`px-3 py-1 rounded-lg text-sm font-bold ${
            enabled ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
          }`}
        >
          {enabled ? "ظاهر" : "مخفي"}
        </span>
      </button>
    );
  }

  function setMany(keys: (keyof AdminVisibilitySettingsPayload)[], enabled: boolean) {
    setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const k of keys) next[k] = enabled;
      return next;
    });
  }

  const groups: {
    title: string;
    keys: (keyof AdminVisibilitySettingsPayload)[];
    items: { label: string; key: keyof AdminVisibilitySettingsPayload }[];
  }[] = [
    {
      title: "روابط الصفحات والتنقل",
      keys: [
        "showServices",
        "showProjects",
        "showTools",
        "showShowcase",
        "showAbout",
        "showContact",
        "showRfqTemplates",
      ],
      items: [
        { label: "الخدمات", key: "showServices" },
        { label: "المشاريع", key: "showProjects" },
        { label: "الأدوات الذكية", key: "showTools" },
        { label: "معرض الأعمال", key: "showShowcase" },
        { label: "من نحن", key: "showAbout" },
        { label: "اتصل بنا", key: "showContact" },
        { label: "نماذج عروض الأسعار", key: "showRfqTemplates" },
      ],
    },
    {
      title: "محتوى الصفحة الرئيسية",
      keys: [
        "showHomeAIBanner",
        "showHomeTrustBadges",
        "showHomeStats",
        "showServices",
        "showHomeTimeline",
        "showHomeQuickLinks",
        "showRfqTemplates",
        "showProjects",
        "showShowcase",
        "showTeam",
        "showTestimonials",
        "showTools",
        "showNewsletter",
      ],
      items: [
        { label: "بانر الذكاء الاصطناعي", key: "showHomeAIBanner" },
        { label: "ميزات الثقة", key: "showHomeTrustBadges" },
        { label: "الإحصاءات", key: "showHomeStats" },
        { label: "الخدمات (قسم)", key: "showServices" },
        { label: "خطوات العمل", key: "showHomeTimeline" },
        { label: "روابط سريعة", key: "showHomeQuickLinks" },
        { label: "نماذج عروض الأسعار (قسم)", key: "showRfqTemplates" },
        { label: "المشاريع (قسم)", key: "showProjects" },
        { label: "معرض الأعمال (قسم)", key: "showShowcase" },
        { label: "فريق العمل", key: "showTeam" },
        { label: "آراء العملاء", key: "showTestimonials" },
        { label: "ميزات AI التسويقية (قسم)", key: "showTools" },
        { label: "النشرة", key: "showNewsletter" },
      ],
    },
    {
      title: "عناصر ثابتة بالموقع",
      keys: ["showAIChatbot", "showWhatsAppButton", "showFloatingCTA", "showFooter"],
      items: [
        { label: "مساعد الدردشة AI", key: "showAIChatbot" },
        { label: "زر واتساب", key: "showWhatsAppButton" },
        { label: "نداء عائم (استشارة مجانية)", key: "showFloatingCTA" },
        { label: "الفوتر", key: "showFooter" },
      ],
    },
  ];

  const allKeys = Array.from(new Set(groups.flatMap((g) => g.keys)));

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إظهار/إخفاء الأقسام</h1>
          <p className="text-gray-600 mt-1">
            تحكم بما يظهر للزوار في التنقل والصفحات.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setMany(allKeys, true)}
            disabled={saving}
            className="bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إظهار الكل
          </button>
          <button
            type="button"
            onClick={() => setMany(allKeys, false)}
            disabled={saving}
            className="bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إخفاء الكل
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
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
        {groups.map((g) => (
          <div key={g.title} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="text-lg font-bold text-gray-900">{g.title}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMany(g.keys, true)}
                  className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:shadow-sm transition"
                >
                  إظهار
                </button>
                <button
                  type="button"
                  onClick={() => setMany(g.keys, false)}
                  className="px-3 py-2 rounded-lg bg-gray-50 text-gray-900 border border-gray-200 font-bold hover:shadow-sm transition"
                >
                  إخفاء
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {g.items.map((it) => toggle(it.label, it.key))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
