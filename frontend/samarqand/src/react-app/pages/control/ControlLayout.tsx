import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenText,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
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
  type LucideIcon,
} from "lucide-react";

import { fetchAuthMe, fetchSiteConfig, logout } from "@/react-app/api/site";

const PROJECT_MANAGER_GROUPS = [
  "Project Managers",
  "PMO",
  "مدراء المشاريع",
  "مدير مشروع",
  "مدير المشاريع",
];

type NavItem = { to: string; label: string; icon: LucideIcon; show: boolean };
type GroupKey =
  | "operations"
  | "projects"
  | "files"
  | "content"
  | "settings"
  | "system";

const GROUP_TITLES: Record<GroupKey, string> = {
  operations: "العمليات اليومية",
  projects: "المشاريع والعقود",
  files: "الملفات والوسائط",
  content: "محتوى الموقع",
  settings: "الإعدادات",
  system: "النظام والحساب",
};

const DEFAULT_GROUP_ORDER: GroupKey[] = [
  "operations",
  "projects",
  "files",
  "content",
  "settings",
  "system",
];

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
  const [collapsedGroups, setCollapsedGroups] = useState<GroupKey[]>([]);
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

  useEffect(() => {
    if (!me?.authenticated) return;
    const reqId = ++visibilityRequestId.current;
    // Public config carries this flag; the admin endpoint is manager-only and
    // would raise a 403 for every other role.
    fetchSiteConfig()
      .then((config) => {
        if (reqId !== visibilityRequestId.current) return;
        setShowControlProjectsManagement(
          Boolean(config.visibility.showControlProjectsManagement),
        );
      })
      .catch(() => {});
  }, [me?.authenticated]);

  // One source of truth: the same access map drives both the route guard and
  // the menu, so a link can never appear for a path the user cannot open.
  const access = useMemo(() => {
    const role = me?.role || "anonymous";
    const groups = new Set(
      (me?.groups || []).map((g) => String(g || "").trim()).filter(Boolean),
    );
    const superuser = Boolean(me?.isSuperuser);
    const manager = superuser || role === "manager" || groups.has("Managers");
    const projectRole = manager || PROJECT_MANAGER_GROUPS.some((g) => groups.has(g));
    const registrar = manager || role === "registrar" || groups.has("Registrars");
    const accountant = manager || role === "accountant" || groups.has("Accountants");
    const employee = role === "employee" || groups.has("Employees");
    const canProjects = projectRole && (superuser || manager || showControlProjectsManagement);
    const canDelivery = projectRole || accountant || registrar;

    return {
      superuser,
      manager,
      registrar,
      accountant,
      employee,
      projectRole,
      canOps: manager || accountant || registrar || employee,
      canProjects,
      canBoq: canDelivery,
      canFieldDocs: canDelivery,
      canRfq: canDelivery,
      canHr: manager,
      canFleet: manager || registrar,
      canMail: manager || registrar,
      canCompanyDocs: accountant || registrar,
      canMedia: manager || registrar,
      canUsers: superuser,
      canAudit: manager,
      canBackup: superuser,
    };
  }, [me, showControlProjectsManagement]);

  useEffect(() => {
    if (meLoading || !me) return;
    const pathname = location.pathname || "";
    const isAllowedPath =
      pathname === "/control" ||
      pathname.startsWith("/control/dashboard") ||
      pathname.startsWith("/control/password") ||
      pathname.startsWith("/control/settings/security") ||
      (pathname.startsWith("/control/ops") && access.canOps) ||
      (pathname.startsWith("/control/leads") && access.manager) ||
      (pathname.startsWith("/control/projects") && access.canProjects) ||
      (pathname.startsWith("/control/rfq") && access.canRfq) ||
      (pathname.startsWith("/control/boq") && access.canBoq) ||
      (pathname.startsWith("/control/field-docs") && access.canFieldDocs) ||
      (pathname.startsWith("/control/hr") && access.canHr) ||
      (pathname.startsWith("/control/fleet") && access.canFleet) ||
      (pathname.startsWith("/control/mail") && access.canMail) ||
      (pathname.startsWith("/control/media") && access.canMedia) ||
      (pathname.startsWith("/control/company-documents") && access.canCompanyDocs) ||
      (pathname.startsWith("/control/services") && access.manager) ||
      (pathname.startsWith("/control/blogs") && access.manager) ||
      (pathname.startsWith("/control/testimonials") && access.manager) ||
      (pathname.startsWith("/control/home-sections") && access.manager) ||
      (pathname.startsWith("/control/pages") && access.manager) ||
      (pathname.startsWith("/control/settings") && access.manager) ||
      (pathname.startsWith("/control/team") && access.manager) ||
      (pathname.startsWith("/control/users") && access.canUsers) ||
      (pathname.startsWith("/control/backup") && access.canBackup);

    if (pathname.startsWith("/control/login")) {
      if (me.authenticated && me.isStaff) {
        navigate("/control/dashboard", { replace: true });
      }
      return;
    }
    if (!me.authenticated || !me.isStaff) {
      navigate("/control/login", { replace: true });
      return;
    }
    if (!isAllowedPath) {
      navigate("/control/dashboard", { replace: true });
    }
  }, [location.pathname, me, meLoading, navigate, access]);

  async function onLogout() {
    await logout().catch(() => {});
    setMe({ authenticated: false, username: "", isSuperuser: false, isStaff: false, role: "anonymous", groups: [] });
    navigate("/control/login", { replace: true });
  }

  const roleLabel = useMemo(() => {
    if (access.superuser) return "سوبر أدمن";
    const role = me?.role || "";
    if (role === "manager" || access.manager) return "مدير";
    if (role === "accountant") return "محاسب";
    if (role === "registrar") return "مسجل";
    if (role === "employee") return "موظف";
    if (role === "registered_guest") return "ضيف مسجل";
    if (role === "guest") return "ضيف";
    return "موظف";
  }, [access.superuser, access.manager, me?.role]);

  const pathname = location.pathname || "";
  const isActive = useCallback(
    (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    [pathname],
  );

  const navGroups = useMemo(() => {
    const groups: Record<GroupKey, NavItem[]> = {
      operations: [
        { to: "/control/ops", label: "العمليات والموارد", icon: ClipboardList, show: access.canOps },
        { to: "/control/leads", label: "العملاء المحتملون", icon: UsersRound, show: access.manager },
        { to: "/control/hr", label: "الموارد البشرية", icon: UserCog, show: access.canHr },
        { to: "/control/fleet", label: "المركبات", icon: Truck, show: access.canFleet },
        { to: "/control/mail", label: "البريد", icon: Mail, show: access.canMail },
      ],
      projects: [
        { to: "/control/projects", label: "المشاريع", icon: BriefcaseBusiness, show: access.canProjects },
        { to: "/control/boq", label: "بنود الكميات", icon: FileSpreadsheet, show: access.canBoq },
        { to: "/control/field-docs", label: "التوثيق الميداني", icon: ClipboardList, show: access.canFieldDocs },
        { to: "/control/rfq", label: "عروض الأسعار", icon: FileText, show: access.canRfq },
      ],
      files: [
        { to: "/control/company-documents", label: "وثائق الشركة", icon: FolderOpen, show: access.canCompanyDocs },
        { to: "/control/media", label: "المكتبة", icon: ImageIcon, show: access.canMedia },
      ],
      content: [
        { to: "/control/home-sections", label: "أقسام الرئيسية", icon: Building2, show: access.manager },
        { to: "/control/services", label: "الخدمات", icon: Boxes, show: access.manager },
        { to: "/control/pages", label: "الصفحات", icon: FileText, show: access.manager },
        { to: "/control/team", label: "فريق العمل", icon: UsersRound, show: access.manager },
        { to: "/control/blogs", label: "المدونات", icon: BookOpenText, show: access.manager },
        { to: "/control/testimonials", label: "آراء العملاء", icon: UsersRound, show: access.manager },
      ],
      settings: [
        { to: "/control/settings/company", label: "بيانات الشركة", icon: Building2, show: access.manager },
        { to: "/control/settings/content", label: "نصوص الواجهة", icon: FileText, show: access.manager },
        { to: "/control/settings/visibility", label: "إظهار الأقسام", icon: Settings, show: access.manager },
        { to: "/control/settings/security", label: "أمان الحساب", icon: LockKeyhole, show: true },
        { to: "/control/settings/home", label: "الشعار والهيرو", icon: ImageIcon, show: access.manager },
        { to: "/control/settings/ai", label: "الذكاء الاصطناعي", icon: Wrench, show: access.manager },
        { to: "/control/settings/calculator", label: "الحاسبة", icon: BarChart3, show: access.manager },
      ],
      system: [
        { to: "/control/ops?tab=audit", label: "سجل التدقيق", icon: Shield, show: access.canAudit },
        { to: "/control/users", label: "المستخدمون", icon: Users, show: access.canUsers },
        { to: "/control/backup", label: "نسخ احتياطي", icon: Shield, show: access.canBackup },
        { to: "/control/password", label: "كلمة المرور", icon: LockKeyhole, show: true },
      ],
    };

    let order = DEFAULT_GROUP_ORDER;
    if (access.projectRole && !access.manager) {
      order = ["projects", "operations", "files", "content", "settings", "system"];
    } else if (access.registrar && !access.manager) {
      order = ["operations", "files", "projects", "content", "settings", "system"];
    }

    return order
      .map((key) => ({
        key,
        title: GROUP_TITLES[key],
        items: groups[key].filter((it) => it.show),
      }))
      .filter((g) => g.items.length > 0);
  }, [access]);

  const quickLinks = useMemo(() => {
    let preferred: string[];
    if (access.superuser || access.manager) {
      preferred = ["/control/dashboard", "/control/ops", "/control/leads", "/control/projects", "/control/settings/content", "/control/backup"];
    } else if (access.projectRole) {
      preferred = ["/control/dashboard", "/control/projects", "/control/boq", "/control/field-docs"];
    } else if (access.accountant) {
      preferred = ["/control/dashboard", "/control/ops", "/control/boq", "/control/rfq"];
    } else if (access.registrar) {
      preferred = ["/control/dashboard", "/control/ops", "/control/hr", "/control/mail"];
    } else {
      preferred = ["/control/dashboard", "/control/ops"];
    }
    const all = [
      { to: "/control/dashboard", label: "الرئيسية", icon: LayoutDashboard },
      ...navGroups.flatMap((g) => g.items),
    ];
    return preferred
      .map((path) => all.find((it) => it.to === path))
      .filter((it): it is (typeof all)[number] => Boolean(it))
      .slice(0, 5);
  }, [access, navGroups]);

  function toggleGroup(key: GroupKey) {
    setCollapsedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const isLogin = pathname.startsWith("/control/login");

  return (
    <div className="min-h-screen bg-sq-black text-white" dir="rtl">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-64 -left-52 w-[620px] h-[620px] rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-20 w-[520px] h-[520px] rounded-full bg-slate-500/20 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-sq-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/control/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sq-green via-sq-black to-sq-red flex items-center justify-center shadow-lg shrink-0">
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
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sq-green to-sq-red flex items-center justify-center text-sm font-extrabold shrink-0">
                    {String(me.username || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="leading-tight">
                    <div className="font-bold text-white text-sm">{me.username}</div>
                    <div className="text-[11px] text-white/60">{roleLabel || "—"}</div>
                  </div>
                </div>
                <Link
                  to="/control/password"
                  aria-label="تغيير كلمة المرور"
                  title="تغيير كلمة المرور"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/90 text-sm"
                >
                  <LockKeyhole size={16} />
                  <span className="hidden lg:inline">كلمة المرور</span>
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="تسجيل الخروج"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white text-sm font-extrabold shadow-lg hover:shadow-xl transition"
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
              aria-label={mobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {!isLogin && quickLinks.length > 2 && (
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

      <div className="relative max-w-7xl mx-auto px-4 py-4">
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
                      <div className="text-xs text-white/60 mt-1">{roleLabel} · حسب صلاحياتك</div>
                    </div>
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sq-green/40 via-white/5 to-sq-red/40 flex items-center justify-center border border-white/10">
                      <Activity size={16} />
                    </div>
                  </div>
                </div>

                <nav className="p-3 space-y-2">
                  <Link
                    to="/control/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition ${
                      isActive("/control/dashboard")
                        ? "bg-gradient-to-r from-sq-green/25 via-white/5 to-sq-red/25 border-white/20 text-white shadow-sm"
                        : "bg-white/0 border-white/0 text-white/85 hover:bg-white/5 hover:border-white/10 hover:text-white"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center border bg-white/10 border-white/15">
                      <LayoutDashboard size={16} />
                    </div>
                    <span className="font-bold text-sm truncate">لوحة التحكم</span>
                  </Link>

                  {navGroups.map((g) => {
                    const collapsed = collapsedGroups.includes(g.key);
                    return (
                      <div key={g.key} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          aria-expanded={!collapsed}
                          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[11px] font-extrabold tracking-wide text-white/50 hover:text-white/80 transition"
                        >
                          <span>{g.title}</span>
                          <ChevronDown
                            size={14}
                            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                          />
                        </button>
                        {!collapsed && (
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
                                      ? "bg-gradient-to-r from-sq-green/25 via-white/5 to-sq-red/25 border-white/20 text-white shadow-sm"
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
                        )}
                      </div>
                    );
                  })}
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
      </div>

      <footer className="relative border-t border-white/10 bg-sq-black/70 backdrop-blur-xl mt-auto">
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
            <span className="text-white/60">|</span>
            <Link to="/control/password" className="hover:text-white transition">
              كلمة المرور
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
