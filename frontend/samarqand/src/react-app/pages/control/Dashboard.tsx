import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import {
  createAdminTeamMember,
  deleteAdminTeamMember,
  fetchAdminSummary,
  fetchAdminTeam,
  reorderAdminTeam,
  updateAdminTeamMember,
  uploadAdminImage,
  type AdminTeamMember,
} from "@/react-app/api/site";
import { isManagerRole, useControlRole } from "@/react-app/utils/controlRole";

type Summary = {
  warnings: string[];
  counts: Record<string, number>;
  links: { backup: string; publicSite: string; tools: string };
};

type Access = "manager" | "ops" | "all";

type CardDef = {
  key: string;
  label: string;
  description: string;
  to: string;
  access: Access;
};

// Ordered by priority: work that needs attention first, then site content.
const CARD_DEFS: CardDef[] = [
  {
    key: "leads",
    label: "العملاء المحتملون",
    description: "الطلبات الواردة من الزوار",
    to: "/control/leads",
    access: "manager",
  },
  {
    key: "rfqDocuments",
    label: "نماذج عروض الأسعار",
    description: "قوالب عروض الأسعار المحفوظة",
    to: "/control/rfq",
    access: "ops",
  },
  {
    key: "projects",
    label: "المشاريع",
    description: "المشاريع المنشورة",
    to: "/control/projects",
    access: "ops",
  },
  {
    key: "services",
    label: "الخدمات",
    description: "الخدمات المعروضة للزوار",
    to: "/control/services",
    access: "manager",
  },
  {
    key: "team",
    label: "فريق العمل",
    description: "أعضاء الفريق",
    to: "/control/team",
    access: "manager",
  },
  {
    key: "testimonials",
    label: "آراء العملاء",
    description: "الشهادات المنشورة",
    to: "/control/testimonials",
    access: "manager",
  },
  {
    key: "trustBadges",
    label: "ميزات الثقة",
    description: "عناصر الثقة في الصفحة الرئيسية",
    to: "/control/home-sections",
    access: "manager",
  },
  {
    key: "stats",
    label: "إحصاءات الهوم",
    description: "أرقام الصفحة الرئيسية",
    to: "/control/home-sections",
    access: "manager",
  },
  {
    key: "timeline",
    label: "خطوات العمل",
    description: "مراحل العمل في الصفحة الرئيسية",
    to: "/control/home-sections",
    access: "manager",
  },
  {
    key: "aiFeatures",
    label: "ميزات AI",
    description: "ميزات الذكاء الاصطناعي",
    to: "/control/home-sections",
    access: "manager",
  },
  {
    key: "aiMetrics",
    label: "مؤشرات AI",
    description: "مؤشرات الذكاء الاصطناعي",
    to: "/control/home-sections",
    access: "manager",
  },
];

const CARD_CLASS =
  "block bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition";

