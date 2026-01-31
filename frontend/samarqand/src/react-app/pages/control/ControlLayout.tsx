import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenText,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  Shield,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";

import { fetchAdminVisibilitySettings, fetchAuthMe, logout } from "@/react-app/api/site";

export default function ControlLayout() {
  const [me, setMe] = useState<{
    authenticated: boolean;
    username: string;
    isSuperuser: boolean;
    isStaff: boolean;
    role: string;
    groups: string[];
  } | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [showControlProjectsManagement, setShowControlProjectsManagement] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const meRequestId = useRef(0);
  const visibilityRequestId = useRef(0);

  const refreshMe = useCallback(() => {
    const reqId = ++meRequestId.current;
    setMeLoading(true);
    fetchAuthMe()
      .then((data) => {
        if (reqId !== meRequestId.current) return;
        setMe({
          authenticated: Boolean(data.authenticated),
          username: data.username || "",
          isSuperuser: Boolean(data.isSuperuser),
          isStaff: Boolean(data.isStaff),
          role: data.role || "staff",
          groups: Array.isArray(data.groups) ? data.groups : [],
        });
        setMeLoading(false);
      })
      .catch(() => {
        if (reqId !== meRequestId.current) return;
        setMe({ authenticated: false, username: "", isSuperuser: false, isStaff: false, role: "anonymous", groups: [] });
        setMeLoading(false);
      });
  }, []);

  useEffect(() => {
    refreshMe();
  }, [location.pathname, refreshMe]);

  const meAuthenticated = Boolean(me?.authenticated);
  const meIsStaff = Boolean(me?.isStaff);

  useEffect(() => {
    if (!meAuthenticated || !meIsStaff) return;
    const reqId = ++visibilityRequestId.current;
    fetchAdminVisibilitySettings()
      .then((v) => {
        if (reqId !== visibilityRequestId.current) return;
        setShowControlProjectsManagement(Boolean(v.showControlProjectsManagement));
      })
      .catch(() => {});
  }, [meAuthenticated, meIsStaff]);

  useEffect(() => {
    if (meLoading) return;
    if (!me) return;
    const role = me.role || "staff";
    const groupNames = new Set((me.groups || []).map((x) => String(x || "").trim()).filter(Boolean));
    const canProjectsByGroup =
      me.isSuperuser ||
      role === "manager" ||
      ["Project Managers", "PMO", "مدراء المشاريع", "مدير مشروع", "مدير المشاريع"].some((g) => groupNames.has(g));
    const canManageSite = me.isSuperuser || role === "manager";
    const canRegistration = me.isSuperuser || role === "manager" || role === "registrar";
    const canAccounting = me.isSuperuser || role === "manager" || role === "accountant";
    const canOps = me.isSuperuser || role === "manager" || role === "accountant" || role === "registrar" || role === "employee";
    const canProjects = canProjectsByGroup;
    const canRfq = canProjectsByGroup || me.isSuperuser || role === "manager" || role === "accountant" || role === "registrar";
    const canCompanyDocs = canAccounting || canRegistration;
    const canMedia = canRegistration || canManageSite;
    const canUsers = me.isSuperuser;

    const pathname = location.pathname || "";
    const isAllowedPath =
      pathname === "/control" ||
      pathname.startsWith("/control/dashboard") ||
      pathname.startsWith("/control/password") ||
      (pathname.startsWith("/control/ops") && canOps) ||
      (pathname.startsWith("/control/projects") && canProjects && showControlProjectsManagement) ||
      (pathname.startsWith("/control/rfq") && canRfq) ||
      (pathname.startsWith("/control/media") && canMedia) ||
      (pathname.startsWith("/control/company-documents") && canCompanyDocs) ||
      (pathname.startsWith("/control/services") && canManageSite) ||
      (pathname.startsWith("/control/blogs") && canManageSite) ||
      (pathname.startsWith("/control/testimonials") && canManageSite) ||
      (pathname.startsWith("/control/home-sections") && canManageSite) ||
      (pathname.startsWith("/control/pages") && canManageSite) ||
      (pathname.startsWith("/control/settings") && canManageSite) ||
      (pathname.startsWith("/control/team") && canManageSite) ||
      (pathname.startsWith("/control/users") && canUsers) ||
      (pathname.startsWith("/control/backup") && me.isSuperuser);

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
      return;
    }
    if (!isAllowedPath) {
      navigate("/control/dashboard", { replace: true });
    }
  }, [location.pathname, me, meLoading, navigate, showControlProjectsManagement]);

  async function onLogout() {
    await logout().catch(() => {});
    setMe({ authenticated: false, username: "", isSuperuser: false, isStaff: false, role: "anonymous", groups: [] });
    navigate("/control/login", { replace: true });
  }

  const roleLabel = useMemo(() => {
    const role = me?.role || "anonymous";
    if (me?.isSuperuser) return "سوبر أدمن";
    if (role === "manager") return "مدير";
    if (role === "accountant") return "محاسب";
    if (role === "registrar") return "مسجل";
    if (role === "employee") return "موظف";
    if (role === "registered_guest") return "ضيف مسجل";
    if (role === "guest") return "ضيف";
    return "";
  }, [me?.isSuperuser, me?.role]);

  const canManageSite = Boolean(me?.isSuperuser || me?.role === "manager");
  const canRegistration = Boolean(me?.isSuperuser || me?.role === "manager" || me?.role === "registrar");
  const canAccounting = Boolean(me?.isSuperuser || me?.role === "manager" || me?.role === "accountant");
  const canOps = Boolean(
    me?.isSuperuser ||
      me?.role === "manager" ||
      me?.role === "accountant" ||
      me?.role === "registrar" ||
      me?.role === "employee",
  );
  const canProjects = Boolean(
    me?.isSuperuser ||
      me?.role === "manager" ||
      ["Project Managers", "PMO", "مدراء المشاريع", "مدير مشروع", "مدير المشاريع"].some((g) =>
        Boolean(me?.groups?.includes(g)),
      ),
  ) && showControlProjectsManagement;
  const canRfq = Boolean(
    canProjects ||
      me?.isSuperuser ||
      me?.role === "manager" ||
      me?.role === "accountant" ||
      me?.role === "registrar",
  );
  const canCompanyDocs = Boolean(canAccounting || canRegistration);
  const canMedia = Boolean(canRegistration || canManageSite);
  const canAudit = Boolean(me?.isSuperuser || me?.role === "manager");

  const pathname = location.pathname || "";
  const isActive = useCallback((prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`), [pathname]);

  const navGroups = useMemo(() => {
    const items = [
      {
        title: "الأساسيات",
        items: [
          { to: "/control/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, show: true },
          { to: "/control/ops", label: "العمليات والموارد", icon: ClipboardList, show: canOps },
        ],
      },
      {
        title: "إدارة المشاريع",
        items: [
          { to: "/control/projects", label: "المشاريع", icon: BriefcaseBusiness, show: canProjects },
          { to: "/control/rfq", label: "نماذج عروض الأسعار", icon: FileText, show: canRfq },
          { to: "/control/media", label: "المكتبة", icon: ImageIcon, show: canMedia },
          { to: "/control/company-documents", label: "مستندات الشركة", icon: FolderOpen, show: canCompanyDocs },
        ],
      },
      {
        title: "محتوى الموقع",
        items: [
          { to: "/control/services", label: "الخدمات", icon: Boxes, show: canManageSite },
          { to: "/control/blogs", label: "المدونات", icon: BookOpenText, show: canManageSite },
          { to: "/control/testimonials", label: "آراء العملاء", icon: UsersRound, show: canManageSite },
          { to: "/control/home-sections", label: "محتوى الصفحة الرئيسية", icon: Building2, show: canManageSite },
          { to: "/control/pages", label: "الصفحات", icon: FileText, show: canManageSite },
          { to: "/control/team", label: "فريق العمل", icon: UsersRound, show: canManageSite },
        ],
      },
      {
        title: "الإعدادات",
        items: [
          { to: "/control/settings/company", label: "إعدادات الشركة", icon: Building2, show: canManageSite },
          { to: "/control/settings/home", label: "إعدادات الصفحة الرئيسية", icon: LayoutDashboard, show: canManageSite },
          { to: "/control/settings/ai", label: "إعدادات الذكاء الاصطناعي", icon: Wrench, show: canManageSite },
          { to: "/control/settings/calculator", label: "إعدادات الحاسبة", icon: BarChart3, show: canManageSite },
          { to: "/control/settings/visibility", label: "إظهار/إخفاء الأقسام", icon: Settings, show: canManageSite },
        ],
      },
      {
        title: "الأمان والنظام",
        items: [
          { to: "/control/ops?tab=audit", label: "سجل التدقيق", icon: Shield, show: canAudit },
          { to: "/control/users", label: "المستخدمون", icon: Users, show: Boolean(me?.isSuperuser) },
          { to: "/control/password", label: "تغيير كلمة المرور", icon: LockKeyhole, show: true },
          { to: "/control/backup", label: "نسخ احتياطي", icon: Shield, show: Boolean(me?.isSuperuser) },
        ],
      },
    ];

    return items
      .map((g) => ({ ...g, items: g.items.filter((it) => it.show) }))
      .filter((g) => g.items.length);
  }, [canAudit, canCompanyDocs, canManageSite, canMedia, canOps, canProjects, canRfq, me?.isSuperuser]);

  const quickLinks = useMemo(() => {
    const items = [
      { to: "/control/dashboard", label: "الرئيسية", icon: LayoutDashboard, show: true },
      { to: "/control/ops", label: "عمليات", icon: ClipboardList, show: canOps },
      { to: "/control/projects", label: "مشاريع", icon: BriefcaseBusiness, show: canProjects },
      { to: "/control/rfq", label: "RFQ", icon: FileText, show: canRfq },
      { to: "/control/media", label: "مكتبة", icon: ImageIcon, show: canMedia },
      { to: "/control/users", label: "مستخدمين", icon: Users, show: Boolean(me?.isSuperuser) },
      { to: "/control/backup", label: "Backup", icon: Shield, show: Boolean(me?.isSuperuser) },
    ];
    return items.filter((x) => x.show);
  }, [canMedia, canOps, canProjects, canRfq, me?.isSuperuser]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white" dir="rtl">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-64 -left-52 w-[620px] h-[620px] rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-20 w-[520px] h-[520px] rounded-full bg-slate-500/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0F19]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/control/dashboard" className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126] flex items-center justify-center shadow-lg">
                <Activity size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold tracking-tight text-white truncate">لوحة الإدارة</div>
                <div className="text-xs text-white/60 truncate">Samar Qand Control</div>
              </div>
            </Link>
            <div className="hidden lg:flex items-center gap-2 text-sm text-white/60">
              <Link to="/" className="hover:text-white transition">
                الموقع
              </Link>
              <span>/</span>
              <span className="text-white/90">لوحة التحكم</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            {quickLinks.map((it) => {
              const Icon = it.icon;
              const active = isActive(it.to.split("?")[0] || it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                    active
                      ? "bg-white/10 border-white/20 text-white"
                      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-sm font-semibold">{it.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {me?.authenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-3 px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center font-extrabold">
                    {String(me.username || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <div className="font-bold text-white text-sm">{me.username}</div>
                    <div className="text-xs text-white/60">{roleLabel || "—"}</div>
                  </div>
                </div>
                <Link
                  to="/control/password"
                  className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/90"
                >
                  <LockKeyhole size={16} />
                  <span className="text-sm font-semibold">كلمة المرور</span>
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white font-extrabold shadow-lg hover:shadow-xl transition"
                >
                  خروج
                </button>
              </div>
            ) : (
              <Link
                to="/control/login"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition font-bold"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-8">
        {pathname.startsWith("/control/login") ? (
          <div className="max-w-lg mx-auto">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
              <Outlet />
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[300px_1fr] gap-8">
            <aside className="lg:sticky lg:top-[92px] h-fit">
              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-white">التنقل</div>
                      <div className="text-xs text-white/60 mt-1">روابط سريعة حسب صلاحياتك</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#007A3D]/40 via-white/5 to-[#CE1126]/40 flex items-center justify-center border border-white/10">
                      <Activity size={18} />
                    </div>
                  </div>
                </div>

                <nav className="p-3 space-y-3">
                  {navGroups.map((g) => (
                    <div key={g.title} className="space-y-2">
                      <div className="px-3 text-[11px] font-extrabold tracking-wide text-white/50">
                        {g.title}
                      </div>
                      <div className="space-y-1">
                        {g.items.map((it) => {
                          const Icon = it.icon;
                          const active = isActive(it.to.split("?")[0] || it.to);
                          return (
                            <Link
                              key={it.to}
                              to={it.to}
                              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border transition ${
                                active
                                  ? "bg-gradient-to-r from-[#007A3D]/25 via-white/5 to-[#CE1126]/25 border-white/20 text-white shadow-sm"
                                  : "bg-white/0 border-white/0 text-white/85 hover:bg-white/5 hover:border-white/10 hover:text-white"
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                                  active ? "bg-white/10 border-white/15" : "bg-white/0 border-white/10"
                                }`}
                              >
                                <Icon size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold truncate">{it.label}</div>
                                <div className="text-xs text-white/55 truncate" dir="ltr">
                                  {it.to}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2">
                    {canManageSite ? (
                      <a
                        href="/django-admin/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-white/10 bg-white/0 hover:bg-white/5 transition text-white/85"
                      >
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10">
                          <Wrench size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold truncate">Django Admin</div>
                          <div className="text-xs text-white/55 truncate">لوحة النظام القديمة</div>
                        </div>
                      </a>
                    ) : null}
                  </div>
                </nav>

                <div className="p-4 border-t border-white/10 text-xs text-white/60 flex items-center justify-between">
                  <span>© Samar Qand</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    جاهز
                  </span>
                </div>
              </div>
            </aside>

            <section className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-4 shadow-xl">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-white/80">
                    <span className="text-sm font-bold">وصول سريع:</span>
                    <span className="text-sm text-white/60">إدارة المستخدمين والموظفين والمشاريع…</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to="/control/dashboard"
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-sm"
                    >
                      <span className="inline-flex items-center gap-2">
                        <LayoutDashboard size={16} /> لوحة التحكم
                      </span>
                    </Link>
                    {canOps ? (
                      <Link
                        to="/control/ops?tab=resources&resTab=attendance"
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-sm"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ClipboardList size={16} /> الموظفين والدوام
                        </span>
                      </Link>
                    ) : null}
                    {canProjects ? (
                      <Link
                        to="/control/projects"
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-sm"
                      >
                        <span className="inline-flex items-center gap-2">
                          <BriefcaseBusiness size={16} /> المشاريع
                        </span>
                      </Link>
                    ) : null}
                    {canAudit ? (
                      <Link
                        to="/control/ops?tab=audit"
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-bold text-sm"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Shield size={16} /> سجل التدقيق
                        </span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl text-white">
                <Outlet />
              </div>
            </section>
          </div>
        )}
      </main>

      <footer className="relative border-t border-white/10 bg-[#0B0F19]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 text-sm text-white/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity size={16} />
            <span className="font-bold text-white/80">لوحة إدارة سمر قند</span>
            <span className="text-white/50">•</span>
            <span>تحكم سريع • صلاحيات • تدقيق</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="hover:text-white transition">
              الموقع
            </Link>
            <span className="text-white/40">|</span>
            <Link to="/control/password" className="hover:text-white transition">
              كلمة المرور
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
