import { useEffect, useState } from "react";

type Detail = { url?: string; status?: number };

/** Surfaces failed background fetches that pages otherwise swallow silently. */
export default function ApiErrorBanner() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    function onError(event: Event) {
      const detail = (event as CustomEvent<Detail>).detail || {};
      const status = detail.status ? ` (${detail.status})` : "";
      setMessage(`تعذّر تحميل بعض البيانات${status}. أعد المحاولة.`);
    }
    window.addEventListener("sq-api-error", onError);
    return () => window.removeEventListener("sq-api-error", onError);
  }, []);

  if (!message) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl bg-red-600 text-white shadow-2xl px-5 py-4 flex items-start gap-4"
    >
      <span className="flex-1 text-sm leading-relaxed">{message}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-white/20 px-3 py-1 text-sm font-bold hover:bg-white/30"
      >
        إعادة
      </button>
      <button
        type="button"
        aria-label="إغلاق"
        onClick={() => setMessage("")}
        className="text-white/80 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
