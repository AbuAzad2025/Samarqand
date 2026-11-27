import { Building2, ClipboardCheck, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { useEffect, useMemo, useState } from "react";

import { fetchServices, type ServicePayload } from "@/react-app/api/site";

const iconMap = {
  Building2,
  ClipboardCheck,
  Pencil,
};

export default function Services({ showHeading = true }: { showHeading?: boolean }) {
  const [items, setItems] = useState<ServicePayload[]>([]);

  useEffect(() => {
    fetchServices().then(setItems).catch(() => {});
  }, []);

  const iconKeys = useMemo(
    () => Object.keys(iconMap) as (keyof typeof iconMap)[],
    [],
  );

  return (
    <section id="services" className="section-corp">
      <div className="max-w-7xl mx-auto px-4" dir="rtl">
        {showHeading ? (
          <>
            <h2 className="text-4xl font-bold text-center mb-4 text-slate-900">
              خدماتنا
            </h2>
            <p className="text-center text-gray-600 mb-16 text-lg">نقدم خدمات متكاملة في مجال المقاولات والهندسة</p>
          </>
        ) : null}
        
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((service, idx) => {
            const IconComponent =
              iconMap[iconKeys[idx % iconKeys.length]] ?? Building2;
            
            return (
              <div key={service.id} className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-all hover:-translate-y-2 duration-300">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                  <IconComponent className="text-white" size={32} />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{service.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{service.description}</p>
                
                <Link
                  to="/contact"
                  className="inline-block text-sq-green font-semibold hover:text-sq-green transition"
                >
                  اطلب الخدمة ←
                </Link>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <Link
            to="/contact"
            className="btn-corp-primary font-bold hover:shadow-lg hover:scale-105 transition-all text-lg"
          >
            احصل على استشارة مجانية
          </Link>
        </div>
      </div>
    </section>
  );
}
