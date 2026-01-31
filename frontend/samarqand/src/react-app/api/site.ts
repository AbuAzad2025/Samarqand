export type CompanyPayload = {
  name: string;
  brandTitle: string;
  brandSubtitle: string;
  slogan: string;
  description: string;
  mission: string;
  vision: string;
  topbarSlogan: string;
  address: string;
  registrationStatus: string;
  chamberMembership: string;
  classification: string;
  email: string;
  phone1: string;
  phone2: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  logoUrl: string;
};

export type ServicePayload = {
  id: number;
  title: string;
  slug: string;
  url: string;
  description: string;
  imageUrl: string;
};

export type ProjectPayload = {
  id: number;
  title: string;
  slug: string;
  url: string;
  category: string;
  description: string;
  location: string;
  year: string;
  imageUrl: string;
};

export type TeamMemberPayload = {
  id: number;
  name: string;
  position: string;
  specialization: string;
  experience: string;
  bio: string;
  imageUrl: string;
};

export type TestimonialPayload = {
  id: number;
  name: string;
  project: string;
  text: string;
  rating: number;
};

export type HomeSectionPayload = {
  trustBadges: {
    id: number;
    title: string;
    description: string;
    iconClass: string;
  }[];
  stats: {
    id: number;
    label: string;
    value: string;
    iconClass: string;
  }[];
  timelineSteps: {
    id: number;
    title: string;
    description: string;
    iconClass: string;
  }[];
  aiFeatures: {
    id: number;
    title: string;
    description: string;
    badgeText: string;
  }[];
  aiMetrics: {
    id: number;
    value: string;
    label: string;
  }[];
};

const _apiBaseUrlRaw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "";
const _apiBaseUrl = _apiBaseUrlRaw.replace(/\/+$/, "");

export function apiUrl(input: string): string {
  if (!_apiBaseUrl) return input;
  if (/^https?:\/\//i.test(input) || input.startsWith("//")) return input;
  if (input.startsWith("/")) return `${_apiBaseUrl}${input}`;
  return `${_apiBaseUrl}/${input}`;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), {
    ...init,
    credentials: init?.credentials || "same-origin",
  });
}

type ApiError = { code: string; message?: string; details?: unknown };
type ApiResponse<T> = { ok: true; result: T } | { ok: false; error: ApiError };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(`${apiUrl(url)} ${res.status}`);
  }
  const payload = (await res.json()) as ApiResponse<T>;
  if (!payload || payload.ok !== true) {
    const code = (payload as { error?: ApiError } | null)?.error?.code || "error";
    throw new Error(code);
  }
  return payload.result;
}

async function readApiResponse<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

function readApiErrorCode(payload: ApiResponse<unknown> | null): string {
  return payload && payload.ok === false ? payload.error.code : "error";
}

function getCookie(name: string): string | null {
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const c of cookies) {
    const cookie = c.trim();
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.slice(name.length + 1));
    }
  }
  return null;
}

export async function fetchCompany(): Promise<CompanyPayload> {
  return fetchJson<CompanyPayload>("/api/site/company");
}

export type SiteConfigPayload = {
  visibility: {
    showServices: boolean;
    showProjects: boolean;
    showTools: boolean;
    showShowcase: boolean;
    showAbout: boolean;
    showContact: boolean;
    showTeam: boolean;
    showTestimonials: boolean;
    showHomeTrustBadges: boolean;
    showHomeStats: boolean;
    showHomeTimeline: boolean;
    showHomeQuickLinks: boolean;
    showRfqTemplates: boolean;
    showHomeAIBanner: boolean;
    showNewsletter: boolean;
    showAIChatbot: boolean;
    showWhatsAppButton: boolean;
    showFloatingCTA: boolean;
    showFooter: boolean;
  };
};

export async function fetchSiteConfig(): Promise<SiteConfigPayload> {
  return fetchJson<SiteConfigPayload>("/api/site/config");
}

export async function fetchAuthAccess(): Promise<{ canUseRestrictedTools: boolean }> {
  return fetchJson<{ canUseRestrictedTools: boolean }>("/api/auth/access");
}

export async function fetchAuthMe(): Promise<{
  authenticated: boolean;
  username: string;
  isStaff: boolean;
  isSuperuser: boolean;
  role: string;
  groups: string[];
  workerId: number;
}> {
  return fetchJson<{
    authenticated: boolean;
    username: string;
    isStaff: boolean;
    isSuperuser: boolean;
    role: string;
    groups: string[];
    workerId: number;
  }>("/api/auth/me");
}

