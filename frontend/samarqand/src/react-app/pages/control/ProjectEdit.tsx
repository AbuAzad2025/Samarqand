import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  addAdminProjectGalleryItem,
  deleteAdminProject,
  fetchAdminProjectDetail,
  publishAdminProject,
  removeAdminProjectGalleryItem,
  unpublishAdminProject,
  updateAdminProject,
  uploadAdminImage,
  type AdminProjectDetail,
} from "@/react-app/api/site";

export default function ControlProjectEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const projectId = Number(params.id);
  const [data, setData] = useState<AdminProjectDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const res = await fetchAdminProjectDetail(projectId);
    setData(res);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    load().catch(() => {});
  }, [load, projectId]);

  const sortedGallery = useMemo(() => {
    return [...(data?.gallery || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminProject(projectId, {
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
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
    </div>
  );
}
