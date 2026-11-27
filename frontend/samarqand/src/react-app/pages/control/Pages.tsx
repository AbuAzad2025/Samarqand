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
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [allowedTypes, setAllowedTypes] = useState<{ type: string; typeName: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const currentParentId = useMemo(() => data?.parent?.id || parentId || 0, [data?.parent?.id, parentId]);

  function notify(kind: "success" | "error", text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  }

  function clearNotice() {
    setNotice(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tree = await fetchAdminPagesTree(parentId);
      setData({ parent: { id: tree.parent.id, title: tree.parent.title }, items: tree.items });
      const types = await fetchAdminPagesAllowedTypes(tree.parent.id).catch(() => []);
      setAllowedTypes(types);
      setNewType((prev) => prev || types[0]?.type || "");
    } catch {
      notify("error", "تعذر تحميل الصفحات. يرجى الضغط على «تحديث».");
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
          <h1 className="text-2xl font-bold text-white">إدارة الصفحات</h1>
          <p className="text-slate-300 mt-1 truncate">
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

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`border rounded-2xl p-4 mb-6 font-semibold ${
            notice.kind === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="text-lg font-bold text-gray-900">إضافة صفحة</div>
        <p className="text-sm text-gray-600 mt-1 mb-4">الحقول المميزة بـ * إلزامية.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newType) {
              notify("error", "اختر نوع الصفحة أولاً.");
              return;
            }
            if (!newTitle.trim()) {
              notify("error", "عنوان الصفحة مطلوب.");
              return;
            }
            if (!data?.parent?.id) return;
            setCreating(true);
            clearNotice();
            try {
              const res = await createAdminPage({
                parentId: data.parent.id,
                type: newType,
                title: newTitle,
                slug: newSlug || undefined,
                live: true,
              });
              if (!res.ok) {
                notify("error", "تعذر إنشاء الصفحة. يرجى المحاولة مرة أخرى.");
                return;
              }
              setNewTitle("");
              setNewSlug("");
              notify("success", "تم إنشاء الصفحة بنجاح.");
              await load();
            } catch {
              notify("error", "تعذر إنشاء الصفحة. يرجى المحاولة مرة أخرى.");
            } finally {
              setCreating(false);
            }
          }}
          className="grid md:grid-cols-2 gap-4"
        >
          <div>
            <label htmlFor="new-page-type" className="block text-sm font-semibold text-gray-700 mb-2">نوع الصفحة *</label>
            <select
              id="new-page-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
              required
            >
              {allowedTypes.length ? null : <option value="">لا يوجد أنواع متاحة هنا</option>}
              {allowedTypes.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.typeName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-page-title" className="block text-sm font-semibold text-gray-700 mb-2">عنوان الصفحة *</label>
            <input
              id="new-page-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="عنوان الصفحة"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="new-page-slug" className="block text-sm font-semibold text-gray-700 mb-2">Slug (اختياري)</label>
            <input
              id="new-page-slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="Slug (اختياري)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3"
              dir="ltr"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setNewTitle("");
                setNewSlug("");
                setNewType(allowedTypes[0]?.type || "");
                clearNotice();
              }}
              className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!newType || !newTitle.trim() || creating}
              className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
            >
              {creating ? "جارٍ الإنشاء..." : "إنشاء"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">القائمة</div>
          <div className="text-sm text-gray-600">{items.length} عنصر</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : !items.length ? (
          <div className="p-10 text-center">
            <div className="text-3xl mb-2" aria-hidden="true">📄</div>
            <div className="font-bold text-gray-900">لا توجد صفحات في هذا المجلد</div>
            <p className="text-sm text-gray-600 mt-2">أضف صفحة جديدة من النموذج أعلاه، أو افتح مجلداً آخر.</p>
          </div>
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
                  aria-label={p.hasChildren ? `فتح المجلد ${p.title}` : `لا توجد صفحات فرعية في ${p.title}`}
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
                    aria-label={p.live ? `إلغاء نشر ${p.title}` : `نشر ${p.title}`}
                    disabled={busyId === p.id}
                    onClick={async () => {
                      clearNotice();
                      setBusyId(p.id);
                      try {
                        const res = p.live ? await unpublishAdminPage(p.id) : await publishAdminPage(p.id);
                        if (!res.ok) {
                          notify("error", "تعذر تغيير حالة النشر. يرجى المحاولة مرة أخرى.");
                          return;
                        }
                        notify("success", p.live ? "تم إلغاء النشر." : "تم نشر الصفحة.");
                        await load();
                      } catch {
                        notify("error", "تعذر تغيير حالة النشر. يرجى المحاولة مرة أخرى.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                  >
                    {busyId === p.id ? "جارٍ التنفيذ..." : p.live ? "إلغاء النشر" : "نشر"}
                  </button>
                  <button
                    type="button"
                    aria-label={`حذف ${p.title}`}
                    disabled={busyId === p.id}
                    onClick={async () => {
                      if (!window.confirm("حذف الصفحة؟ سيتم حذف كل الصفحات تحتها أيضاً.")) return;
                      clearNotice();
                      setBusyId(p.id);
                      try {
                        const res = await deleteAdminPage(p.id);
                        if (!res.ok) {
                          notify("error", "تعذر حذف الصفحة. يرجى المحاولة مرة أخرى.");
                          return;
                        }
                        notify("success", "تم حذف الصفحة.");
                        await load();
                      } catch {
                        notify("error", "تعذر حذف الصفحة. يرجى المحاولة مرة أخرى.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
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
