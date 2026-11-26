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
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Settings,
  Shield,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Wrench,
  X,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    const canBoq = canProjectsByGroup || me.isSuperuser || role === "manager" || role === "accountant" || role === "registrar";
    const canCompanyDocs = canAccounting || canRegistration;
    const canMedia = canRegistration || canManageSite;
    const canUsers = me.isSuperuser;
    const canHr = canOps;
    const canFleet = canOps;
    const canMail = true;

    const pathname = location.pathname || "";
    const isAllowedPath =
      pathname === "/control" ||
      pathname.startsWith("/control/dashboard") ||
      pathname.startsWith("/control/password") ||
      (pathname.startsWith("/control/ops") && canOps) ||
      (pathname.startsWith("/control/projects") && canProjects && showControlProjectsManagement) ||
      (pathname.startsWith("/control/rfq") && canRfq) ||
      (pathname.startsWith("/control/boq") && canBoq) ||
      (pathname.startsWith("/control/field-docs") && canBoq) ||
      (pathname.startsWith("/control/hr") && canHr) ||
      (pathname.startsWith("/control/fleet") && canFleet) ||
      (pathname.startsWith("/control/mail") && canMail) ||
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
    me?.isSuperuser || me?.role === "manager" || me?.role === "accountant" || me?.role === "registrar" || me?.role === "employee",
  );
  const canProjects = Boolean(
    me?.isSuperuser ||
      me?.role === "manager" ||
      ["Project Managers", "PMO", "مدراء المشاريع", "مدير مشروع", "مدير المشاريع"].some((g) => Boolean(me?.groups?.includes(g))),
  ) && showControlProjectsManagement;
  const canRfq = Boolean(
    canProjects || me?.isSuperuser || me?.role === "manager" || me?.role === "accountant" || me?.role === "registrar",
  );
  const canBoq = Boolean(
    canProjects || me?.isSuperuser || me?.role === "manager" || me?.role === "accountant" || me?.role === "registrar",
  );
  const canFieldDocs = canBoq;
  const canHr = canOps;
  const canFleet = canOps;
  const canMail = true;
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
          { to: "/control/hr", label: "الموارد البشرية", icon: UserCog, show: canHr },
          { to: "/control/fleet", label: "المركبات", icon: Truck, show: canFleet },
          { to: "/control/mail", label: "البريد", icon: Mail, show: canMail },
        ],
      },
      {
        title: "إدارة المشاريع",
        items: [
          { to: "/control/projects", label: "المشاريع", icon: BriefcaseBusiness, show: canProjects },
          { to: "/control/boq", label: "بنود الكميات", icon: FileSpreadsheet, show: canBoq },
          { to: "/control/field-docs", label: "التوثيق الميداني", icon: ClipboardList, show: canFieldDocs },
          { to: "/control/rfq", label: "عروض الأسعار", icon: FileText, show: canRfq },
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
          { to: "/control/home-sections", label: "الصفحة الرئيسية", icon: Building2, show: canManageSite },
          { to: "/control/pages", label: "الصفحات", icon: FileText, show: canManageSite },
          { to: "/control/team", label: "فريق العمل", icon: UsersRound, show: canManageSite },
        ],
      },
      {
        title: "الإعدادات",
        items: [
          { to: "/control/settings/company", label: "الشركة", icon: Building2, show: canManageSite },
          { to: "/control/settings/home", label: "الصفحة الرئيسية", icon: LayoutDashboard, show: canManageSite },
          { to: "/control/settings/ai", label: "الذكاء الاصطناعي", icon: Wrench, show: canManageSite },
          { to: "/control/settings/calculator", label: "الحاسبة", icon: BarChart3, show: canManageSite },
          { to: "/control/settings/visibility", label: "إظهار الأقسام", icon: Settings, show: canManageSite },
        ],
      },
      {
        title: "الأمان والنظام",
        items: [
          { to: "/control/ops?tab=audit", label: "سجل التدقيق", icon: Shield, show: canAudit },
          { to: "/control/users", label: "المستخدمون", icon: Users, show: Boolean(me?.isSuperuser) },
          { to: "/control/password", label: "كلمة المرور", icon: LockKeyhole, show: true },
          { to: "/control/backup", label: "نسخ احتياطي", icon: Shield, show: Boolean(me?.isSuperuser) },
        ],
      },
    ];

    return items
      .map((g) => ({ ...g, items: g.items.filter((it) => it.show) }))
      .filter((g) => g.items.length);
  }, [canAudit, canBoq, canCompanyDocs, canFieldDocs, canFleet, canHr, canMail, canManageSite, canMedia, canOps, canProjects, canRfq, me?.isSuperuser]);

  const quickLinks = useMemo(() => {
    const items = [
      { to: "/control/dashboard", label: "الرئيسية", icon: LayoutDashboard, show: true },
      { to: "/control/ops", label: "العمليات", icon: ClipboardList, show: canOps },
      { to: "/control/hr", label: "الموارد البشرية", icon: UserCog, show: canHr },
      { to: "/control/fleet", label: "المركبات", icon: Truck, show: canFleet },
      { to: "/control/mail", label: "البريد", icon: Mail, show: canMail },
      { to: "/control/projects", label: "المشاريع", icon: BriefcaseBusiness, show: canProjects },
      { to: "/control/boq", label: "بنود الكميات", icon: FileSpreadsheet, show: canBoq },
      { to: "/control/field-docs", label: "التوثيق", icon: ClipboardList, show: canFieldDocs },
      { to: "/control/rfq", label: "عروض الأسعار", icon: FileText, show: canRfq },
      { to: "/control/media", label: "المكتبة", icon: ImageIcon, show: canMedia },
      { to: "/control/users", label: "المستخدمون", icon: Users, show: Boolean(me?.isSuperuser) },
      { to: "/control/backup", label: "نسخ احتياطي", icon: Shield, show: Boolean(me?.isSuperuser) },
    ];
    return items.filter((x) => x.show);
  }, [canBoq, canFieldDocs, canFleet, canHr, canMail, canMedia, canOps, canProjects, canRfq, me?.isSuperuser]);

  const isLogin = pathname.startsWith("/control/login");

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white" dir="rtl">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-64 -left-52 w-[620px] h-[620px] rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-20 w-[520px] h-[520px] rounded-full bg-slate-500/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0F19]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/control/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126] flex items-center justify-center shadow-lg shrink-0">
              <Activity size={18} />
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="font-extrabold tracking-tight text-white truncate leading-tight">لوحة إدارة سمرقند</div>
              <div className="text-[11px] text-white/60 truncate">Samar Qand Control</div>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="hidden md:flex items-center gap-2 text-sm text-white/70 hover:text-white transition"
            >
              <Home size={16} />
              <span>الموقع</span>
            </Link>

            {me?.authenticated ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#007A3D] to-[#CE1126] flex items-center justify-center text-sm font-extrabold shrink-0">
                    {String(me.username || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <div className="font-bold text-white text-sm">{me.username}</div>
                    <div className="text-[11px] text-white/60">{roleLabel || "—"}</div>
                  </div>
                </div>
                <Link
                  to="/control/password"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/90 text-sm"
                >
                  <LockKeyhole size={16} />
                  <span className="hidden lg:inline">كلمة المرور</span>
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white text-sm font-extrabold shadow-lg hover:shadow-xl transition"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </div>
            ) : (
              <Link
                to="/control/login"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition font-bold text-sm"
              >
                تسجيل الدخول
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {!isLogin && quickLinks.length > 0 && (
          <div className="border-t border-white/10 bg-white/5">
            <div className="max-w-7xl mx-auto px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <span className="text-xs font-bold text-white/50 shrink-0">اختصارات:</span>
                {quickLinks.map((it) => {
                  const Icon = it.icon;
                  const active = isActive(it.to.split("?")[0] || it.to);
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                        active
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-4">
        {isLogin ? (
          <div className="max-w-md mx-auto pt-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
              <Outlet />
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
            <aside className={`lg:block lg:sticky lg:top-24 lg:self-start ${mobileMenuOpen ? "block" : "hidden"}`}>
              <div className="bg-white/5 border border-white/10 rounded-3xl shadow-xl lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto">
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-white">التنقل</div>
                      <div className="text-xs text-white/60 mt-1">حسب صلاحياتك</div>
                    </div>
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#007A3D]/40 via-white/5 to-[#CE1126]/40 flex items-center justify-center border border-white/10">
                      <Activity size={16} />
                    </div>
                  </div>
                </div>

                <nav className="p-3 space-y-4">
                  {navGroups.map((g) => (
                    <div key={g.title} className="space-y-1.5">
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
                              onClick={() => setMobileMenuOpen(false)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition ${
                                active
                                  ? "bg-gradient-to-r from-[#007A3D]/25 via-white/5 to-[#CE1126]/25 border-white/20 text-white shadow-sm"
                                  : "bg-white/0 border-white/0 text-white/85 hover:bg-white/5 hover:border-white/10 hover:text-white"
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                                  active ? "bg-white/10 border-white/15" : "bg-white/0 border-white/10"
                                }`}
                              >
                                <Icon size={16} />
                              </div>
                              <span className="font-bold text-sm truncate">{it.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {canManageSite && (
                    <div className="pt-2">
                      <a
                        href="/django-admin/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/0 hover:bg-white/5 transition text-white/85"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10">
                          <Wrench size={16} />
                        </div>
                        <span className="font-bold text-sm truncate">Django Admin</span>
                      </a>
                    </div>
                  )}
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

            <section className="bg-white/5 border border-white/10 rounded-3xl p-5 shadow-xl text-white lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto">
              <Outlet />
            </section>
          </div>
        )}
      </main>

      <footer className="relative border-t border-white/10 bg-[#0B0F19]/70 backdrop-blur-xl mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-5 text-sm text-white/60 flex items-center justify-between gap-3 flex-wrap">
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
