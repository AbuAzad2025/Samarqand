import {
  apiFetch,
  fetchJson,
  getCookie,
  readApiErrorCode,
  readApiResponse,
} from "@/react-app/api/site";

export type BoqProjectItem = {
  id: number;
  title: string;
};

export type BoqItem = {
  id: number;
  sortOrder: number;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  accountId: number | null;
  executedQuantity: number;
  remainingQuantity: number;
  notes: string;
};

export type PaymentApplicationItem = {
  id: number;
  boqItemId: number;
  boqItemDescription: string;
  contractedQuantity: number;
  previouslyDoneQuantity: number;
  currentQuantity: number;
  totalDoneQuantity: number;
  donePercent: number;
  unitPrice: number;
  totalAmount: number;
  previouslyCertified: number;
  currentAmount: number;
};

export type PaymentApplication = {
  id: number;
  applicationNumber: string;
  applicationDate: string;
  periodFrom: string | null;
  periodTo: string | null;
  totalWorksDone: number;
  previousApplicationsTotal: number;
  currentDue: number;
  retentionPercent: number;
  retentionAmount: number;
  withholdingTaxPercent: number;
  withholdingTaxAmount: number;
  previousDeductions: number;
  netAmount: number;
  status: "draft" | "submitted" | "approved" | "paid" | "rejected";
  submittedToConsultant: boolean;
  consultantApproved: boolean;
  consultantNotes: string;
  journalEntryId: number | null;
  items?: PaymentApplicationItem[];
};

export type VariationOrderItem = {
  id: number;
  boqItemId: number | null;
  description: string;
  unit: string;
  quantityChange: number;
  unitPrice: number;
  total: number;
};

export type VariationOrder = {
  id: number;
  variationNumber: string;
  title: string;
  reason: string;
  description: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "implemented";
  costImpact: number;
  scheduleImpactDays: number;
  submittedAt: string;
  approvedAt: string | null;
  items?: VariationOrderItem[];
};

export type FinalAccount = {
  exists: boolean;
  id?: number;
  contractAmount: number;
  totalVariations: number;
  revisedContractAmount: number;
  totalPreviousApplications: number;
  totalRetentionReleased: number;
  totalWithholdingTax: number;
  netDue: number;
  status: "draft" | "submitted" | "agreed" | "closed";
  closedAt: string | null;
  notes: string;
};

export async function fetchBoqProjects(): Promise<BoqProjectItem[]> {
  const data = await fetchJson<{ items: BoqProjectItem[] }>("/api/admin/boq/projects");
  return data.items;
}

export async function fetchBoqItems(projectId: number): Promise<{ projectTitle: string; items: BoqItem[] }> {
  return fetchJson<{ projectTitle: string; items: BoqItem[] }>(
    `/api/admin/boq/projects/${projectId}/items`,
  );
}

