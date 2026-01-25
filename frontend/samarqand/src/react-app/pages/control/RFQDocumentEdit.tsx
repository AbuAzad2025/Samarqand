import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowUp, Copy, Download, Plus, Printer, Trash2 } from "lucide-react";

import {
  deleteAdminRfqDocument,
  downloadAdminRfqDocumentPdf,
  fetchAdminRfqDocumentDetail,
  updateAdminRfqDocument,
  fetchCompany,
  type CompanyPayload,
  type AdminRfqDocumentDetail,
} from "@/react-app/api/site";

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

type RfqItem = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

type RfqVendor = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
};

type RfqMeta = {
  subject: string;
  dueDate: string;
  deliveryLocation: string;
  validityDays: number;
  paymentTerms: string;
  notes: string;
};

type RfqPayload = {
  vendor: RfqVendor;
  rfq: RfqMeta;
  items: RfqItem[];
  taxRate: number;
  discountRate: number;
};

function toNumber(val: unknown, fallback = 0): number {
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePayload(input: unknown): RfqPayload {
  const obj = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const vendorRaw = obj.vendor && typeof obj.vendor === "object" && !Array.isArray(obj.vendor) ? (obj.vendor as Record<string, unknown>) : {};
  const rfqRaw = obj.rfq && typeof obj.rfq === "object" && !Array.isArray(obj.rfq) ? (obj.rfq as Record<string, unknown>) : {};
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];

  const items: RfqItem[] = itemsRaw
    .filter((it) => it && typeof it === "object" && !Array.isArray(it))
    .map((it) => {
      const r = it as Record<string, unknown>;
      return {
        description: String(r.description || ""),
        qty: toNumber(r.qty, 0),
        unit: String(r.unit || ""),
        unitPrice: toNumber(r.unitPrice, 0),
      };
    });

  return {
    vendor: {
      name: String(vendorRaw.name || ""),
      contactName: String(vendorRaw.contactName || ""),
      phone: String(vendorRaw.phone || ""),
      email: String(vendorRaw.email || ""),
      address: String(vendorRaw.address || ""),
    },
    rfq: {
      subject: String(rfqRaw.subject || ""),
      dueDate: String(rfqRaw.dueDate || ""),
      deliveryLocation: String(rfqRaw.deliveryLocation || ""),
      validityDays: toNumber(rfqRaw.validityDays, 14),
      paymentTerms: String(rfqRaw.paymentTerms || ""),
      notes: String(rfqRaw.notes || ""),
    },
    items: items.length ? items : [{ description: "", qty: 1, unit: "قطعة", unitPrice: 0 }],
    taxRate: toNumber(obj.taxRate, 0),
    discountRate: toNumber(obj.discountRate, 0),
  };
}

function calcTotals(payload: RfqPayload): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = payload.items.reduce((sum, it) => sum + toNumber(it.qty) * toNumber(it.unitPrice), 0);
  const discount = subtotal * toNumber(payload.discountRate);
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * toNumber(payload.taxRate);
  const total = afterDiscount + tax;
  return {
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    discount: Number.isFinite(discount) ? discount : 0,
    tax: Number.isFinite(tax) ? tax : 0,
    total: Number.isFinite(total) ? total : 0,
  };
}

