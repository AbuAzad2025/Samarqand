import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  createAdminRfqDocument,
  fetchAdminRfqDocuments,
  type AdminRfqDocumentListItem,
} from "@/react-app/api/site";
import { groupRfqTemplatesByCategory, RFQ_TEMPLATES, RFQ_TEMPLATES_BY_KEY } from "@/react-app/rfqTemplates";

export default function ControlRFQDocuments() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminRfqDocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAdminRfqDocuments();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) => {
      const hay = `${d.title || ""} ${d.number || ""} ${d.templateKey || ""} ${d.currency || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RFQ_TEMPLATES;
    return RFQ_TEMPLATES.filter((t) => {
      const hay = `${t.label} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search]);
  const groupedTemplates = useMemo(() => groupRfqTemplatesByCategory(filteredTemplates), [filteredTemplates]);

  async function createFromTemplate(key: string) {
    const tpl = RFQ_TEMPLATES_BY_KEY[key] || null;
    if (!tpl) return;
    setCreatingKey(key);
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
      }
    } finally {
      setCreatingKey(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">نماذج عروض الأسعار</h1>
          <p className="text-gray-600 mt-1">
            قوالب جاهزة + نماذج محفوظة للاستخدام العملي مع الموردين.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث: عنوان، رقم، قالب، عملة..."
            className="w-[320px] max-w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
          />
          <button
            type="button"
            onClick={() => load()}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <div className="text-lg font-bold text-gray-900">قوالب جاهزة</div>
            <div className="text-sm text-gray-600 mt-1">
              مثل فواتير/نماذج fawater: اختر قالب، املأ بيانات المورد والبنود، واطبع/صدّر.
            </div>
          </div>
        </div>

        {!filteredTemplates.length ? <div className="text-gray-600">لا توجد قوالب مطابقة للبحث.</div> : null}

        {filteredTemplates.length ? (
          <div className="space-y-8">
            {groupedTemplates.map((g) => (
              <div key={g.category}>
                <div className="text-sm font-black text-gray-900 mb-3">{g.category}</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {g.templates.map((t) => {
                    const Icon = t.icon;
                    const busy = creatingKey === t.key;
                    return (
                      <div key={t.key} className="border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                            <Icon size={20} className="text-emerald-700" />
                          </div>
                          <div className="text-xs font-bold px-3 py-1 rounded-lg bg-gray-100 text-gray-700" dir="ltr">
                            {t.defaultCurrency}
                          </div>
                        </div>
                        <div className="mt-4 font-bold text-gray-900">{t.label}</div>
                        <div className="mt-2 text-sm text-gray-600 leading-relaxed">{t.description}</div>
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
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={Boolean(creatingKey)}
                            onClick={() => createFromTemplate(t.key)}
                            className="flex-1 bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
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
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="font-bold text-gray-900">النماذج المحفوظة</div>
        </div>

        {loading ? (
          <div className="p-6 text-gray-600">جارٍ التحميل...</div>
        ) : (
          <div className="divide-y">
            {filteredDocs.map((d) => (
              <div key={d.id} className="p-6 flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="font-bold text-gray-900 truncate">{d.title || "—"}</div>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-200 text-gray-800" dir="ltr">
                      {d.number || `#${d.id}`}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800" dir="ltr">
                      {d.currency || "—"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate" dir="ltr">
                    {d.templateKey || "—"}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 truncate" dir="ltr">
                    {d.updatedAt || d.createdAt || ""}
                  </div>
                </div>
                <Link
                  to={`/control/rfq/${d.id}`}
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                >
                  تحرير
                </Link>
              </div>
            ))}
            {!filteredDocs.length && <div className="p-6 text-gray-600">لا يوجد نماذج مطابقة.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
