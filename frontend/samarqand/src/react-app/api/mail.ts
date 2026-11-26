import { apiFetch, fetchJson, getCookie, readApiErrorCode, readApiResponse } from "@/react-app/api/site";

export type MailFolder = {
  key: string;
  label: string;
  count: number;
  unread: number;
};

export type MailAttachment = {
  id: number;
  filename: string;
  fileSize: number;
  contentType: string;
  documentId: number;
};

export type MailMessage = {
  id: number;
  senderId: number;
  senderName: string;
  recipients: number[];
  cc: number[];
  bcc: number[];
  subject: string;
  body: string;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  isIncoming: boolean;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  attachments: MailAttachment[];
  parent?: MailMessage | null;
};

export type MailUser = {
  id: number;
  username: string;
  fullName: string;
};

export async function fetchMailFolders(): Promise<{ folders: MailFolder[] }> {
  return fetchJson("/api/admin/mail/folders");
}

export async function fetchMailMessages(params?: {
  folder?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: MailMessage[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams();
  if (params?.folder) query.set("folder", params.folder);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return fetchJson(`/api/admin/mail/messages${qs ? `?${qs}` : ""}`);
}

export async function fetchMailMessageDetail(msgId: number): Promise<{ message: MailMessage }> {
  return fetchJson(`/api/admin/mail/messages/${msgId}`);
}

export async function sendMail(payload: {
  subject: string;
  body: string;
  recipients: number[];
  cc?: number[];
  bcc?: number[];
  parentId?: number | null;
  saveAsDraft?: boolean;
  attachmentIds?: number[];
}): Promise<{ ok: boolean; message?: MailMessage; error?: string }> {
  const res = await apiFetch("/api/admin/mail/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ message: MailMessage }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, message: data.result.message };
}

export async function updateMailMessage(
  msgId: number,
  payload: {
    subject?: string;
    body?: string;
    recipients?: number[];
    cc?: number[];
    bcc?: number[];
    sendNow?: boolean;
  },
): Promise<{ ok: boolean; message?: MailMessage; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ message: MailMessage }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, message: data.result.message };
}

export async function deleteMailMessage(msgId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ deleted: boolean }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function hardDeleteMailMessage(msgId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/hard-delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ deleted: boolean }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function toggleStarMailMessage(msgId: number): Promise<{ ok: boolean; isStarred?: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/star`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ isStarred: boolean }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, isStarred: data.result.isStarred };
}

export async function markMailRead(msgId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/read`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  if (!res.ok) return { ok: false };
  return { ok: true };
}

export async function markMailUnread(msgId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/unread`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  if (!res.ok) return { ok: false };
  return { ok: true };
}

export async function moveMailMessage(msgId: number, folder: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/mail/messages/${msgId}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({ folder }),
    credentials: "same-origin",
  });
  if (!res.ok) return { ok: false };
  return { ok: true };
}

export async function fetchMailUsers(search?: string): Promise<{ users: MailUser[] }> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return fetchJson(`/api/admin/mail/users${query}`);
}

export async function uploadMailAttachment(file: File): Promise<{
  ok: boolean;
  attachment?: { id: number; filename: string; fileSize: number; contentType: string; documentId: number; url: string };
  error?: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/api/admin/mail/attachments/upload", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  const data = await readApiResponse<{
    attachment: { id: number; filename: string; fileSize: number; contentType: string; documentId: number; url: string };
  }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, attachment: data.result.attachment };
}
