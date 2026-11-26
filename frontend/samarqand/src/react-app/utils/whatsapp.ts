/** Build a WhatsApp link from the company phone number in site settings. */
export function whatsappUrl(
  phone: string | null | undefined,
  text?: string,
): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
