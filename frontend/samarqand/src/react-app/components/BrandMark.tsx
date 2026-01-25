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
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={label || "شعار الشركة"}
        width={size}
        height={size}
        className={className}
        loading="eager"
        decoding="async"
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
          <stop offset="0%" stopColor="#4A90E2" />
          <stop offset="100%" stopColor="#5DADE2" />
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