export async function login(input: {
  username: string;
  password: string;
}): Promise<{ ok: boolean }> {
  if (!getCookie("csrftoken")) {
    try {
      await fetchAuthMe();
    } catch (e) {
      void e;
    }
  }

  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function createOrUpdateUser(input: {
  username: string;
  password?: string;
  role:
    | "guest"
    | "registered_guest"
    | "employee"
    | "registrar"
    | "accountant"
    | "manager"
    | "superadmin";
}): Promise<{ ok: boolean; created?: boolean; generatedPassword?: string; error?: string }> {
  const res = await apiFetch("/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{
    created: boolean;
    generatedPassword: string | null;
  }>(res);
  if (!res.ok || !data || data.ok !== true) {
    const code = data && data.ok === false ? data.error.code : "forbidden";
    return { ok: false, error: code };
  }
  return {
    ok: true,
    created: Boolean(data.result.created),
    generatedPassword: data.result.generatedPassword || undefined,
  };
}

export type AdminUserListItem = {
  id: number;
  username: string;
  isSuperuser: boolean;
  role: string;
  groups: string[];
  workerId: number;
};

export async function fetchAdminUsersList(input?: { limit?: number }): Promise<AdminUserListItem[]> {
  const limit = Number(input?.limit) || 200;
  const qs = `?limit=${encodeURIComponent(String(limit))}`;
  const data = await fetchJson<{ items: AdminUserListItem[] }>(`/api/admin/users/list${qs}`);
  return data.items;
}

export async function logout(): Promise<{ ok: boolean }> {
  const res = await apiFetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function changePassword(input: {
  oldPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await readApiResponse<unknown>(res);
    return { ok: false, error: readApiErrorCode(data) };
  }
  return { ok: true };
}

export async function fetchAdminSummary(): Promise<{
  warnings: string[];
  counts: Record<string, number>;
  links: { djangoAdmin: string; publicSite: string; tools: string };
}> {
  return fetchJson<{
    warnings: string[];
    counts: Record<string, number>;
    links: { djangoAdmin: string; publicSite: string; tools: string };
  }>("/api/admin/summary");
}

export type AdminCompanySettingsPayload = Omit<CompanyPayload, "logoUrl"> & {
  logoImageId: number | null;
  logoUrl: string;
};

export async function fetchAdminCompanySettings(): Promise<AdminCompanySettingsPayload> {
  return fetchJson<AdminCompanySettingsPayload>("/api/admin/settings/company");
}

export async function updateAdminCompanySettings(
  payload: Partial<AdminCompanySettingsPayload>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/settings/company/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await readApiResponse<unknown>(res);
    return { ok: false, error: readApiErrorCode(data) };
  }
  return { ok: true };
}

export type AdminHomeSettingsPayload = {
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroLead: string;
  heroPrimaryCtaLabel: string;
  heroPrimaryCtaUrl: string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaUrl: string;
  heroBackgroundImageId: number | null;
  heroBackgroundUrl: string;
  newsletterTitle: string;
  newsletterSubtitle: string;
};

export async function fetchAdminHomeSettings(): Promise<AdminHomeSettingsPayload> {
  return fetchJson<AdminHomeSettingsPayload>("/api/admin/settings/home");
}

export async function updateAdminHomeSettings(
  payload: Partial<AdminHomeSettingsPayload>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/settings/home/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await readApiResponse<unknown>(res);
    return { ok: false, error: readApiErrorCode(data) };
  }
  return { ok: true };
}

export type AdminAISettingsPayload = {
  geminiApiKeyEnvVar: string;
  geminiModel: string;
  geminiEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
  companyContext: string;
  designAnalyzerPrompt: string;
  contentGeneratorPrompt: string;
  chatPrompt: string;
  visualizerPrompt: string;
  visualizerDefaultStyle: string;
  visualizerDefaultAspectRatio: string;
  visualizerPlaceholderPrimaryHex: string;
  visualizerPlaceholderSecondaryHex: string;
  visualizerPlaceholderFooterText: string;
};

export async function fetchAdminAISettings(): Promise<AdminAISettingsPayload> {
  return fetchJson<AdminAISettingsPayload>("/api/admin/settings/ai");
}

export async function updateAdminAISettings(
  payload: Partial<AdminAISettingsPayload>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/settings/ai/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await readApiResponse<unknown>(res);
    return { ok: false, error: readApiErrorCode(data) };
  }
  return { ok: true };
}

export type AdminCalculatorSettingsItem = {
  key: string;
  label: string;
  category: string;
  unit: string;
  basis: "area_total" | "area_per_floor";
  factor: number;
  unitPriceIls: number;
  enabled: boolean;
};

export type AdminCalculatorSettingsPayload = {
  currencyDefault: "ILS" | "USD";
  usdToIlsRate: number;
  laborPercent: number;
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
  includeVat: boolean;
  vatPercent: number;
  items: AdminCalculatorSettingsItem[];

  concreteM3PerM2?: number;
  concreteUnitPriceIls?: number;
  steelKgPerM2?: number;
  steelUnitPriceIls?: number;
  blocksPerM2?: number;
  blockUnitPriceIls?: number;
  tilesM2PerM2?: number;
  tilesUnitPriceIls?: number;
  paintLitersPerM2?: number;
  paintUnitPriceIls?: number;
  electricUnitPriceIls?: number;
  plumbingUnitPriceIls?: number;
};

export async function fetchAdminCalculatorSettings(): Promise<AdminCalculatorSettingsPayload> {
  return fetchJson<AdminCalculatorSettingsPayload>("/api/admin/settings/calculator");
}

export async function updateAdminCalculatorSettings(
  payload: Partial<AdminCalculatorSettingsPayload>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/settings/calculator/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await readApiResponse<unknown>(res);
    return { ok: false, error: readApiErrorCode(data) };
  }
  return { ok: true };
}

export type AdminVisibilitySettingsPayload = {
  showServices: boolean;
  showProjects: boolean;
  showControlProjectsManagement: boolean;
  showTools: boolean;
  showShowcase: boolean;
  showAbout: boolean;
  showContact: boolean;
  showTeam: boolean;
  showTestimonials: boolean;
  showHomeTrustBadges: boolean;
  showHomeStats: boolean;
  showHomeTimeline: boolean;
  showHomeQuickLinks: boolean;
  showRfqTemplates: boolean;
  showHomeAIBanner: boolean;
  showNewsletter: boolean;
  showAIChatbot: boolean;
  showWhatsAppButton: boolean;
  showFloatingCTA: boolean;
  showFooter: boolean;
};

export async function fetchAdminVisibilitySettings(): Promise<AdminVisibilitySettingsPayload> {
  return fetchJson<AdminVisibilitySettingsPayload>("/api/admin/settings/visibility");
}

export async function updateAdminVisibilitySettings(
  payload: Partial<AdminVisibilitySettingsPayload>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/settings/visibility/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await readApiResponse<unknown>(res);
    return { ok: false, error: readApiErrorCode(data) };
  }
  return { ok: true };
}

export type AdminTeamMember = {
  id: number;
  sortOrder: number;
  name: string;
  position: string;
  specialization: string;
  experience: string;
  bio: string;
  imageId: number | null;
  imageUrl: string;
};

export async function fetchAdminTeam(): Promise<AdminTeamMember[]> {
  const data = await fetchJson<{ items: AdminTeamMember[] }>("/api/admin/team");
  return data.items;
}

