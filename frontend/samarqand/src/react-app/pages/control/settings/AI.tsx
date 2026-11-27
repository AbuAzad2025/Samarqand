import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminAISettings,
  updateAdminAISettings,
  type AdminAISettingsPayload,
} from "@/react-app/api/site";

const INPUT =
  "w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green";

export default function ControlAISettings() {
  const [data, setData] = useState<AdminAISettingsPayload | null>(null);
  const [saved, setSaved] = useState<AdminAISettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const payload = await fetchAdminAISettings();
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
      const res = await updateAdminAISettings(data);
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

  if (loading) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ تحميل إعدادات الذكاء الاصطناعي…
      </p>
    );
  }
  if (loadError || !data) {
    return (
      <div role="alert" className="bg-white border border-red-200 rounded-2xl p-6">
        <p className="font-bold text-red-700">تعذر تحميل إعدادات الذكاء الاصطناعي.</p>
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
          <h1 className="text-2xl font-bold text-white">إعدادات الذكاء الاصطناعي</h1>
          <p className="text-slate-300 mt-1">
            التحكم بالتفعيل والنموذج والبرومبتات. لا تُحفظ التعديلات إلا بعد الضغط على حفظ.
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
          تم حفظ إعدادات الذكاء الاصطناعي بنجاح.
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
          aria-labelledby="ai-general-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 id="ai-general-title" className="text-lg font-bold text-gray-900">
              الإعدادات العامة
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              تفعيل النموذج واختياره وضبط حدود الإخراج وسياق الشركة.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div>
              <div className="font-semibold text-gray-900">تفعيل Gemini</div>
              <div className="text-sm text-gray-600">
                تعطيل التفعيل يجبر النظام على ردود احتياطية.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!data.geminiEnabled}
              onClick={() => setData({ ...data, geminiEnabled: !data.geminiEnabled })}
              className={`px-4 py-2 rounded-lg font-bold transition ${
                data.geminiEnabled
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-300 text-gray-800"
              }`}
            >
              {data.geminiEnabled ? "مفعل" : "متوقف"}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ai-model" className="block text-sm font-semibold text-gray-700 mb-2">
                اسم النموذج
              </label>
              <input
                id="ai-model"
                value={data.geminiModel}
                onChange={(e) => setData({ ...data, geminiModel: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="ai-key-env" className="block text-sm font-semibold text-gray-700 mb-2">
                متغير مفتاح API
              </label>
              <input
                id="ai-key-env"
                value={data.geminiApiKeyEnvVar}
                onChange={(e) => setData({ ...data, geminiApiKeyEnvVar: e.target.value })}
                className={INPUT}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ai-temperature" className="block text-sm font-semibold text-gray-700 mb-2">
                درجة الإبداع (Temperature)
              </label>
              <input
                id="ai-temperature"
                value={data.temperature}
                onChange={(e) => setData({ ...data, temperature: Number(e.target.value) })}
                className={INPUT}
                type="number"
                step="0.1"
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="ai-max-tokens" className="block text-sm font-semibold text-gray-700 mb-2">
                أقصى عدد للرموز في الإخراج
              </label>
              <input
                id="ai-max-tokens"
                value={data.maxOutputTokens}
                onChange={(e) => setData({ ...data, maxOutputTokens: Number(e.target.value) })}
                className={INPUT}
                type="number"
                step="1"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ai-context" className="block text-sm font-semibold text-gray-700 mb-2">
              سياق الشركة
            </label>
            <textarea
              id="ai-context"
              value={data.companyContext}
              onChange={(e) => setData({ ...data, companyContext: e.target.value })}
              className={`${INPUT} min-h-40`}
            />
          </div>
        </section>

        <section
          aria-labelledby="ai-prompts-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div>
            <h2 id="ai-prompts-title" className="text-lg font-bold text-gray-900">
              البرومبتات
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              التعليمات التي توجّه الذكاء الاصطناعي في كل أداة من أدوات الموقع.
            </p>
          </div>

          <div>
            <label htmlFor="ai-prompt-design" className="block text-sm font-semibold text-gray-700 mb-2">
              تحليل التصميم
            </label>
            <textarea
              id="ai-prompt-design"
              value={data.designAnalyzerPrompt}
              onChange={(e) => setData({ ...data, designAnalyzerPrompt: e.target.value })}
              className={`${INPUT} min-h-28`}
            />
          </div>

          <div>
            <label htmlFor="ai-prompt-content" className="block text-sm font-semibold text-gray-700 mb-2">
              مولّد المحتوى
            </label>
            <textarea
              id="ai-prompt-content"
              value={data.contentGeneratorPrompt}
              onChange={(e) => setData({ ...data, contentGeneratorPrompt: e.target.value })}
              className={`${INPUT} min-h-28`}
            />
          </div>

          <div>
            <label htmlFor="ai-prompt-chat" className="block text-sm font-semibold text-gray-700 mb-2">
              الشات بوت
            </label>
            <textarea
              id="ai-prompt-chat"
              value={data.chatPrompt}
              onChange={(e) => setData({ ...data, chatPrompt: e.target.value })}
              className={`${INPUT} min-h-28`}
            />
          </div>

          <div>
            <label htmlFor="ai-prompt-visual" className="block text-sm font-semibold text-gray-700 mb-2">
              المصور المعماري
            </label>
            <textarea
              id="ai-prompt-visual"
              value={data.visualizerPrompt}
              onChange={(e) => setData({ ...data, visualizerPrompt: e.target.value })}
              className={`${INPUT} min-h-28`}
            />
          </div>
        </section>
      </div>

      <section
        aria-labelledby="ai-visualizer-title"
        className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mt-6 space-y-4"
      >
        <div>
          <h2 id="ai-visualizer-title" className="text-lg font-bold text-gray-900">
            إعدادات المصور الافتراضي
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            القيم الافتراضية والألوان المستخدمة عند توليد صورة معمارية.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="ai-v-style" className="block text-sm font-semibold text-gray-700 mb-2">
              الستايل الافتراضي
            </label>
            <input
              id="ai-v-style"
              value={data.visualizerDefaultStyle}
              onChange={(e) => setData({ ...data, visualizerDefaultStyle: e.target.value })}
              className={INPUT}
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="ai-v-ratio" className="block text-sm font-semibold text-gray-700 mb-2">
              الأبعاد الافتراضية
            </label>
            <input
              id="ai-v-ratio"
              value={data.visualizerDefaultAspectRatio}
              onChange={(e) => setData({ ...data, visualizerDefaultAspectRatio: e.target.value })}
              className={INPUT}
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="ai-v-footer" className="block text-sm font-semibold text-gray-700 mb-2">
              نص الفوتر
            </label>
            <input
              id="ai-v-footer"
              value={data.visualizerPlaceholderFooterText}
              onChange={(e) => setData({ ...data, visualizerPlaceholderFooterText: e.target.value })}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="ai-v-primary" className="block text-sm font-semibold text-gray-700 mb-2">
              لون أساسي
            </label>
            <input
              id="ai-v-primary"
              value={data.visualizerPlaceholderPrimaryHex}
              onChange={(e) => setData({ ...data, visualizerPlaceholderPrimaryHex: e.target.value })}
              className={INPUT}
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="ai-v-secondary" className="block text-sm font-semibold text-gray-700 mb-2">
              لون ثانوي
            </label>
            <input
              id="ai-v-secondary"
              value={data.visualizerPlaceholderSecondaryHex}
              onChange={(e) => setData({ ...data, visualizerPlaceholderSecondaryHex: e.target.value })}
              className={INPUT}
              dir="ltr"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
