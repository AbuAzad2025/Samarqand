import { useEffect, useMemo, useState } from "react";

import { BRAND } from "@/react-app/brand";

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

  return (
    <img
      src={BRAND.samarqand.icon}
      alt={label || BRAND.samarqand.name}
      width={size}
      height={size}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
