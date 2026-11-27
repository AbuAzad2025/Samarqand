import { useEffect, useState } from "react";

import {
  confirmTwoFactor,
  disableTwoFactor,
  fetchTwoFactorStatus,
  setupTwoFactor,
  type TwoFactorStatus,
} from "@/react-app/api/site";

export default function ControlSecuritySettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTwoFactorStatus().then(setStatus).catch(() => {});
  }, []);

  async function startSetup() {
    setBusy(true);
    setMessage("");
    try {
      const data = await setupTwoFactor();
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStatus({ enabled: false, hasPendingSecret: true });
    } catch {
      setMessage("تعذر بدء الإعداد.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setMessage("");
    const res = await confirmTwoFactor(code);
    if (res.ok) {
      setStatus({ enabled: true, hasPendingSecret: false });
      setSecret("");
      setCode("");
      setMessage("تم تفعيل المصادقة الثنائية.");
    } else {
      setMessage("رمز غير صحيح. تأكد من توقيت جهازك.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    const res = await disableTwoFactor(code);
    if (res.ok) {
      setStatus({ enabled: false, hasPendingSecret: false });
      setCode("");
      setMessage("تم إلغاء المصادقة الثنائية.");
    } else {
      setMessage("رمز غير صحيح.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">أمان الحساب</h1>
        <p className="text-slate-300 mt-1">
          أضف خطوة تحقق ثانية لحسابك على لوحة التحكم.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        {!status ? (
          <p className="text-gray-500">جارٍ التحميل…</p>
        ) : status.enabled ? (
          <>
            <p className="font-bold text-sq-green" role="status">
              المصادقة الثنائية مفعلة ✅
            </p>
            <p className="text-sm text-gray-600">
              سيُطلب منك رمز من تطبيق المصادقة عند كل تسجيل دخول.
            </p>
            <label htmlFor="security-code" className="block text-sm font-bold text-gray-700">
              أدخل الرمز الحالي لإلغاء التفعيل
            </label>
            <input
              id="security-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-48 rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900"
            />
            <button
              type="button"
              onClick={disable}
              disabled={busy || code.length !== 6}
              className="rounded-xl border border-red-300 text-red-700 px-5 py-2.5 font-bold disabled:opacity-50"
            >
              إلغاء التفعيل
            </button>
          </>
        ) : secret ? (
          <>
            <p className="font-bold text-gray-900">أضف هذا المفتاح إلى تطبيق المصادقة</p>
            <code
              dir="ltr"
              className="block bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm break-all text-gray-900"
            >
              {secret}
            </code>
            <a
              href={otpauthUrl}
              className="text-sm font-bold text-sq-green underline"
            >
              فتح الرابط في تطبيق المصادقة
            </a>
            <label htmlFor="security-code" className="block text-sm font-bold text-gray-700">
              أدخل الرمز المكوّن من 6 أرقام للتأكيد
            </label>
            <input
              id="security-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-48 rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900"
            />
            <button
              type="button"
              onClick={confirm}
              disabled={busy || code.length !== 6}
              className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-5 py-2.5 font-bold text-white disabled:opacity-50"
            >
              تفعيل
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startSetup}
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            بدء إعداد المصادقة الثنائية
          </button>
        )}
        {message ? (
          <p role="status" className="text-sm font-semibold text-sq-green">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
