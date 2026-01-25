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
    return list.length ? list : ["00970 000 0000"];
  }, [company?.phone1, company?.phone2]);

  return (
    <div className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white py-3">
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-sm">
        <div className="flex gap-6">
          <div className="flex items-center gap-4">
            <Phone size={16} />
            <div className="flex items-center gap-3" dir="ltr">
              {phones.slice(0, 2).map((p) => (
                <a
                  key={p}
                  href={`tel:${p.replace(/\\s+/g, "")}`}
                  className="font-medium hover:text-gray-100 transition"
                >
                  {p}
                </a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={16} />
            <span className="font-medium">{company?.address || "فلسطين"}</span>
          </div>
        </div>
        <div className="text-sm font-medium">
          {company?.topbarSlogan || "نحن نؤمن بجودة العمل والإلتزام بالمواعيد الإنشائية"}
        </div>
      </div>
    </div>
  );
}
