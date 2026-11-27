import { Award, Building2, HardHat, Shield, type LucideIcon, ThumbsUp, Users } from "lucide-react";
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
  const iconMap: Record<string, LucideIcon> = useMemo(
    () => ({
      shield: Shield,
      award: Award,
      users: Users,
      thumbsup: ThumbsUp,
      building: Building2,
      hardhat: HardHat,
    }),
    [],
  );

  return (
    <section className="py-12 bg-gradient-to-r from-gray-50 to-white border-y border-gray-200">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="grid md:grid-cols-4 gap-6">
          {items.map((badge, index) => {
            const key = (badge.iconClass || "")
              .toLowerCase()
              .replace(/[^a-z]/g, "");
            const Icon = iconMap[key] ?? icons[index % icons.length] ?? Shield;
            return (
            <div
              key={badge.id}
              className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
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
