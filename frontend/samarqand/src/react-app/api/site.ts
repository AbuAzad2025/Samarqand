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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`${url} ${res.status}`);
  }
  return (await res.json()) as T;
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
  groups: string[];
}> {
  return fetchJson<{
    authenticated: boolean;
    username: string;
    isStaff: boolean;
    isSuperuser: boolean;
    groups: string[];
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

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function createOrUpdateUser(input: {
  username: string;
  password?: string;
  role: "manager" | "superadmin";
}): Promise<{ ok: boolean; created?: boolean; generatedPassword?: string; error?: string }> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error || "forbidden" };
  }
  return { ok: true, created: Boolean(data.created), generatedPassword: data.generatedPassword };
}

export async function logout(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function changePassword(input: {
  oldPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/settings/company/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/settings/home/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/settings/ai/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/settings/calculator/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || "error" };
  }
  return { ok: true };
}

export type AdminVisibilitySettingsPayload = {
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

export async function fetchAdminVisibilitySettings(): Promise<AdminVisibilitySettingsPayload> {
  return fetchJson<AdminVisibilitySettingsPayload>("/api/admin/settings/visibility");
}

export async function updateAdminVisibilitySettings(
  payload: Partial<AdminVisibilitySettingsPayload>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/settings/visibility/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/team/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
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
  const res = await fetch(`/api/admin/team/${memberId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, imageId: data.imageId, imageUrl: data.imageUrl };
}

export async function deleteAdminTeamMember(memberId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/team/${memberId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function reorderAdminTeam(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/team/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/services/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminService(
  serviceId: number,
  payload: Partial<Omit<AdminServiceDetail, "id" | "live" | "firstPublishedAt" | "coverUrl">> & { slug?: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/services/${serviceId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function publishAdminService(serviceId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/services/${serviceId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function unpublishAdminService(serviceId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/services/${serviceId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function deleteAdminService(serviceId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/services/${serviceId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
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
  const res = await fetch("/api/admin/testimonials/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminTestimonial(
  itemId: number,
  payload: Partial<Omit<AdminTestimonial, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/testimonials/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminTestimonial(itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/testimonials/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function reorderAdminTestimonials(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/testimonials/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/home/trust-badges/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminHomeTrustBadge(
  itemId: number,
  payload: Partial<Omit<AdminHomeTrustBadge, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/home/trust-badges/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminHomeTrustBadge(itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/home/trust-badges/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function reorderAdminHomeTrustBadges(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/home/trust-badges/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/home/stats/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminHomeStat(
  itemId: number,
  payload: Partial<Omit<AdminHomeStat, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/home/stats/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminHomeStat(itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/home/stats/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function reorderAdminHomeStats(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/home/stats/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/home/timeline/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminHomeTimelineStep(
  itemId: number,
  payload: Partial<Omit<AdminHomeTimelineStep, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/home/timeline/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminHomeTimelineStep(itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/home/timeline/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function reorderAdminHomeTimeline(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/home/timeline/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/home/ai-features/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminHomeAIFeature(
  itemId: number,
  payload: Partial<Omit<AdminHomeAIFeature, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/home/ai-features/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminHomeAIFeature(itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/home/ai-features/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function reorderAdminHomeAIFeatures(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/home/ai-features/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/home/ai-metrics/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminHomeAIMetric(
  itemId: number,
  payload: Partial<Omit<AdminHomeAIMetric, "id">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/home/ai-metrics/${itemId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminHomeAIMetric(itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/home/ai-metrics/${itemId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function reorderAdminHomeAIMetrics(input: { ids: number[] }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/home/ai-metrics/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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

export async function createAdminProject(payload: {
  title: string;
  slug?: string;
  shortDescription?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await fetch("/api/admin/projects/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminProject(
  projectId: number,
  payload: Partial<Omit<AdminProjectDetail, "id" | "gallery" | "live">> & { slug?: string },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/projects/${projectId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function publishAdminProject(projectId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/projects/${projectId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function unpublishAdminProject(projectId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/projects/${projectId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function deleteAdminProject(projectId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/projects/${projectId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
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
  const res = await fetch("/api/admin/articles/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminArticle(
  articleId: number,
  payload: Partial<Omit<AdminArticleDetail, "id" | "live" | "firstPublishedAt" | "coverUrl">> & {
    slug?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/articles/${articleId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function publishAdminArticle(articleId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/articles/${articleId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function unpublishAdminArticle(articleId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/articles/${articleId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function deleteAdminArticle(articleId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/articles/${articleId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
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
  const res = await fetch("/api/admin/rfq/documents/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminRfqDocument(
  docId: number,
  payload: Partial<Pick<AdminRfqDocumentDetail, "title" | "templateKey" | "currency" | "data">>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/rfq/documents/${docId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function deleteAdminRfqDocument(docId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/rfq/documents/${docId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
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
  const res = await fetch("/api/admin/images/upload", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false };
  return { ok: true, id: data.id, url: data.url };
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
  const res = await fetch(`/api/admin/media/images/${imageId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/media/documents/upload", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false };
  return { ok: true, id: data.id, url: data.url };
}

export async function deleteAdminMediaDocument(docId: number): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/media/documents/${docId}/delete`, {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
  const res = await fetch("/api/admin/pages/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true, id: data.id };
}

export async function updateAdminPage(pageId: number, payload: Partial<AdminPageDetail> & { slug?: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/pages/${pageId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
  return { ok: true };
}

export async function publishAdminPage(pageId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/pages/${pageId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function unpublishAdminPage(pageId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/pages/${pageId}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function deleteAdminPage(pageId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/pages/${pageId}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function addAdminProjectGalleryItem(projectId: number, input: { imageId: number; caption?: string }): Promise<{ ok: boolean; id?: number; url?: string }> {
  const res = await fetch(`/api/admin/projects/${projectId}/gallery/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false };
  return { ok: true, id: data.id, url: data.url };
}

export async function removeAdminProjectGalleryItem(projectId: number, itemId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/admin/projects/${projectId}/gallery/${itemId}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") || "" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  });
  return { ok: res.ok };
}

export async function downloadAdminBackup(): Promise<void> {
  const res = await fetch("/api/admin/backup/export", {
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
  const res = await fetch("/api/admin/backup/import", {
    method: "POST",
    headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
    body: form,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error || "error" };
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
