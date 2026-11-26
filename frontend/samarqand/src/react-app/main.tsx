import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Best-effort offline caching for static assets. The real static prefix is
// injected by the Django SPA template tag; fall back to the site root.
if ("serviceWorker" in navigator) {
  const prefix =
    document
      .querySelector('meta[name="sq-static-base"]')
      ?.getAttribute("content") || "/";
  // Under Django the SPA lives under /static/..., so a SW registered there
  // cannot control site pages. Register only for root-served deployments.
  if (prefix === "/") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    });
  }
}
