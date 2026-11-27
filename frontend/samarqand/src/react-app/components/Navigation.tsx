import { ArrowLeft, Menu, Phone, Search, X } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useEffect, useRef, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import BrandMark from "@/react-app/components/BrandMark";

type NavItem = { to: string; label: string; show: boolean };

const MENU_ID = "main-mobile-menu";
const SEARCH_ID = "main-site-search";

export default function Navigation() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  // A new route always starts with the transient panels closed.
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Escape closes whichever panel is open and returns focus to its trigger.
  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      } else {
        setSearchOpen(false);
        setQuery("");
        searchButtonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, searchOpen]);

  const v = config?.visibility;
  const items: NavItem[] = [
    { to: "/", label: "الرئيسية", show: true },
    { to: "/about", label: "من نحن", show: v?.showAbout ?? true },
    { to: "/projects", label: "مشاريعنا", show: v?.showProjects ?? true },
    { to: "/showcase", label: "معرض الأعمال", show: v?.showShowcase ?? true },
    { to: "/services", label: "خدماتنا", show: v?.showServices ?? true },
    { to: "/tools", label: "الأدوات الذكية", show: v?.showTools ?? true },
    { to: "/contact", label: "تواصل معنا", show: v?.showContact ?? true },
  ].filter((item) => item.show);

  function toggleMenu() {
    if (!menuOpen) setSearchOpen(false);
    setMenuOpen(!menuOpen);
  }

  function toggleSearch() {
    if (!searchOpen) setMenuOpen(false);
    setSearchOpen(!searchOpen);
  }

  function navLink(item: NavItem) {
    const active = pathname === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={active ? "page" : undefined}
        className={`nav-flash group relative overflow-hidden rounded-full px-2.5 py-1.5 text-[13px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green ${
          active
            ? "bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white shadow-lg shadow-sq-black/20"
            : "text-slate-700 hover:bg-gradient-to-r hover:from-sq-green hover:via-sq-black hover:to-sq-red hover:text-white hover:-translate-y-0.5 hover:shadow-lg"
        }`}
      >
        <span className="nav-flash-shine pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        <span className="relative">{item.label}</span>
      </Link>
    );
  }

  return (
    <nav aria-label="التنقل الرئيسي" className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-lg">
      <div className="h-1 bg-gradient-to-r from-sq-red via-sq-black to-sq-green" />
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-20 items-center justify-between gap-3">
          {/* Brand — right side in RTL */}
          <Link
            to="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-sq-green via-sq-black to-sq-red p-0.5 shadow-lg">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
                <BrandMark
                  logoUrl={company?.logoUrl || undefined}
                  label={company?.name ? `شعار ${company.name}` : "شعار سمر قند"}
                  size={44}
                  className="h-10 w-10 object-contain"
                />
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="bg-gradient-to-l from-sq-green to-sq-red bg-clip-text text-xl font-extrabold leading-tight text-transparent">
                {company?.brandTitle || "سمر قند"}
              </div>
              <div className="max-w-[220px] truncate text-[11px] font-medium text-slate-500">
                {company?.brandSubtitle ||
                  "مقاولات عامة • استشارات هندسية • تصاميم معمارية"}
              </div>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {items.map(navLink)}
          </div>

          {/* Actions — left side in RTL */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              ref={searchButtonRef}
              type="button"
              aria-label={searchOpen ? "إغلاق البحث" : "بحث"}
              aria-expanded={searchOpen}
              aria-controls={SEARCH_ID}
              onClick={toggleSearch}
              className={`rounded-full border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green ${
                searchOpen
                  ? "border-sq-green text-sq-green"
                  : "border-slate-200 text-slate-600 hover:border-sq-green hover:text-sq-green"
              }`}
            >
              <Search size={19} aria-hidden="true" />
            </button>
            <Link
              to="/request-quote"
              className="nav-flash group relative hidden overflow-hidden rounded-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-sq-black/20 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green lg:inline-flex lg:items-center lg:gap-2"
            >
              <span className="nav-flash-shine pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              <Phone size={15} className="relative" aria-hidden="true" />
              <span className="relative">اطلب عرض سعر</span>
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen}
              aria-controls={MENU_ID}
              onClick={toggleMenu}
              className="rounded-full border border-slate-200 p-2 text-slate-700 transition hover:border-sq-green hover:text-sq-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green lg:hidden"
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div id={SEARCH_ID} hidden={!searchOpen} className="border-t border-slate-100 py-3" dir="rtl">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث في صفحات الموقع..."
            aria-label="ابحث في صفحات الموقع"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-sq-green focus:outline-none focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-1"
          />
          <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
            {items
              .filter((item) => item.label.includes(query.trim()))
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-sq-green transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
                >
                  {item.label}
                </Link>
              ))}
            {!items.some((item) => item.label.includes(query.trim())) ? (
              <span className="text-sm text-slate-500">لا توجد نتائج.</span>
            ) : null}
          </div>
        </div>

        <div id={MENU_ID} hidden={!menuOpen} className="border-t border-slate-100 py-3 lg:hidden" dir="rtl">
          <ul className="flex flex-col gap-1" aria-label="روابط التنقل">
            {items.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green ${
                      active
                        ? "bg-emerald-50 text-sq-green"
                        : "text-slate-700 hover:bg-slate-100 hover:text-sq-green"
                    }`}
                  >
                    <span>{item.label}</span>
                    <ArrowLeft size={16} className="text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 border-t border-slate-100 pt-3">
              <Link
                to="/request-quote"
                onClick={() => setMenuOpen(false)}
                className="btn-corp-primary w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
              >
                <Phone size={16} aria-hidden="true" />
                اطلب عرض سعر
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
