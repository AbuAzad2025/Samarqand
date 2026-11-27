import { Phone, MapPin } from "lucide-react";
import { Link } from "react-router";
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

  const hasContact = phones.length > 0 || Boolean(company?.address?.trim());

  return (
    <div className="text-white">
      <div className="h-1 bg-gradient-to-r from-sq-red via-sq-black to-sq-green" />
      <div className="bg-[#0D131D] py-2 sm:py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 text-xs sm:min-h-[36px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:text-sm">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-x-6 sm:gap-y-1">
            {phones.length ? (
              <div className="flex min-w-0 items-center gap-2">
                <Phone size={16} className="shrink-0 text-white/70" aria-hidden="true" />
                <span className="sr-only">الهاتف:</span>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" dir="ltr">
                  {phones.slice(0, 2).map((phone, index) => (
                    <span key={phone} className="inline-flex items-center gap-3">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-white/60">|</span>
                      ) : null}
                      <a
                        href={`tel:${phone.replace(/\s+/g, "")}`}
                        className="whitespace-nowrap font-medium transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {phone}
                      </a>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {company?.address ? (
              <div className="flex min-w-0 items-start gap-2 sm:items-center">
                <MapPin size={16} className="mt-0.5 shrink-0 text-white/70 sm:mt-0" aria-hidden="true" />
                <span className="min-w-0 truncate font-medium" title={company.address}>
                  {company.address}
                </span>
              </div>
            ) : null}

            {!hasContact ? (
              <Link
                to="/contact"
                className="font-medium text-white/90 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                تواصل معنا
              </Link>
            ) : null}
          </div>

          {company?.topbarSlogan ? (
            <p className="hidden shrink-0 text-sm font-medium text-white/80 lg:block">
              {company.topbarSlogan}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
