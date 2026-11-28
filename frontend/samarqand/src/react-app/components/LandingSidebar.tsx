import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardList,
  Compass,
  FileText,
  Home,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LockKeyhole,
  LogIn,
  Mail,
  Menu,
  MessageSquareText,
  Sparkles,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { fetchAuthMe, type SiteConfigPayload } from "@/react-app/api/site";

type Visibility = SiteConfigPayload["visibility"];
type AuthState = { authenticated: boolean; isStaff: boolean } | null;
type Entry = {
  label: string;
  to: string;
  icon: LucideIcon;
  show: true | keyof Visibility | ((auth: AuthState) => boolean);
};

const SECTION_IDS = [
  "home",
  "services",
  "projects",
  "tools",
  "rfq-templates",
  "testimonials",
  "contact",
] as const;

// Static navigation data; visibility/auth filters are applied once per change.
const SIDEBAR_GROUPS: readonly { title: string; items: readonly Entry[] }[] = [
  {
    title: "الحساب",
    items: [
      { label: "تسجيل الدخول", to: "/control/login", icon: LogIn, show: (auth) => auth !== null && !auth.authenticated },
      { label: "لوحة التحكم", to: "/control/dashboard", icon: LayoutDashboard, show: (auth) => Boolean(auth?.authenticated && auth.isStaff) },
      { label: "كلمة المرور", to: "/control/password", icon: LockKeyhole, show: (auth) => Boolean(auth?.authenticated && auth.isStaff) },
    ],
  },
  {
    title: "ابدأ من هنا",
    items: [
      { label: "الرئيسية", to: "#home", icon: Home, show: true },
      { label: "من نحن", to: "/about", icon: Info, show: true },
      { label: "اتصل بنا", to: "#contact", icon: Mail, show: "showNewsletter" },
    ],
  },
  {
    title: "خدماتنا وأعمالنا",
    items: [
      { label: "الخدمات", to: "#services", icon: Wrench, show: "showServices" },
      { label: "المشاريع", to: "#projects", icon: BriefcaseBusiness, show: "showProjects" },
      { label: "معرض الأعمال", to: "/showcase", icon: LayoutGrid, show: "showShowcase" },
    ],
  },
  {
    title: "أدوات وطلبات",
    items: [
      { label: "الأدوات الذكية", to: "#tools", icon: Sparkles, show: "showTools" },
      { label: "نماذج العروض", to: "#rfq-templates", icon: ClipboardList, show: "showRfqTemplates" },
      { label: "طلب عرض سعر", to: "/request-quote", icon: ArrowUpRight, show: true },
    ],
  },
  {
    title: "استكشف الموقع",
    items: [
      { label: "آراء العملاء", to: "#testimonials", icon: MessageSquareText, show: "showTestimonials" },
      { label: "فريق العمل", to: "/about", icon: UsersRound, show: "showTeam" },
      { label: "المدونة", to: "/blog", icon: FileText, show: true },
      { label: "الفعاليات", to: "/events", icon: Compass, show: true },
      { label: "مواقعنا", to: "/locations", icon: Compass, show: true },
      { label: "بحث في الموقع", to: "/search", icon: Compass, show: true },
    ],
  },
];

export default function LandingSidebar({
  visibility,
}: {
  visibility?: SiteConfigPayload["visibility"];
}) {
  const [active, setActive] = useState("#home");
  const [open, setOpen] = useState(false);
  // The longest group starts collapsed so the guide fits most screens.
  const [collapsed, setCollapsed] = useState<string[]>(["استكشف الموقع"]);
  const navRef = useRef<HTMLElement>(null);
  const [auth, setAuth] = useState<AuthState>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let activeRequest = true;
    fetchAuthMe()
      .then((me) => {
        if (!activeRequest) return;
        setAuth({
          authenticated: Boolean(me.authenticated),
          isStaff: Boolean(me.isStaff),
        });
      })
      .catch(() => {
        if (activeRequest) setAuth({ authenticated: false, isStaff: false });
      });
    return () => {
      activeRequest = false;
    };
  }, []);

  const closeSidebar = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (closeRef.current ?? dialog?.querySelector<HTMLElement>("a[href], button:not([disabled])"))?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSidebar();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.closest("[hidden]"));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeSidebar]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(`#${hit.target.id}`);
      },
      { rootMargin: "-110px 0px -65% 0px", threshold: 0 },
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const groups = useMemo(
    () =>
      SIDEBAR_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.show === true
            ? true
            : typeof item.show === "function"
              ? item.show(auth)
              : (visibility?.[item.show] ?? true),
        ),
      })).filter((group) => group.items.length > 0),
    [visibility, auth],
  );

  function toggleGroup(title: string) {
    setCollapsed((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title],
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح دليل الصفحة"
        aria-expanded={open}
        aria-controls="landing-sidebar"
        className="fixed right-4 top-32 z-40 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-md transition hover:border-sq-green hover:text-sq-green focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2 md:top-36"
      >
        <Menu size={16} aria-hidden="true" />
        <span className="hidden sm:inline">دليل الصفحة</span>
      </button>

      {open && (
        <>
          <div
            role="presentation"
            aria-hidden="true"
            onClick={closeSidebar}
            className="fixed inset-0 z-40 bg-sq-black/50"
          />
          <aside
            id="landing-sidebar"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-sidebar-title"
            className="fixed inset-y-0 right-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-[min(22rem,90vw)] flex-col bg-white text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div id="landing-sidebar-title" className="text-lg font-extrabold">
                  دليل الصفحة
                </div>
                <div className="text-xs text-slate-500">كل ما تحتاجه في مكان واحد</div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeSidebar}
                aria-label="إغلاق دليل الصفحة"
                className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sq-green"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav
              ref={navRef}
              aria-label="أقسام الصفحة"
              className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4"
            >
              {groups.map((group, groupIndex) => {
                const isCollapsed = collapsed.includes(group.title);
                const groupId = `landing-sidebar-group-${groupIndex}`;
                return (
                  <div key={group.title} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      aria-expanded={!isCollapsed}
                      aria-controls={groupId}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-extrabold text-slate-500 transition hover:text-sq-green focus-visible:ring-2 focus-visible:ring-sq-green"
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        size={12}
                        aria-hidden="true"
                        className={isCollapsed ? "-rotate-90" : ""}
                      />
                    </button>
                    <div id={groupId} hidden={isCollapsed} className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.to.startsWith("#") && active === item.to;
                        const content = (
                          <>
                            <Icon size={16} className="shrink-0" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold">{item.label}</span>
                          </>
                        );
                        const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition focus-visible:ring-2 focus-visible:ring-sq-green ${
                          isActive
                            ? "bg-emerald-50 text-sq-green"
                            : "text-slate-700 hover:bg-slate-50 hover:text-sq-green"
                        }`;
                        return item.to.startsWith("#") ? (
                          <a
                            key={item.to}
                            href={item.to}
                            onClick={closeSidebar}
                            aria-current={isActive ? "location" : undefined}
                            className={className}
                          >
                            {content}
                          </a>
                        ) : (
                          <Link key={item.to} to={item.to} onClick={closeSidebar} className={className}>
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
              <span className="text-xs text-slate-500">
                سياسة الخصوصية · شروط الاستخدام في تذييل الموقع.
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => navRef.current?.scrollBy({ top: -320, behavior: "smooth" })}
                  aria-label="التمرير إلى أعلى القائمة"
                  className="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sq-green"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => navRef.current?.scrollBy({ top: 320, behavior: "smooth" })}
                  aria-label="التمرير إلى أسفل القائمة"
                  className="rounded-lg border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sq-green"
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
