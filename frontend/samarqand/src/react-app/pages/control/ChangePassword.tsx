import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { changePassword, fetchAuthMe } from "@/react-app/api/site";

export default function ControlChangePassword() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchAuthMe()
      .then((me) => {
        if (!me.authenticated) {
          navigate("/control/login");
        }
      })
      .catch(() => navigate("/control/login"));
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!newPassword || newPassword.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword({ oldPassword, newPassword });
      if (!res.ok) {
        if (res.error === "invalid_old_password") {
          setError("كلمة المرور الحالية غير صحيحة.");
        } else if (res.error === "forbidden") {
          setError("غير مصرح. سجل الدخول أولاً.");
        } else {
          setError("تعذر تغيير كلمة المرور.");
        }
        return;
      }
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => navigate("/control"), 800);
    } catch {
      setError("تعذر تغيير كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">تغيير كلمة المرور</h1>
      <p className="text-gray-600 mb-8">غيّر كلمة المرور لحسابك الحالي.</p>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم تغيير كلمة المرور بنجاح.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            كلمة المرور الحالية
          </label>
          <input
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            كلمة المرور الجديدة
          </label>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            تأكيد كلمة المرور الجديدة
          </label>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
        >
          {loading ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </form>
    </div>
  );
}
