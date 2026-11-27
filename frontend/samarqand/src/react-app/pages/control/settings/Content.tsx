import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminContentSettings,
  updateAdminContentSettings,
  type SiteContentTexts,
} from "@/react-app/api/site";

type JsonKey = "values" | "headings" | "projectTypes";

const JSON_FIELDS: {
  key: JsonKey;
  title: string;
  description: string;
}[] = [
  {
    key: "values",
    title: "قيم الشركة",
    description: "قيم النصوص العامة المستخدمة في صفحات الموقع (مصفوفة JSON).",
  },
  {
    key: "headings",
    title: "عناوين الأقسام",
    description: "عناوين الأقسام وعناوينها الفرعية (كائن JSON).",
  },
  {
    key: "projectTypes",
    title: "أنواع المشاريع",
    description: "أنواع المشاريع المعروضة للزوار (مصفوفة JSON).",
  },
];

const noErrors: Record<JsonKey, boolean> = {
  values: false,
  headings: false,
  projectTypes: false,
};

export default function ControlContentSettings() {
  const [data, setData] = useState<SiteContentTexts | null>(null);
  const [saved, setSaved] = useState<SiteContentTexts | null>(null);
  const [drafts, setDrafts] = useState<Record<JsonKey, string>>({
    values: "",
    headings: "",
    projectTypes: "",
  });
  const [jsonErrors, setJsonErrors] = useState<Record<JsonKey, boolean>>(noErrors);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const payload = await fetchAdminContentSettings();
      setData(payload);
      setSaved(payload);
      setDrafts({
        values: JSON.stringify(payload.values, null, 2),
        headings: JSON.stringify(payload.headings, null, 2),
        projectTypes: JSON.stringify(payload.projectTypes, null, 2),
      });
      setJsonErrors(noErrors);
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

  const hasJsonError = Object.values(jsonErrors).some(Boolean);
  const dirty =
    (!!data && !!saved && JSON.stringify(data) !== JSON.stringify(saved)) ||
    (!!saved &&
      JSON_FIELDS.some(
        (field) => drafts[field.key] !== JSON.stringify(saved[field.key], null, 2),
      ));

  function onJsonChange(key: JsonKey, value: string) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    try {
      const parsed: unknown = JSON.parse(value);
      if (key === "values") {
        setData((prev) => (prev ? { ...prev, values: parsed as string[] } : prev));
      } else if (key === "headings") {
        setData((prev) =>
          prev
            ? { ...prev, headings: parsed as SiteContentTexts["headings"] }
            : prev,
        );
      } else {
        setData((prev) =>
          prev ? { ...prev, projectTypes: parsed as string[] } : prev,
        );
      }
      setJsonErrors((prev) => ({ ...prev, [key]: false }));
    } catch {
      setJsonErrors((prev) => ({ ...prev, [key]: true }));
    }
  }

  async function onSave() {
    if (!data || saving || hasJsonError) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminContentSettings(data);
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
    if (saved) {
      setData(saved);
      setDrafts({
        values: JSON.stringify(saved.values, null, 2),
        headings: JSON.stringify(saved.headings, null, 2),
        projectTypes: JSON.stringify(saved.projectTypes, null, 2),
      });
    }
    setJsonErrors(noErrors);
    setStatus("idle");
  }

  if (loading) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ تحميل نصوص الواجهة…
      </p>
    );
  }
  if (loadError || !data) {
    return (
      <div role="alert" className="bg-white border border-slate-200 rounded-2xl p-6">
        <p className="font-bold text-red-700">تعذر تحميل نصوص الواجهة.</p>
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
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">نصوص الواجهة</h1>
          <p className="text-sm text-slate-300 mt-1">
            عدّل النصوص التي تظهر للزوار في صفحات الموقع. لا تُحفظ التعديلات إلا بعد الضغط على حفظ.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || !dirty}
            className="rounded-xl bg-white border border-slate-300 text-slate-800 px-5 py-3 font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving || hasJsonError}
            aria-busy={saving}
            className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-6 py-3 font-bold text-white hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {status === "saved" && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800"
        >
          تم حفظ نصوص الواجهة بنجاح.
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700"
        >
          تعذر الحفظ. لم يتم حفظ التعديلات، حاول مرة أخرى.
        </div>
      )}
      {hasJsonError && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-sm"
        >
          يوجد JSON غير صالح. صحّح الحقول المحددة قبل الحفظ.
        </div>
      )}

      <section
        aria-labelledby="content-hours-title"
        className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5"
      >
        <div>
          <h2 id="content-hours-title" className="text-lg font-bold text-slate-900">
            ساعات العمل
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            النص الذي يعرض أوقات العمل للزوار.
          </p>
        </div>
        <label className="block">
          <span className="block text-sm font-bold text-slate-700 mb-2">
            نص ساعات العمل
          </span>
          <input
            value={data.workingHours}
            onChange={(event) =>
              setData((prev) =>
                prev ? { ...prev, workingHours: event.target.value } : prev,
              )
            }
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sq-green"
          />
        </label>
      </section>

      {JSON_FIELDS.map((field) => (
        <section
          key={field.key}
          aria-labelledby={`content-${field.key}-title`}
          className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4"
        >
          <div>
            <h2 id={`content-${field.key}-title`} className="text-lg font-bold text-slate-900">
              {field.title}
            </h2>
            <p className="text-sm text-slate-600 mt-1">{field.description}</p>
          </div>
          <label className="block">
            <span className="block text-sm font-bold text-slate-700 mb-2">
              {field.title} (JSON)
            </span>
            <textarea
              rows={8}
              value={drafts[field.key]}
              onChange={(event) => onJsonChange(field.key, event.target.value)}
              dir="ltr"
              aria-invalid={jsonErrors[field.key] || undefined}
              className={`w-full rounded-xl border p-3 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sq-green ${
                jsonErrors[field.key]
                  ? "border-red-400 bg-red-50"
                  : "border-slate-300"
              }`}
            />
            {jsonErrors[field.key] && (
              <span role="alert" className="block text-xs text-red-600 mt-1">
                JSON غير صالح في هذا الحقل.
              </span>
            )}
          </label>
        </section>
      ))}
    </div>
  );
}
