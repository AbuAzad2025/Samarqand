import { Phone, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from "react";

import { fetchCompany, type CompanyPayload } from "@/react-app/api/site";

export default function TopBar() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  const phones = useMemo(() => {
    const list = [company?.phone1, company?.phone2].filter(
      (p): p is string => Boolean(p && String(p).trim()),
    );
    return list;
  }, [company?.phone1, company?.phone2]);

  return (
    <div className="text-white">
      <div className="h-1 bg-gradient-to-r from-sq-red via-sq-black to-sq-green" />
      <div className="bg-[#0D131D] py-2 sm:py-3">
      <div className="mx-auto flex min-h-[52px] max-w-7xl flex-wrap items-center justify-between gap-2 px-4 text-xs sm:min-h-[36px] sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {phones.length ? (
            <div className="flex items-center gap-4">
              <Phone size={16} />
              <div className="flex items-center gap-3" dir="ltr">
                {phones.slice(0, 2).map((p) => (
                  <a
                    key={p}
                    href={`tel:${p.replace(/\s+/g, "")}`}
                    className="font-medium hover:text-gray-100 transition"
                  >
                    {p}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {company?.address ? (
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span className="font-medium">{company.address}</span>
            </div>
          ) : null}
        </div>
        {company?.topbarSlogan ? (
          <div className="hidden text-sm font-medium lg:block">{company.topbarSlogan}</div>
        ) : null}
      </div>
    </div>
    </div>
  );
}
