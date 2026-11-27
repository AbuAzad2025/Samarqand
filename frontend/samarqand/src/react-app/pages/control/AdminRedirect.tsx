import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

const TARGET = "/control";

/**
 * Legacy `/admin/*` alias. Redirect once to the control panel and never from a
 * path that already points there, so a redirect chain can't loop back here.
 */
export default function AdminRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (pathname === TARGET || pathname.startsWith(`${TARGET}/`)) return;
    redirected.current = true;
    navigate(TARGET, { replace: true });
  }, [navigate, pathname]);

  return (
    <p className="sr-only" role="status" aria-live="polite">
      جارٍ التوجيه إلى لوحة التحكم…
    </p>
  );
}
