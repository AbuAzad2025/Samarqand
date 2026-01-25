import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from "react";

import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";

export default function WhatsAppButton() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);

  const v = config?.visibility;
  if (!(v?.showWhatsAppButton ?? true)) return null;

  const phone = (company?.phone1 || "").replace(/\D/g, "");

  return (
    <a
      href={phone ? `https://wa.me/${phone}` : "/contact"}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-8 left-8 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:bg-[#20BA5A] transition-all hover:scale-110 z-50"
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle size={28} />
    </a>
  );
}