export default function ControlRFQDocumentEdit() {
  const params = useParams();
  const navigate = useNavigate();
  const id = Number(params.id || 0);
  const [data, setData] = useState<AdminRfqDocumentDetail | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const [title, setTitle] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [vendor, setVendor] = useState<RfqVendor>({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
  });
  const [rfq, setRfq] = useState<RfqMeta>({
    subject: "",
    dueDate: "",
    deliveryLocation: "",
    validityDays: 14,
    paymentTerms: "",
    notes: "",
  });
  const [items, setItems] = useState<RfqItem[]>([{ description: "", qty: 1, unit: "قطعة", unitPrice: 0 }]);
  const [taxRatePct, setTaxRatePct] = useState(0);
  const [discountRatePct, setDiscountRatePct] = useState(0);
  const [showJson, setShowJson] = useState(false);
  const originalSnapshotRef = useRef<string>("");

  const load = useCallback(async () => {
    const d = await fetchAdminRfqDocumentDetail(id);
    setData(d);
    setTitle(d.title || "");
    setTemplateKey(d.templateKey || "");
    setCurrency(d.currency || "ILS");
    const normalized = normalizePayload(d.data || {});
    setVendor(normalized.vendor);
    setRfq(normalized.rfq);
    setItems(normalized.items);
    setTaxRatePct(toNumber(normalized.taxRate, 0) * 100);
    setDiscountRatePct(toNumber(normalized.discountRate, 0) * 100);
    originalSnapshotRef.current = safeJsonStringify({
      title: d.title || "",
      templateKey: d.templateKey || "",
      currency: d.currency || "ILS",
      payload: normalized,
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    load().catch(() => {});
  }, [id, load]);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      document.body.classList.remove("rfq-printing");
    };
    window.addEventListener("afterprint", handler);
    return () => window.removeEventListener("afterprint", handler);
  }, []);

  const payload = useMemo<RfqPayload>(() => {
    return {
      vendor,
      rfq,
      items,
      taxRate: toNumber(taxRatePct, 0) / 100,
      discountRate: toNumber(discountRatePct, 0) / 100,
    };
  }, [discountRatePct, items, rfq, taxRatePct, vendor]);

  const totals = useMemo(() => calcTotals(payload), [payload]);

  const hasChanges = useMemo(() => {
    if (!data) return false;
    const snap = safeJsonStringify({ title, templateKey, currency, payload });
    return snap.trim() !== (originalSnapshotRef.current || "").trim();
  }, [currency, data, payload, templateKey, title]);

  const onPrint = useCallback(() => {
    document.body.classList.add("rfq-printing");
    window.setTimeout(() => window.print(), 50);
  }, []);

  const onSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminRfqDocument(id, { title, templateKey, currency, data: payload as unknown as Record<string, unknown> });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      await load();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [currency, id, load, payload, templateKey, title]);

  if (!id) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="text-gray-700">معرّف النموذج غير صحيح.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <div className="text-gray-700">جارٍ التحميل...</div>
      </div>
    );
  }

  const filename = (data.number ? data.number.toLowerCase() : `rfq-${id}`) + ".pdf";

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">تحرير نموذج عرض سعر</h1>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-200 text-gray-800" dir="ltr">
              {data.number || `#${data.id}`}
            </span>
          </div>
          <p className="text-gray-600 mt-1" dir="ltr">
            {data.templateKey || "—"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/control/rfq"
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            رجوع
          </Link>
          <button
            type="button"
            onClick={onPrint}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition inline-flex items-center gap-2"
          >
            <Printer size={18} />
            طباعة
          </button>
          <button
            type="button"
            onClick={async () => {
              await downloadAdminRfqDocumentPdf(id, filename).catch(() => {});
            }}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
          >
            تنزيل PDF
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges || saving}
            className="bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>

      {status === "saved" ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800 font-semibold">
          تم الحفظ بنجاح.
        </div>
      ) : null}
      {status === "error" ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-800 font-semibold">
          حصل خطأ أثناء الحفظ.
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Template Key</label>
                  <input
                    value={templateKey}
                    onChange={(e) => setTemplateKey(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">العملة</label>
                  <input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">بيانات المورد</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم المورد/الشركة</label>
                <input
                  value={vendor.name}
                  onChange={(e) => setVendor((v) => ({ ...v, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم مسؤول التواصل</label>
                <input
                  value={vendor.contactName}
                  onChange={(e) => setVendor((v) => ({ ...v, contactName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
                <input
                  value={vendor.phone}
                  onChange={(e) => setVendor((v) => ({ ...v, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
                <input
                  value={vendor.email}
                  onChange={(e) => setVendor((v) => ({ ...v, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <input
                  value={vendor.address}
                  onChange={(e) => setVendor((v) => ({ ...v, address: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">تفاصيل الطلب</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">الموضوع</label>
                <input
                  value={rfq.subject}
                  onChange={(e) => setRfq((r) => ({ ...r, subject: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={rfq.dueDate}
                  onChange={(e) => setRfq((r) => ({ ...r, dueDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">مكان التسليم</label>
                <input
                  value={rfq.deliveryLocation}
                  onChange={(e) => setRfq((r) => ({ ...r, deliveryLocation: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">صلاحية العرض (يوم)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={String(rfq.validityDays ?? "")}
                  onChange={(e) => setRfq((r) => ({ ...r, validityDays: toNumber(e.target.value, 14) }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">شروط الدفع</label>
                <input
                  value={rfq.paymentTerms}
                  onChange={(e) => setRfq((r) => ({ ...r, paymentTerms: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                <textarea
                  value={rfq.notes}
                  onChange={(e) => setRfq((r) => ({ ...r, notes: e.target.value }))}
                  className="w-full min-h-[110px] px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="text-lg font-bold text-gray-900">البنود</div>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { description: "", qty: 1, unit: "قطعة", unitPrice: 0 }])}
                className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition inline-flex items-center gap-2"
              >
                <Plus size={18} />
                إضافة بند
              </button>
            </div>

            <div className="overflow-auto border border-gray-200 rounded-2xl">
              <table className="min-w-[820px] w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-gray-700">
                    <th className="text-right p-3 font-bold w-[46%]">الوصف</th>
                    <th className="text-right p-3 font-bold w-[10%]">الكمية</th>
                    <th className="text-right p-3 font-bold w-[10%]">الوحدة</th>
                    <th className="text-right p-3 font-bold w-[12%]">سعر الوحدة</th>
                    <th className="text-right p-3 font-bold w-[12%]">الإجمالي</th>
                    <th className="text-right p-3 font-bold w-[10%]">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, idx) => {
                    const rowTotal = toNumber(it.qty) * toNumber(it.unitPrice);
                    return (
                      <tr key={idx} className="align-top">
                        <td className="p-3">
                          <input
                            value={it.description}
                            onChange={(e) =>
                              setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="1"
                            value={String(it.qty)}
                            onChange={(e) =>
                              setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, qty: toNumber(e.target.value, 0) } : r)))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            value={it.unit}
                            list="rfq-units"
                            onChange={(e) =>
                              setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, unit: e.target.value } : r)))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={String(it.unitPrice)}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, unitPrice: toNumber(e.target.value, 0) } : r)),
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-3 font-bold text-gray-900" dir="ltr">
                          {rowTotal.toFixed(2)} {currency}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setItems((prev) => {
                                  if (idx === 0) return prev;
                                  const copy = [...prev];
                                  const tmp = copy[idx - 1];
                                  copy[idx - 1] = copy[idx];
                                  copy[idx] = tmp;
                                  return copy;
                                })
                              }
                              className="px-3 py-2 rounded-lg border bg-white disabled:opacity-40"
                              title="أعلى"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === items.length - 1}
                              onClick={() =>
                                setItems((prev) => {
                                  if (idx >= prev.length - 1) return prev;
                                  const copy = [...prev];
                                  const tmp = copy[idx + 1];
                                  copy[idx + 1] = copy[idx];
                                  copy[idx] = tmp;
                                  return copy;
                                })
                              }
                              className="px-3 py-2 rounded-lg border bg-white disabled:opacity-40"
                              title="أسفل"
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) => {
                                  const copy = [...prev];
                                  copy.splice(idx + 1, 0, { ...copy[idx] });
                                  return copy;
                                })
                              }
                              className="px-3 py-2 rounded-lg border bg-white"
                              title="تكرار"
                            >
                              <Copy size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) => {
                                  if (prev.length <= 1) return prev;
                                  return prev.filter((_, i) => i !== idx);
                                })
                              }
                              className="px-3 py-2 rounded-lg border bg-white text-red-700"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <datalist id="rfq-units">
              <option value="قطعة" />
              <option value="متر" />
              <option value="م2" />
              <option value="م3" />
              <option value="كغم" />
              <option value="طن" />
              <option value="لتر" />
              <option value="ساعة" />
              <option value="يوم" />
              <option value="شهر" />
              <option value="باكيت" />
              <option value="كرتون" />
              <option value="حبة" />
            </datalist>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">نسبة الخصم (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={String(discountRatePct)}
                  onChange={(e) => setDiscountRatePct(toNumber(e.target.value, 0))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">نسبة الضريبة (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={String(taxRatePct)}
                  onChange={(e) => setTaxRatePct(toNumber(e.target.value, 0))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="text-lg font-bold text-gray-900">معاينة</div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={onPrint}
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition inline-flex items-center gap-2"
                >
                  <Printer size={18} />
                  طباعة/حفظ PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowJson((v) => !v)}
                  className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                >
                  {showJson ? "إخفاء JSON" : "عرض JSON"}
                </button>
              </div>
            </div>

            <div id="rfq-print" className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="bg-white p-6" dir="rtl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xl font-black text-gray-900">{company?.name || "سمرقند"}</div>
                    <div className="text-sm text-gray-600 mt-1">{company?.address || ""}</div>
                    <div className="text-sm text-gray-600 mt-1" dir="ltr">
                      {(company?.phone1 || "") + (company?.phone2 ? ` | ${company.phone2}` : "")}
                      {company?.email ? ` | ${company.email}` : ""}
                    </div>
                  </div>
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name} className="h-12 w-auto object-contain" />
                  ) : null}
                </div>

                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="text-sm font-bold text-gray-900">بيانات الطلب</div>
                    <div className="text-sm text-gray-700 mt-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-gray-500 font-semibold">الرقم</div>
                        <div dir="ltr">{data.number || `#${data.id}`}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2">
                        <div className="text-gray-500 font-semibold">العملة</div>
                        <div dir="ltr">{currency}</div>
                      </div>
                      {rfq.dueDate ? (
                        <div className="flex items-center justify-between gap-3 mt-2">
                          <div className="text-gray-500 font-semibold">الاستحقاق</div>
                          <div dir="ltr">{rfq.dueDate}</div>
                        </div>
                      ) : null}
                      {rfq.deliveryLocation ? (
                        <div className="flex items-center justify-between gap-3 mt-2">
                          <div className="text-gray-500 font-semibold">التسليم</div>
                          <div>{rfq.deliveryLocation}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="text-sm font-bold text-gray-900">إلى المورد</div>
                    <div className="text-sm text-gray-700 mt-2">
                      <div className="font-bold text-gray-900">{vendor.name || "—"}</div>
                      {vendor.contactName ? <div className="mt-1">{vendor.contactName}</div> : null}
                      {vendor.phone ? (
                        <div className="mt-1" dir="ltr">
                          {vendor.phone}
                        </div>
                      ) : null}
                      {vendor.email ? (
                        <div className="mt-1" dir="ltr">
                          {vendor.email}
                        </div>
                      ) : null}
                      {vendor.address ? <div className="mt-1">{vendor.address}</div> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-lg font-black text-gray-900">{rfq.subject || title || "طلب عرض سعر"}</div>
                  <div className="mt-3 overflow-auto border border-gray-200 rounded-xl">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-gray-700">
                          <th className="text-right p-3 font-bold w-[52%]">البند</th>
                          <th className="text-right p-3 font-bold w-[12%]">الكمية</th>
                          <th className="text-right p-3 font-bold w-[12%]">الوحدة</th>
                          <th className="text-right p-3 font-bold w-[12%]">سعر الوحدة</th>
                          <th className="text-right p-3 font-bold w-[12%]">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-3">{it.description || "—"}</td>
                            <td className="p-3" dir="ltr">
                              {toNumber(it.qty, 0)}
                            </td>
                            <td className="p-3">{it.unit || "—"}</td>
                            <td className="p-3" dir="ltr">
                              {toNumber(it.unitPrice, 0).toFixed(2)}
                            </td>
                            <td className="p-3 font-bold text-gray-900" dir="ltr">
                              {(toNumber(it.qty, 0) * toNumber(it.unitPrice, 0)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 grid md:grid-cols-[1fr_320px] gap-4">
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="text-sm font-bold text-gray-900">شروط الدفع</div>
                    <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{rfq.paymentTerms || "—"}</div>
                    {rfq.notes ? (
                      <>
                        <div className="h-px bg-gray-200 my-4" />
                        <div className="text-sm font-bold text-gray-900">ملاحظات</div>
                        <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{rfq.notes}</div>
                      </>
                    ) : null}
                  </div>
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="text-sm font-bold text-gray-900 mb-3">الملخص</div>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-600">المجموع</div>
                        <div dir="ltr">
                          {totals.subtotal.toFixed(2)} {currency}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-600">الخصم</div>
                        <div dir="ltr">
                          {totals.discount.toFixed(2)} {currency}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-600">الضريبة</div>
                        <div dir="ltr">
                          {totals.tax.toFixed(2)} {currency}
                        </div>
                      </div>
                      <div className="h-px bg-gray-200 my-2" />
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black text-gray-900">الإجمالي</div>
                        <div className="font-black text-gray-900" dir="ltr">
                          {totals.total.toFixed(2)} {currency}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showJson ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="text-sm font-bold text-gray-900">JSON (للمراجعة/النسخ)</div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(safeJsonStringify(payload)).catch(() => {});
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:shadow-sm transition inline-flex items-center gap-2"
                  >
                    <Copy size={16} />
                    نسخ
                  </button>
                </div>
                <pre className="w-full overflow-auto px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-xs" dir="ltr">
                  {safeJsonStringify(payload)}
                </pre>
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([safeJsonStringify({ title, templateKey, currency, payload })], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${data.number || `rfq-${id}`}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition inline-flex items-center gap-2"
              >
                <Download size={18} />
                تنزيل JSON
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">معلومات</div>
            <div className="space-y-2 text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-600">آخر تحديث</div>
                <div className="text-sm" dir="ltr">
                  {data.updatedAt || data.createdAt || ""}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-600">القالب</div>
                <div className="text-sm" dir="ltr">
                  {data.templateKey || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">إجمالي سريع</div>
            <div className="space-y-2 text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-600">المجموع</div>
                <div className="text-sm" dir="ltr">
                  {totals.subtotal.toFixed(2)} {currency}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-600">الخصم</div>
                <div className="text-sm" dir="ltr">
                  {totals.discount.toFixed(2)} {currency}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-600">الضريبة</div>
                <div className="text-sm" dir="ltr">
                  {totals.tax.toFixed(2)} {currency}
                </div>
              </div>
              <div className="h-px bg-gray-200 my-2" />
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-gray-900">الإجمالي</div>
                <div className="text-sm font-bold text-gray-900" dir="ltr">
                  {totals.total.toFixed(2)} {currency}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">حذف</div>
            <button
              type="button"
              onClick={async () => {
                const ok = window.confirm("حذف هذا النموذج؟ لا يمكن التراجع.");
                if (!ok) return;
                const res = await deleteAdminRfqDocument(id).catch(() => ({ ok: false }));
                if (res.ok) navigate("/control/rfq", { replace: true });
              }}
              className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition"
            >
              حذف النموذج
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
