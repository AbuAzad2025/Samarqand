import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import {
  createAdminPage,
  deleteAdminPage,
  fetchAdminPagesAllowedTypes,
  fetchAdminPagesTree,
  publishAdminPage,
  unpublishAdminPage,
  type AdminPageTreeItem,
} from "@/react-app/api/site";

function editUrlFor(item: AdminPageTreeItem): string {
  if (item.type === "website.servicepage") return `/control/services/${item.id}`;
  if (item.type === "website.projectpage") return `/control/projects/${item.id}`;
  if (item.type === "website.articlepage") return `/control/blogs/${item.id}`;
  return `/control/pages/${item.id}`;
}

export default function ControlPages() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const parentId = Number(params.get("parentId") || 0) || undefined;

  const [data, setData] = useState<{ parent: { id: number; title: string }; items: AdminPageTreeItem[] } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const [allowedTypes, setAllowedTypes] = useState<{ type: string; typeName: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const currentParentId = useMemo(() => data?.parent?.id || parentId || 0, [data?.parent?.id, parentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const tree = await fetchAdminPagesTree(parentId);
      setData({ parent: { id: tree.parent.id, title: tree.parent.title }, items: tree.items });
      const types = await fetchAdminPagesAllowedTypes(tree.parent.id).catch(() => []);
      setAllowedTypes(types);
      setNewType(types[0]?.type || "");
    } catch {
      setStatus("error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const items = useMemo(() => {
    const raw = data?.items || [];
    return [...raw].sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      return a.title.localeCompare(b.title, "ar");
    });
  }, [data?.items]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">إدارة الصفحات</h1>
          <p className="text-gray-600 mt-1 truncate">
            المجلد الحالي: {data?.parent?.title || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
          >
            تحديث
          </button>
          {parentId ? (
            <button
              type="button"
              onClick={() => {
                params.delete("parentId");
                setParams(params, { replace: true });
              }}
              className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
            >
              للجذر
            </button>
          ) : null}
        </div>
      </div>

      {status === "saved" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      ) : status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر تنفيذ العملية.
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="text-lg font-bold text-gray-900 mb-4">إضافة صفحة</div>
        <div className="grid md:grid-cols-2 gap-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-3"
          >
            {allowedTypes.length ? null : <option value="">لا يوجد أنواع متاحة هنا</option>}
            {allowedTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.typeName}
              </option>
            ))}
          </select>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="عنوان الصفحة"
            className="border border-gray-200 rounded-xl px-4 py-3"
          />
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="Slug (اختياري)"
            className="border border-gray-200 rounded-xl px-4 py-3 md:col-span-2"
            dir="ltr"
          />
        </div>
        <div className="flex items-center justify-end mt-4">
          <button
            type="button"
            disabled={!newType || !newTitle.trim() || creating}
            onClick={async () => {
              if (!data?.parent?.id) return;
              setCreating(true);
              setStatus("idle");
              try {
                const res = await createAdminPage({
                  parentId: data.parent.id,
                  type: newType,
                  title: newTitle,
                  slug: newSlug || undefined,
                  live: true,
                });
                if (!res.ok) {
                  setStatus("error");
                  return;
                }
                setNewTitle("");
                setNewSlug("");
                setStatus("saved");
                setTimeout(() => setStatus("idle"), 1500);
                await load();
              } catch {
                setStatus("error");
              } finally {
                setCreating(false);
              }
            }}
            className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {creating ? "جارٍ الإنشاء..." : "إنشاء"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">القائمة</div>
          <div className="text-sm text-gray-600">{items.length} عنصر</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : !items.length ? (
          <div className="p-6 text-gray-600">لا يوجد صفحات هنا.</div>
        ) : (
          <div className="divide-y">
            {items.map((p) => (
              <div key={p.id} className="p-6 flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (!p.hasChildren) return;
                    setParams({ parentId: String(p.id) }, { replace: true });
                  }}
                  disabled={!p.hasChildren}
                  className="bg-white border border-gray-200 text-gray-900 px-3 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-40"
                  title={p.hasChildren ? "فتح المجلد" : "لا يوجد صفحات فرعية"}
                >
                  {p.hasChildren ? "↩" : "—"}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-bold text-gray-900 truncate">{p.title}</div>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-800">
                      {p.typeName}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        p.live ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {p.live ? "منشور" : "مسودة"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1 truncate" dir="ltr">
                    /{p.slug} • #{p.id}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      فتح
                    </a>
                  ) : null}
                  <Link
                    to={editUrlFor(p)}
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    تحرير
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setStatus("idle");
                      const res = p.live ? await unpublishAdminPage(p.id) : await publishAdminPage(p.id);
                      if (!res.ok) {
                        setStatus("error");
                        return;
                      }
                      setStatus("saved");
                      setTimeout(() => setStatus("idle"), 1500);
                      await load();
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    {p.live ? "إلغاء النشر" : "نشر"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = window.confirm("حذف الصفحة؟ سيتم حذف كل الصفحات تحتها أيضاً.");
                      if (!ok) return;
                      setStatus("idle");
                      const res = await deleteAdminPage(p.id);
                      if (!res.ok) {
                        setStatus("error");
                        return;
                      }
                      setStatus("saved");
                      setTimeout(() => setStatus("idle"), 1500);
                      await load();
                    }}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentParentId ? (
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            رجوع
          </button>
        </div>
      ) : null}
    </div>
  );
}
