import { useCallback, useEffect, useState } from "react";

import {
  confirmTwoFactor,
  disableTwoFactor,
  fetchTwoFactorStatus,
  setupTwoFactor,
  type TwoFactorStatus,
} from "@/react-app/api/site";

type Notice = { text: string; kind: "success" | "error" };

export default function ControlSecuritySettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setStatus(await fetchTwoFactorStatus());
    } catch {
      setStatus(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function cancel() {
    setCode("");
    setSecret("");
    setOtpauthUrl("");
    setNotice(null);
    if (status) setStatus({ enabled: status.enabled, hasPendingSecret: false });
  }

  async function startSetup() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const data = await setupTwoFactor();
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStatus({ enabled: false, hasPendingSecret: true });
      setNotice({
        text: "أضف المفتاح إلى تطبيق المصادقة ثم أدخل الرمز للتأكيد.",
        kind: "success",
      });
    } catch {
      setNotice({ text: "تعذر بدء إعداد المصادقة الثنائية.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await confirmTwoFactor(code);
      if (res.ok) {
        setStatus({ enabled: true, hasPendingSecret: false });
        setSecret("");
        setCode("");
        setNotice({ text: "تم تفعيل المصادقة الثنائية.", kind: "success" });
      } else {
        setNotice({
          text: "رمز غير صحيح. تحقق من الرمز وتوقيت جهازك.",
          kind: "error",
        });
      }
    } catch {
      setNotice({ text: "تعذر تأكيد الرمز. حاول مرة أخرى.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy || code.length !== 6) return;
    const confirmed = window.confirm(
      "سيتم إلغاء المصادقة الثنائية عن حسابك، وسيصبح تسجيل الدخول يعتمد على كلمة المرور فقط.\n\nهل تريد المتابعة؟",
    );
    if (!confirmed) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await disableTwoFactor(code);
      if (res.ok) {
        setStatus({ enabled: false, hasPendingSecret: false });
        setCode("");
        setNotice({ text: "تم إلغاء المصادقة الثنائية.", kind: "success" });
      } else {
        setNotice({ text: "رمز غير صحيح. حاول مرة أخرى.", kind: "error" });
      }
    } catch {
      setNotice({ text: "تعذر إلغاء المصادقة الثنائية.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ تحميل حالة أمان الحساب…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">أمان الحساب</h1>
        <p className="text-slate-300 mt-1">
          أضف خطوة تحقق ثانية لحسابك على لوحة التحكم.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700"
        >
          <p className="font-bold">تعذر تحميل حالة المصادقة الثنائية.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 font-bold underline"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      <section
        aria-labelledby="security-status-title"
        className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4"
      >
        <div>
          <h2 id="security-status-title" className="text-lg font-bold text-gray-900">
            حالة الحماية
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            توضح هذه المجموعة ما إذا كانت المصادقة الثنائية مفعّلة لحسابك.
          </p>
        </div>

        {!status ? (
          <p className="text-gray-500">لا توجد معلومات متاحة حالياً.</p>
        ) : status.enabled ? (
          <>
            <p className="font-bold text-sq-green" role="status">
              المصادقة الثنائية مفعلة ✅
            </p>
            <p className="text-sm text-gray-600">
              سيُطلب منك رمز من تطبيق المصادقة عند كل تسجيل دخول.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-700">
            المصادقة الثنائية غير مفعّلة. يمكنك تفعيلها من المجموعة أدناه.
          </p>
        )}
      </section>

      <section
        aria-labelledby="security-setup-title"
        className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4"
      >
        <div>
          <h2 id="security-setup-title" className="text-lg font-bold text-gray-900">
            تفعيل أو إلغاء المصادقة الثنائية
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            استخدم تطبيق مصادقة لإضافة المفتاح، ثم أكّد برمز مكوّن من 6 أرقام. يمكنك إلغاء الإعداد في أي وقت قبل التأكيد.
          </p>
        </div>

        {status?.enabled ? (
          <>
            <label htmlFor="security-code" className="block text-sm font-bold text-gray-700">
              أدخل الرمز الحالي لإلغاء التفعيل
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                id="security-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                aria-describedby={notice ? "security-notice" : undefined}
                aria-invalid={notice?.kind === "error" || undefined}
                className="w-48 rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sq-green"
              />
              <button
                type="button"
                onClick={() => void disable()}
                disabled={busy || code.length !== 6}
                className="rounded-xl border border-red-300 text-red-700 px-5 py-2.5 font-bold disabled:opacity-50"
              >
                {busy ? "جارٍ التنفيذ..." : "إلغاء التفعيل"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy || !code}
                className="rounded-xl border border-gray-200 text-gray-800 px-5 py-2.5 font-bold disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
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
            <div className="flex items-center gap-3 flex-wrap">
              <input
                id="security-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                aria-describedby={notice ? "security-notice" : undefined}
                aria-invalid={notice?.kind === "error" || undefined}
                className="w-48 rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-sq-green"
              />
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy || code.length !== 6}
                className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-5 py-2.5 font-bold text-white disabled:opacity-50"
              >
                {busy ? "جارٍ التأكيد..." : "تأكيد التفعيل"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="rounded-xl border border-gray-200 text-gray-800 px-5 py-2.5 font-bold disabled:opacity-50"
              >
                إلغاء الإعداد
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void startSetup()}
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {busy ? "جارٍ البدء..." : "بدء إعداد المصادقة الثنائية"}
          </button>
        )}

        {notice && (
          <p
            id="security-notice"
            role={notice.kind === "error" ? "alert" : "status"}
            aria-live={notice.kind === "error" ? "assertive" : "polite"}
            className={`text-sm font-semibold ${
              notice.kind === "error" ? "text-red-700" : "text-sq-green"
            }`}
          >
            {notice.text}
          </p>
        )}
      </section>
    </div>
  );
}
