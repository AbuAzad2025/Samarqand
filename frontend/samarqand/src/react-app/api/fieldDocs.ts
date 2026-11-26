import { apiFetch, fetchJson, getCookie, readApiErrorCode, readApiResponse } from "@/react-app/api/site";

export type FieldDocsProjectItem = {
  id: number;
  title: string;
};

export type CorrespondenceItem = {
  id: number;
  direction: "incoming" | "outgoing";
  referenceNumber: string;
  date: string;
  fromEntity: string;
  toEntity: string;
  subject: string;
  description: string;
  documentFile: string | null;
  responseDueDate: string | null;
  status: "pending_reply" | "replied" | "closed";
  respondedAt: string | null;
  responseRef: string;
};

export type MeetingItem = {
  id: number;
  meetingNumber: string;
  meetingDate: string;
  meetingType: "site" | "progress" | "technical" | "coordination" | "safety";
  location: string;
  chairperson: string;
  attendees: string;
  minutesBy: string;
  summary: string;
  status: "draft" | "reviewed" | "approved";
  documentFile: string | null;
  actionItemsCount: number;
};

export type MeetingActionItem = {
  id: number;
  itemNumber: string;
  description: string;
  responsible: string;
  dueDate: string | null;
  status: "open" | "in_progress" | "completed" | "closed";
  completedAt: string | null;
};

export type DailyReportItem = {
  id: number;
  date: string;
  weather: string;
  temperature: string;
  totalWorkers: number;
  workersBreakdown: Record<string, unknown>;
  equipmentUsed: string;
  equipmentHours: Record<string, unknown>;
  workDoneSummary: string;
  quantitiesExecuted: string;
  materialsReceived: string;
  issuesEncountered: string;
  delays: string;
  safetyObservations: string;
  planForNextDay: string;
  submittedBy: number | null;
  submittedAt: string;
};

export type DeliveryNoteItem = {
  id: number;
  purchaseOrderId: number | null;
  deliveryDate: string;
  supplierName: string;
  vehiclePlate: string;
  driverName: string;
  notes: string;
  itemsCount: number;
};

