export function formatMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return String(safe);
  }
}

export function todayInputValue(): string {
  const d = new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function baseHumanizeErrorCode(code: string): string | null {
  const c = String(code || "").trim();
  if (!c) return "حدث خطأ غير متوقع.";
  if (c === "error" || c === "request_failed" || c === "invalid_response") {
    return "حدث خطأ غير متوقع. أعد المحاولة.";
  }
  if (c === "forbidden") return "ليست لديك صلاحية لهذه العملية.";
  if (c === "not_found") return "العنصر المطلوب غير موجود.";
  if (c === "rate_limited") return "تم تجاوز عدد المحاولات المسموح بها. حاول لاحقاً.";
  if (c === "upload_failed" || c === "missing_file" || c === "file_too_large") {
    return "تعذّر رفع الملف. تحقق من الملف وحاول مرة أخرى.";
  }
  return null;
}
