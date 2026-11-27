import { ArrowLeft, Building2, ClipboardCheck, Pencil } from "lucide-react";
import { Link } from "react-router";
import { useEffect, useMemo, useState } from "react";

import { fetchServices, type ServicePayload } from "@/react-app/api/site";

const iconMap = {
  Building2,
  ClipboardCheck,
  Pencil,
};

export default function Services({ showHeading = true }: { showHeading?: boolean }) {
  const [items, setItems] = useState<ServicePayload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchServices()
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
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
            <p className="text-center text-gray-600 mb-16 text-lg">
              تعرّف على الخدمات المتاحة واطلب عرض سعر لما يناسب مشروعك.
            </p>
          </>
        ) : null}

        <div className="grid md:grid-cols-3 gap-8" aria-busy={loading}>
          {loading ? (
            <p role="status" className="md:col-span-3 text-center text-gray-600">
              جارٍ تحميل الخدمات…
            </p>
          ) : items.length === 0 ? (
            <div className="md:col-span-3 rounded-xl border border-gray-200 bg-white p-8 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                لا توجد خدمات منشورة حالياً
              </h3>
              <p className="text-gray-600 mb-4">
                يمكنك التواصل معنا لمعرفة المزيد عن الخدمات.
              </p>
              <Link
                to="/contact"
                className="font-bold text-sq-green hover:underline"
              >
                تواصل معنا
              </Link>
            </div>
          ) : (
            items.map((service, idx) => {
              const IconComponent =
                iconMap[iconKeys[idx % iconKeys.length]] ?? Building2;

              return (
                <div
                  key={service.id}
                  className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-all hover:-translate-y-2 duration-300"
                >
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-sq-green text-white">
                    <IconComponent size={32} aria-hidden="true" />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {service.description}
                  </p>

                  <Link
                    to="/request-quote"
                    className="inline-flex items-center gap-1 font-semibold text-sq-green hover:underline"
                  >
                    اطلب عرض سعر
                    <ArrowLeft size={16} aria-hidden="true" />
                  </Link>
                </div>
              );
            })
          )}
        </div>

        <div className="text-center mt-12">
          <Link
            to="/request-quote"
            className="btn-corp-primary font-bold hover:shadow-lg hover:scale-105 transition-all text-lg"
          >
            اطلب عرض سعر
          </Link>
        </div>
      </div>
    </section>
  );
}
