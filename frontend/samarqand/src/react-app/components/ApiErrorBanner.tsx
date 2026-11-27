import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const FRIENDLY_MESSAGE =
  "تعذّر تحميل بعض البيانات. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.";

/** Surfaces failed background fetches without exposing technical details. */
export default function ApiErrorBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // The event detail (URL/status) is intentionally ignored: it is diagnostic
    // information for developers, not something to show to visitors.
    function onError() {
      setVisible(true);
    }
    window.addEventListener("sq-api-error", onError);
    return () => window.removeEventListener("sq-api-error", onError);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl bg-red-600 text-white shadow-2xl px-5 py-4 flex items-start gap-4"
    >
      <span className="flex-1 text-sm leading-relaxed">{FRIENDLY_MESSAGE}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-sm font-bold hover:bg-white/30"
      >
        <RefreshCw size={14} aria-hidden="true" />
        إعادة المحاولة
      </button>
      <button
        type="button"
        aria-label="إغلاق التنبيه"
        onClick={() => setVisible(false)}
        className="shrink-0 text-white/80 hover:text-white"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