export async function createBoqItem(
  projectId: number,
  payload: {
    sortOrder?: number;
    itemCode?: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    accountId?: number;
    notes?: string;
  },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/boq/projects/${projectId}/items/create`, {
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

export async function updateBoqItem(
  projectId: number,
  itemId: number,
  payload: Partial<{
    sortOrder: number;
    itemCode: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    accountId: number | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/boq/projects/${projectId}/items/${itemId}/update`, {
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

export async function deleteBoqItem(projectId: number, itemId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/boq/projects/${projectId}/items/${itemId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchPaymentApplications(projectId: number): Promise<{
  projectTitle: string;
  items: PaymentApplication[];
}> {
  return fetchJson<{ projectTitle: string; items: PaymentApplication[] }>(
    `/api/admin/boq/projects/${projectId}/payment-applications`,
  );
}

export async function fetchPaymentApplicationDetail(
  projectId: number,
  applicationId: number,
): Promise<PaymentApplication> {
  return fetchJson<PaymentApplication>(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}`,
  );
}

export async function createPaymentApplication(
  projectId: number,
  payload: {
    applicationNumber: string;
    applicationDate: string;
    periodFrom?: string;
    periodTo?: string;
    previousApplicationsTotal?: number;
    retentionPercent?: number;
    withholdingTaxPercent?: number;
    previousDeductions?: number;
  },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updatePaymentApplication(
  projectId: number,
  applicationId: number,
  payload: Partial<{
    applicationNumber: string;
    applicationDate: string;
    periodFrom: string | null;
    periodTo: string | null;
    previousApplicationsTotal: number;
    retentionPercent: number;
    withholdingTaxPercent: number;
    previousDeductions: number;
    consultantNotes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deletePaymentApplication(
  projectId: number,
  applicationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/delete`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function addPaymentApplicationItem(
  projectId: number,
  applicationId: number,
  payload: {
    boqItemId: number;
    currentQuantity: number;
    previouslyDoneQuantity?: number;
    previouslyCertified?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/add-item`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function updatePaymentApplicationItem(
  projectId: number,
  applicationId: number,
  itemId: number,
  payload: Partial<{
    currentQuantity: number;
    previouslyDoneQuantity: number;
    previouslyCertified: number;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/items/${itemId}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function removePaymentApplicationItem(
  projectId: number,
  applicationId: number,
  itemId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/items/${itemId}/delete`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function submitPaymentApplication(
  projectId: number,
  applicationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/submit`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function approvePaymentApplication(
  projectId: number,
  applicationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/approve`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function rejectPaymentApplication(
  projectId: number,
  applicationId: number,
  consultantNotes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify({ consultantNotes }),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function payPaymentApplication(
  projectId: number,
  applicationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/pay`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function generatePaymentApplicationEntry(
  projectId: number,
  applicationId: number,
): Promise<{ ok: boolean; journalEntryId?: number; number?: string; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/payment-applications/${applicationId}/generate-entry`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<{ journalEntryId: number; number: string }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, journalEntryId: data.result.journalEntryId, number: data.result.number };
}

export async function fetchVariationOrders(projectId: number): Promise<{
  projectTitle: string;
  items: VariationOrder[];
}> {
  return fetchJson<{ projectTitle: string; items: VariationOrder[] }>(
    `/api/admin/boq/projects/${projectId}/variation-orders`,
  );
}

export async function createVariationOrder(
  projectId: number,
  payload: {
    variationNumber: string;
    title: string;
    reason?: string;
    description?: string;
    costImpact?: number;
    scheduleImpactDays?: number;
  },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/boq/projects/${projectId}/variation-orders/create`, {
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

export async function updateVariationOrder(
  projectId: number,
  variationId: number,
  payload: Partial<{
    variationNumber: string;
    title: string;
    reason: string;
    description: string;
    costImpact: number;
    scheduleImpactDays: number;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/variation-orders/${variationId}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteVariationOrder(
  projectId: number,
  variationId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/variation-orders/${variationId}/delete`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function setVariationOrderStatus(
  projectId: number,
  variationId: number,
  status: VariationOrder["status"],
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/variation-orders/${variationId}/set-status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify({ status }),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function addVariationOrderItem(
  projectId: number,
  variationId: number,
  payload: {
    boqItemId?: number;
    description: string;
    unit: string;
    quantityChange: number;
    unitPrice: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/variation-orders/${variationId}/add-item`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function updateVariationOrderItem(
  projectId: number,
  variationId: number,
  itemId: number,
  payload: Partial<{
    description: string;
    unit: string;
    quantityChange: number;
    unitPrice: number;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/variation-orders/${variationId}/items/${itemId}/update`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken") || "",
      },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function removeVariationOrderItem(
  projectId: number,
  variationId: number,
  itemId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/boq/projects/${projectId}/variation-orders/${variationId}/items/${itemId}/delete`,
    {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchFinalAccount(projectId: number): Promise<FinalAccount> {
  return fetchJson<FinalAccount>(`/api/admin/boq/projects/${projectId}/final-account`);
}

export async function updateFinalAccount(
  projectId: number,
  payload: Partial<{
    contractAmount: number;
    totalVariations: number;
    totalRetentionReleased: number;
    totalWithholdingTax: number;
    status: FinalAccount["status"];
    notes: string;
  }>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/boq/projects/${projectId}/final-account/update`, {
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
