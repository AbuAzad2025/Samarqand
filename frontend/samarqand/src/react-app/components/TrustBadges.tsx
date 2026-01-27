import { Award, Shield, ThumbsUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeSections } from "@/react-app/api/site";

export default function TrustBadges() {
  const [items, setItems] = useState<
    { id: number; title: string; description: string; iconClass: string }[]
  >([]);

  useEffect(() => {
    fetchHomeSections()
      .then((data) => setItems(data.trustBadges))
      .catch(() => {});
  }, []);

  const icons = useMemo(() => [Shield, Award, Users, ThumbsUp], []);

  return (
    <section className="py-12 bg-gradient-to-r from-gray-50 to-white border-y border-gray-200">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="grid md:grid-cols-4 gap-6">
          {items.map((badge, index) => {
            const Icon = icons[index % icons.length] ?? Shield;
            return (
            <div
              key={badge.id}
              className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-[#007A3D] via-[#0B0F19] to-[#CE1126] rounded-full flex items-center justify-center flex-shrink-0">
                <Icon className="text-white" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm mb-1">{badge.title}</h3>
                <p className="text-xs text-gray-600">{badge.description}</p>
              </div>
            </div>
          )})}
        </div>
      </div>
    </section>
  );
}
