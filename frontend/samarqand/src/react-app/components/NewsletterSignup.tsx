import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Mail, Send, X } from "lucide-react";

import { fetchCompany, fetchHomeSettings, type CompanyPayload } from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";

const DISMISS_KEY = "sq-newsletter-dismissed";

type Status = { kind: "success" | "error"; message: string } | null;

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [dismissed, setDismissed] = useState(false);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [home, setHome] = useState<{
    newsletterTitle?: string;
    newsletterSubtitle?: string;
  } | null>(null);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // Storage can be unavailable in private mode; the section still works.
    }
    let active = true;
    fetchCompany().then((data) => { if (active) setCompany(data); }).catch(() => {});
    fetchHomeSettings().then((data) => { if (active) setHome(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
  }

  function restore() {
    setEmail("");
    setStatus(null);
    setDismissed(false);
    try {
      window.sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus({ kind: "error", message: "يرجى إدخال بريد إلكتروني صحيح." });
      return;
    }

    const link = whatsappUrl(
      company?.phone1,
      `اشتراك جديد في النشرة الإخبارية: ${value}`,
    );
    if (!link) {
      setStatus({
        kind: "error",
        message: "رقم التواصل غير متاح حالياً. يمكنك إرسال طلبك عبر صفحة اتصل بنا.",
      });
      return;
    }

    const popup = window.open(link, "_blank");
    if (!popup) {
      setStatus({
        kind: "error",
        message: "تعذّر فتح واتساب. اسمح بالنوافذ المنبثقة أو تواصل معنا عبر صفحة اتصل بنا.",
      });
      return;
    }
    try {
      popup.opener = null;
    } catch {
      // Cross-origin windows may reject this; the link itself is safe.
    }
    setStatus({
      kind: "success",
      message: "تم فتح واتساب برسالة جاهزة؛ أرسلها لإتمام طلب الاشتراك.",
    });
    setEmail("");
  }

  if (dismissed) {
    return (
      <section className="section-corp-muted" dir="rtl">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-[var(--corp-muted)]">
            تم إخفاء نموذج الاشتراك. يمكنك التواصل معنا مباشرة في أي وقت.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/contact"
              className="btn-corp-secondary text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
            >
              صفحة التواصل
            </Link>
            <button
              type="button"
              onClick={restore}
              className="btn-corp-link text-sm font-bold focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
            >
              إظهار النموذج
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative bg-gradient-to-r from-sq-green via-sq-black to-sq-red py-16"
      dir="rtl"
      aria-labelledby="newsletter-heading"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء نموذج الاشتراك"
        className="absolute left-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white"
      >
        <X size={18} aria-hidden="true" />
      </button>

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-block rounded-full bg-white/20 p-4">
            <Mail size={40} className="text-white" aria-hidden="true" />
          </div>

          <h2 id="newsletter-heading" className="mb-3 text-3xl font-bold text-white md:text-4xl">
            {home?.newsletterTitle || "اشترك في نشرتنا الإخبارية"}
          </h2>
          <p className="mb-6 text-lg text-white/90">
            {home?.newsletterSubtitle || "احصل على آخر العروض والنصائح الهندسية مباشرة على بريدك"}
          </p>

          {status && (
            <div
              role={status.kind === "error" ? "alert" : "status"}
              className={`mx-auto mb-5 max-w-xl rounded-lg px-4 py-3 text-sm font-semibold ${
                status.kind === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-white text-[#8a1020]"
              }`}
            >
              {status.message}
              {status.kind === "error" ? (
                <Link to="/contact" className="ms-2 underline underline-offset-2">
                  افتح صفحة التواصل
                </Link>
              ) : null}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mx-auto flex max-w-xl flex-col gap-4 md:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              البريد الإلكتروني للاشتراك في النشرة
            </label>
            <input
              id="newsletter-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (status) setStatus(null);
              }}
              placeholder="أدخل بريدك الإلكتروني"
              aria-describedby="newsletter-note"
              aria-invalid={status?.kind === "error" ? true : undefined}
              className="flex-1 rounded-lg px-5 py-4 text-gray-800 focus:outline-none focus:ring-4 focus:ring-white/50"
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-7 py-4 font-bold text-sq-green transition hover:bg-gray-100 focus-visible:ring-4 focus-visible:ring-white/60"
            >
              <span>اشترك الآن</span>
              <Send size={20} aria-hidden="true" />
            </button>
          </form>

          <p id="newsletter-note" className="mt-5 text-sm text-white/75">
            لا يُحفظ بريدك في هذا الموقع؛ تتم المشاركة عبر واتساب فقط عند إرسالك للرسالة.
          </p>
        </div>
      </div>
    </section>
  );
}
