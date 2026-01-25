import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function AdminRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/control", { replace: true });
  }, [navigate]);

  return null;
}

