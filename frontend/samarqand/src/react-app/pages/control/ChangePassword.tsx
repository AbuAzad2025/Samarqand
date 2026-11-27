import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { changePassword, fetchAuthMe } from "@/react-app/api/site";

function friendlyError(error?: string): string {
  switch (error) {
    case "invalid_old_password":
      return "كلمة المرور الحالية غير صحيحة.";
    case "unauthorized":
    case "forbidden":
      return "يجب تسجيل الدخول أولاً لتغيير كلمة المرور.";
    case "missing_fields":
      return "أدخل كلمة المرور الحالية والجديدة.";
    case "rate_limited":
      return "محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.";
    default:
      return "تعذر تغيير كلمة المرور حالياً. حاول مرة أخرى بعد قليل.";
  }
}

export default function ControlChangePassword() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    fetchAuthMe()
      .then((me) => {
        if (!me.authenticated) navigate("/control/login", { replace: true });
      })
      .catch(() => navigate("/control/login", { replace: true }));
  }, [navigate]);

  function validate(): string | null {
    if (!oldPassword.trim()) return "أدخل كلمة المرور الحالية.";
    if (newPassword.trim().length < 8) {
      return "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.";
    }
    if (newPassword === oldPassword) {
      return "يجب أن تختلف كلمة المرور الجديدة عن الحالية.";
    }
    if (newPassword !== confirmPassword) {
      return "تأكيد كلمة المرور غير مطابق.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || loading) return;
    setError(null);
    setSuccess(false);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      const res = await changePassword({ oldPassword, newPassword });
      if (!res.ok) {
        setError(friendlyError(res.error));
        return;
      }
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      // Keep the failure generic; backend details are not shown to the user.
      setError("تعذر تغيير كلمة المرور حالياً. حاول مرة أخرى بعد قليل.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">تغيير كلمة المرور</h1>
      <p className="text-slate-300 mb-8">
        غيّر كلمة المرور لحسابك الحالي. ستستخدمها في تسجيل الدخول القادم.
      </p>

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800"
        >
          <p className="font-bold">تم تغيير كلمة المرور بنجاح.</p>
          <Link
            to="/control/dashboard"
            className="inline-block mt-2 font-semibold underline"
          >
            العودة إلى لوحة التحكم
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        aria-busy={loading}
        className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
      >
        <div>
          <label
            htmlFor="password-old"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            كلمة المرور الحالية
          </label>
          <input
            id="password-old"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:opacity-60"
            type="password"
            autoComplete="current-password"
            disabled={loading}
            required
          />
        </div>

        <div>
          <label
            htmlFor="password-new"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            كلمة المرور الجديدة
          </label>
          <input
            id="password-new"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:opacity-60"
            type="password"
            autoComplete="new-password"
            disabled={loading}
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="text-xs text-gray-500 mt-1">
            8 أحرف على الأقل، وتختلف عن كلمة المرور الحالية.
          </p>
        </div>

        <div>
          <label
            htmlFor="password-confirm"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            تأكيد كلمة المرور الجديدة
          </label>
          <input
            id="password-confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:opacity-60"
            type="password"
            autoComplete="new-password"
            disabled={loading}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
        >
          {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
        </button>
      </form>
    </div>
  );
}
