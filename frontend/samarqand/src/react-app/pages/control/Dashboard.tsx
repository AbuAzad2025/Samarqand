import { useEffect, useMemo, useState } from "react";
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

export default function ControlDashboard({ mode = "full" }: { mode?: "full" | "team" }) {
  const [data, setData] = useState<{
    warnings: string[];
    counts: Record<string, number>;
    links: { djangoAdmin: string; publicSite: string; tools: string };
  } | null>(null);

  const [team, setTeam] = useState<AdminTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamStatus, setTeamStatus] = useState<"idle" | "saved" | "error">("idle");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [savingTeamId, setSavingTeamId] = useState<number | null>(null);
  const [uploadingTeamId, setUploadingTeamId] = useState<number | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPosition, setNewTeamPosition] = useState("");
  const [newTeamSpecialization, setNewTeamSpecialization] = useState("");
  const [newTeamExperience, setNewTeamExperience] = useState("");
  const [newTeamBio, setNewTeamBio] = useState("");
  const [newTeamImage, setNewTeamImage] = useState<File | null>(null);

  async function loadSummary() {
    try {
      const res = await fetchAdminSummary();
      setData(res);
    } catch {
      setData(null);
    }
  }

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const items = await fetchAdminTeam();
      setTeam(items);
    } catch {
      setTeamStatus("error");
    } finally {
      setTeamLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "full") loadSummary();
    if (mode === "team") loadTeam();
  }, [mode]);

  const cards = useMemo(() => {
    const c = data?.counts || {};
    return [
      { label: "الخدمات", value: c.services ?? 0 },
      { label: "المشاريع", value: c.projects ?? 0 },
      { label: "فريق العمل", value: c.team ?? 0 },
      { label: "آراء العملاء", value: c.testimonials ?? 0 },
      { label: "نماذج عروض الأسعار", value: c.rfqDocuments ?? 0 },
      { label: "ميزات الثقة", value: c.trustBadges ?? 0 },
      { label: "إحصاءات الهوم", value: c.stats ?? 0 },
      { label: "خطوات العمل", value: c.timeline ?? 0 },
      { label: "ميزات AI", value: c.aiFeatures ?? 0 },
      { label: "مؤشرات AI", value: c.aiMetrics ?? 0 },
    ];
  }, [data]);

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
      await loadSummary();
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
      await loadSummary();
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
          onClick={loadTeam}
          disabled={teamLoading}
          className="bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
        >
          تحديث
        </button>
      </div>

      {teamStatus === "saved" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      )}
      {teamStatus === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر تنفيذ العملية.
        </div>
      )}

      <div className="border border-gray-200 rounded-2xl p-5 mb-8">
        <div className="font-bold text-gray-900 mb-4">إضافة عضو جديد</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="الاسم"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <input
            value={newTeamPosition}
            onChange={(e) => setNewTeamPosition(e.target.value)}
            placeholder="المنصب"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <input
            value={newTeamSpecialization}
            onChange={(e) => setNewTeamSpecialization(e.target.value)}
            placeholder="التخصص"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <input
            value={newTeamExperience}
            onChange={(e) => setNewTeamExperience(e.target.value)}
            placeholder="الخبرة"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <textarea
            value={newTeamBio}
            onChange={(e) => setNewTeamBio(e.target.value)}
            placeholder="نبذة مختصرة"
            className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2"
            rows={4}
          />
          <label className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2 flex items-center justify-between gap-3 cursor-pointer">
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
            onClick={onCreateTeamMember}
            disabled={creatingTeam}
            className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {creatingTeam ? "جارٍ الإضافة..." : "إضافة"}
          </button>
        </div>
      </div>

      {teamLoading ? (
        <div className="text-gray-600">جارٍ التحميل...</div>
      ) : !team.length ? (
        <div className="text-gray-600">لا يوجد أعضاء في فريق العمل حالياً.</div>
      ) : (
        <div className="space-y-4">
          {team.map((m, idx) => (
            <div key={m.id} className="border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center">
                    {m.imageUrl ? (
                      <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
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
                    onClick={() => onMoveTeam(idx, -1)}
                    disabled={idx === 0}
                    className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveTeam(idx, 1)}
                    disabled={idx === team.length - 1}
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
                    onClick={() => onSaveTeamMember(m)}
                    disabled={savingTeamId === m.id}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                  >
                    {savingTeamId === m.id ? "حفظ..." : "حفظ"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTeamMember(m.id)}
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
                  className="border border-gray-200 rounded-xl px-4 py-3"
                />
                <input
                  value={m.position}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, position: e.target.value } : x)),
                    )
                  }
                  placeholder="المنصب"
                  className="border border-gray-200 rounded-xl px-4 py-3"
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
                  className="border border-gray-200 rounded-xl px-4 py-3"
                />
                <input
                  value={m.experience}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, experience: e.target.value } : x)),
                    )
                  }
                  placeholder="الخبرة"
                  className="border border-gray-200 rounded-xl px-4 py-3"
                />
                <textarea
                  value={m.bio}
                  onChange={(e) =>
                    setTeam((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, bio: e.target.value } : x)),
                    )
                  }
                  placeholder="نبذة مختصرة"
                  className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2"
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
            <h1 className="text-3xl font-bold text-gray-900">فريق العمل</h1>
            <p className="text-gray-600 mt-1">إدارة أعضاء فريق العمل وإعداداتهم.</p>
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
          <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-600 mt-1">
            إدارة سريعة للإعدادات والمزايا الأساسية.
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href={data?.links.publicSite || "/"}
            target="_blank"
            rel="noopener noreferrer"
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

      {!!data?.warnings?.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <div className="font-bold text-amber-900 mb-2">تنبيهات</div>
          <ul className="text-amber-900/90 space-y-1">
            {data.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
          >
            <div className="text-sm text-gray-600">{c.label}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {c.value}
            </div>
          </div>
        ))}
      </div>

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
              href={data?.links.tools || "/tools"}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">الأدوات</div>
              <div className="text-sm text-gray-600 mt-1">
                عرض الأدوات وتأكد من صلاحيات الوصول
              </div>
            </a>
            <a
              href={data?.links.djangoAdmin || "/django-admin/"}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
            >
              <div className="font-semibold text-gray-900">Django Admin</div>
              <div className="text-sm text-gray-600 mt-1">
                إدارة متقدمة للمنظومة (سوبر أدمن)
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
