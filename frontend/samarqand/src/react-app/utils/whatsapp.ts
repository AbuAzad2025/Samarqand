/** Build a WhatsApp link from the company phone number in site settings. */
export function whatsappUrl(
  phone: string | null | undefined,
  text?: string,
): string | null {
  const raw = (phone || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  // `00` is the international access prefix; wa.me expects the plain number.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  const message = typeof text === "string" ? text.trim() : "";
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
