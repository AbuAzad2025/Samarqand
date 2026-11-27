import { useEffect, useMemo, useState } from "react";

import { BRAND } from "@/react-app/brand";

type BrandMarkProps = {
  logoUrl?: string;
  label?: string;
  size?: number;
  className?: string;
  /** Text alternative; pass an empty string when the mark is purely decorative. */
  alt?: string;
};

export default function BrandMark({
  logoUrl,
  label,
  size = 80,
  className,
  alt,
}: BrandMarkProps) {
  const [failed, setFailed] = useState(false);

  const dimension = Number.isFinite(size) && size > 0 ? Math.round(size) : 80;
  const accessibleName = (
    alt !== undefined ? alt : label?.trim() || BRAND.samarqand.name
  ).trim();
  const classes = ["object-contain", className].filter(Boolean).join(" ");

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

  const sharedProps = {
    width: dimension,
    height: dimension,
    className: classes,
    alt: accessibleName,
    "aria-hidden": accessibleName === "" || undefined,
    loading: "eager" as const,
    decoding: "async" as const,
    draggable: false,
  };

  if (src && !failed) {
    return (
      <img
        {...sharedProps}
        src={src}
        onError={() => setFailed(true)}
      />
    );
  }

  return <img {...sharedProps} src={BRAND.samarqand.icon} />;
}
