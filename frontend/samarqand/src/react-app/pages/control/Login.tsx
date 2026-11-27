import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { fetchAuthMe, login } from "@/react-app/api/site";

/** Map API failure codes to short, non-technical Arabic messages. */
function friendlyError(
  res: { ok: boolean; status: number; error?: string },
  needsCode: boolean,
): string {
  switch (res.error) {
    case "two_factor_required":
      return "أدخل رمز المصادقة الثنائية من تطبيقك للمتابعة.";
    case "invalid_code":
      return "رمز المصادقة غير صحيح. تحقق من الرمز وتوقيت جهازك.";
    case "forbidden":
      return "هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم.";
    case "inactive":
      return "هذا الحساب غير مفعّل. تواصل مع مدير النظام.";
    case "rate_limited":
      return "محاولات دخول كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
    case "csrf_failed":
      return "انتهت الجلسة. حدّث الصفحة ثم حاول مرة أخرى.";
    default:
      if (needsCode) return "تعذر تسجيل الدخول. تحقق من رمز المصادقة.";
      if (res.status === 403) {
        return "هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم.";
      }
      return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  }
}

export default function ControlLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    fetchAuthMe()
      .then((me) => {
        if (!active) return;
        // Only staff may use the control panel. Redirecting non-staff here
        // would bounce between /login and /dashboard forever.
        if (me.authenticated && me.isStaff) {
          navigate("/control/dashboard", { replace: true });
        } else if (me.authenticated && !me.isStaff) {
          setError("هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم.");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || loading) return;
    submitting.current = true;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await login({
        username,
        password,
        code: needsCode ? code : undefined,
      });
      if (!res.ok) {
        const message = friendlyError(res, needsCode);
        if (res.error === "two_factor_required") {
          setNeedsCode(true);
          setNotice(message);
        } else {
          setError(message);
        }
        return;
      }
      navigate("/control/dashboard", { replace: true });
    } catch {
      // Never surface raw error details to the user.
      setError("تعذر تسجيل الدخول حالياً. حاول مرة أخرى بعد قليل.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">تسجيل الدخول</h1>
      <p className="text-slate-300 mb-8">
        لوحة التحكم مخصصة للمدراء والموظفين المصرح لهم.
      </p>

      <form
        onSubmit={onSubmit}
        aria-busy={loading}
        className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
      >
        <div>
          <label
            htmlFor="login-username"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            اسم المستخدم
          </label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:opacity-60"
            autoComplete="username"
            autoFocus
            disabled={loading}
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={Boolean(error)}
            required
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            كلمة المرور
          </label>
          <input
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:opacity-60"
            type="password"
            autoComplete="current-password"
            disabled={loading}
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={Boolean(error)}
            required
          />
        </div>
        {needsCode && (
          <div>
            <label
              htmlFor="login-code"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              رمز المصادقة الثنائية
            </label>
            <input
              id="login-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:opacity-60"
              disabled={loading}
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={Boolean(error)}
              required
            />
          </div>
        )}

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-3"
          >
            {notice}
          </div>
        )}
        {error && (
          <div
            id="login-error"
            role="alert"
            aria-live="assertive"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
