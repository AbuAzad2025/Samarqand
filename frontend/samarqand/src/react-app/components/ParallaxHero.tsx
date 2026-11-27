import { useEffect, useMemo, useState } from "react";
import { ArrowDown } from 'lucide-react';

import {
  fetchCompany,
  fetchHomeSettings,
  type CompanyPayload,
  type HomeSettingsPayload,
} from "@/react-app/api/site";
import BrandMark from "@/react-app/components/BrandMark";

export default function ParallaxHero() {
  const [scrollY, setScrollY] = useState(0);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [home, setHome] = useState<HomeSettingsPayload | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
    fetchHomeSettings().then(setHome).catch(() => {});
  }, []);

  const hero = useMemo(() => {
    const title1 = home?.heroTitleLine1 || company?.brandTitle || "شركة سمر قند";
    const title2 = home?.heroTitleLine2 || "للمقاولات";
    const lead = home?.heroLead || company?.slogan || "نبني مشاريعكم بإتقان وخبرة فلسطينية";
    const bg =
      home?.heroBackgroundUrl ||
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=1080&fit=crop";
    const primaryLabel = home?.heroPrimaryCtaLabel || "ابدأ مشروعك الآن";
    const primaryUrl = home?.heroPrimaryCtaUrl || "/contact";
    const secondaryLabel = home?.heroSecondaryCtaLabel || "تعرف على خدماتنا";
    const secondaryUrl = home?.heroSecondaryCtaUrl || "#services";
    return {
      title1,
      title2,
      lead,
      bg,
      primaryLabel,
      primaryUrl,
      secondaryLabel,
      secondaryUrl,
    };
  }, [company?.brandTitle, company?.slogan, home]);

  return (
    <section className="relative h-[78vh] min-h-[560px] max-h-[820px] overflow-hidden">
      {/* Background Image with Parallax */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundColor: "#0B1220",
          backgroundImage: hero.bg
            ? `linear-gradient(to bottom, rgba(0,0,0,0.70), rgba(0,0,0,0.50), rgba(0,0,0,0.70)), url(${hero.bg})`
            : "linear-gradient(to bottom, rgba(10,20,40,1), rgba(10,20,40,0.75), rgba(10,20,40,1))",
          transform: `translateY(${scrollY * 0.5}px)`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,122,61,0.22),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(206,17,38,0.18),transparent_48%)]" />
      </div>

      <div className="relative z-10 h-full flex items-center justify-center text-center px-4" dir="rtl">
        <div className="max-w-4xl">
          {/* Logo */}
          <div className="mb-8 animate-fade-in">
            <div className="w-28 h-28 md:w-32 md:h-32 mx-auto drop-shadow-2xl">
              <BrandMark
                logoUrl={company?.logoUrl || undefined}
                label={company?.name || hero.title1}
                size={128}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-fade-in-up">
            <span className="text-white">
              {hero.title1}
            </span>
            <br />
            <span className="text-4xl md:text-5xl text-[#A7D7BC]">{hero.title2}</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/90 mb-12 animate-fade-in-up animation-delay-200">
            {hero.lead}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 justify-center animate-fade-in-up animation-delay-400">
            <a
              href={hero.primaryUrl}
              className="btn-corp-primary text-lg font-bold hover:shadow-2xl hover:scale-105 transition-all"
            >
              {hero.primaryLabel}
            </a>
            <a
              href={hero.secondaryUrl}
              className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all border-2 border-white/50"
            >
              {hero.secondaryLabel}
            </a>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
            <ArrowDown className="text-white" size={32} />
          </div>
        </div>
      </div>
    </section>
  );
}