export type DeliveryNoteLineItem = {
  id: number;
  inventoryItemId: number | null;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type RfiItem = {
  id: number;
  rfiNumber: string;
  subject: string;
  question: string;
  category: "design" | "specification" | "site_condition" | "material" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "answered" | "closed";
  submittedTo: string;
  submittedAt: string;
  response: string;
  respondedBy: string;
  respondedAt: string | null;
  daysToRespond: number;
};

export type NcrItem = {
  id: number;
  ncrNumber: string;
  date: string;
  location: string;
  severity: "minor" | "major" | "critical";
  description: string;
  clauseRef: string;
  status: "open" | "action_taken" | "closed";
  correctiveAction: string;
  actionDeadline: string | null;
  closedAt: string | null;
};

export type SubmittalItem = {
  id: number;
  submittalNumber: string;
  title: string;
  category: "material_sample" | "shop_drawing" | "method_statement" | "test_report" | "certificate";
  status: "submitted" | "under_review" | "approved" | "approved_with_comments" | "rejected";
  submittedTo: string;
  submittedAt: string;
  response: string;
  respondedAt: string | null;
};

export async function fetchFieldDocsProjects(): Promise<FieldDocsProjectItem[]> {
  const data = await fetchJson<{ items: FieldDocsProjectItem[] }>("/api/admin/field-docs/projects");
  return data.items;
}

export async function fetchCorrespondence(projectId: number): Promise<CorrespondenceItem[]> {
  const data = await fetchJson<{ items: CorrespondenceItem[] }>(
    `/api/admin/field-docs/projects/${projectId}/correspondence`,
  );
  return data.items;
}

export async function createCorrespondence(
  projectId: number,
  payload: Partial<CorrespondenceItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/correspondence/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateCorrespondence(
  projectId: number,
  correspondenceId: number,
  payload: Partial<CorrespondenceItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/correspondence/${correspondenceId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteCorrespondence(
  projectId: number,
  correspondenceId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/correspondence/${correspondenceId}/delete`,
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

export async function fetchMeetings(projectId: number): Promise<MeetingItem[]> {
  const data = await fetchJson<{ items: MeetingItem[] }>(
    `/api/admin/field-docs/projects/${projectId}/meetings`,
  );
  return data.items;
}

export async function createMeeting(
  projectId: number,
  payload: Partial<MeetingItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/meetings/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateMeeting(
  projectId: number,
  meetingId: number,
  payload: Partial<MeetingItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/meetings/${meetingId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteMeeting(
  projectId: number,
  meetingId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/meetings/${meetingId}/delete`,
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

export async function fetchMeetingActionItems(
  projectId: number,
  meetingId: number,
): Promise<MeetingActionItem[]> {
  const data = await fetchJson<{ items: MeetingActionItem[] }>(
    `/api/admin/field-docs/projects/${projectId}/meetings/${meetingId}/action-items`,
  );
  return data.items;
}

export async function createMeetingActionItem(
  projectId: number,
  meetingId: number,
  payload: Partial<MeetingActionItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/meetings/${meetingId}/action-items/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateMeetingActionItem(
  projectId: number,
  meetingId: number,
  itemId: number,
  payload: Partial<MeetingActionItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/meetings/${meetingId}/action-items/${itemId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteMeetingActionItem(
  projectId: number,
  meetingId: number,
  itemId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/meetings/${meetingId}/action-items/${itemId}/delete`,
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

export async function fetchDailyReports(projectId: number): Promise<DailyReportItem[]> {
  const data = await fetchJson<{ items: DailyReportItem[] }>(
    `/api/admin/field-docs/projects/${projectId}/daily-reports`,
  );
  return data.items;
}

export async function createDailyReport(
  projectId: number,
  payload: Partial<DailyReportItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/daily-reports/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateDailyReport(
  projectId: number,
  reportId: number,
  payload: Partial<DailyReportItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/daily-reports/${reportId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteDailyReport(
  projectId: number,
  reportId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/daily-reports/${reportId}/delete`,
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

export async function fetchDeliveryNotes(projectId: number): Promise<DeliveryNoteItem[]> {
  const data = await fetchJson<{ items: DeliveryNoteItem[] }>(
    `/api/admin/field-docs/projects/${projectId}/delivery-notes`,
  );
  return data.items;
}

export async function createDeliveryNote(
  projectId: number,
  payload: Partial<DeliveryNoteItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/delivery-notes/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateDeliveryNote(
  projectId: number,
  noteId: number,
  payload: Partial<DeliveryNoteItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/delivery-notes/${noteId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteDeliveryNote(
  projectId: number,
  noteId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/delivery-notes/${noteId}/delete`,
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

export async function addDeliveryNoteItem(
  projectId: number,
  noteId: number,
  payload: Partial<DeliveryNoteLineItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/delivery-notes/${noteId}/items/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function updateDeliveryNoteItem(
  projectId: number,
  noteId: number,
  itemId: number,
  payload: Partial<DeliveryNoteLineItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/delivery-notes/${noteId}/items/${itemId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function removeDeliveryNoteItem(
  projectId: number,
  noteId: number,
  itemId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/delivery-notes/${noteId}/items/${itemId}/delete`,
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

export async function fetchRfiItems(projectId: number): Promise<RfiItem[]> {
  const data = await fetchJson<{ items: RfiItem[] }>(`/api/admin/field-docs/projects/${projectId}/rfi`);
  return data.items;
}

export async function createRfiItem(
  projectId: number,
  payload: Partial<RfiItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/rfi/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateRfiItem(
  projectId: number,
  rfiId: number,
  payload: Partial<RfiItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/rfi/${rfiId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteRfiItem(
  projectId: number,
  rfiId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/rfi/${rfiId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchNcrItems(projectId: number): Promise<NcrItem[]> {
  const data = await fetchJson<{ items: NcrItem[] }>(`/api/admin/field-docs/projects/${projectId}/ncr`);
  return data.items;
}

export async function createNcrItem(
  projectId: number,
  payload: Partial<NcrItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/ncr/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateNcrItem(
  projectId: number,
  ncrId: number,
  payload: Partial<NcrItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/ncr/${ncrId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteNcrItem(
  projectId: number,
  ncrId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/ncr/${ncrId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function fetchSubmittalItems(projectId: number): Promise<SubmittalItem[]> {
  const data = await fetchJson<{ items: SubmittalItem[] }>(
    `/api/admin/field-docs/projects/${projectId}/submittals`,
  );
  return data.items;
}

export async function createSubmittalItem(
  projectId: number,
  payload: Partial<SubmittalItem>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/field-docs/projects/${projectId}/submittals/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateSubmittalItem(
  projectId: number,
  submittalId: number,
  payload: Partial<SubmittalItem>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/submittals/${submittalId}/update`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
    },
  );
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteSubmittalItem(
  projectId: number,
  submittalId: number,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(
    `/api/admin/field-docs/projects/${projectId}/submittals/${submittalId}/delete`,
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