export async function createAdminTeamMember(payload: {
  name: string;
  position?: string;
  specialization?: string;
  experience?: string;
  bio?: string;
  imageId?: number | null;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/team/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminTeamMember(
  memberId: number,
  payload: Partial<{
    sortOrder: number;
    name: string;
    position: string;
    specialization: string;
    experience: string;
    bio: string;
    imageId: number | null;
  }>,
): Promise<{ ok: boolean; error?: string; imageId?: number | null; imageUrl?: string }> {
  const res = await apiFetch(`/api/admin/team/${memberId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ imageUrl: string; imageId: number | null }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, imageId: data.result.imageId, imageUrl: data.result.imageUrl };
}

export async function deleteAdminTeamMember(memberId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/team/${memberId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function reorderAdminTeam(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/team/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminServiceListItem = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  firstPublishedAt: string;
  coverUrl: string;
  shortDescription: string;
};

export async function fetchAdminServices(): Promise<AdminServiceListItem[]> {
  const data = await fetchJson<{ items: AdminServiceListItem[] }>("/api/admin/services");
  return data.items;
}

export type AdminServiceDetail = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  firstPublishedAt: string;
  shortDescription: string;
  coverImageId: number | null;
  coverUrl: string;
  bodyHtml: string;
};

export async function fetchAdminServiceDetail(serviceId: number): Promise<AdminServiceDetail> {
  return fetchJson<AdminServiceDetail>(`/api/admin/services/${serviceId}`);
}

export async function createAdminService(payload: {
  title: string;
  slug?: string;
  shortDescription?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/services/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminService(
  serviceId: number,
  payload: Partial<Omit<AdminServiceDetail, "id" | "live" | "firstPublishedAt" | "coverUrl">> & { slug?: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/services/${serviceId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function publishAdminService(serviceId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/services/${serviceId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function unpublishAdminService(serviceId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/services/${serviceId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function deleteAdminService(serviceId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/services/${serviceId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export type AdminTestimonial = {
  id: number;
  sortOrder: number;
  name: string;
  project: string;
  text: string;
  rating: number;
};

export async function fetchAdminTestimonials(): Promise<AdminTestimonial[]> {
  const data = await fetchJson<{ items: AdminTestimonial[] }>("/api/admin/testimonials");
  return data.items;
}

export async function createAdminTestimonial(payload: {
  name: string;
  project?: string;
  text: string;
  rating?: number;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/testimonials/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminTestimonial(
  itemId: number,
  payload: Partial<Omit<AdminTestimonial, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/testimonials/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminTestimonial(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/testimonials/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function reorderAdminTestimonials(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/testimonials/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminHomeTrustBadge = {
  id: number;
  sortOrder: number;
  title: string;
  description: string;
  iconClass: string;
};

export async function fetchAdminHomeTrustBadges(): Promise<AdminHomeTrustBadge[]> {
  const data = await fetchJson<{ items: AdminHomeTrustBadge[] }>("/api/admin/home/trust-badges");
  return data.items;
}

export async function createAdminHomeTrustBadge(payload: {
  title: string;
  description?: string;
  iconClass?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/home/trust-badges/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminHomeTrustBadge(
  itemId: number,
  payload: Partial<Omit<AdminHomeTrustBadge, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/home/trust-badges/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminHomeTrustBadge(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/home/trust-badges/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function reorderAdminHomeTrustBadges(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/home/trust-badges/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminHomeStat = {
  id: number;
  sortOrder: number;
  label: string;
  value: string;
  iconClass: string;
};

export async function fetchAdminHomeStats(): Promise<AdminHomeStat[]> {
  const data = await fetchJson<{ items: AdminHomeStat[] }>("/api/admin/home/stats");
  return data.items;
}

export async function createAdminHomeStat(payload: {
  label: string;
  value: string;
  iconClass?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/home/stats/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminHomeStat(
  itemId: number,
  payload: Partial<Omit<AdminHomeStat, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/home/stats/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminHomeStat(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/home/stats/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function reorderAdminHomeStats(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/home/stats/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminHomeTimelineStep = {
  id: number;
  sortOrder: number;
  title: string;
  description: string;
  iconClass: string;
};

export async function fetchAdminHomeTimeline(): Promise<AdminHomeTimelineStep[]> {
  const data = await fetchJson<{ items: AdminHomeTimelineStep[] }>("/api/admin/home/timeline");
  return data.items;
}

export async function createAdminHomeTimelineStep(payload: {
  title: string;
  description?: string;
  iconClass?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/home/timeline/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminHomeTimelineStep(
  itemId: number,
  payload: Partial<Omit<AdminHomeTimelineStep, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/home/timeline/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminHomeTimelineStep(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/home/timeline/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function reorderAdminHomeTimeline(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/home/timeline/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminHomeAIFeature = {
  id: number;
  sortOrder: number;
  title: string;
  description: string;
  badgeText: string;
};

export async function fetchAdminHomeAIFeatures(): Promise<AdminHomeAIFeature[]> {
  const data = await fetchJson<{ items: AdminHomeAIFeature[] }>("/api/admin/home/ai-features");
  return data.items;
}

export async function createAdminHomeAIFeature(payload: {
  title: string;
  description?: string;
  badgeText?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/home/ai-features/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminHomeAIFeature(
  itemId: number,
  payload: Partial<Omit<AdminHomeAIFeature, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/home/ai-features/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminHomeAIFeature(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/home/ai-features/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function reorderAdminHomeAIFeatures(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/home/ai-features/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminHomeAIMetric = {
  id: number;
  sortOrder: number;
  value: string;
  label: string;
};

export async function fetchAdminHomeAIMetrics(): Promise<AdminHomeAIMetric[]> {
  const data = await fetchJson<{ items: AdminHomeAIMetric[] }>("/api/admin/home/ai-metrics");
  return data.items;
}

export async function createAdminHomeAIMetric(payload: {
  value: string;
  label: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/home/ai-metrics/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminHomeAIMetric(
  itemId: number,
  payload: Partial<Omit<AdminHomeAIMetric, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/home/ai-metrics/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminHomeAIMetric(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/home/ai-metrics/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function reorderAdminHomeAIMetrics(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/home/ai-metrics/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminProjectListItem = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  firstPublishedAt: string;
  coverUrl: string;
  shortDescription: string;
  status: string;
  pmpPhase: string;
  progressPercent: number;
  clientName: string;
  projectLocation: string;
  completionYear: number | null;
};

export async function fetchAdminProjects(): Promise<AdminProjectListItem[]> {
  const data = await fetchJson<{ items: AdminProjectListItem[] }>("/api/admin/projects");
  return data.items;
}

export type AdminProjectDetail = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  shortDescription: string;
  status: string;
  pmpPhase: string;
  progressPercent: number;
  startDate: string;
  targetEndDate: string;
  budgetAmount: string;
  scopeStatement: string;
  keyDeliverables: string;
  keyStakeholders: string;
  keyRisks: string;
  managementNotes: string;
  clientName: string;
  projectLocation: string;
  completionYear: number | null;
  executingAgency: string;
  projectOwner: string;
  funder: string;
  supervisor: string;
  companyRole: string;
  scopeOfWork: string;
  gallery: { id: number; imageId: number | null; url: string; caption: string; sortOrder: number }[];
};

export async function fetchAdminProjectDetail(projectId: number): Promise<AdminProjectDetail> {
  return fetchJson<AdminProjectDetail>(`/api/admin/projects/${projectId}`);
}

export async function reorderAdminProjects(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/projects/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function createAdminProject(payload: {
  title: string;
  slug?: string;
  shortDescription?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/projects/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminProject(
  projectId: number,
  payload: Partial<Omit<AdminProjectDetail, "id" | "gallery" | "live">> & { slug?: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function publishAdminProject(projectId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function unpublishAdminProject(projectId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function deleteAdminProject(projectId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export type AdminOpsClient = {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchAdminOpsClients(): Promise<AdminOpsClient[]> {
  const data = await fetchJson<{ items: AdminOpsClient[] }>("/api/admin/ops/clients");
  return data.items;
}

export async function createAdminOpsClient(payload: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/clients/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsClient(
  clientId: number,
  payload: Partial<{
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/clients/${clientId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsClient(clientId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/clients/${clientId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsSupplier = {
  id: number;
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

export async function fetchAdminOpsSuppliers(): Promise<AdminOpsSupplier[]> {
  const data = await fetchJson<{ items: AdminOpsSupplier[] }>("/api/admin/ops/suppliers");
  return data.items;
}

export async function createAdminOpsSupplier(payload: {
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/suppliers/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsSupplier(
  supplierId: number,
  payload: Partial<{
    name: string;
    category: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/suppliers/${supplierId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsSupplier(supplierId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/suppliers/${supplierId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsContract = {
  id: number;
  projectId: number;
  projectTitle: string;
  clientId: number;
  clientName: string;
  title: string;
  number: string;
  status: string;
  startDate: string;
  endDate: string;
  amount: number;
  notes: string;
};

export async function fetchAdminOpsContracts(): Promise<AdminOpsContract[]> {
  const data = await fetchJson<{ items: AdminOpsContract[] }>("/api/admin/ops/contracts");
  return data.items;
}

export type AdminOpsContractAddendum = {
  id: number;
  title: string;
  amountDelta: number;
  startDate: string;
  endDate: string;
  notes: string;
};

export async function fetchAdminOpsContractAddendums(contractId: number): Promise<AdminOpsContractAddendum[]> {
  const data = await fetchJson<{ items: AdminOpsContractAddendum[] }>(`/api/admin/ops/contracts/${contractId}/addendums`);
  return data.items;
}

export async function createAdminOpsContractAddendum(
  contractId: number,
  payload: {
    title?: string;
    amountDelta?: number | string | null;
    startDate?: string;
    endDate?: string;
    notes?: string;
  },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/contracts/${contractId}/addendums/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export type AdminOpsContractPayment = {
  id: number;
  title: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  paidDate: string;
  status: string;
  notes: string;
};

export async function fetchAdminOpsContractPayments(contractId: number): Promise<AdminOpsContractPayment[]> {
  const data = await fetchJson<{ items: AdminOpsContractPayment[] }>(`/api/admin/ops/contracts/${contractId}/payments`);
  return data.items;
}

export async function createAdminOpsContractPayment(
  contractId: number,
  payload: {
    title?: string;
    dueDate?: string;
    amount?: number | string | null;
    paidAmount?: number | string | null;
    paidDate?: string;
    status?: string;
    notes?: string;
  },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/contracts/${contractId}/payments/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsContractPayment(
  paymentId: number,
  payload: Partial<{
    title: string;
    dueDate: string;
    amount: number | string | null;
    paidAmount: number | string | null;
    paidDate: string;
    status: string;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/contract-payments/${paymentId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsContractPayment(paymentId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/contract-payments/${paymentId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function createAdminOpsContract(payload: {
  projectId?: number | null;
  clientId?: number | null;
  title?: string;
  number?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  amount?: number | string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/contracts/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsContract(
  contractId: number,
  payload: Partial<{
    projectId: number | null;
    clientId: number | null;
    title: string;
    number: string;
    status: string;
    startDate: string;
    endDate: string;
    amount: number | string;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/contracts/${contractId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsContract(contractId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/contracts/${contractId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsPurchaseOrder = {
  id: number;
  supplierId: number;
  supplierName: string;
  projectId: number;
  projectTitle: string;
  number: string;
  date: string;
  status: string;
  totalAmount: number;
  notes: string;
};

export async function fetchAdminOpsPurchaseOrders(): Promise<AdminOpsPurchaseOrder[]> {
  const data = await fetchJson<{ items: AdminOpsPurchaseOrder[] }>("/api/admin/ops/purchase-orders");
  return data.items;
}

export async function createAdminOpsPurchaseOrder(payload: {
  supplierId?: number | null;
  projectId?: number | null;
  number?: string;
  date?: string;
  status?: string;
  totalAmount?: number | string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/purchase-orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsPurchaseOrder(
  purchaseOrderId: number,
  payload: Partial<{
    supplierId: number | null;
    projectId: number | null;
    number: string;
    date: string;
    status: string;
    totalAmount: number | string;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/purchase-orders/${purchaseOrderId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsPurchaseOrder(purchaseOrderId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/purchase-orders/${purchaseOrderId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsInventoryItem = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  currentQty: number;
  reorderLevel: number | null;
  notes: string;
};

export async function fetchAdminOpsInventoryItems(): Promise<AdminOpsInventoryItem[]> {
  const data = await fetchJson<{ items: AdminOpsInventoryItem[] }>("/api/admin/ops/inventory/items");
  return data.items;
}

export async function createAdminOpsInventoryItem(payload: {
  sku?: string;
  name: string;
  unit?: string;
  currentQty?: number | string;
  reorderLevel?: number | string | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/inventory/items/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsInventoryItem(
  itemId: number,
  payload: Partial<{
    sku: string;
    name: string;
    unit: string;
    currentQty: number | string;
    reorderLevel: number | string | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/inventory/items/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsInventoryItem(itemId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/inventory/items/${itemId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsInventoryTransaction = {
  id: number;
  itemId: number;
  itemName: string;
  projectId: number;
  projectTitle: string;
  kind: string;
  quantity: number;
  unitCost: number | null;
  date: string;
  reference: string;
  notes: string;
};

export async function fetchAdminOpsInventoryTransactions(input?: {
  itemId?: number;
}): Promise<AdminOpsInventoryTransaction[]> {
  const qs = input?.itemId ? `?itemId=${encodeURIComponent(String(input.itemId))}` : "";
  const data = await fetchJson<{ items: AdminOpsInventoryTransaction[] }>(`/api/admin/ops/inventory/transactions${qs}`);
  return data.items;
}

export async function createAdminOpsInventoryTransaction(payload: {
  itemId: number;
  projectId?: number | null;
  kind: string;
  quantity: number | string;
  unitCost?: number | string | null;
  date?: string;
  reference?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/inventory/transactions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export type AdminOpsWorker = {
  id: number;
  userId: number;
  userUsername: string;
  name: string;
  role: string;
  phone: string;
  timeClockId: string;
  kind: string;
  active: boolean;
  dailyCost: number | null;
  monthlySalary: number | null;
  notes: string;
};

export async function fetchAdminOpsWorkers(): Promise<AdminOpsWorker[]> {
  const data = await fetchJson<{ items: AdminOpsWorker[] }>("/api/admin/ops/workers");
  return data.items;
}

export async function createAdminOpsWorker(payload: {
  userId?: number | null;
  name: string;
  role?: string;
  phone?: string;
  timeClockId?: string;
  kind?: string;
  active?: boolean;
  dailyCost?: number | string | null;
  monthlySalary?: number | string | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/workers/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsWorker(
  workerId: number,
  payload: Partial<{
    userId: number | null;
    name: string;
    role: string;
    phone: string;
    timeClockId: string;
    kind: string;
    active: boolean;
    dailyCost: number | string | null;
    monthlySalary: number | string | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/workers/${workerId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsWorker(workerId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/workers/${workerId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsAttendance = {
  id: number;
  workerId: number;
  workerName: string;
  projectId: number;
  projectTitle: string;
  date: string;
  status: string;
  hours: number | null;
  notes: string;
};

export async function fetchAdminOpsAttendance(input?: {
  workerId?: number;
  year?: number;
  month?: number;
}): Promise<AdminOpsAttendance[]> {
  const qsParts: string[] = [];
  if (input?.workerId) qsParts.push(`workerId=${encodeURIComponent(String(input.workerId))}`);
  if (input?.year) qsParts.push(`year=${encodeURIComponent(String(input.year))}`);
  if (input?.month) qsParts.push(`month=${encodeURIComponent(String(input.month))}`);
  const qs = qsParts.length ? `?${qsParts.join("&")}` : "";
  const data = await fetchJson<{ items: AdminOpsAttendance[] }>(`/api/admin/ops/attendance${qs}`);
  return data.items;
}

export async function createAdminOpsAttendance(payload: {
  workerId: number;
  date: string;
  status?: string;
  hours?: number | string | null;
  projectId?: number | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; created?: boolean; error?: string }> {
  const res = await apiFetch("/api/admin/ops/attendance/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number; created: boolean }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id, created: data.result.created };
}

export type AdminOpsTimeclockImportItem = {
  workerId?: number;
  timeClockId?: string;
  date: string;
  projectId?: number | null;
  hours?: number | string | null;
  checkIn?: string;
  checkOut?: string;
  checkInAt?: string;
  checkOutAt?: string;
  status?: string;
  notes?: string;
};

export async function importAdminOpsTimeclock(
  items: AdminOpsTimeclockImportItem[],
  input?: { dryRun?: boolean; defaultProjectId?: number | null },
): Promise<{
  ok: boolean;
  dryRun?: boolean;
  createdCount?: number;
  updatedCount?: number;
  errors?: unknown[];
  results?: unknown[];
  error?: string;
}> {
  const res = await apiFetch("/api/admin/ops/timeclock/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({ items, dryRun: Boolean(input?.dryRun), defaultProjectId: input?.defaultProjectId ?? null }),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{
    dryRun: boolean;
    createdCount: number;
    updatedCount: number;
    errors: unknown[];
    results: unknown[];
  }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, ...data.result };
}

export async function importAdminOpsTimeclockFromFolder(input?: {
  dryRun?: boolean;
  defaultProjectId?: number | null;
  limitFiles?: number;
}): Promise<{
  ok: boolean;
  dryRun?: boolean;
  files?: string[];
  createdCount?: number;
  updatedCount?: number;
  errors?: unknown[];
  results?: unknown[];
  error?: string;
}> {
  const res = await apiFetch("/api/admin/ops/timeclock/import-from-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({
      dryRun: Boolean(input?.dryRun),
      defaultProjectId: input?.defaultProjectId ?? null,
      limitFiles: input?.limitFiles ?? null,
    }),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{
    dryRun: boolean;
    files: string[];
    createdCount: number;
    updatedCount: number;
    errors: unknown[];
    results: unknown[];
  }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, ...data.result };
}

export type AdminOpsTimeclockImportRun = {
  id: number;
  createdAt: string;
  actorId: number;
  actorUsername: string;
  role: string;
  source: string;
  dryRun: boolean;
  defaultProjectId: number;
  defaultProjectTitle: string;
  itemsCount: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
};

export async function fetchAdminOpsTimeclockRuns(input?: {
  limit?: number;
}): Promise<AdminOpsTimeclockImportRun[]> {
  const limit = Number(input?.limit) || 50;
  const qs = `?limit=${encodeURIComponent(String(limit))}`;
  const data = await fetchJson<{ items: AdminOpsTimeclockImportRun[] }>(`/api/admin/ops/timeclock/runs${qs}`);
  return data.items;
}

export type AdminOpsAuditLog = {
  id: number;
  createdAt: string;
  actorId: number;
  actorUsername: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  meta: unknown;
  ip: string;
  userAgent: string;
};

export async function fetchAdminOpsAuditLogs(input?: {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: number;
  sinceId?: number;
  limit?: number;
}): Promise<AdminOpsAuditLog[]> {
  const qsParts: string[] = [];
  const action = String(input?.action || "").trim();
  const entityType = String(input?.entityType || "").trim();
  const entityId = String(input?.entityId || "").trim();
  if (action) qsParts.push(`action=${encodeURIComponent(action)}`);
  if (entityType) qsParts.push(`entityType=${encodeURIComponent(entityType)}`);
  if (entityId) qsParts.push(`entityId=${encodeURIComponent(entityId)}`);
  if (input?.actorId) qsParts.push(`actorId=${encodeURIComponent(String(input.actorId))}`);
  if (input?.sinceId) qsParts.push(`sinceId=${encodeURIComponent(String(input.sinceId))}`);
  const limit = Number(input?.limit) || 200;
  qsParts.push(`limit=${encodeURIComponent(String(limit))}`);
  const qs = qsParts.length ? `?${qsParts.join("&")}` : "";
  const data = await fetchJson<{ items: AdminOpsAuditLog[] }>(`/api/admin/ops/audit-logs${qs}`);
  return data.items;
}

export async function updateAdminOpsAttendance(
  itemId: number,
  payload: Partial<{
    workerId: number;
    date: string;
    status: string;
    hours: number | string | null;
    projectId: number | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/attendance/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsAttendance(itemId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/attendance/${itemId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsPayrollEntry = {
  id: number;
  workerId: number;
  workerName: string;
  year: number;
  month: number;
  kind: string;
  amount: number | null;
  date: string;
  notes: string;
};

export async function fetchAdminOpsPayroll(input?: {
  workerId?: number;
  year?: number;
  month?: number;
}): Promise<AdminOpsPayrollEntry[]> {
  const qsParts: string[] = [];
  if (input?.workerId) qsParts.push(`workerId=${encodeURIComponent(String(input.workerId))}`);
  if (input?.year) qsParts.push(`year=${encodeURIComponent(String(input.year))}`);
  if (input?.month) qsParts.push(`month=${encodeURIComponent(String(input.month))}`);
  const qs = qsParts.length ? `?${qsParts.join("&")}` : "";
  const data = await fetchJson<{ items: AdminOpsPayrollEntry[] }>(`/api/admin/ops/payroll${qs}`);
  return data.items;
}

export async function generateAdminOpsPayrollFromAttendance(input: {
  year: number | string;
  month: number | string;
  workerId?: number | null;
  dryRun?: boolean;
}): Promise<{
  ok: boolean;
  dryRun?: boolean;
  year?: number;
  month?: number;
  workerId?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  errors?: unknown[];
  results?: unknown[];
  error?: string;
}> {
  const res = await apiFetch("/api/admin/ops/payroll/generate-from-attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({
      year: Number(input.year) || 0,
      month: Number(input.month) || 0,
      workerId: input.workerId ?? null,
      dryRun: Boolean(input.dryRun),
    }),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{
    dryRun: boolean;
    year: number;
    month: number;
    workerId: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: unknown[];
    results: unknown[];
  }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, ...data.result };
}

export async function createAdminOpsPayrollEntry(payload: {
  workerId: number;
  year: number | string;
  month: number | string;
  kind?: string;
  amount: number | string;
  date?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/payroll/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsPayrollEntry(
  entryId: number,
  payload: Partial<{
    workerId: number;
    year: number | string;
    month: number | string;
    kind: string;
    amount: number | string;
    date: string;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/payroll/${entryId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsPayrollEntry(entryId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/payroll/${entryId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsEquipment = {
  id: number;
  name: string;
  code: string;
  status: string;
  hourlyCost: number | null;
  notes: string;
};

export async function fetchAdminOpsEquipment(): Promise<AdminOpsEquipment[]> {
  const data = await fetchJson<{ items: AdminOpsEquipment[] }>("/api/admin/ops/equipment");
  return data.items;
}

export async function createAdminOpsEquipment(payload: {
  name: string;
  code?: string;
  status?: string;
  hourlyCost?: number | string | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/equipment/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsEquipment(
  equipmentId: number,
  payload: Partial<{
    name: string;
    code: string;
    status: string;
    hourlyCost: number | string | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/equipment/${equipmentId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsEquipment(equipmentId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/equipment/${equipmentId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminOpsAssignment = {
  id: number;
  projectId: number;
  projectTitle: string;
  resourceType: string;
  workerId: number;
  workerName: string;
  equipmentId: number;
  equipmentName: string;
  startDate: string;
  endDate: string;
  hoursPerDay: number | null;
  costOverride: number | null;
  notes: string;
};

export async function fetchAdminOpsAssignments(): Promise<AdminOpsAssignment[]> {
  const data = await fetchJson<{ items: AdminOpsAssignment[] }>("/api/admin/ops/assignments");
  return data.items;
}

export async function createAdminOpsAssignment(payload: {
  projectId?: number | null;
  resourceType: string;
  workerId?: number | null;
  equipmentId?: number | null;
  startDate?: string;
  endDate?: string;
  hoursPerDay?: number | string | null;
  costOverride?: number | string | null;
  notes?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/ops/assignments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminOpsAssignment(
  assignmentId: number,
  payload: Partial<{
    projectId: number | null;
    resourceType: string;
    workerId: number | null;
    equipmentId: number | null;
    startDate: string;
    endDate: string;
    hoursPerDay: number | string | null;
    costOverride: number | string | null;
    notes: string;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/assignments/${assignmentId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminOpsAssignment(assignmentId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/ops/assignments/${assignmentId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminKpiProjectItem = {
  projectId: number;
  title: string;
  status: string;
  progressPercent: number;
  budgetAmount: number;
  contractsTotal: number;
  purchaseOrdersTotal: number;
  paidTotal: number;
  variance: number;
};

export async function fetchAdminKpiProjects(): Promise<AdminKpiProjectItem[]> {
  const data = await fetchJson<{ items: AdminKpiProjectItem[] }>("/api/admin/kpi/projects");
  return data.items;
}

export type AdminArticleListItem = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  firstPublishedAt: string;
  coverUrl: string;
  searchDescription: string;
};

export async function fetchAdminArticles(): Promise<AdminArticleListItem[]> {
  const data = await fetchJson<{ items: AdminArticleListItem[] }>("/api/admin/articles");
  return data.items;
}

export type AdminArticleDetail = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  firstPublishedAt: string;
  searchDescription: string;
  coverImageId: number | null;
  coverUrl: string;
  bodyHtml: string;
};

export async function fetchAdminArticleDetail(articleId: number): Promise<AdminArticleDetail> {
  return fetchJson<AdminArticleDetail>(`/api/admin/articles/${articleId}`);
}

export async function createAdminArticle(payload: {
  title: string;
  slug?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/articles/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminArticle(
  articleId: number,
  payload: Partial<Omit<AdminArticleDetail, "id" | "live" | "firstPublishedAt" | "coverUrl">> & {
    slug?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/articles/${articleId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function publishAdminArticle(articleId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/articles/${articleId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function unpublishAdminArticle(articleId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/articles/${articleId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function deleteAdminArticle(articleId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/articles/${articleId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export type AdminRfqDocumentListItem = {
  id: number;
  title: string;
  number: string;
  templateKey: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminRfqDocumentDetail = AdminRfqDocumentListItem & {
  data: Record<string, unknown>;
};

export async function fetchAdminRfqDocuments(): Promise<AdminRfqDocumentListItem[]> {
  const data = await fetchJson<{ items: AdminRfqDocumentListItem[] }>("/api/admin/rfq/documents");
  return data.items;
}

export async function fetchAdminRfqDocumentDetail(docId: number): Promise<AdminRfqDocumentDetail> {
  return fetchJson<AdminRfqDocumentDetail>(`/api/admin/rfq/documents/${docId}`);
}

export async function createAdminRfqDocument(payload: {
  title: string;
  templateKey?: string;
  currency?: string;
  data?: Record<string, unknown>;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/rfq/documents/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminRfqDocument(
  docId: number,
  payload: Partial<Pick<AdminRfqDocumentDetail, "title" | "templateKey" | "currency" | "data">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/rfq/documents/${docId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function deleteAdminRfqDocument(docId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/rfq/documents/${docId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function downloadAdminRfqDocumentPdf(docId: number, filename?: string): Promise<void> {
  const res = await fetch(`/api/admin/rfq/documents/${docId}/pdf`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error("pdf_failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `rfq-${docId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadAdminImage(file: File, title?: string): Promise<{ ok: boolean; id?: number; url?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  const res = await apiFetch("/api/admin/images/upload", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number; url: string }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false };
  return { ok: true, id: data.result.id, url: data.result.url };
}

export type AdminMediaImage = {
  id: number;
  title: string;
  url: string;
  width: number;
  height: number;
  createdAt: string;
};

export async function fetchAdminMediaImages(input?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminMediaImage[]; total: number; limit: number; offset: number }> {
  const q = input?.q ? `q=${encodeURIComponent(input.q)}` : "";
  const limit = typeof input?.limit === "number" ? `limit=${input.limit}` : "";
  const offset = typeof input?.offset === "number" ? `offset=${input.offset}` : "";
  const qs = [q, limit, offset].filter(Boolean).join("&");
  return fetchJson<{ items: AdminMediaImage[]; total: number; limit: number; offset: number }>(
    `/api/admin/media/images${qs ? `?${qs}` : ""}`,
  );
}

export async function deleteAdminMediaImage(imageId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/media/images/${imageId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminMediaDocument = {
  id: number;
  title: string;
  url: string;
  fileSize: number;
  createdAt: string;
};

export async function fetchAdminMediaDocuments(input?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: AdminMediaDocument[]; total: number; limit: number; offset: number }> {
  const q = input?.q ? `q=${encodeURIComponent(input.q)}` : "";
  const limit = typeof input?.limit === "number" ? `limit=${input.limit}` : "";
  const offset = typeof input?.offset === "number" ? `offset=${input.offset}` : "";
  const qs = [q, limit, offset].filter(Boolean).join("&");
  return fetchJson<{ items: AdminMediaDocument[]; total: number; limit: number; offset: number }>(
    `/api/admin/media/documents${qs ? `?${qs}` : ""}`,
  );
}

export async function uploadAdminDocument(file: File, title?: string): Promise<{ ok: boolean; id?: number; url?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  const res = await apiFetch("/api/admin/media/documents/upload", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number; url: string }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false };
  return { ok: true, id: data.result.id, url: data.result.url };
}

export async function deleteAdminMediaDocument(docId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/media/documents/${docId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type AdminPageTreeItem = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  type: string;
  typeName: string;
  url: string;
  parentId: number | null;
  hasChildren: boolean;
  depth: number;
};

export async function fetchAdminPagesTree(parentId?: number): Promise<{
  parent: { id: number; title: string; slug: string; type: string; typeName: string; url: string };
  items: AdminPageTreeItem[];
}> {
  const qs = typeof parentId === "number" ? `?parentId=${parentId}` : "";
  return fetchJson<{
    parent: { id: number; title: string; slug: string; type: string; typeName: string; url: string };
    items: AdminPageTreeItem[];
  }>(`/api/admin/pages/tree${qs}`);
}

export async function fetchAdminPagesAllowedTypes(parentId: number): Promise<{ type: string; typeName: string }[]> {
  const data = await fetchJson<{ items: { type: string; typeName: string }[] }>(
    `/api/admin/pages/allowed-types?parentId=${parentId}`,
  );
  return data.items;
}

export type AdminPageDetail = {
  id: number;
  title: string;
  slug: string;
  live: boolean;
  type: string;
  typeName: string;
  url: string;
  parentId: number | null;
  searchDescription: string;
  bodyHtml: string;
  shortDescription?: string;
  coverImageId?: number | null;
  coverUrl?: string;
  clientName?: string;
  projectLocation?: string;
  completionYear?: number | null;
  executingAgency?: string;
  projectOwner?: string;
  funder?: string;
  supervisor?: string;
  companyRole?: string;
  scopeOfWork?: string;
  issuer?: string;
  certificateId?: string;
  issuedYear?: number | null;
  toAddress?: string;
  subject?: string;
  replyAddress?: string;
};

export async function fetchAdminPageDetail(pageId: number): Promise<AdminPageDetail> {
  return fetchJson<AdminPageDetail>(`/api/admin/pages/${pageId}`);
}

export async function createAdminPage(input: {
  parentId: number;
  type: string;
  title: string;
  slug?: string;
  live?: boolean;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await apiFetch("/api/admin/pages/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true, id: data.result.id };
}

export async function updateAdminPage(pageId: number, payload: Partial<AdminPageDetail> & { slug?: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/pages/${pageId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function publishAdminPage(pageId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/pages/${pageId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function unpublishAdminPage(pageId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/pages/${pageId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function deleteAdminPage(pageId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/pages/${pageId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function addAdminProjectGalleryItem(projectId: number, input: { imageId: number; caption?: string }): Promise<{ ok: boolean; id?: number; url?: string }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/gallery/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number; url: string }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false };
  return { ok: true, id: data.result.id, url: data.result.url };
}

export async function removeAdminProjectGalleryItem(projectId: number, itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/gallery/${itemId}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export type AdminProjectDocument = {
  id: number;
  title: string;
  documentId: number | null;
  url: string;
  downloadUrl: string;
  fileSize: number;
  createdAt: string;
};

export async function fetchAdminProjectDocuments(projectId: number): Promise<AdminProjectDocument[]> {
  const data = await fetchJson<{ items: AdminProjectDocument[] }>(`/api/admin/projects/${projectId}/documents`);
  return data.items;
}

export async function reorderAdminProjectDocuments(
  projectId: number,
  input: { ids: number[] },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/documents/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function updateAdminProjectDocument(
  projectId: number,
  itemId: number,
  payload: { title?: string; sortOrder?: number },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/documents/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function uploadAdminProjectDocument(
  projectId: number,
  file: File,
  title?: string,
): Promise<{ ok: boolean; id?: number; documentId?: number; url?: string; title?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (title) {
    form.append("title", title);
    form.append("rowTitle", title);
  }
  const res = await apiFetch(`/api/admin/projects/${projectId}/documents/upload`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number; documentId: number; url: string; title: string }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false };
  return {
    ok: true,
    id: data.result.id,
    documentId: data.result.documentId,
    url: data.result.url,
    title: data.result.title,
  };
}

export async function removeAdminProjectDocument(projectId: number, itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/projects/${projectId}/documents/${itemId}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export type CompanyDocumentCategory =
  | "template"
  | "letterhead"
  | "invoice"
  | "receipt"
  | "company_document"
  | "company_certificate";

export type AdminCompanyDocument = {
  id: number;
  category: CompanyDocumentCategory;
  sortOrder: number;
  title: string;
  documentId: number | null;
  url: string;
  downloadUrl: string;
  fileSize: number;
  createdAt: string;
};

export async function fetchAdminCompanyDocuments(category: CompanyDocumentCategory): Promise<AdminCompanyDocument[]> {
  const data = await fetchJson<{ items: AdminCompanyDocument[] }>(
    `/api/admin/company-documents?category=${encodeURIComponent(category)}`,
  );
  return data.items;
}

export async function reorderAdminCompanyDocuments(input: {
  category: CompanyDocumentCategory;
  ids: number[];
}): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/company-documents/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function updateAdminCompanyDocument(
  itemId: number,
  payload: { title?: string; sortOrder?: number },
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/admin/company-documents/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export async function uploadAdminCompanyDocument(input: {
  category: CompanyDocumentCategory;
  file: File;
  title?: string;
}): Promise<{ ok: boolean; id?: number; documentId?: number; url?: string; title?: string; category?: string }> {
  const form = new FormData();
  form.append("category", input.category);
  form.append("file", input.file);
  if (input.title) {
    form.append("title", input.title);
    form.append("rowTitle", input.title);
  }
  const res = await apiFetch(`/api/admin/company-documents/upload`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await readApiResponse<{ id: number; documentId: number; url: string; title: string; category: string }>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false };
  return {
    ok: true,
    id: data.result.id,
    documentId: data.result.documentId,
    url: data.result.url,
    title: data.result.title,
    category: data.result.category,
  };
}

export async function removeAdminCompanyDocument(itemId: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/admin/company-documents/${itemId}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  return { ok: Boolean(res.ok && data && data.ok === true) };
}

export async function downloadAdminBackup(): Promise<void> {
  const res = await apiFetch("/api/admin/backup/export", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error("export_failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function restoreAdminBackup(file: File): Promise<{ ok: boolean; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch("/api/admin/backup/import", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await readApiResponse<Record<string, never>>(res);
  if (!res.ok || !data || data.ok !== true) return { ok: false, error: readApiErrorCode(data) };
  return { ok: true };
}

export type HomeSettingsPayload = {
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroLead: string;
  heroPrimaryCtaLabel: string;
  heroPrimaryCtaUrl: string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaUrl: string;
  heroBackgroundUrl: string;
  newsletterTitle: string;
  newsletterSubtitle: string;
};

export async function fetchHomeSettings(): Promise<HomeSettingsPayload> {
  return fetchJson<HomeSettingsPayload>("/api/site/home");
}

export async function fetchServices(): Promise<ServicePayload[]> {
  const data = await fetchJson<{ items: ServicePayload[] }>("/api/site/services");
  return data.items;
}

export async function fetchProjects(): Promise<ProjectPayload[]> {
  const data = await fetchJson<{ items: ProjectPayload[] }>("/api/site/projects");
  return data.items;
}

export async function fetchTeam(): Promise<TeamMemberPayload[]> {
  const data = await fetchJson<{ items: TeamMemberPayload[] }>("/api/site/team");
  return data.items;
}

export async function fetchTestimonials(): Promise<TestimonialPayload[]> {
  const data = await fetchJson<{ items: TestimonialPayload[] }>(
    "/api/site/testimonials",
  );
  return data.items;
}

export async function fetchHomeSections(): Promise<HomeSectionPayload> {
  return fetchJson<HomeSectionPayload>("/api/site/home-sections");
}
