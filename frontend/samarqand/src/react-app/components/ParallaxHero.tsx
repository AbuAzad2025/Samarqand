import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import {
  fetchCompany,
  fetchHomeSettings,
  type CompanyPayload,
  type HomeSettingsPayload,
} from "@/react-app/api/site";
import BrandMark from "@/react-app/components/BrandMark";

const PARALLAX_FACTOR = 0.3;
const PARALLAX_MAX = 120;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduce;
}

function ParallaxBackground({ bg }: { bg: string }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    if (reduceMotion) {
      el.style.setProperty("--parallax-y", "0px");
      return;
    }

    let frame = 0;
    let visible = true;

    const apply = () => {
      frame = 0;
      if (!visible) return;
      const offset = Math.min(window.scrollY * PARALLAX_FACTOR, PARALLAX_MAX);
      el.style.setProperty("--parallax-y", `${offset}px`);
    };

    // One passive listener; all scroll events are coalesced into one rAF write.
    const onScroll = () => {
      if (frame || !visible) return;
      frame = requestAnimationFrame(apply);
    };

    // Stop doing any scroll work once the hero leaves the viewport.
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = Boolean(entry?.isIntersecting);
            if (visible) onScroll();
          });
    observer?.observe(el);

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return (
    <div
      ref={layerRef}
      className="absolute"
      aria-hidden="true"
      style={{
        inset: "-6%",
        backgroundColor: "#0B1220",
        backgroundImage: bg
          ? `linear-gradient(to bottom, rgba(0,0,0,0.70), rgba(0,0,0,0.50), rgba(0,0,0,0.70)), url(${bg})`
          : "linear-gradient(to bottom, rgba(10,20,40,1), rgba(10,20,40,0.75), rgba(10,20,40,1))",
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Written imperatively via --parallax-y so scrolling never re-renders React.
        transform: "translateY(var(--parallax-y, 0px)) scale(1.06)",
        willChange: "transform",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,122,61,0.22),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(206,17,38,0.18),transparent_48%)]" />
    </div>
  );
}

export default function ParallaxHero() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [home, setHome] = useState<HomeSettingsPayload | null>(null);

  useEffect(() => {
    let active = true;
    fetchCompany().then((data) => { if (active) setCompany(data); }).catch(() => {});
    fetchHomeSettings().then((data) => { if (active) setHome(data); }).catch(() => {});
    return () => { active = false; };
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
    <section
      aria-labelledby="hero-title"
      className="relative h-[78vh] min-h-[560px] max-h-[820px] overflow-hidden"
    >
      <ParallaxBackground bg={hero.bg} />

      <div className="relative z-10 flex h-full items-center justify-center px-4 text-center" dir="rtl">
        <div className="max-w-4xl">
          <div className="mb-8 animate-fade-in">
            <div className="mx-auto h-28 w-28 drop-shadow-2xl md:h-32 md:w-32">
              <BrandMark
                logoUrl={company?.logoUrl || undefined}
                label={company?.name || hero.title1}
                size={128}
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <h1 id="hero-title" className="mb-6 animate-fade-in-up text-5xl font-bold text-white md:text-7xl">
            <span className="text-white">{hero.title1}</span>
            <br />
            <span className="text-4xl text-[#A7D7BC] md:text-5xl">{hero.title2}</span>
          </h1>

          <p className="mb-12 animate-fade-in-up animation-delay-200 text-xl text-white/90 md:text-2xl">
            {hero.lead}
          </p>

          <div className="flex animate-fade-in-up flex-wrap justify-center gap-4 animation-delay-400">
            <a
              href={hero.primaryUrl}
              className="btn-corp-primary text-lg font-bold transition-all hover:scale-105 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sq-black"
            >
              {hero.primaryLabel}
            </a>
            <a
              href={hero.secondaryUrl}
              className="rounded-full border-2 border-white/50 bg-white/10 px-8 py-4 text-lg font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sq-black"
            >
              {hero.secondaryLabel}
            </a>
          </div>
        </div>
      </div>

      <a
        href="#services"
        aria-label="الانتقال إلى قسم الخدمات"
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded-full p-1 text-white transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
      >
        <ArrowDown size={32} aria-hidden="true" />
      </a>
    </section>
  );
}
