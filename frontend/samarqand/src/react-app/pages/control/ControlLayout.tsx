import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useCallback, useEffect, useState } from "react";

import { fetchAuthMe, logout } from "@/react-app/api/site";

export default function ControlLayout() {
  const [me, setMe] = useState<{
    authenticated: boolean;
    username: string;
    isSuperuser: boolean;
    isStaff: boolean;
  } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const refreshMe = useCallback(() => {
    fetchAuthMe()
      .then((data) =>
        setMe({
          authenticated: Boolean(data.authenticated),
          username: data.username || "",
          isSuperuser: Boolean(data.isSuperuser),
          isStaff: Boolean(data.isStaff),
        }),
      )
      .catch(() =>
        setMe({ authenticated: false, username: "", isSuperuser: false, isStaff: false }),
      );
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    refreshMe();
  }, [location.pathname, refreshMe]);

  useEffect(() => {
    if (!me) return;
    if (location.pathname.startsWith("/control/login")) {
      if (me.authenticated && me.isStaff) {
        navigate("/control/dashboard", { replace: true });
      }
      return;
    }
    if (!me.authenticated) {
      navigate("/control/login", { replace: true });
      return;
    }
    if (!me.isStaff) {
      navigate("/control/login", { replace: true });
    }
  }, [location.pathname, me, navigate]);

  async function onLogout() {
    await logout().catch(() => {});
    setMe({ authenticated: false, username: "", isSuperuser: false, isStaff: false });
    navigate("/control/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-bold text-gray-900 hover:text-[#007A3D] transition">
              الموقع
            </Link>
            <div className="text-gray-300">/</div>
            <Link to="/control" className="font-semibold text-gray-700 hover:text-[#007A3D] transition">
              لوحة التحكم
            </Link>
          </div>
          <div className="text-sm text-gray-600">
            {me?.authenticated ? (
              <div className="flex items-center gap-4">
                <Link to="/control/password" className="text-[#007A3D] font-semibold hover:underline">
                  تغيير كلمة المرور
                </Link>
                <Link to="/control/dashboard" className="text-gray-700 hover:text-gray-900 font-semibold">
                  الرئيسية
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-gray-700 hover:text-gray-900 font-semibold"
                >
                  خروج
                </button>
                <span>
                  {me.username}
                  {me.isSuperuser ? " (سوبر أدمن)" : ""}
                </span>
              </div>
            ) : (
              <Link to="/control/login" className="text-[#007A3D] font-semibold hover:underline">
                تسجيل الدخول
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {location.pathname.startsWith("/control/login") ? (
          <Outlet />
        ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          <aside className="bg-white border border-gray-200 rounded-2xl p-4 h-fit">
            <div className="text-xs font-bold text-gray-500 mb-3">القائمة</div>
            <nav className="space-y-2">
              <Link
                to="/control/dashboard"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                لوحة التحكم
              </Link>
              <Link
                to="/control/team"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                فريق العمل
              </Link>
              <Link
                to="/control/users"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                المستخدمون
              </Link>
              <Link
                to="/control/projects"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                المشاريع
              </Link>
              <Link
                to="/control/services"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                الخدمات
              </Link>
              <Link
                to="/control/blogs"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                المدونات
              </Link>
              <Link
                to="/control/testimonials"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                آراء العملاء
              </Link>
              <Link
                to="/control/home-sections"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                محتوى الصفحة الرئيسية
              </Link>
              <Link
                to="/control/pages"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                الصفحات
              </Link>
              <Link
                to="/control/media"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                المكتبة
              </Link>
              <Link
                to="/control/rfq"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                نماذج عروض الأسعار
              </Link>
              <Link
                to="/control/password"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                تغيير كلمة المرور
              </Link>
              <div className="pt-2">
                <div className="text-xs font-bold text-gray-500 mb-2 px-4">
                  الإعدادات
                </div>
                <div className="space-y-2">
                  <Link
                    to="/control/settings/company"
                    className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
                  >
                    الشركة
                  </Link>
                  <Link
                    to="/control/settings/home"
                    className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
                  >
                    الصفحة الرئيسية
                  </Link>
                  <Link
                    to="/control/settings/ai"
                    className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
                  >
                    الذكاء الاصطناعي
                  </Link>
                  <Link
                    to="/control/settings/calculator"
                    className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
                  >
                    الحاسبة
                  </Link>
                  <Link
                    to="/control/settings/visibility"
                    className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
                  >
                    إظهار/إخفاء الأقسام
                  </Link>
                </div>
              </div>
              <a
                href="/django-admin/"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
              >
                Django Admin
              </a>
              {me?.isSuperuser ? (
                <Link
                  to="/control/backup"
                  className="block px-4 py-2 rounded-lg hover:bg-gray-50 transition font-semibold text-gray-800"
                >
                  نسخ احتياطي
                </Link>
              ) : null}
            </nav>
          </aside>
          <section>
            <Outlet />
          </section>
        </div>
        )}
      </main>
    </div>
  );
}

