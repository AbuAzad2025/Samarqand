import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  addAdminProjectGalleryItem,
  deleteAdminProject,
  fetchAdminProjectDetail,
  fetchAdminProjectDocuments,
  publishAdminProject,
  reorderAdminProjectDocuments,
  removeAdminProjectDocument,
  removeAdminProjectGalleryItem,
  unpublishAdminProject,
  updateAdminProjectDocument,
  updateAdminProject,
  uploadAdminImage,
  uploadAdminProjectDocument,
  type AdminProjectDocument,
  type AdminProjectDetail,
} from "@/react-app/api/site";

export default function ControlProjectEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const projectId = Number(params.id);
  const [data, setData] = useState<AdminProjectDetail | null>(null);
  const [documents, setDocuments] = useState<AdminProjectDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const res = await fetchAdminProjectDetail(projectId);
    setData(res);
  }, [projectId]);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const items = await fetchAdminProjectDocuments(projectId);
      setDocuments(items);
    } finally {
      setDocsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    load().catch(() => {});
    loadDocs().catch(() => {});
  }, [load, loadDocs, projectId]);

  const sortedGallery = useMemo(() => {
    return [...(data?.gallery || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  function formatBytes(n: number): string {
    const val = Number(n || 0);
    if (!val) return "—";
    const kb = 1024;
    const mb = kb * 1024;
    if (val >= mb) return `${(val / mb).toFixed(1)} MB`;
    if (val >= kb) return `${Math.round(val / kb)} KB`;
    return `${val} B`;
  }

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminProject(projectId, {
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        status: data.status,
        pmpPhase: data.pmpPhase,
        progressPercent: data.progressPercent,
        startDate: data.startDate,
        targetEndDate: data.targetEndDate,
        budgetAmount: data.budgetAmount,
        scopeStatement: data.scopeStatement,
        keyDeliverables: data.keyDeliverables,
        keyStakeholders: data.keyStakeholders,
        keyRisks: data.keyRisks,
        managementNotes: data.managementNotes,
        clientName: data.clientName,
        projectLocation: data.projectLocation,
        completionYear: data.completionYear,
        executingAgency: data.executingAgency,
        projectOwner: data.projectOwner,
        funder: data.funder,
        supervisor: data.supervisor,
        companyRole: data.companyRole,
        scopeOfWork: data.scopeOfWork,
      });
      setStatus(res.ok ? "saved" : "error");
      await load();
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadAdminImage(file);
      if (!up.ok || !up.id) return;
      await addAdminProjectGalleryItem(projectId, { imageId: up.id, caption });
      setCaption("");
      setFile(null);
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function onDocUpload() {
    if (!docFile) return;
    setDocUploading(true);
    try {
      await uploadAdminProjectDocument(projectId, docFile, docTitle.trim() || undefined);
      setDocTitle("");
      setDocFile(null);
      await loadDocs();
    } finally {
      setDocUploading(false);
    }
  }

  async function moveDoc(id: number, dir: -1 | 1) {
    const idx = documents.findIndex((d) => d.id === id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= documents.length) return;
    const reordered = [...documents];
    const tmp = reordered[idx];
    reordered[idx] = reordered[nextIdx];
    reordered[nextIdx] = tmp;
    setDocuments(reordered);
    await reorderAdminProjectDocuments(projectId, { ids: reordered.map((x) => x.id) });
    await loadDocs();
  }

  async function onTogglePublish() {
    if (!data) return;
    if (data.live) {
      await unpublishAdminProject(projectId);
    } else {
      await publishAdminProject(projectId);
    }
    await load();
  }

  async function onDelete() {
    if (!confirm("حذف المشروع نهائياً؟")) return;
    const res = await deleteAdminProject(projectId);
    if (res.ok) navigate("/control/projects");
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {data.title}
            </h1>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                data.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              {data.live ? "منشور" : "مسودة"}
            </span>
          </div>
          <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
            <Link to="/control/projects" className="text-[#007A3D] font-semibold hover:underline">
              المشاريع
            </Link>
            <span className="text-gray-300">/</span>
            <span dir="ltr" className="truncate">{data.slug}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onTogglePublish}
            className={`px-5 py-3 rounded-lg font-bold transition ${
              data.live
                ? "bg-white border border-gray-200 text-gray-800 hover:shadow-sm"
                : "bg-emerald-600 text-white hover:shadow-lg"
            }`}
          >
            {data.live ? "إلغاء النشر" : "نشر"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="bg-white border border-red-200 text-red-700 px-5 py-3 rounded-lg font-bold hover:bg-red-50 transition"
          >
            حذف
          </button>
        </div>
      </div>

      {status === "saved" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر الحفظ.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="text-lg font-bold text-gray-900">تفاصيل</div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
            <input
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Slug</label>
            <input
              value={data.slug}
              onChange={(e) => setData({ ...data, slug: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">وصف مختصر</label>
            <input
              value={data.shortDescription}
              onChange={(e) => setData({ ...data, shortDescription: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
              <select
                value={data.status}
                onChange={(e) => setData({ ...data, status: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] bg-white"
              >
                <option value="ongoing">قيد العمل</option>
                <option value="completed">منجز</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">المرحلة (PMP)</label>
              <select
                value={data.pmpPhase}
                onChange={(e) => setData({ ...data, pmpPhase: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] bg-white"
              >
                <option value="initiating">البدء</option>
                <option value="planning">التخطيط</option>
                <option value="executing">التنفيذ</option>
                <option value="monitoring">المتابعة والتحكم</option>
                <option value="closing">الإغلاق</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">نسبة الإنجاز %</label>
              <input
                value={data.progressPercent ?? 0}
                onChange={(e) => setData({ ...data, progressPercent: Number(e.target.value || 0) })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                type="number"
                min={0}
                max={100}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ البدء</label>
              <input
                value={data.startDate || ""}
                onChange={(e) => setData({ ...data, startDate: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                type="date"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الانتهاء المستهدف</label>
              <input
                value={data.targetEndDate || ""}
                onChange={(e) => setData({ ...data, targetEndDate: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                type="date"
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">ميزانية (اختياري)</label>
              <input
                value={data.budgetAmount || ""}
                onChange={(e) => setData({ ...data, budgetAmount: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">بيان نطاق المشروع</label>
              <input
                value={data.scopeStatement || ""}
                onChange={(e) => setData({ ...data, scopeStatement: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">المخرجات الرئيسية</label>
            <textarea
              value={data.keyDeliverables || ""}
              onChange={(e) => setData({ ...data, keyDeliverables: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-24"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">أصحاب المصلحة</label>
              <textarea
                value={data.keyStakeholders || ""}
                onChange={(e) => setData({ ...data, keyStakeholders: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-24"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">المخاطر</label>
              <textarea
                value={data.keyRisks || ""}
                onChange={(e) => setData({ ...data, keyRisks: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-24"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات الإدارة</label>
            <textarea
              value={data.managementNotes || ""}
              onChange={(e) => setData({ ...data, managementNotes: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-24"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">العميل</label>
              <input
                value={data.clientName}
                onChange={(e) => setData({ ...data, clientName: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الموقع</label>
              <input
                value={data.projectLocation}
                onChange={(e) => setData({ ...data, projectLocation: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">سنة الإنجاز</label>
              <input
                value={data.completionYear ?? ""}
                onChange={(e) =>
                  setData({ ...data, completionYear: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">الجهة المنفذة</label>
              <input
                value={data.executingAgency}
                onChange={(e) => setData({ ...data, executingAgency: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">نطاق العمل</label>
            <textarea
              value={data.scopeOfWork}
              onChange={(e) => setData({ ...data, scopeOfWork: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D] min-h-28"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="text-lg font-bold text-gray-900">معرض الصور</div>
              <div className="text-sm text-gray-600 mt-1">{sortedGallery.length} صورة</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
            <div className="grid md:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">إضافة صورة</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">وصف (اختياري)</label>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onUpload}
              disabled={!file || uploading}
              className="mt-4 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
            >
              {uploading ? "جارٍ الرفع..." : "رفع وإضافة"}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            {sortedGallery.map((g) => (
              <div key={g.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <div className="aspect-[4/3] bg-gray-100">
                  {g.url ? <img src={g.url} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700 truncate">{g.caption || "—"}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      await removeAdminProjectGalleryItem(projectId, g.id);
                      await load();
                    }}
                    className="text-red-700 font-bold text-sm hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!sortedGallery.length && (
            <div className="text-gray-600 mt-6">لا يوجد صور بعد.</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="text-lg font-bold text-gray-900">مستندات المشروع</div>
            <div className="text-sm text-gray-600 mt-1">{documents.length} مستند</div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
          <div className="grid md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">إضافة مستند</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان (اختياري)</label>
              <input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onDocUpload}
            disabled={!docFile || docUploading}
            className="mt-4 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            {docUploading ? "جارٍ الرفع..." : "رفع"}
          </button>
        </div>

        {docsLoading ? (
          <div className="text-gray-600 mt-6">جارٍ التحميل...</div>
        ) : (
          <div className="mt-6 space-y-3">
            {documents.map((d) => (
              <div
                key={d.id}
                className="border border-gray-200 rounded-2xl bg-white px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="min-w-0">
                  <input
                    value={d.title || ""}
                    onChange={(e) =>
                      setDocuments((prev) => prev.map((x) => (x.id === d.id ? { ...x, title: e.target.value } : x)))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  />
                  <div className="text-sm text-gray-600 mt-1">
                    <span dir="ltr">{formatBytes(d.fileSize)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await moveDoc(d.id, -1);
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    أعلى
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await moveDoc(d.id, 1);
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    أسفل
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateAdminProjectDocument(projectId, d.id, { title: d.title || "" });
                      await loadDocs();
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    حفظ
                  </button>
                  {d.downloadUrl ? (
                    <a
                      href={d.downloadUrl}
                      className="text-[#007A3D] font-bold text-sm hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      تنزيل
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("حذف المستند؟")) return;
                      await removeAdminProjectDocument(projectId, d.id);
                      await loadDocs();
                    }}
                    className="text-red-700 font-bold text-sm hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
            {!documents.length ? <div className="text-gray-600">لا يوجد مستندات بعد.</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
