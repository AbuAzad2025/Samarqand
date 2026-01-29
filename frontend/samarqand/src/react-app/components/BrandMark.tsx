import { useEffect, useMemo, useState } from "react";

type BrandMarkProps = {
  logoUrl?: string;
  label?: string;
  size?: number;
  className?: string;
};

export default function BrandMark({
  logoUrl,
  label,
  size = 80,
  className,
}: BrandMarkProps) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    const raw = (logoUrl || "").trim();
    if (!raw) return "";

    if (typeof window === "undefined") return raw;

    try {
      const resolved = new URL(raw, window.location.origin).toString();
      if (window.location.protocol === "https:" && resolved.startsWith("http://")) {
        return `https://${resolved.slice("http://".length)}`;
      }
      return resolved;
    } catch {
      if (window.location.protocol === "https:" && raw.startsWith("http://")) {
        return `https://${raw.slice("http://".length)}`;
      }
      return raw;
    }
  }, [logoUrl]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label || "شعار الشركة"}
        width={size}
        height={size}
        className={className}
        loading="eager"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  const w = size;
  const h = size;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 100"
      aria-label={label || "شعار الشركة"}
      role="img"
      className={className}
    >
      <defs>
        <linearGradient id="sq_grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#007A3D" />
          <stop offset="70%" stopColor="#0B0F19" />
          <stop offset="100%" stopColor="#CE1126" />
        </linearGradient>
        <filter id="sq_shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.25" />
        </filter>
      </defs>

      <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,0.08)" />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="url(#sq_grad)"
        strokeWidth="4"
        filter="url(#sq_shadow)"
      />
      <circle cx="50" cy="50" r="36" fill="rgba(255,255,255,0.10)" />

      <g opacity="0.85" stroke="#007A3D" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 66 C38 60 46 60 50 66 C54 72 62 72 70 66" />
        <path d="M36 65 C34 63 32 63 30 65" />
        <path d="M40 63 C38 61 36 61 34 63" />
        <path d="M66 65 C68 63 70 63 72 65" />
        <path d="M62 63 C64 61 66 61 68 63" />
      </g>
      <rect x="26" y="70" width="48" height="6" rx="3" fill="#0B0F19" opacity="0.65" />
      <rect x="26" y="70" width="16" height="6" rx="3" fill="#CE1126" />
      <rect x="42" y="70" width="16" height="6" rx="0" fill="#FFFFFF" />
      <rect x="58" y="70" width="16" height="6" rx="3" fill="#007A3D" />

      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fill="white"
        style={{ letterSpacing: "1px" }}
      >
        س ق
      </text>
    </svg>
  );
}
