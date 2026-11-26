export function formatMoney(value: number): string {
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function todayInputValue(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export function baseHumanizeErrorCode(code: string): string | null {
  const c = String(code || "").trim();
  if (!c) return "حدث خطأ غير متوقع.";
  if (c === "forbidden") return "ليست لديك صلاحية لهذه العملية.";
  if (c === "not_found") return "العنصر المطلوب غير موجود.";
  return null;
}
