import { useEffect, useState } from "react";

import { fetchAuthMe } from "@/react-app/api/site";

export type ControlRole = {
  isSuperuser: boolean;
  role: string;
  groups: string[];
};

export function useControlRole(): ControlRole {
  const [value, setValue] = useState<ControlRole>({
    isSuperuser: false,
    role: "",
    groups: [],
  });

  useEffect(() => {
    fetchAuthMe()
      .then((me) =>
        setValue({
          isSuperuser: Boolean(me.isSuperuser),
          role: me.role || "",
          groups: me.groups || [],
        }),
      )
      .catch(() => {});
  }, []);

  return value;
}

export function isManagerRole(role: ControlRole): boolean {
  return (
    role.isSuperuser ||
    role.role === "superadmin" ||
    role.role === "manager" ||
    role.groups.includes("Managers")
  );
}

export function isAccountingRole(role: ControlRole): boolean {
  return (
    isManagerRole(role) ||
    role.role === "accountant" ||
    role.groups.includes("Accountants")
  );
}
