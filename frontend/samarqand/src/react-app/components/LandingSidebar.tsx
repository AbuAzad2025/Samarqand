import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
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

type Entry = {
  label: string;
  to: string;
  icon: LucideIcon;
  show: boolean;
};

export default function LandingSidebar({
  visibility,
}: {
  visibility?: SiteConfigPayload["visibility"];
}) {
  const [active, setActive] = useState("#home");
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [auth, setAuth] = useState<{ authenticated: boolean; isStaff: boolean } | null>(null);

  useEffect(() => {
    fetchAuthMe()
      .then((me) =>
        setAuth({
          authenticated: Boolean(me.authenticated),
          isStaff: Boolean(me.isStaff),
        }),
      )
      .catch(() => setAuth({ authenticated: false, isStaff: false }));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const ids = ["home", "services", "projects", "tools", "rfq-templates", "testimonials", "contact"];
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(`#${hit.target.id}`);
      },
      { rootMargin: "-110px 0px -65% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const groups: { title: string; items: Entry[] }[] = [
    {
      title: "الحساب",
      items: [
        { label: "تسجيل الدخول", to: "/control/login", icon: LogIn, show: !auth?.authenticated },
        { label: "لوحة التحكم", to: "/control/dashboard", icon: LayoutDashboard, show: Boolean(auth?.authenticated && auth.isStaff) },
        { label: "كلمة المرور", to: "/control/password", icon: LockKeyhole, show: Boolean(auth?.authenticated && auth.isStaff) },
      ],
    },
    {
      title: "ابدأ من هنا",
      items: [
        { label: "الرئيسية", to: "#home", icon: Home, show: true },
        { label: "من نحن", to: "/about", icon: Info, show: true },
        { label: "اتصل بنا", to: "#contact", icon: Mail, show: visibility?.showNewsletter ?? true },
      ],
    },
    {
      title: "خدماتنا وأعمالنا",
      items: [
        { label: "الخدمات", to: "#services", icon: Wrench, show: visibility?.showServices ?? true },
        { label: "المشاريع", to: "#projects", icon: BriefcaseBusiness, show: visibility?.showProjects ?? true },
        { label: "معرض الأعمال", to: "/showcase", icon: LayoutGrid, show: visibility?.showShowcase ?? true },
      ],
    },
    {
      title: "أدوات وطلبات",
      items: [
        { label: "الأدوات الذكية", to: "#tools", icon: Sparkles, show: visibility?.showTools ?? true },
        { label: "نماذج العروض", to: "#rfq-templates", icon: ClipboardList, show: visibility?.showRfqTemplates ?? true },
        { label: "طلب عرض سعر", to: "/request-quote", icon: ArrowUpRight, show: true },
      ],
    },
    {
      title: "استكشف الموقع",
      items: [
        { label: "آراء العملاء", to: "#testimonials", icon: MessageSquareText, show: visibility?.showTestimonials ?? true },
        { label: "فريق العمل", to: "/about", icon: UsersRound, show: visibility?.showTeam ?? true },
        { label: "المدونة", to: "/blog", icon: FileText, show: true },
        { label: "الفعاليات", to: "/events", icon: Compass, show: true },
        { label: "مواقعنا", to: "/locations", icon: Compass, show: true },
        { label: "بحث في الموقع", to: "/search", icon: Compass, show: true },
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter((item) => item.show) }))
    .filter((group) => group.items.length);

  function toggleGroup(title: string) {
    setCollapsed((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title],
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح دليل الصفحة"
        className="fixed inset-inline-start-4 top-32 z-40 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-md transition hover:border-sq-green hover:text-sq-green md:top-36"
      >
        <Menu size={16} aria-hidden="true" />
        <span className="hidden sm:inline">دليل الصفحة</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="إغلاق دليل الصفحة"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-sq-black/50"
          />
          <aside
            aria-label="دليل صفحة الرئيسية"
            className="fixed inset-block-0 inset-inline-end-0 z-50 flex w-[min(22rem,90vw)] flex-col bg-white text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-extrabold">دليل الصفحة</div>
                <div className="text-xs text-slate-500">كل ما تحتاجه في مكان واحد</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-4">
              {groups.map((group) => {
                const isCollapsed = collapsed.includes(group.title);
                return (
                  <div key={group.title} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      aria-expanded={!isCollapsed}
                      className="flex w-full items-center justify-between px-2 py-1 text-xs font-extrabold text-slate-500 hover:text-sq-green"
                    >
                      <span>{group.title}</span>
                      <ChevronDown size={12} className={isCollapsed ? "-rotate-90" : ""} />
                    </button>
                    {!isCollapsed &&
                      group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.to.startsWith("#") && active === item.to;
                        const content = (
                          <>
                            <Icon size={16} className="shrink-0" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold">{item.label}</span>
                          </>
                        );
                        const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition ${
                          isActive
                            ? "bg-emerald-50 text-sq-green"
                            : "text-slate-700 hover:bg-slate-50 hover:text-sq-green"
                        }`;
                        return item.to.startsWith("#") ? (
                          <a
                            key={item.to}
                            href={item.to}
                            onClick={() => setOpen(false)}
                            aria-current={isActive ? "location" : undefined}
                            className={className}
                          >
                            {content}
                          </a>
                        ) : (
                          <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={className}>
                            {content}
                          </Link>
                        );
                      })}
                  </div>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              سياسة الخصوصية · شروط الاستخدام في تذييل الموقع.
            </div>
          </aside>
        </>
      )}
    </>
  );
}
