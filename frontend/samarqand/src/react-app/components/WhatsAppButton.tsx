import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";
import { useFooterVisible } from "@/react-app/utils/useFooterVisible";

export default function WhatsAppButton() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const footerVisible = useFooterVisible();

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showWhatsAppButton ?? true)) return null;

  const waLink = whatsappUrl(company?.phone1) || "/contact";

  return (
    <a
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-8 left-8 bg-sq-whatsapp text-white p-4 rounded-full shadow-lg hover:bg-sq-whatsapp-hover transition-all hover:scale-110 z-50 ${footerVisible ? "opacity-0 pointer-events-none" : ""}`}
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle size={28} />
    </a>
  );
}
