import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowUp, Copy, Download, Plus, Printer, Trash2, X } from "lucide-react";

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

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-gray-600 mt-3">{description}</p>
        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 text-gray-800 px-4 py-2 font-bold hover:bg-gray-50 transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg text-white px-4 py-2 font-bold hover:shadow-lg transition disabled:opacity-50 ${
              danger
                ? "bg-gradient-to-r from-red-600 to-red-500"
                : "bg-gradient-to-r from-sq-green via-sq-black to-sq-red"
            }`}
          >
            {busy ? "جارٍ التنفيذ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type EditorSnapshot = {
  title: string;
  templateKey: string;
  currency: string;
  vendor: RfqVendor;
  rfq: RfqMeta;
  items: RfqItem[];
  taxRatePct: number;
  discountRatePct: number;
};

export default function ControlRFQDocumentEdit() {
  const params = useParams();
  const navigate = useNavigate();
  const id = Number(params.id || 0);
  const [data, setData] = useState<AdminRfqDocumentDetail | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [loadError, setLoadError] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
  const originalRef = useRef<EditorSnapshot | null>(null);

  const load = useCallback(async () => {
    const d = await fetchAdminRfqDocumentDetail(id);
    const normalized = normalizePayload(d.data || {});
    const nextTitle = d.title || "";
    const nextTemplateKey = d.templateKey || "";
    const nextCurrency = d.currency || "ILS";
    const nextTaxRatePct = toNumber(normalized.taxRate, 0) * 100;
    const nextDiscountRatePct = toNumber(normalized.discountRate, 0) * 100;

    setData(d);
    setTitle(nextTitle);
    setTemplateKey(nextTemplateKey);
    setCurrency(nextCurrency);
    setVendor(normalized.vendor);
    setRfq(normalized.rfq);
    setItems(normalized.items);
    setTaxRatePct(nextTaxRatePct);
    setDiscountRatePct(nextDiscountRatePct);
    setValidationError("");
    setStatus("idle");
    originalSnapshotRef.current = safeJsonStringify({
      title: nextTitle,
      templateKey: nextTemplateKey,
      currency: nextCurrency,
      payload: normalized,
    });
    originalRef.current = {
      title: nextTitle,
      templateKey: nextTemplateKey,
      currency: nextCurrency,
      vendor: normalized.vendor,
      rfq: normalized.rfq,
      items: normalized.items,
      taxRatePct: nextTaxRatePct,
      discountRatePct: nextDiscountRatePct,
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadError(false);
    load().catch(() => setLoadError(true));
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
    if (!title.trim()) {
      setValidationError("العنوان مطلوب قبل الحفظ.");
      return;
    }
    setSaving(true);
    setStatus("idle");
    setValidationError("");
    try {
      const res = await updateAdminRfqDocument(id, { title: title.trim(), templateKey, currency, data: payload as unknown as Record<string, unknown> });
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

  function restoreOriginal() {
    const original = originalRef.current;
    if (!original) return;
    setTitle(original.title);
    setTemplateKey(original.templateKey);
    setCurrency(original.currency);
    setVendor(original.vendor);
    setRfq(original.rfq);
    setItems(original.items);
    setTaxRatePct(original.taxRatePct);
    setDiscountRatePct(original.discountRatePct);
    setValidationError("");
    setStatus("idle");
    setConfirmDiscard(false);
  }

  function handleCancel() {
    if (!hasChanges) {
      restoreOriginal();
      return;
    }
    setConfirmDiscard(true);
  }

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
        {loadError ? (
          <>
            <div className="font-bold text-gray-900">تعذر تحميل النموذج.</div>
            <p className="text-sm text-gray-600 mt-2">
              تحقق من الاتصال ثم أعد المحاولة.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                load().catch(() => setLoadError(true));
              }}
              className="mt-4 rounded-lg bg-gray-900 text-white px-4 py-2 font-bold hover:bg-gray-800 transition"
            >
              إعادة المحاولة
            </button>
          </>
        ) : (
          <div className="text-gray-700">جارٍ التحميل...</div>
        )}
      </div>
    );
  }

  const filename = (data.number ? data.number.toLowerCase() : `rfq-${id}`) + ".pdf";

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">تحرير نموذج عرض سعر</h1>
            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-200 text-gray-800" dir="ltr">
              {data.number || `#${data.id}`}
            </span>
          </div>
          <p className="text-gray-600 mt-1">
            القالب: <span dir="ltr">{data.templateKey || "—"}</span>
            {hasChanges ? (
              <span className="mr-2 text-amber-700 font-bold">• توجد تعديلات غير محفوظة</span>
            ) : null}
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
            onClick={handleCancel}
            disabled={!hasChanges || saving}
            className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
            title="التراجع عن التعديلات غير المحفوظة"
          >
            إلغاء التعديلات
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges || saving}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
            title={!hasChanges ? "لا توجد تعديلات للحفظ" : "حفظ التعديلات"}
          >
            {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </button>
        </div>
      </div>

      {validationError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-amber-900 font-semibold">
          {validationError}
        </div>
      ) : null}
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  عنوان النموذج <span className="text-red-600">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setValidationError("");
                  }}
                  aria-invalid={Boolean(validationError)}
                  placeholder="اكتب عنواناً يدل على محتوى النموذج"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    معرّف القالب (templateKey)
                  </label>
                  <input
                    value={templateKey}
                    onChange={(e) => setTemplateKey(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">العملة</label>
                  <input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم مسؤول التواصل</label>
                <input
                  value={vendor.contactName}
                  onChange={(e) => setVendor((v) => ({ ...v, contactName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
                <input
                  value={vendor.phone}
                  onChange={(e) => setVendor((v) => ({ ...v, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
                <input
                  value={vendor.email}
                  onChange={(e) => setVendor((v) => ({ ...v, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <input
                  value={vendor.address}
                  onChange={(e) => setVendor((v) => ({ ...v, address: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                <input
                  type="date"
                  value={rfq.dueDate}
                  onChange={(e) => setRfq((r) => ({ ...r, dueDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">مكان التسليم</label>
                <input
                  value={rfq.deliveryLocation}
                  onChange={(e) => setRfq((r) => ({ ...r, deliveryLocation: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">شروط الدفع</label>
                <input
                  value={rfq.paymentTerms}
                  onChange={(e) => setRfq((r) => ({ ...r, paymentTerms: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                <textarea
                  value={rfq.notes}
                  onChange={(e) => setRfq((r) => ({ ...r, notes: e.target.value }))}
                  className="w-full min-h-[110px] px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <div>
                <div className="text-lg font-bold text-gray-900">معاينة مباشرة</div>
                <div className="text-xs text-gray-500 mt-1">
                  تعرض التعديلات الحالية قبل الحفظ؛ اطبع أو نزّل PDF بعد التأكد من البيانات.
                </div>
              </div>
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

            {(vendor.name.trim() === "" || !items.some((it) => it.description.trim() !== "")) ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {vendor.name.trim() === "" ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                    اسم المورد غير مدخل
                  </span>
                ) : null}
                {!items.some((it) => it.description.trim() !== "") ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                    لا توجد بنود مكتملة الوصف
                  </span>
                ) : null}
              </div>
            ) : null}

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
                    <img loading="lazy" decoding="async" src={company.logoUrl} alt={company.name} className="h-12 w-auto object-contain" />
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
            <div className="text-lg font-bold text-gray-900 mb-2">حذف النموذج</div>
            <p className="text-xs text-gray-500 mb-4">
              سيطلب تأكيداً قبل الحذف، ولا يمكن التراجع بعده.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteError("");
                setConfirmDelete(true);
              }}
              className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition"
            >
              حذف النموذج
            </button>
          </div>
        </div>
      </div>

      {confirmDiscard ? (
        <ConfirmDialog
          title="التراجع عن التعديلات؟"
          description="ستتم إعادة الحقول إلى قيمها المحفوظة ولن تُحفظ التعديلات الحالية."
          confirmLabel="تجاهل التعديلات"
          onConfirm={restoreOriginal}
          onCancel={() => setConfirmDiscard(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="تأكيد حذف النموذج"
          description={`سيتم حذف «${title || data.number || `#${id}`}» نهائياً. لا يمكن التراجع بعد الحذف.`}
          confirmLabel="تأكيد الحذف"
          danger
          busy={deleting}
          error={deleteError}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            setDeleteError("");
            const res = await deleteAdminRfqDocument(id).catch(() => ({ ok: false }));
            setDeleting(false);
            if (res.ok) {
              navigate("/control/rfq", { replace: true });
            } else {
              setDeleteError("تعذر حذف النموذج. حاول مرة أخرى.");
            }
          }}
        />
      ) : null}
    </div>
  );
}
