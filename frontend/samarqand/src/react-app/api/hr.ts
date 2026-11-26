import {
  apiFetch,
  fetchJson,
  getCookie,
  readApiErrorCode,
  readApiResponse,
} from "@/react-app/api/site";

export type WorkerItem = {
  id: number;
  userId: number;
  userUsername: string;
  name: string;
  role: string;
  phone: string;
  timeClockId: string;
  kind: "worker" | "employee";
  active: boolean;
  dailyCost: number | null;
  monthlySalary: number | null;
  notes: string;
};

export type LeaveType =
  | "annual"
  | "sick"
  | "unpaid"
  | "emergency"
  | "pilgrimage"
  | "other";

export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequestItem = {
  id: number;
  workerId: number;
  workerName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  approvedById: number | null;
  approvedAt: string | null;
};

export type ContractType =
  | "full_time"
  | "part_time"
  | "contract"
  | "seasonal";

export type ContractItem = {
  id: number;
  workerId: number;
  workerName: string;
  contractNumber: string;
  contractType: ContractType;
  startDate: string;
  endDate: string | null;
  basicSalary: number;
  transportationAllowance: number;
  housingAllowance: number;
  position: string;
  department: string;
  probationPeriodDays: number;
  isActive: boolean;
};

export type OvertimeItem = {
  id: number;
  workerId: number;
  workerName: string;
  projectId: number | null;
  projectTitle: string;
  date: string;
  hours: number;
  multiplier: number;
  hourlyRate: number | null;
  amount: number | null;
  approved: boolean;
  approvedById: number | null;
  approvedAt: string | null;
  notes: string;
};

export type SocialSecurityItem = {
  id: number;
  workerId: number;
  workerName: string;
  year: number;
  month: number;
  grossSalary: number;
  employeeShare: number;
  employerShare: number;
  total: number;
  paid: boolean;
  paidDate: string | null;
};

export async function fetchWorkers(): Promise<WorkerItem[]> {
  const data = await fetchJson<{ items: WorkerItem[] }>("/api/admin/ops/workers");
  return data.items;
}

export async function fetchLeaveRequests(params?: {
  workerId?: number;
  status?: LeaveStatus;
}): Promise<LeaveRequestItem[]> {
  const query = new URLSearchParams();
  if (params?.workerId) query.set("workerId", String(params.workerId));
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  const data = await fetchJson<{ items: LeaveRequestItem[] }>(
    `/api/admin/hr/leave${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createLeaveRequest(payload: {
  workerId: number;
  leaveType?: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/hr/leave/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateLeaveRequest(
  leaveId: number,
  payload: Partial<{
    workerId: number;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/leave/${leaveId}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteLeaveRequest(leaveId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/leave/${leaveId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function approveLeaveRequest(leaveId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/leave/${leaveId}/approve`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function rejectLeaveRequest(leaveId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/leave/${leaveId}/reject`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type LeaveBalance = {
  year: number;
  workerId: number;
  annualEntitlement: number;
  approvedAnnualDays: number;
  remainingAnnualDays: number;
};

export async function fetchLeaveBalance(
  workerId: number,
  year?: number,
): Promise<LeaveBalance> {
  const query = new URLSearchParams();
  if (year) query.set("year", String(year));
  const qs = query.toString();
  return fetchJson<LeaveBalance>(
    `/api/admin/hr/leave/balance/${workerId}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchContracts(params?: {
  workerId?: number;
}): Promise<ContractItem[]> {
  const query = new URLSearchParams();
  if (params?.workerId) query.set("workerId", String(params.workerId));
  const qs = query.toString();
  const data = await fetchJson<{ items: ContractItem[] }>(
    `/api/admin/hr/contracts${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createContract(payload: {
  workerId: number;
  contractNumber?: string;
  contractType?: ContractType;
  startDate: string;
  endDate?: string | null;
  basicSalary?: number;
  transportationAllowance?: number;
  housingAllowance?: number;
  position?: string;
  department?: string;
  probationPeriodDays?: number;
  isActive?: boolean;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/hr/contracts/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateContract(
  contractId: number,
  payload: Partial<{
    workerId: number;
    contractNumber: string;
    contractType: ContractType;
    startDate: string;
    endDate: string | null;
    basicSalary: number;
    transportationAllowance: number;
    housingAllowance: number;
    position: string;
    department: string;
    probationPeriodDays: number;
    isActive: boolean;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/contracts/${contractId}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteContract(contractId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/contracts/${contractId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchOvertime(params?: {
  workerId?: number;
  year?: number;
  month?: number;
}): Promise<OvertimeItem[]> {
  const query = new URLSearchParams();
  if (params?.workerId) query.set("workerId", String(params.workerId));
  if (params?.year) query.set("year", String(params.year));
  if (params?.month) query.set("month", String(params.month));
  const qs = query.toString();
  const data = await fetchJson<{ items: OvertimeItem[] }>(
    `/api/admin/hr/overtime${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createOvertime(payload: {
  workerId: number;
  projectId?: number | null;
  date: string;
  hours: number;
  multiplier?: number;
  hourlyRate?: number | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/hr/overtime/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateOvertime(
  overtimeId: number,
  payload: Partial<{
    workerId: number;
    projectId: number | null;
    date: string;
    hours: number;
    multiplier: number;
    hourlyRate: number | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/overtime/${overtimeId}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteOvertime(overtimeId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/overtime/${overtimeId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function approveOvertime(overtimeId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/overtime/${overtimeId}/approve`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchSocialSecurity(params?: {
  workerId?: number;
  year?: number;
  month?: number;
}): Promise<SocialSecurityItem[]> {
  const query = new URLSearchParams();
  if (params?.workerId) query.set("workerId", String(params.workerId));
  if (params?.year) query.set("year", String(params.year));
  if (params?.month) query.set("month", String(params.month));
  const qs = query.toString();
  const data = await fetchJson<{ items: SocialSecurityItem[] }>(
    `/api/admin/hr/social-security${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createSocialSecurity(payload: {
  workerId: number;
  year: number;
  month: number;
  grossSalary?: number;
  employeeShare?: number;
  employerShare?: number;
  paid?: boolean;
  paidDate?: string | null;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/hr/social-security/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateSocialSecurity(
  recordId: number,
  payload: Partial<{
    workerId: number;
    year: number;
    month: number;
    grossSalary: number;
    employeeShare: number;
    employerShare: number;
    paid: boolean;
    paidDate: string | null;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/social-security/${recordId}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteSocialSecurity(recordId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/social-security/${recordId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function markSocialSecurityPaid(
  recordId: number,
  paidDate?: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/hr/social-security/${recordId}/mark-paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify({ paidDate }),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}
