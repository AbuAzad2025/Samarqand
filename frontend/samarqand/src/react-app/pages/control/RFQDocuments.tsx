import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  createAdminRfqDocument,
  fetchAdminRfqDocuments,
  type AdminRfqDocumentListItem,
} from "@/react-app/api/site";
import {
  groupRfqTemplatesByCategory,
  RFQ_TEMPLATES,
  RFQ_TEMPLATES_BY_KEY,
} from "@/react-app/rfqTemplates";

type SortKey = "updated-desc" | "updated-asc" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  "updated-desc": "الأحدث تعديلاً",
  "updated-asc": "الأقدم تعديلاً",
  title: "حسب العنوان",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
}

export default function ControlRFQDocuments() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminRfqDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("updated-desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminRfqDocuments();
      setItems(data);
    } catch {
      setItems([]);
      setError("تعذر تحميل النماذج المحفوظة. استخدم زر تحديث للمحاولة مجدداً.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter((d) => {
          const hay = `${d.title || ""} ${d.number || ""} ${d.templateKey || ""} ${d.currency || ""}`.toLowerCase();
          return hay.includes(q);
        })
      : [...items];

    return list.sort((a, b) => {
      if (sort === "title") {
        return (a.title || "").localeCompare(b.title || "", "ar");
      }
      const aDate = a.updatedAt || a.createdAt || "";
      const bDate = b.updatedAt || b.createdAt || "";
      const cmp = aDate.localeCompare(bDate);
      return sort === "updated-desc" ? -cmp : cmp;
    });
  }, [items, search, sort]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RFQ_TEMPLATES;
    return RFQ_TEMPLATES.filter((t) => {
      const hay = `${t.label} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search]);
  const groupedTemplates = useMemo(
    () => groupRfqTemplatesByCategory(filteredTemplates),
    [filteredTemplates],
  );

  async function createFromTemplate(key: string) {
    const tpl = RFQ_TEMPLATES_BY_KEY[key] || null;
    if (!tpl) return;
    setCreatingKey(key);
    setCreateError("");
    try {
      const today = new Date();
      const title = `${tpl.label} - ${today.toISOString().slice(0, 10)}`;
      const res = await createAdminRfqDocument({
        title,
        templateKey: tpl.key,
        currency: tpl.defaultCurrency,
        data: tpl.defaultData,
      });
      if (res.ok && res.id) {
        navigate(`/control/rfq/${res.id}`);
      } else {
        setCreateError("تعذر إنشاء النموذج من القالب. حاول مرة أخرى.");
      }
    } catch {
      setCreateError("تعذر إنشاء النموذج من القالب. حاول مرة أخرى.");
    } finally {
      setCreatingKey(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">نماذج عروض الأسعار</h1>
          <p className="text-slate-300 mt-1">
            قوالب جاهزة + نماذج محفوظة للاستخدام العملي مع الموردين.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث: عنوان، رقم، قالب، عملة..."
            aria-label="البحث في القوالب والنماذج"
            className="w-[320px] max-w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
          />
          <button
            type="button"
            onClick={() => {
              load();
              setCreateError("");
            }}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            تحديث
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 mb-6 text-sm font-semibold">
          {error}
        </div>
      ) : null}
      {createError ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 mb-6 text-sm font-semibold">
          {createError}
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <div className="text-lg font-bold text-gray-900">قوالب جاهزة</div>
            <div className="text-sm text-gray-600 mt-1">
              اختر قالباً لإنشاء نموذج جديد، ثم املأ بيانات المورد والبنود واحفظه أو اطبعه.
            </div>
          </div>
          <div className="text-xs font-semibold text-gray-500">
            {filteredTemplates.length} قالب متاح
          </div>
        </div>

        {!filteredTemplates.length ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <div className="font-bold text-gray-800">لا توجد قوالب مطابقة للبحث.</div>
            <p className="text-sm text-gray-500 mt-1">
              جرّب كلمة أخرى أو امسح عبارة البحث لعرض كل القوالب.
            </p>
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-3 rounded-lg bg-gray-100 text-gray-800 font-bold px-4 py-2 hover:bg-gray-200 transition"
              >
                عرض كل القوالب
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedTemplates.map((g) => (
              <div key={g.category}>
                <div className="text-sm font-black text-gray-900 mb-3">{g.category}</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {g.templates.map((t) => {
                    const Icon = t.icon;
                    const busy = creatingKey === t.key;
                    return (
                      <div
                        key={t.key}
                        className="border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                            <Icon size={20} className="text-emerald-700" />
                          </div>
                          <div
                            className="text-xs font-bold px-3 py-1 rounded-lg bg-gray-100 text-gray-700"
                            dir="ltr"
                          >
                            {t.defaultCurrency}
                          </div>
                        </div>
                        <div className="mt-4 font-bold text-gray-900">{t.label}</div>
                        <div className="mt-2 text-sm text-gray-600 leading-relaxed">
                          {t.description}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs font-bold px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            disabled={Boolean(creatingKey)}
                            onClick={() => createFromTemplate(t.key)}
                            className="w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                          >
                            {busy ? "جارٍ الإنشاء..." : "استخدم القالب"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-gray-900">النماذج المحفوظة</div>
            <div className="text-xs text-gray-500 mt-1">
              {items.length} نموذج محفوظ
              {search ? ` • ${filteredDocs.length} نتيجة للبحث` : ""}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
            ترتيب
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-800 bg-white"
              aria-label="ترتيب النماذج"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ تحميل النماذج…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-bold text-gray-800">لا توجد نماذج محفوظة بعد.</div>
            <p className="text-sm text-gray-500 mt-2">
              اختر أحد القوالب أعلاه لإنشاء أول نموذج وتحرير بياناته.
            </p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-bold text-gray-800">لا توجد نماذج مطابقة للبحث.</div>
            <p className="text-sm text-gray-500 mt-2">جرّب كلمة بحث أخرى.</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 rounded-lg bg-gray-100 text-gray-800 font-bold px-4 py-2 hover:bg-gray-200 transition"
            >
              مسح البحث
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {filteredDocs.map((d) => {
              const templateLabel = RFQ_TEMPLATES_BY_KEY[d.templateKey]?.label || d.templateKey || "قالب غير محدد";
              return (
                <div
                  key={d.id}
                  className="p-6 flex items-center gap-5 flex-wrap sm:flex-nowrap"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-bold text-gray-900 truncate">
                        {d.title || "نموذج بدون عنوان"}
                      </div>
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-200 text-gray-800"
                        dir="ltr"
                      >
                        {d.number || `#${d.id}`}
                      </span>
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800"
                        dir="ltr"
                      >
                        {d.currency || "—"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 truncate">
                      القالب: {templateLabel}
                    </div>
                    <div className="text-xs text-gray-500 mt-1" dir="ltr">
                      آخر تحديث: {formatDate(d.updatedAt || d.createdAt)}
                    </div>
                  </div>
                  <Link
                    to={`/control/rfq/${d.id}`}
                    className="shrink-0 bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    تحرير ومعاينة
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