export default function ControlDashboard({
  mode = "full",
}: {
  mode?: "full" | "team";
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  const [team, setTeam] = useState<AdminTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamStatus, setTeamStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [savingTeamId, setSavingTeamId] = useState<number | null>(null);
  const [uploadingTeamId, setUploadingTeamId] = useState<number | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPosition, setNewTeamPosition] = useState("");
  const [newTeamSpecialization, setNewTeamSpecialization] = useState("");
  const [newTeamExperience, setNewTeamExperience] = useState("");
  const [newTeamBio, setNewTeamBio] = useState("");
  const [newTeamImage, setNewTeamImage] = useState<File | null>(null);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      setSummary(await fetchAdminSummary());
    } catch {
      // No cached or invented numbers: an error is shown instead.
      setSummary(null);
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      setTeam(await fetchAdminTeam());
    } catch {
      setTeamStatus("error");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "full") void loadSummary();
    if (mode === "team") void loadTeam();
  }, [mode, loadSummary, loadTeam]);

  const controlRole = useControlRole();
  const canManage = isManagerRole(controlRole);
  const isSuperuser =
    controlRole.isSuperuser || controlRole.role === "superadmin";
  const role = controlRole.role;

  function canOpen(access: Access): boolean {
    if (access === "all") return true;
    if (access === "manager") return canManage;
    return (
      canManage ||
      role === "accountant" ||
      role === "registrar" ||
      role === "employee"
    );
  }

  const cards = useMemo(() => {
    if (!summary) return [];
    const counts = summary.counts || {};
    return CARD_DEFS.map((def) => ({
      ...def,
      value: counts[def.key] ?? 0,
      clickable: canOpen(def.access),
    }));
    // controlRole is a small object recreated on each render; depend on its
    // primitive fields so the memo is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, canManage, role]);

  const totalItems = cards.reduce((sum, card) => sum + card.value, 0);

  const quickActions = useMemo(
    () =>
      [
        {
          label: "العملاء المحتملون",
          description: "متابعة الطلبات الجديدة",
          to: "/control/leads",
          show: canManage,
        },
        {
          label: "المشاريع",
          description: "إضافة أو تحرير مشروع",
          to: "/control/projects",
          show: canOpen("ops"),
        },
        {
          label: "نماذج عروض الأسعار",
          description: "تجهيز عرض سعر جديد",
          to: "/control/rfq",
          show: canOpen("ops"),
        },
        {
          label: "محتوى الصفحة الرئيسية",
          description: "تحديث ما يراه الزوار",
          to: "/control/home-sections",
          show: canManage,
        },
        {
          label: "النسخ الاحتياطي",
          description: "تنزيل نسخة من البيانات",
          to: summary?.links.backup || "/control/backup",
          show: isSuperuser,
        },
        {
          label: "تغيير كلمة المرور",
          description: "تأمين حسابك",
          to: "/control/password",
          show: true,
        },
      ].filter((action) => action.show),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, isSuperuser, role, summary],
  );

  async function onCreateTeamMember() {
    const name = newTeamName.trim();
    if (!name) return;
    setCreatingTeam(true);
    setTeamStatus("idle");
    try {
      let imageId: number | null | undefined = undefined;
      if (newTeamImage) {
        const up = await uploadAdminImage(newTeamImage, name);
        if (up.ok && up.id) imageId = up.id;
      }
      const res = await createAdminTeamMember({
        name,
        position: newTeamPosition,
        specialization: newTeamSpecialization,
        experience: newTeamExperience,
        bio: newTeamBio,
        imageId,
      });
      if (!res.ok) {
        setTeamStatus("error");
        return;
      }
      setNewTeamName("");
      setNewTeamPosition("");
      setNewTeamSpecialization("");
      setNewTeamExperience("");
      setNewTeamBio("");
      setNewTeamImage(null);
      await loadTeam();
      if (mode === "full") await loadSummary();
      setTeamStatus("saved");
      setTimeout(() => setTeamStatus("idle"), 1500);
    } catch {
      setTeamStatus("error");
    } finally {
      setCreatingTeam(false);
    }
  }

  async function onSaveTeamMember(member: AdminTeamMember) {
    if (!member.name.trim()) return;
    setSavingTeamId(member.id);
    setTeamStatus("idle");
    try {
      const res = await updateAdminTeamMember(member.id, {
        sortOrder: member.sortOrder,
        name: member.name,
        position: member.position,
        specialization: member.specialization,
        experience: member.experience,
        bio: member.bio,
        imageId: member.imageId,
      });
      if (!res.ok) {
        setTeamStatus("error");
        return;
      }
      setTeam((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, imageId: res.imageId ?? m.imageId, imageUrl: res.imageUrl ?? m.imageUrl }
            : m,
        ),
      );
      setTeamStatus("saved");
      setTimeout(() => setTeamStatus("idle"), 1500);
    } catch {
      setTeamStatus("error");
    } finally {
      setSavingTeamId(null);
    }
  }

  async function onDeleteTeamMember(memberId: number) {
    if (!window.confirm("هل تريد حذف عضو الفريق؟")) return;
    setTeamStatus("idle");
    try {
      const res = await deleteAdminTeamMember(memberId);
      if (!res.ok) {
        setTeamStatus("error");
        return;
      }
      await loadTeam();
      if (mode === "full") await loadSummary();
      setTeamStatus("saved");
      setTimeout(() => setTeamStatus("idle"), 1500);
    } catch {
      setTeamStatus("error");
    }
  }

  async function onMoveTeam(fromIndex: number, dir: -1 | 1) {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= team.length) return;
    const next = [...team];
    const tmp = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = tmp;
    const normalized = next.map((m, idx) => ({ ...m, sortOrder: idx }));
    setTeam(normalized);
    setTeamStatus("idle");
    try {
      const res = await reorderAdminTeam({ ids: normalized.map((m) => m.id) });
      if (!res.ok) {
        setTeamStatus("error");
        await loadTeam();
        return;
      }
      await loadTeam();
      setTeamStatus("saved");
      setTimeout(() => setTeamStatus("idle"), 1500);
    } catch {
      setTeamStatus("error");
      await loadTeam();
    }
  }

  const teamSection = (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xl font-bold text-gray-900">فريق العمل</div>
          <div className="text-sm text-gray-600 mt-1">
            إضافة، تعديل، حذف، وترتيب أعضاء الفريق.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadTeam()}
          disabled={teamLoading}
          className="bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
        >
          تحديث
        </button>
      </div>

      {teamStatus === "saved" && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800"
        >
          تم الحفظ.
        </div>
      )}
      {teamStatus === "error" && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700"
        >
          تعذر تنفيذ العملية. حاول مرة أخرى.
        </div>
      )}

      <div className="border border-gray-200 rounded-2xl p-5 mb-8">
        <div className="font-bold text-gray-900 mb-4">إضافة عضو جديد</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="الاسم"
            aria-label="اسم العضو"
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <input
            value={newTeamPosition}
            onChange={(e) => setNewTeamPosition(e.target.value)}
            placeholder="المنصب"
            aria-label="المنصب"
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <input
            value={newTeamSpecialization}
            onChange={(e) => setNewTeamSpecialization(e.target.value)}
            placeholder="التخصص"
            aria-label="التخصص"
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <input
            value={newTeamExperience}
            onChange={(e) => setNewTeamExperience(e.target.value)}
            placeholder="الخبرة"
            aria-label="الخبرة"
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <textarea
            value={newTeamBio}
            onChange={(e) => setNewTeamBio(e.target.value)}
            placeholder="نبذة مختصرة"
            aria-label="نبذة مختصرة"
            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 md:col-span-2"
            rows={4}
          />
          <label className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 md:col-span-2 flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-gray-700 font-semibold">
              {newTeamImage ? newTeamImage.name : "اختر صورة (اختياري)"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setNewTeamImage(e.target.files?.[0] || null)}
            />
          </label>
        </div>
        <div className="flex items-center justify-end mt-4">
          <button
            type="button"
            onClick={() => void onCreateTeamMember()}
            disabled={creatingTeam || !newTeamName.trim()}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {creatingTeam ? "جارٍ الإضافة..." : "إضافة"}
          </button>
        </div>
      </div>

      {teamLoading ? (
        <p role="status" className="text-gray-600">
          جارٍ تحميل أعضاء الفريق…
        </p>
      ) : !team.length ? (
        <p className="text-gray-600">لا يوجد أعضاء في فريق العمل حالياً.</p>
      ) : (
        <div className="space-y-4">
          {team.map((m, idx) => (
            <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center">
                    {m.imageUrl ? (
                      <img loading="lazy" decoding="async" src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xs font-bold text-gray-500">بدون صورة</div>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{m.name || "—"}</div>
                    <div className="text-xs text-gray-500 mt-1">الترتيب: {idx + 1}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void onMoveTeam(idx, -1)}
                    disabled={idx === 0}
                    aria-label={`تقديم ${m.name || "العضو"}`}
                    title="تقديم"
                    className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => void onMoveTeam(idx, 1)}
                    disabled={idx === team.length - 1}
                    aria-label={`تأخير ${m.name || "العضو"}`}
                    title="تأخير"
                    className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                  >
                    ↓
                  </button>

                  <label className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition cursor-pointer">
                    {uploadingTeamId === m.id ? "رفع..." : "تغيير الصورة"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingTeamId === m.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingTeamId(m.id);
                        setTeamStatus("idle");
                        try {
                          const up = await uploadAdminImage(file, m.name || file.name);
                          const uploadedId = up.id;
                          if (up.ok && uploadedId) {
                            const res = await updateAdminTeamMember(m.id, { imageId: uploadedId });
                            if (res.ok) {
                              setTeam((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? {
                                        ...x,
                                        imageId: res.imageId ?? uploadedId,
                                        imageUrl: res.imageUrl ?? x.imageUrl,
                                      }
                                    : x,
                                ),
                              );
                              setTeamStatus("saved");
                              setTimeout(() => setTeamStatus("idle"), 1500);
                            } else {
                              setTeamStatus("error");
                            }
                          } else {
                            setTeamStatus("error");
                          }
                        } catch {
                          setTeamStatus("error");
                        } finally {
                          setUploadingTeamId(null);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void onSaveTeamMember(m)}
                    disabled={savingTeamId === m.id || !m.name.trim()}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                  >
                    {savingTeamId === m.id ? "حفظ..." : "حفظ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteTeamMember(m.id)}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                  >
                    حذف
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 mt-4">
                <input
                  value={m.name}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  placeholder="الاسم"
                  aria-label={`اسم العضو ${idx + 1}`}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                />
                <input
                  value={m.position}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, position: e.target.value } : x)),
                    )
                  }
                  placeholder="المنصب"
                  aria-label={`منصب العضو ${idx + 1}`}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                />
                <input
                  value={m.specialization}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) =>
                        x.id === m.id ? { ...x, specialization: e.target.value } : x,
                      ),
                    )
                  }
                  placeholder="التخصص"
                  aria-label={`تخصص العضو ${idx + 1}`}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                />
                <input
                  value={m.experience}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, experience: e.target.value } : x)),
                    )
                  }
                  placeholder="الخبرة"
                  aria-label={`خبرة العضو ${idx + 1}`}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                />
                <textarea
                  value={m.bio}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, bio: e.target.value } : x)),
                    )
                  }
                  placeholder="نبذة مختصرة"
                  aria-label={`نبذة العضو ${idx + 1}`}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 md:col-span-2"
                  rows={4}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (mode === "team") {
    return (
      <div>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">فريق العمل</h1>
            <p className="text-white/70 mt-1">إدارة أعضاء فريق العمل وإعداداتهم.</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/control/dashboard"
              className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
        {teamSection}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">لوحة التحكم</h1>
          <p className="text-white/60 mt-1">
            نظرة سريعة على بيانات الموقع والإجراءات الأكثر استخداماً.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a
            href={summary?.links.publicSite || "/"}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="فتح الموقع في تبويب جديد"
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            فتح الموقع
          </a>
          <Link
            to="/control/home-sections"
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            محتوى الصفحة الرئيسية
          </Link>
        </div>
      </div>

      {summary?.warnings && summary.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <div className="font-bold text-amber-900 mb-2">تنبيهات تحتاج مراجعة</div>
          <ul className="text-amber-900/90 space-y-1 list-disc pr-5">
            {summary.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="quick-actions-title" className="mb-10">
        <h2 id="quick-actions-title" className="text-xl font-bold text-white mb-1">
          الإجراءات الأكثر استخداماً
        </h2>
        <p className="text-white/60 text-sm mb-4">
          اختصارات للوظائف التي تحتاجها بشكل متكرر، مرتبة حسب الأولوية.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
            >
              <div className="font-semibold text-gray-900">{action.label}</div>
              <div className="text-sm text-gray-600 mt-1">{action.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {summaryLoading ? (
        <div
          role="status"
          className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-600 mb-10"
        >
          جارٍ تحميل بيانات لوحة التحكم…
        </div>
      ) : summaryError ? (
        <div
          role="alert"
          className="bg-white border border-red-200 rounded-2xl p-8 text-center mb-10"
        >
          <p className="font-bold text-red-700">
            تعذر تحميل بيانات لوحة التحكم.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            الأرقام مخفية حتى نتمكن من عرض بيانات صحيحة من الخادم.
          </p>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="mt-4 bg-white border border-gray-200 text-gray-900 px-5 py-2 rounded-lg font-bold hover:shadow-sm transition"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : summary ? (
        <section aria-labelledby="summary-title" className="mb-10">
            <h2 id="summary-title" className="text-xl font-bold text-white mb-1">
              نظرة على المحتوى
            </h2>
            <p className="text-white/60 text-sm mb-4">
              الأرقام أدناه قادمة من الخادم مباشرة، مرتبة من الأكثر أهمية إلى الأقل.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((c) => {
                const inner = (
                  <>
                    <div className="text-sm text-gray-600">{c.label}</div>
                    <div className="text-3xl font-bold text-gray-900 mt-1" dir="ltr">
                      {c.value}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{c.description}</div>
                  </>
                );
                return c.clickable ? (
                  <Link key={c.key} to={c.to} className={CARD_CLASS}>
                    {inner}
                  </Link>
                ) : (
                  <div key={c.key} className={CARD_CLASS}>
                    {inner}
                  </div>
                );
              })}
            </div>
            {totalItems === 0 && (
              <p
                role="status"
                className="mt-4 bg-white/10 border border-white/15 rounded-xl p-4 text-sm text-white/80"
              >
                لا توجد بيانات مسجلة بعد. ابدأ من الإجراءات السريعة أعلاه لإضافة
                المحتوى.
              </p>
            )}
        </section>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xl font-bold text-gray-900 mb-4">الإعدادات</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to="/control/settings/company"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">الشركة</div>
              <div className="text-sm text-gray-600 mt-1">
                الاسم، التواصل، الروابط، التصنيف والترخيص
              </div>
            </Link>
            <Link
              to="/control/settings/home"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">الصفحة الرئيسية</div>
              <div className="text-sm text-gray-600 mt-1">
                الهيرو، روابط الأزرار، النشرة
              </div>
            </Link>
            <Link
              to="/control/settings/ai"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">الذكاء الاصطناعي</div>
              <div className="text-sm text-gray-600 mt-1">
                النموذج، التفعيل، البرومبتات
              </div>
            </Link>
            <Link
              to="/control/settings/calculator"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">الحاسبة</div>
              <div className="text-sm text-gray-600 mt-1">
                أسعار ومعاملات الحساب
              </div>
            </Link>
            <Link
              to="/control/settings/visibility"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">إظهار/إخفاء الأقسام</div>
              <div className="text-sm text-gray-600 mt-1">
                التحكم بما يظهر للزوار في الموقع
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xl font-bold text-gray-900 mb-4">إدارة النظام</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              to="/control/projects"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">المشاريع</div>
              <div className="text-sm text-gray-600 mt-1">
                إنشاء، تحرير، نشر، ومعرض صور
              </div>
            </Link>
            <Link
              to="/control/ops"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">إدارة العمليات</div>
              <div className="text-sm text-gray-600 mt-1">
                العملاء، العقود، المشتريات، الموارد، وتقارير KPI
              </div>
            </Link>
            <Link
              to="/control/team"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">فريق العمل</div>
              <div className="text-sm text-gray-600 mt-1">
                إضافة، تعديل، حذف، وترتيب الأعضاء
              </div>
            </Link>
            <Link
              to="/control/rfq"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">نماذج عروض الأسعار</div>
              <div className="text-sm text-gray-600 mt-1">
                قوالب RFQ، تحرير، طباعة وPDF
              </div>
            </Link>
            <Link
              to="/control/users"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">المستخدمون</div>
              <div className="text-sm text-gray-600 mt-1">
                إضافة مدراء وسوبر أدمن
              </div>
            </Link>
            <Link
              to="/control/password"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">تغيير كلمة المرور</div>
              <div className="text-sm text-gray-600 mt-1">
                تحديث كلمة المرور للحساب الحالي
              </div>
            </Link>
            <a
              href={summary?.links.tools || "/tools"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="فتح الأدوات في تبويب جديد"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">الأدوات</div>
              <div className="text-sm text-gray-600 mt-1">
                عرض الأدوات وتأكد من صلاحيات الوصول
              </div>
            </a>
            <Link
              to={summary?.links.backup || "/control/backup"}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">النسخ الاحتياطي</div>
              <div className="text-sm text-gray-600 mt-1">
                نسخ واستعادة بيانات المنظومة (سوبر أدمن)
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
