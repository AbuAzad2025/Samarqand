import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminVisibilitySettings,
  updateAdminVisibilitySettings,
  type AdminVisibilitySettingsPayload,
} from "@/react-app/api/site";

type Group = {
  title: string;
  description: string;
  keys: (keyof AdminVisibilitySettingsPayload)[];
  items: { label: string; key: keyof AdminVisibilitySettingsPayload }[];
};

const GROUPS: Group[] = [
  {
    title: "لوحة التحكم",
    description: "إظهار أو إخفاء أدوات إدارية داخل لوحة التحكم.",
    keys: ["showControlProjectsManagement"],
    items: [
      {
        label: "إدارة المشاريع داخل لوحة التحكم",
        key: "showControlProjectsManagement",
      },
    ],
  },
  {
    title: "روابط الصفحات والتنقل",
    description: "الصفحات التي تظهر في قائمة تنقل الزوار.",
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
    description: "الأقسام التي تظهر للزوار في الصفحة الرئيسية.",
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
    description: "عناصر تظهر في جميع صفحات الموقع.",
    keys: ["showAIChatbot", "showWhatsAppButton", "showFloatingCTA", "showFooter"],
    items: [
      { label: "مساعد الدردشة AI", key: "showAIChatbot" },
      { label: "زر واتساب", key: "showWhatsAppButton" },
      { label: "نداء عائم (تواصل معنا)", key: "showFloatingCTA" },
      { label: "الفوتر", key: "showFooter" },
    ],
  },
];

const ALL_KEYS = Array.from(new Set(GROUPS.flatMap((g) => g.keys)));

export default function ControlVisibilitySettings() {
  const [data, setData] = useState<AdminVisibilitySettingsPayload | null>(null);
  const [saved, setSaved] = useState<AdminVisibilitySettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const payload = await fetchAdminVisibilitySettings();
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
      const res = await updateAdminVisibilitySettings(data);
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

  function toggle(label: string, key: keyof AdminVisibilitySettingsPayload) {
    if (!data) return null;
    const enabled = Boolean(data[key]);
    return (
      <button
        key={key}
        type="button"
        aria-pressed={enabled}
        onClick={() =>
          setData((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev))
        }
        className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
      >
        <span className="font-semibold text-gray-900">{label}</span>
        <span
          className={`px-3 py-1 rounded-lg text-sm font-bold shrink-0 ${
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

  if (loading) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ تحميل إعدادات الإظهار…
      </p>
    );
  }
  if (loadError || !data) {
    return (
      <div role="alert" className="bg-white border border-red-200 rounded-2xl p-6">
        <p className="font-bold text-red-700">تعذر تحميل إعدادات الإظهار.</p>
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
          <h1 className="text-2xl font-bold text-white">إظهار/إخفاء الأقسام</h1>
          <p className="text-slate-300 mt-1">
            تحكم بما يظهر للزوار في التنقل والصفحات. لا تُحفظ التعديلات إلا بعد الضغط على حفظ.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setMany(ALL_KEYS, true)}
            disabled={saving}
            className="bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إظهار الكل
          </button>
          <button
            type="button"
            onClick={() => setMany(ALL_KEYS, false)}
            disabled={saving}
            className="bg-white border border-gray-200 text-gray-900 px-5 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إخفاء الكل
          </button>
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
          تم حفظ إعدادات الإظهار بنجاح.
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
        {GROUPS.map((g, index) => (
          <section
            key={g.title}
            aria-labelledby={`visibility-group-${index}`}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="mb-4">
              <h2 id={`visibility-group-${index}`} className="text-lg font-bold text-gray-900">
                {g.title}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{g.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <button
                type="button"
                onClick={() => setMany(g.keys, true)}
                className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:shadow-sm transition"
              >
                إظهار المجموعة
              </button>
              <button
                type="button"
                onClick={() => setMany(g.keys, false)}
                className="px-3 py-2 rounded-lg bg-gray-50 text-gray-900 border border-gray-200 font-bold hover:shadow-sm transition"
              >
                إخفاء المجموعة
              </button>
            </div>
            <div className="grid gap-3">
              {g.items.map((it) => toggle(it.label, it.key))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
