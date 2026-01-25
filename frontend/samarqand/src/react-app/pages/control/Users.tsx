import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { createOrUpdateUser, fetchAuthMe } from "@/react-app/api/site";

type Role = "manager" | "superadmin";

export default function ControlUsers() {
  const [me, setMe] = useState<{
    authenticated: boolean;
    isSuperuser: boolean;
    username: string;
  } | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [result, setResult] = useState<{ password?: string; message: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAuthMe()
      .then((data) =>
        setMe({
          authenticated: Boolean(data.authenticated),
          isSuperuser: Boolean(data.isSuperuser),
          username: data.username || "",
        }),
      )
      .catch(() =>
        setMe({ authenticated: false, isSuperuser: false, username: "" }),
      );
  }, []);

  const isReady = useMemo(() => me !== null, [me]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await createOrUpdateUser({
        username,
        password: password || undefined,
        role,
      });
      if (!res.ok) {
        setError(res.error || "غير مصرح.");
        return;
      }
      setResult({
        message: res.created ? "تم إنشاء المستخدم." : "تم تحديث المستخدم.",
        password: res.generatedPassword,
      });
      setUsername("");
      setPassword("");
      setRole("manager");
    } catch {
      setError("تعذر حفظ المستخدم.");
    } finally {
      setLoading(false);
    }
  }

  if (!isReady) {
    return null;
  }

  if (!me?.authenticated) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">غير مسجل دخول</h1>
        <p className="text-gray-600 mb-6">سجل الدخول للوصول إلى لوحة التحكم.</p>
        <Link
          to="/control/login"
          className="inline-block bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (!me.isSuperuser) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح</h1>
        <p className="text-gray-600">
          إدارة المستخدمين متاحة للسوبر أدمن فقط.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">إدارة المستخدمين</h1>
      <p className="text-gray-600 mb-8">
        إنشاء/تحديث مستخدم مع (يوزرنيم + باسورد + دور). هذه الصفحة للسوبر أدمن فقط.
      </p>

      {result?.password && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
          <div className="font-bold text-emerald-900 mb-2">{result.message}</div>
          <div className="text-emerald-900 mb-2">
            كلمة المرور تم توليدها تلقائياً. انسخها الآن لأننا لن نعرضها مرة أخرى:
          </div>
          <pre className="bg-white border border-emerald-200 rounded-lg p-3 overflow-auto">
{result.password}
          </pre>
        </div>
      )}

      {result && !result.password && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
          <div className="font-bold text-emerald-900">{result.message}</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            اسم المستخدم
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            كلمة المرور (اختياري)
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
            type="text"
            autoComplete="new-password"
            placeholder="اتركها فارغة للتوليد التلقائي"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            الدور
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
          >
            <option value="manager">مدير</option>
            <option value="superadmin">سوبر أدمن</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
        >
          {loading ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </form>
    </div>
  );
}

