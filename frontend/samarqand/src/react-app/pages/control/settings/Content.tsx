import { useEffect, useState } from "react";

import {
  fetchAdminContentSettings,
  updateAdminContentSettings,
  type SiteContentTexts,
} from "@/react-app/api/site";

export default function ControlContentSettings() {
  const [data, setData] = useState<SiteContentTexts | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchAdminContentSettings().then(setData).catch(() => {});
  }, []);

  if (!data) {
    return <div className="text-center py-16 text-slate-500">جارٍ التحميل…</div>;
  }

  function field(
    label: string,
    key: "values" | "headings" | "projectTypes",
  ) {
    return (
      <label className="block">
        <span className="block text-sm font-bold text-slate-700 mb-2">{label}</span>
        <textarea
          rows={8}
          value={JSON.stringify(data![key], null, 2)}
          onChange={(event) => {
            try {
              const parsed = JSON.parse(event.target.value);
              setData((prev) => (prev ? { ...prev, [key]: parsed } : prev));
            } catch {
              setStatus("JSON غير صالح");
            }
          }}
          dir="ltr"
          className="w-full rounded-xl border border-slate-300 p-3 font-mono text-sm text-slate-800"
        />
      </label>
    );
  }

  async function onSave() {
    setSaving(true);
    setStatus("");
    try {
      const res = await updateAdminContentSettings(data!);
      setStatus(res.ok ? "تم الحفظ" : res.error || "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
        <label className="block">
          <span className="block text-sm font-bold text-slate-700 mb-2">ساعات العمل</span>
          <input
            value={data.workingHours}
            onChange={(event) =>
              setData((prev) =>
                prev ? { ...prev, workingHours: event.target.value } : prev,
              )
            }
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800"
          />
        </label>
        {field("قيم الشركة (JSON)", "values")}
        {field("عناوين الأقسام (JSON)", "headings")}
        {field("أنواع المشاريع (JSON)", "projectTypes")}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-6 py-3 font-bold text-white disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      </div>
    </div>
  );
}
