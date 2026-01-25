import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { fetchAuthMe, login } from "@/react-app/api/site";

export default function ControlLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      const res = await login({ username, password });
      if (!res.ok) {
        setError("اسم المستخدم أو كلمة المرور غير صحيحة.");
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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">تسجيل الدخول</h1>
      <p className="text-gray-600 mb-8">لوحة التحكم مخصصة للمدراء والسوبر أدمن.</p>

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المستخدم</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">كلمة المرور</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
