import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";
import { useFooterVisible } from "@/react-app/utils/useFooterVisible";

const DISMISS_KEY = "sq-whatsapp-dismissed";

export default function WhatsAppButton() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const footerVisible = useFooterVisible();

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showWhatsAppButton ?? true) || dismissed || footerVisible) return null;

  const rawLink = whatsappUrl(company?.phone1) || "/contact";
  const external = /^https?:\/\//i.test(rawLink);

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage can be unavailable; closing the button still works for this render.
    }
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2 sm:bottom-6 sm:left-6 sm:flex-row sm:items-center" dir="rtl">
      <a
        href={rawLink}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        aria-label="تواصل عبر واتساب"
        title="تواصل عبر واتساب"
        className="inline-flex items-center gap-2 rounded-full bg-sq-whatsapp py-2.5 pr-2.5 pl-3 text-slate-900 shadow-lg transition hover:bg-sq-whatsapp-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:pl-5"
      >
        <MessageCircle size={24} className="shrink-0" aria-hidden="true" />
        <span className="hidden text-sm font-bold sm:inline">تواصل عبر واتساب</span>
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إغلاق زر واتساب"
        title="إغلاق"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
