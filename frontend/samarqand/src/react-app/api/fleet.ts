import {
  apiFetch,
  fetchJson,
  getCookie,
  readApiErrorCode,
  readApiResponse,
} from "@/react-app/api/site";

export type VehicleType =
  | "truck"
  | "pickup"
  | "sedan"
  | "bus"
  | "forklift"
  | "trailer"
  | "heavy_equipment";

export type VehicleStatus =
  | "available"
  | "in_use"
  | "maintenance"
  | "out_of_service"
  | "retired";

export type VehicleItem = {
  id: number;
  name: string;
  plateNumber: string;
  vehicleType: VehicleType;
  brand: string;
  modelName: string;
  year: number | null;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  status: VehicleStatus;
  assignedToId: number | null;
  assignedToName: string;
  currentProjectId: number | null;
  currentProjectTitle: string;
  insuranceExpiry: string | null;
  registrationExpiry: string | null;
  fuelType: string;
  tankCapacityLiters: number | null;
  notes: string;
};

export type FuelLogItem = {
  id: number;
  vehicleId: number;
  vehicleName: string;
  plateNumber: string;
  date: string;
  liters: number;
  cost: number;
  odometerKm: number | null;
  station: string;
  filledById: number | null;
  filledByName: string;
  notes: string;
};

export type MaintenanceType =
  | "oil_change"
  | "tires"
  | "repair"
  | "inspection"
  | "insurance"
  | "registration"
  | "other";

export type MaintenanceItem = {
  id: number;
  vehicleId: number;
  vehicleName: string;
  plateNumber: string;
  date: string;
  maintenanceType: MaintenanceType;
  description: string;
  cost: number;
  odometerKm: number | null;
  nextDueDate: string | null;
  garage: string;
  notes: string;
};

export async function fetchVehicles(params?: {
  status?: VehicleStatus;
  vehicleType?: VehicleType;
}): Promise<VehicleItem[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.vehicleType) query.set("vehicleType", params.vehicleType);
  const qs = query.toString();
  const data = await fetchJson<{ items: VehicleItem[] }>(
    `/api/admin/fleet/vehicles${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createVehicle(payload: {
  name: string;
  plateNumber: string;
  vehicleType?: VehicleType;
  brand?: string;
  modelName?: string;
  year?: number | null;
  color?: string;
  chassisNumber?: string;
  engineNumber?: string;
  status?: VehicleStatus;
  assignedToId?: number | null;
  currentProjectId?: number | null;
  insuranceExpiry?: string | null;
  registrationExpiry?: string | null;
  fuelType?: string;
  tankCapacityLiters?: number | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/fleet/vehicles/create", {
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

export async function updateVehicle(
  vehicleId: number,
  payload: Partial<VehicleItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/fleet/vehicles/${vehicleId}/update`, {
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

export async function deleteVehicle(vehicleId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/fleet/vehicles/${vehicleId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchFuelLogs(params?: {
  vehicleId?: number;
  year?: number;
  month?: number;
}): Promise<FuelLogItem[]> {
  const query = new URLSearchParams();
  if (params?.vehicleId) query.set("vehicleId", String(params.vehicleId));
  if (params?.year) query.set("year", String(params.year));
  if (params?.month) query.set("month", String(params.month));
  const qs = query.toString();
  const data = await fetchJson<{ items: FuelLogItem[] }>(
    `/api/admin/fleet/fuel-logs${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createFuelLog(payload: {
  vehicleId: number;
  date: string;
  liters: number;
  cost?: number;
  odometerKm?: number | null;
  station?: string;
  filledById?: number | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/fleet/fuel-logs/create", {
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

export async function updateFuelLog(
  logId: number,
  payload: Partial<FuelLogItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/fleet/fuel-logs/${logId}/update`, {
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

export async function deleteFuelLog(logId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/fleet/fuel-logs/${logId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchMaintenance(params?: {
  vehicleId?: number;
  maintenanceType?: MaintenanceType;
  year?: number;
  month?: number;
}): Promise<MaintenanceItem[]> {
  const query = new URLSearchParams();
  if (params?.vehicleId) query.set("vehicleId", String(params.vehicleId));
  if (params?.maintenanceType) query.set("maintenanceType", params.maintenanceType);
  if (params?.year) query.set("year", String(params.year));
  if (params?.month) query.set("month", String(params.month));
  const qs = query.toString();
  const data = await fetchJson<{ items: MaintenanceItem[] }>(
    `/api/admin/fleet/maintenance${qs ? `?${qs}` : ""}`,
  );
  return data.items;
}

export async function createMaintenance(payload: {
  vehicleId: number;
  date: string;
  maintenanceType?: MaintenanceType;
  description?: string;
  cost?: number;
  odometerKm?: number | null;
  nextDueDate?: string | null;
  garage?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/fleet/maintenance/create", {
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

export async function updateMaintenance(
  recordId: number,
  payload: Partial<MaintenanceItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/fleet/maintenance/${recordId}/update`, {
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

export async function deleteMaintenance(recordId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/fleet/maintenance/${recordId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}
