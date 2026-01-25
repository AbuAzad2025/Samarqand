import { useEffect, useState } from "react";

import {
  fetchAdminAISettings,
  updateAdminAISettings,
  type AdminAISettingsPayload,
} from "@/react-app/api/site";

export default function ControlAISettings() {
  const [data, setData] = useState<AdminAISettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetchAdminAISettings().then(setData).catch(() => {});
  }, []);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminAISettings(data);
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
          <h1 className="text-2xl font-bold text-gray-900">إعدادات الذكاء الاصطناعي</h1>
          <p className="text-gray-600 mt-1">التحكم بالتفعيل والنموذج والبرومبتات.</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
          <div className="text-lg font-bold text-gray-900">الإعدادات العامة</div>

          <div className="flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div>
              <div className="font-semibold text-gray-900">تفعيل Gemini</div>
              <div className="text-sm text-gray-600">تعطيل التفعيل يجبر النظام على ردود احتياطية.</div>
            </div>
            <button
              type="button"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Gemini Model</label>
              <input
                value={data.geminiModel}
                onChange={(e) => setData({ ...data, geminiModel: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">متغير API Key</label>
              <input
                value={data.geminiApiKeyEnvVar}
                onChange={(e) => setData({ ...data, geminiApiKeyEnvVar: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Temperature</label>
              <input
                value={data.temperature}
                onChange={(e) => setData({ ...data, temperature: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                type="number"
                step="0.1"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Max Output Tokens</label>
              <input
                value={data.maxOutputTokens}
                onChange={(e) => setData({ ...data, maxOutputTokens: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                type="number"
                step="1"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">سياق الشركة</label>
            <textarea
              value={data.companyContext}
              onChange={(e) => setData({ ...data, companyContext: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] min-h-40"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-lg font-bold text-gray-900">البرومبتات</div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">تحليل التصميم</label>
            <textarea
              value={data.designAnalyzerPrompt}
              onChange={(e) => setData({ ...data, designAnalyzerPrompt: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] min-h-28"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">مولّد المحتوى</label>
            <textarea
              value={data.contentGeneratorPrompt}
              onChange={(e) => setData({ ...data, contentGeneratorPrompt: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] min-h-28"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الشات بوت</label>
            <textarea
              value={data.chatPrompt}
              onChange={(e) => setData({ ...data, chatPrompt: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] min-h-28"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">المصور المعماري</label>
            <textarea
              value={data.visualizerPrompt}
              onChange={(e) => setData({ ...data, visualizerPrompt: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] min-h-28"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mt-6">
        <div className="text-lg font-bold text-gray-900 mb-4">إعدادات المصور الافتراضي</div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الستايل الافتراضي</label>
            <input
              value={data.visualizerDefaultStyle}
              onChange={(e) => setData({ ...data, visualizerDefaultStyle: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">الأبعاد الافتراضية</label>
            <input
              value={data.visualizerDefaultAspectRatio}
              onChange={(e) => setData({ ...data, visualizerDefaultAspectRatio: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">نص الفوتر</label>
            <input
              value={data.visualizerPlaceholderFooterText}
              onChange={(e) => setData({ ...data, visualizerPlaceholderFooterText: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">لون أساسي</label>
            <input
              value={data.visualizerPlaceholderPrimaryHex}
              onChange={(e) => setData({ ...data, visualizerPlaceholderPrimaryHex: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">لون ثانوي</label>
            <input
              value={data.visualizerPlaceholderSecondaryHex}
              onChange={(e) => setData({ ...data, visualizerPlaceholderSecondaryHex: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
              dir="ltr"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

