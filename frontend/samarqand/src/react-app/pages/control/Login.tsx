import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { fetchAuthMe, login } from "@/react-app/api/site";

export default function ControlLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAuthMe()
      .then((me) => {
        if (me.authenticated) {
          navigate("/control/dashboard", { replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({
        username,
        password,
        code: needsCode ? code : undefined,
      });
      if (!res.ok) {
        if (res.error === "two_factor_required") {
          setNeedsCode(true);
          setError("أدخل رمز المصادقة الثنائية من تطبيقك.");
          return;
        }
        setError(
          res.status === 403
            ? "هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم."
            : needsCode
              ? "رمز المصادقة غير صحيح."
              : "اسم المستخدم أو كلمة المرور غير صحيحة.",
        );
        return;
      }
      navigate("/control/dashboard", { replace: true });
    } catch {
      setError("تعذر تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">تسجيل الدخول</h1>
      <p className="text-slate-300 mb-8">لوحة التحكم مخصصة للمدراء والسوبر أدمن.</p>

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label htmlFor="login-username" className="block text-sm font-semibold text-gray-700 mb-2">اسم المستخدم</label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
          <input
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {needsCode && (
          <div>
            <label htmlFor="login-code" className="block text-sm font-semibold text-gray-700 mb-2">
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
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
              required
            />
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
