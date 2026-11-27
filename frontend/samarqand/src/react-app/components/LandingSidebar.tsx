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
  MessageSquareText,
  Sparkles,
  UsersRound,
  Wrench,
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
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [auth, setAuth] = useState<{
    authenticated: boolean;
    isStaff: boolean;
  } | null>(null);

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
    const ids = [
      "home",
      "services",
      "projects",
      "tools",
      "rfq-templates",
      "testimonials",
      "contact",
    ];
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
    {
      title: "الحساب",
      items: [
        {
          label: "تسجيل الدخول",
          to: "/control/login",
          icon: LogIn,
          show: !auth?.authenticated,
        },
        {
          label: "لوحة التحكم",
          to: "/control/dashboard",
          icon: LayoutDashboard,
          show: Boolean(auth?.authenticated && auth.isStaff),
        },
        {
          label: "كلمة المرور",
          to: "/control/password",
          icon: LockKeyhole,
          show: Boolean(auth?.authenticated && auth.isStaff),
        },
      ],
    },
  ].map((group) => ({ ...group, items: group.items.filter((item) => item.show) })).filter((group) => group.items.length);

  groups.sort((a, b) =>
    a.title === "الحساب" ? -1 : b.title === "الحساب" ? 1 : 0,
  );

  function toggleGroup(title: string) {
    setCollapsed((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title],
    );
  }

  return (
    <aside aria-label="دليل صفحة الرئيسية" className="lg:sticky lg:top-28 lg:self-start">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:max-h-[calc(100vh-380px)] lg:overflow-y-auto">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition"
        >
          <span className="font-extrabold text-slate-900">دليل الصفحة</span>
          <ChevronDown
            size={16}
            className={`text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>

        {open && (
          <nav className="p-3 space-y-4">
            {groups.map((group) => {
              const isCollapsed = collapsed.includes(group.title);
              return (
                <div key={group.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-extrabold text-slate-500 hover:text-sq-green transition"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      size={12}
                      className={isCollapsed ? "-rotate-90" : ""}
                    />
                  </button>
                  {!isCollapsed &&
                    group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.to.startsWith("#") && active === item.to;
                      const content = (
                        <>
                          <Icon size={15} className="shrink-0" />
                          <span className="font-semibold text-sm truncate">
                            {item.label}
                          </span>
                        </>
                      );
                      const className = `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition text-right ${
                        isActive
                          ? "bg-emerald-50 text-sq-green border border-emerald-200"
                          : "text-slate-700 hover:bg-slate-50 hover:text-sq-green border border-transparent"
                      }`;
                      return item.to.startsWith("#") ? (
                        <a
                          key={item.to}
                          href={item.to}
                          className={className}
                          aria-current={isActive ? "location" : undefined}
                        >
                          {content}
                        </a>
                      ) : (
                        <Link key={item.to} to={item.to} className={className}>
                          {content}
                        </Link>
                      );
                    })}
                </div>
              );
            })}

            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              سياسة الخصوصية · شروط الاستخدام متاحان في تذييل الموقع.
            </div>
          </nav>
        )}
      </div>
    </aside>
  );
}
