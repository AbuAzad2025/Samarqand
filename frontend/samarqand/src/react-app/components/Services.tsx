import { Building2, ClipboardCheck, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { useEffect, useMemo, useState } from "react";

import { fetchServices, type ServicePayload } from "@/react-app/api/site";

const iconMap = {
  Building2,
  ClipboardCheck,
  Pencil,
};

export default function Services() {
  const [items, setItems] = useState<ServicePayload[]>([]);

  useEffect(() => {
    fetchServices().then(setItems).catch(() => {});
  }, []);

  const iconKeys = useMemo(
    () => Object.keys(iconMap) as (keyof typeof iconMap)[],
    [],
  );

  return (
    <section id="services" className="py-20 bg-gradient-to-b from-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4" dir="rtl">
        <h2 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] bg-clip-text text-transparent">
          خدماتنا
        </h2>
        <p className="text-center text-gray-600 mb-16 text-lg">نقدم خدمات متكاملة في مجال المقاولات والهندسة</p>
        
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((service, idx) => {
            const IconComponent =
              iconMap[iconKeys[idx % iconKeys.length]] ?? Building2;
            
            return (
              <div key={service.id} className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-all hover:-translate-y-2 duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126] rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <IconComponent className="text-white" size={32} />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{service.title}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">{service.description}</p>
                
                <Link
                  to="/contact"
                  className="inline-block text-[#007A3D] font-semibold hover:text-[#007A3D] transition"
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
            className="inline-block bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-10 py-4 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all text-lg"
          >
            احصل على استشارة مجانية
          </Link>
        </div>
      </div>
    </section>
  );
}
