import { useEffect, useMemo, useState } from "react";
import {
  addPaymentApplicationItem,
  addVariationOrderItem,
  approvePaymentApplication,
  createBoqItem,
  createPaymentApplication,
  createVariationOrder,
  deleteBoqItem,
  deletePaymentApplication,
  deleteVariationOrder,
  fetchBoqItems,
  fetchBoqProjects,
  fetchFinalAccount,
  fetchPaymentApplicationDetail,
  fetchPaymentApplications,
  fetchVariationOrders,
  fetchVariationOrderItems,
  generatePaymentApplicationEntry,
  payPaymentApplication,
  rejectPaymentApplication,
  removePaymentApplicationItem,
  removeVariationOrderItem,
  setVariationOrderStatus,
  submitPaymentApplication,
  updateBoqItem,
  updateFinalAccount,
  updatePaymentApplication,
  updatePaymentApplicationItem,
  updateVariationOrder,
  updateVariationOrderItem,
  type BoqItem,
  type BoqProjectItem,
  type FinalAccount,
  type PaymentApplication,
  type PaymentApplicationItem,
  type VariationOrder,
  type VariationOrderItem,
} from "@/react-app/api/boq";
import { formatMoney, todayInputValue, baseHumanizeErrorCode } from "@/react-app/utils/common";

function humanizeErrorCode(code: string): string {
  const shared = baseHumanizeErrorCode(code);
  if (shared) return shared;
  const c = String(code || "").trim();
  if (c === "project_not_found") return "المشروع غير موجود.";
  if (c === "missing_description_or_unit") return "الوصف والوحدة مطلوبان.";
  if (c === "invalid_quantity_or_price") return "الكمية والسعر غير صحيحين.";
  if (c === "missing_number_or_date") return "رقم وتاريخ المستخلص مطلوبان.";
  if (c === "missing_number_or_title") return "رقم وعنوان أمر التغيير مطلوبان.";
  if (c === "paid_application_locked") return "المستخلص المدفوع لا يمكن تعديله.";
  if (c === "implemented_variation_locked") return "أمر التغيير المنفذ لا يمكن تعديله.";
  if (c === "has_payment_items") return "البند مرتبط بمستخلصات.";
  return c;
}

type Tab = "boq" | "payments" | "variations" | "final";
type PaymentModalMode = "create" | "items" | null;

export default function ControlBOQ() {
  const [projects, setProjects] = useState<BoqProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("boq");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [payments, setPayments] = useState<PaymentApplication[]>([]);
  const [variations, setVariations] = useState<VariationOrder[]>([]);
  const [finalAccount, setFinalAccount] = useState<FinalAccount | null>(null);

  const [paymentModal, setPaymentModal] = useState<PaymentModalMode>(null);
  const [activePayment, setActivePayment] = useState<PaymentApplication | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<PaymentApplication | null>(null);

  const [variationModal, setVariationModal] = useState<"create" | "items" | null>(null);
  const [activeVariation, setActiveVariation] = useState<VariationOrder | null>(null);

  const [boqForm, setBoqForm] = useState<Partial<BoqItem>>({});
  const [editingBoqId, setEditingBoqId] = useState<number | null>(null);

  const [paymentForm, setPaymentForm] = useState<Partial<PaymentApplication>>({});
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [paymentItemForm, setPaymentItemForm] = useState<Partial<PaymentApplicationItem>>({});
  const [editingPaymentItemId, setEditingPaymentItemId] = useState<number | null>(null);

  const [variationForm, setVariationForm] = useState<Partial<VariationOrder>>({});
  const [editingVariationId, setEditingVariationId] = useState<number | null>(null);
  const [variationItemForm, setVariationItemForm] = useState<Partial<VariationOrderItem>>({});
  const [editingVariationItemId, setEditingVariationItemId] = useState<number | null>(null);

  const [finalForm, setFinalForm] = useState<Partial<FinalAccount>>({});

  useEffect(() => {
    fetchBoqProjects()
      .then(setProjects)
      .catch(() => setError("تعذر تحميل المشاريع."));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError("");
    Promise.all([
      fetchBoqItems(selectedProjectId),
      fetchPaymentApplications(selectedProjectId),
      fetchVariationOrders(selectedProjectId),
      fetchFinalAccount(selectedProjectId),
    ])
      .then(([boqData, paymentsData, variationsData, finalData]) => {
        setBoqItems(boqData.items);
        setPayments(paymentsData.items);
        setVariations(variationsData.items);
        setFinalAccount(finalData);
        setFinalForm(finalData);
      })
      .catch(() => setError("تعذر تحميل بيانات المشروع."))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  function showError(err: unknown) {
    const code = typeof err === "string" ? err : humanizeErrorCode(String(err));
    setError(code);
    setTimeout(() => setError(""), 5000);
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }

  async function refreshAll() {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const [boqData, paymentsData, variationsData, finalData] = await Promise.all([
        fetchBoqItems(selectedProjectId),
        fetchPaymentApplications(selectedProjectId),
        fetchVariationOrders(selectedProjectId),
        fetchFinalAccount(selectedProjectId),
      ]);
      setBoqItems(boqData.items);
      setPayments(paymentsData.items);
      setVariations(variationsData.items);
      setFinalAccount(finalData);
      setFinalForm(finalData);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  const totalContractValue = useMemo(
    () => boqItems.reduce((sum, it) => sum + (it.totalPrice || 0), 0),
    [boqItems],
  );

  async function handleSaveBoqItem() {
    if (!selectedProjectId) return;
    const payload = {
      description: boqForm.description || "",
      unit: boqForm.unit || "",
      quantity: Number(boqForm.quantity) || 0,
      unitPrice: Number(boqForm.unitPrice) || 0,
      itemCode: boqForm.itemCode || "",
      sortOrder: Number(boqForm.sortOrder) || 0,
      accountId: boqForm.accountId || undefined,
      notes: boqForm.notes || "",
    };
    const res = editingBoqId
      ? await updateBoqItem(selectedProjectId, editingBoqId, payload)
      : await createBoqItem(selectedProjectId, payload);
    if (res.ok) {
      setBoqForm({});
      setEditingBoqId(null);
      showSuccess(editingBoqId ? "تم تحديث البند." : "تم إضافة البند.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleDeleteBoqItem(id: number) {
    if (!selectedProjectId || !window.confirm("هل أنت متأكد من حذف هذا البند؟")) return;
    const res = await deleteBoqItem(selectedProjectId, id);
    if (res.ok) {
      showSuccess("تم حذف البند.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleSavePayment() {
    if (!selectedProjectId) return;
    const payload = {
      applicationNumber: paymentForm.applicationNumber || "",
      applicationDate: paymentForm.applicationDate || todayInputValue(),
      periodFrom: paymentForm.periodFrom || undefined,
      periodTo: paymentForm.periodTo || undefined,
      previousApplicationsTotal: Number(paymentForm.previousApplicationsTotal) || 0,
      retentionPercent: Number(paymentForm.retentionPercent) || 10,
      withholdingTaxPercent: Number(paymentForm.withholdingTaxPercent) || 10,
      previousDeductions: Number(paymentForm.previousDeductions) || 0,
    };
    const res = editingPaymentId
      ? await updatePaymentApplication(selectedProjectId, editingPaymentId, payload)
      : await createPaymentApplication(selectedProjectId, payload);
    if (res.ok) {
      setPaymentForm({});
      setEditingPaymentId(null);
      setPaymentModal(null);
      showSuccess(editingPaymentId ? "تم تحديث المستخلص." : "تم إنشاء المستخلص.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handlePaymentAction(action: "submit" | "approve" | "reject" | "pay" | "generate", id: number) {
    if (!selectedProjectId) return;
    const res =
      action === "submit"
        ? await submitPaymentApplication(selectedProjectId, id)
        : action === "approve"
          ? await approvePaymentApplication(selectedProjectId, id)
          : action === "reject"
            ? await rejectPaymentApplication(selectedProjectId, id)
            : action === "pay"
              ? await payPaymentApplication(selectedProjectId, id)
              : await generatePaymentApplicationEntry(selectedProjectId, id);
    if (res.ok) {
      showSuccess(
        action === "generate" ? `تم إنشاء القيد رقم ${(res as { number?: string }).number || ""}` : "تم تحديث حالة المستخلص.",
      );
      refreshAll();
      if (activePayment?.id === id) {
        const detail = await fetchPaymentApplicationDetail(selectedProjectId, id);
        setActivePayment(detail);
        setPaymentDetail(detail);
      }
    } else {
      showError(res.error);
    }
  }

  async function handleDeletePayment(id: number) {
    if (!selectedProjectId || !window.confirm("هل أنت متأكد من حذف هذا المستخلص؟")) return;
    const res = await deletePaymentApplication(selectedProjectId, id);
    if (res.ok) {
      showSuccess("تم حذف المستخلص.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function openPaymentItems(payment: PaymentApplication) {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const detail = await fetchPaymentApplicationDetail(selectedProjectId, payment.id);
      setActivePayment(detail);
      setPaymentDetail(detail);
      setPaymentModal("items");
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePaymentItem() {
    if (!selectedProjectId || !activePayment) return;
    const payload = {
      boqItemId: Number(paymentItemForm.boqItemId) || 0,
      currentQuantity: Number(paymentItemForm.currentQuantity) || 0,
      previouslyDoneQuantity: Number(paymentItemForm.previouslyDoneQuantity) || 0,
      previouslyCertified: Number(paymentItemForm.previouslyCertified) || 0,
    };
    const res = editingPaymentItemId
      ? await updatePaymentApplicationItem(selectedProjectId, activePayment.id, editingPaymentItemId, payload)
      : await addPaymentApplicationItem(selectedProjectId, activePayment.id, payload);
    if (res.ok) {
      setPaymentItemForm({});
      setEditingPaymentItemId(null);
      showSuccess(editingPaymentItemId ? "تم تحديث البند." : "تم إضافة البند.");
      const detail = await fetchPaymentApplicationDetail(selectedProjectId, activePayment.id);
      setActivePayment(detail);
      setPaymentDetail(detail);
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleDeletePaymentItem(itemId: number) {
    if (!selectedProjectId || !activePayment || !window.confirm("هل أنت متأكد؟")) return;
    const res = await removePaymentApplicationItem(selectedProjectId, activePayment.id, itemId);
    if (res.ok) {
      showSuccess("تم حذف البند.");
      const detail = await fetchPaymentApplicationDetail(selectedProjectId, activePayment.id);
      setActivePayment(detail);
      setPaymentDetail(detail);
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleSaveVariation() {
    if (!selectedProjectId) return;
    const payload = {
      variationNumber: variationForm.variationNumber || "",
      title: variationForm.title || "",
      reason: variationForm.reason || "other",
      description: variationForm.description || "",
      costImpact: Number(variationForm.costImpact) || 0,
      scheduleImpactDays: Number(variationForm.scheduleImpactDays) || 0,
    };
    const res = editingVariationId
      ? await updateVariationOrder(selectedProjectId, editingVariationId, payload)
      : await createVariationOrder(selectedProjectId, payload);
    if (res.ok) {
      setVariationForm({});
      setEditingVariationId(null);
      setVariationModal(null);
      showSuccess(editingVariationId ? "تم تحديث أمر التغيير." : "تم إنشاء أمر التغيير.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleVariationStatus(id: number, status: VariationOrder["status"]) {
    if (!selectedProjectId) return;
    const res = await setVariationOrderStatus(selectedProjectId, id, status);
    if (res.ok) {
      showSuccess("تم تحديث الحالة.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleDeleteVariation(id: number) {
    if (!selectedProjectId || !window.confirm("هل أنت متأكد من حذف أمر التغيير؟")) return;
    const res = await deleteVariationOrder(selectedProjectId, id);
    if (res.ok) {
      showSuccess("تم الحذف.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleSaveVariationItem() {
    if (!selectedProjectId || !activeVariation) return;
    const payload = {
      boqItemId: variationItemForm.boqItemId || undefined,
      description: variationItemForm.description || "",
      unit: variationItemForm.unit || "",
      quantityChange: Number(variationItemForm.quantityChange) || 0,
      unitPrice: Number(variationItemForm.unitPrice) || 0,
    };
    const res = editingVariationItemId
      ? await updateVariationOrderItem(selectedProjectId, activeVariation.id, editingVariationItemId, payload)
      : await addVariationOrderItem(selectedProjectId, activeVariation.id, payload);
    if (res.ok) {
      setVariationItemForm({});
      setEditingVariationItemId(null);
      showSuccess(editingVariationItemId ? "تم التحديث." : "تمت الإضافة.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleDeleteVariationItem(itemId: number) {
    if (!selectedProjectId || !activeVariation || !window.confirm("هل أنت متأكد؟")) return;
    const res = await removeVariationOrderItem(selectedProjectId, activeVariation.id, itemId);
    if (res.ok) {
      showSuccess("تم الحذف.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  async function handleSaveFinalAccount() {
    if (!selectedProjectId) return;
    const res = await updateFinalAccount(selectedProjectId, {
      contractAmount: Number(finalForm.contractAmount) || 0,
      totalVariations: Number(finalForm.totalVariations) || 0,
      totalRetentionReleased: Number(finalForm.totalRetentionReleased) || 0,
      totalWithholdingTax: Number(finalForm.totalWithholdingTax) || 0,
      status: finalForm.status || "draft",
      notes: finalForm.notes || "",
    });
    if (res.ok) {
      showSuccess("تم حفظ الحساب الختامي.");
      refreshAll();
    } else {
      showError(res.error);
    }
  }

  function statusBadge(status: string): string {
    const map: Record<string, string> = {
      draft: "bg-white/10 text-white/80",
      submitted: "bg-blue-500/20 text-blue-300",
      approved: "bg-emerald-500/20 text-emerald-300",
      paid: "bg-sq-green/30 text-emerald-200",
      rejected: "bg-red-500/20 text-red-300",
      implemented: "bg-purple-500/20 text-purple-300",
      agreed: "bg-emerald-500/20 text-emerald-300",
      closed: "bg-slate-500/20 text-slate-300",
    };
    return map[status] || "bg-white/10 text-white/80";
  }

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: "مسودة",
      submitted: "مرسل",
      approved: "معتمد",
      paid: "مدفوع",
      rejected: "مرفوض",
      implemented: "منفذ",
      agreed: "متفق عليه",
      closed: "مغلق",
    };
    return map[status] || status;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "boq", label: "بنود الكميات" },
    { key: "payments", label: "المستخلصات" },
    { key: "variations", label: "أوامر التغيير" },
    { key: "final", label: "الحساب الختامي" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">إدارة بنود الكميات والمستخلصات</h1>
          <p className="text-white/60 mt-1">BOQ — مستخلصات — أوامر تغييرية — حساب ختامي</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white min-w-[220px] focus:outline-none focus:border-sq-green/50"
          >
            <option value="" className="bg-sq-black">اختر مشروعاً</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-sq-black">
                {p.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refreshAll}
            disabled={!selectedProjectId || loading}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white disabled:opacity-50"
          >
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-emerald-200">
          {success}
        </div>
      )}

      {!selectedProjectId ? (
        <div className="text-center py-20 text-white/50">
          <div className="text-5xl mb-4">📐</div>
          <div className="text-lg font-bold">اختر مشروعاً لبدء العمل</div>
        </div>
      ) : loading ? (
        <div className="text-center py-20 text-white/50">جاري التحميل…</div>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl border text-sm font-bold transition whitespace-nowrap ${
                  tab === t.key
                    ? "bg-gradient-to-r from-sq-green/25 via-white/5 to-sq-red/25 border-white/20 text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "boq" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-white/80 font-bold">
                  قيمة العقد التقديرية: <span className="text-emerald-400">{formatMoney(totalContractValue)}</span> ₪
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBoqForm({});
                    setEditingBoqId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
                >
                  + بند جديد
                </button>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="grid md:grid-cols-12 gap-3">
                  <input
                    type="text"
                    placeholder="رقم البند"
                    value={boqForm.itemCode || ""}
                    onChange={(e) => setBoqForm({ ...boqForm, itemCode: e.target.value })}
                    className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                  />
                  <input
                    type="text"
                    placeholder="وصف البند"
                    value={boqForm.description || ""}
                    onChange={(e) => setBoqForm({ ...boqForm, description: e.target.value })}
                    className="md:col-span-4 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                  />
                  <input
                    type="text"
                    placeholder="الوحدة"
                    value={boqForm.unit || ""}
                    onChange={(e) => setBoqForm({ ...boqForm, unit: e.target.value })}
                    className="md:col-span-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                  />
                  <input
                    type="number"
                    step="0.001"
                    placeholder="الكمية"
                    value={boqForm.quantity ?? ""}
                    onChange={(e) => setBoqForm({ ...boqForm, quantity: Number(e.target.value) })}
                    className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="سعر الوحدة"
                    value={boqForm.unitPrice ?? ""}
                    onChange={(e) => setBoqForm({ ...boqForm, unitPrice: Number(e.target.value) })}
                    className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                  />
                  <input
                    type="number"
                    placeholder="الترتيب"
                    value={boqForm.sortOrder ?? ""}
                    onChange={(e) => setBoqForm({ ...boqForm, sortOrder: Number(e.target.value) })}
                    className="md:col-span-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveBoqItem}
                    className="px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
                  >
                    {editingBoqId ? "تحديث" : "حفظ"}
                  </button>
                  {editingBoqId && (
                    <button
                      type="button"
                      onClick={() => {
                        setBoqForm({});
                        setEditingBoqId(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="px-4 py-3 text-right">#</th>
                      <th className="px-4 py-3 text-right">الوصف</th>
                      <th className="px-4 py-3 text-right">الوحدة</th>
                      <th className="px-4 py-3 text-right">الكمية</th>
                      <th className="px-4 py-3 text-right">سعر الوحدة</th>
                      <th className="px-4 py-3 text-right">الإجمالي</th>
                      <th className="px-4 py-3 text-right">منجز</th>
                      <th className="px-4 py-3 text-right">متبقي</th>
                      <th className="px-4 py-3 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map((it) => (
                      <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3 text-white/60">{it.itemCode || it.id}</td>
                        <td className="px-4 py-3 text-white">{it.description}</td>
                        <td className="px-4 py-3 text-white/70">{it.unit}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(it.quantity)}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(it.unitPrice)}</td>
                        <td className="px-4 py-3 text-emerald-300">{formatMoney(it.totalPrice)}</td>
                        <td className="px-4 py-3 text-blue-300">{formatMoney(it.executedQuantity)}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(it.remainingQuantity)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setBoqForm(it);
                                setEditingBoqId(it.id);
                              }}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBoqItem(it.id)}
                              className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20"
                            >
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {boqItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                          لا توجد بنود كميات لهذا المشروع.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-white/80 font-bold">المستخلصات الدورية</div>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentForm({ applicationDate: todayInputValue() });
                    setEditingPaymentId(null);
                    setPaymentModal("create");
                  }}
                  className="px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
                >
                  + مستخلص جديد
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="px-4 py-3 text-right">الرقم</th>
                      <th className="px-4 py-3 text-right">التاريخ</th>
                      <th className="px-4 py-3 text-right">الإجمالي</th>
                      <th className="px-4 py-3 text-right">مستحق</th>
                      <th className="px-4 py-3 text-right">حبس ضمان</th>
                      <th className="px-4 py-3 text-right">ض. خصم</th>
                      <th className="px-4 py-3 text-right">الصافي</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                      <th className="px-4 py-3 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3 text-white font-bold">{p.applicationNumber}</td>
                        <td className="px-4 py-3 text-white/70">{p.applicationDate}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(p.totalWorksDone)}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(p.currentDue)}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(p.retentionAmount)}</td>
                        <td className="px-4 py-3 text-white/80">{formatMoney(p.withholdingTaxAmount)}</td>
                        <td className="px-4 py-3 text-emerald-300 font-bold">{formatMoney(p.netAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(p.status)}`}>
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openPaymentItems(p)}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10"
                            >
                              البنود
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentForm(p);
                                setEditingPaymentId(p.id);
                                setPaymentModal("create");
                              }}
                              disabled={p.status === "paid"}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
                            >
                              تعديل
                            </button>
                            {p.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => handlePaymentAction("submit", p.id)}
                                className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 hover:bg-blue-500/20"
                              >
                                إرسال
                              </button>
                            )}
                            {(p.status === "draft" || p.status === "submitted") && (
                              <button
                                type="button"
                                onClick={() => handlePaymentAction("approve", p.id)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 hover:bg-emerald-500/20"
                              >
                                اعتماد
                              </button>
                            )}
                            {(p.status === "approved" || p.status === "submitted") && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentAction("pay", p.id)}
                                  className="px-2 py-1 rounded-lg bg-sq-green/20 border border-sq-green/30 text-xs text-emerald-300 hover:bg-sq-green/30"
                                >
                                  دفع
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePaymentAction("generate", p.id)}
                                  disabled={Boolean(p.journalEntryId)}
                                  className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
                                >
                                  قيد
                                </button>
                              </>
                            )}
                            {p.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p.id)}
                                className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                          لا توجد مستخلصات.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "variations" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-white/80 font-bold">أوامر التغييرية</div>
                <button
                  type="button"
                  onClick={() => {
                    setVariationForm({});
                    setEditingVariationId(null);
                    setVariationModal("create");
                  }}
                  className="px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
                >
                  + أمر تغييري جديد
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-white/70">
                    <tr>
                      <th className="px-4 py-3 text-right">الرقم</th>
                      <th className="px-4 py-3 text-right">العنوان</th>
                      <th className="px-4 py-3 text-right">السبب</th>
                      <th className="px-4 py-3 text-right">الأثر المالي</th>
                      <th className="px-4 py-3 text-right">تأثير الجدولة</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                      <th className="px-4 py-3 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variations.map((v) => (
                      <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3 text-white font-bold">{v.variationNumber}</td>
                        <td className="px-4 py-3 text-white">{v.title}</td>
                        <td className="px-4 py-3 text-white/70">{v.reason}</td>
                        <td className="px-4 py-3 text-amber-300">{formatMoney(v.costImpact)}</td>
                        <td className="px-4 py-3 text-white/80">{v.scheduleImpactDays} يوم</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(v.status)}`}>
                            {statusLabel(v.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const items = await fetchVariationOrderItems(
                                    Number(selectedProjectId),
                                    v.id,
                                  );
                                  setActiveVariation({ ...v, items });
                                } catch {
                                  setActiveVariation(v);
                                }
                                setVariationModal("items");
                              }}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10"
                            >
                              البنود
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setVariationForm(v);
                                setEditingVariationId(v.id);
                                setVariationModal("create");
                              }}
                              disabled={v.status === "implemented"}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
                            >
                              تعديل
                            </button>
                            {v.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => handleVariationStatus(v.id, "submitted")}
                                className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 hover:bg-blue-500/20"
                              >
                                إرسال
                              </button>
                            )}
                            {(v.status === "draft" || v.status === "submitted") && (
                              <button
                                type="button"
                                onClick={() => handleVariationStatus(v.id, "approved")}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 hover:bg-emerald-500/20"
                              >
                                اعتماد
                              </button>
                            )}
                            {v.status === "approved" && (
                              <button
                                type="button"
                                onClick={() => handleVariationStatus(v.id, "implemented")}
                                className="px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 hover:bg-purple-500/20"
                              >
                                تنفيذ
                              </button>
                            )}
                            {v.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteVariation(v.id)}
                                className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {variations.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                          لا توجد أوامر تغييرية.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "final" && finalAccount && (
            <div className="space-y-6">
              <div className="text-white/80 font-bold">الحساب الختامي</div>
              <div className="grid md:grid-cols-2 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div>
                  <label className="block text-xs text-white/60 mb-1">قيمة العقد</label>
                  <input
                    type="number"
                    step="0.01"
                    value={finalForm.contractAmount ?? 0}
                    onChange={(e) => setFinalForm({ ...finalForm, contractAmount: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">إجمالي التغييرات</label>
                  <input
                    type="number"
                    step="0.01"
                    value={finalForm.totalVariations ?? 0}
                    onChange={(e) => setFinalForm({ ...finalForm, totalVariations: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">حبس ضمان منصرف</label>
                  <input
                    type="number"
                    step="0.01"
                    value={finalForm.totalRetentionReleased ?? 0}
                    onChange={(e) =>
                      setFinalForm({ ...finalForm, totalRetentionReleased: Number(e.target.value) })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">إجمالي ضريبة الخصم</label>
                  <input
                    type="number"
                    step="0.01"
                    value={finalForm.totalWithholdingTax ?? 0}
                    onChange={(e) =>
                      setFinalForm({ ...finalForm, totalWithholdingTax: Number(e.target.value) })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">الحالة</label>
                  <select
                    value={finalForm.status || "draft"}
                    onChange={(e) =>
                      setFinalForm({ ...finalForm, status: e.target.value as FinalAccount["status"] })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
                  >
                    <option value="draft" className="bg-sq-black">مسودة</option>
                    <option value="submitted" className="bg-sq-black">مرسل</option>
                    <option value="agreed" className="bg-sq-black">متفق عليه</option>
                    <option value="closed" className="bg-sq-black">مغلق</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">المبلغ المتبقي (يتم حسابه تلقائياً)</label>
                  <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-emerald-300 font-bold">
                    {formatMoney(finalAccount.netDue)} ₪
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-white/60 mb-1">ملاحظات</label>
                  <textarea
                    value={finalForm.notes || ""}
                    onChange={(e) => setFinalForm({ ...finalForm, notes: e.target.value })}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSaveFinalAccount}
                className="px-6 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
              >
                حفظ الحساب الختامي
              </button>
            </div>
          )}
        </>
      )}

      {paymentModal === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sq-black border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">
                {editingPaymentId ? "تعديل مستخلص" : "مستخلص جديد"}
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="رقم المستخلص"
                value={paymentForm.applicationNumber || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, applicationNumber: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="date"
                value={paymentForm.applicationDate || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, applicationDate: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="date"
                value={paymentForm.periodFrom || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, periodFrom: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="date"
                value={paymentForm.periodTo || ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, periodTo: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="إجمالي سابق"
                value={paymentForm.previousApplicationsTotal ?? ""}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, previousApplicationsTotal: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="% حبس ضمان"
                value={paymentForm.retentionPercent ?? ""}
                onChange={(e) => setPaymentForm({ ...paymentForm, retentionPercent: Number(e.target.value) })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="% ضريبة خصم"
                value={paymentForm.withholdingTaxPercent ?? ""}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, withholdingTaxPercent: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="خصومات سابقة"
                value={paymentForm.previousDeductions ?? ""}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, previousDeductions: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSavePayment}
                className="px-6 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentModal === "items" && activePayment && paymentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sq-black border border-white/10 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">
                بنود المستخلص: {activePayment.applicationNumber}
              </h3>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 grid md:grid-cols-3 gap-3">
              <select
                value={paymentItemForm.boqItemId || ""}
                onChange={(e) => setPaymentItemForm({ ...paymentItemForm, boqItemId: Number(e.target.value) })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
              >
                <option value="" className="bg-sq-black">اختر بند كميات</option>
                {boqItems.map((it) => (
                  <option key={it.id} value={it.id} className="bg-sq-black">
                    {it.itemCode || it.id} — {it.description}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                placeholder="الكمية الحالية"
                value={paymentItemForm.currentQuantity ?? ""}
                onChange={(e) =>
                  setPaymentItemForm({ ...paymentItemForm, currentQuantity: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.001"
                placeholder="منجز سابقاً"
                value={paymentItemForm.previouslyDoneQuantity ?? ""}
                onChange={(e) =>
                  setPaymentItemForm({ ...paymentItemForm, previouslyDoneQuantity: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="معتمد سابقاً"
                value={paymentItemForm.previouslyCertified ?? ""}
                onChange={(e) =>
                  setPaymentItemForm({ ...paymentItemForm, previouslyCertified: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <div className="md:col-span-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSavePaymentItem}
                  disabled={activePayment.status === "paid"}
                  className="px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold disabled:opacity-40"
                >
                  {editingPaymentItemId ? "تحديث بند" : "إضافة بند"}
                </button>
                {editingPaymentItemId && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentItemForm({});
                      setEditingPaymentItemId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-3 py-2 text-right">البند</th>
                    <th className="px-3 py-2 text-right">كمية العقد</th>
                    <th className="px-3 py-2 text-right">سابق</th>
                    <th className="px-3 py-2 text-right">حالي</th>
                    <th className="px-3 py-2 text-right">إجمالي منجز</th>
                    <th className="px-3 py-2 text-right">% إنجاز</th>
                    <th className="px-3 py-2 text-right">المبلغ الحالي</th>
                    <th className="px-3 py-2 text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(paymentDetail.items || []).map((item) => (
                    <tr key={item.id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2 text-white">{item.boqItemDescription}</td>
                      <td className="px-3 py-2 text-white/80">{formatMoney(item.contractedQuantity)}</td>
                      <td className="px-3 py-2 text-white/80">{formatMoney(item.previouslyDoneQuantity)}</td>
                      <td className="px-3 py-2 text-white/80">{formatMoney(item.currentQuantity)}</td>
                      <td className="px-3 py-2 text-white/80">{formatMoney(item.totalDoneQuantity)}</td>
                      <td className="px-3 py-2 text-blue-300">{formatMoney(item.donePercent)}%</td>
                      <td className="px-3 py-2 text-emerald-300">{formatMoney(item.currentAmount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentItemForm(item);
                              setEditingPaymentItemId(item.id);
                            }}
                            disabled={activePayment.status === "paid"}
                            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePaymentItem(item.id)}
                            disabled={activePayment.status === "paid"}
                            className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-white/80">
              <div>
                إجمالي الأعمال: <span className="text-emerald-300 font-bold">{formatMoney(paymentDetail.totalWorksDone)}</span> ₪
              </div>
              <div>
                الصافي: <span className="text-emerald-300 font-bold">{formatMoney(paymentDetail.netAmount)}</span> ₪
              </div>
            </div>
          </div>
        </div>
      )}

      {variationModal === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sq-black border border-white/10 rounded-3xl p-6 w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">
                {editingVariationId ? "تعديل أمر تغييري" : "أمر تغييري جديد"}
              </h3>
              <button
                type="button"
                onClick={() => setVariationModal(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="رقم أمر التغيير"
                value={variationForm.variationNumber || ""}
                onChange={(e) => setVariationForm({ ...variationForm, variationNumber: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="text"
                placeholder="العنوان"
                value={variationForm.title || ""}
                onChange={(e) => setVariationForm({ ...variationForm, title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <select
                value={variationForm.reason || "other"}
                onChange={(e) => setVariationForm({ ...variationForm, reason: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
              >
                <option value="client_request" className="bg-sq-black">طلب العميل</option>
                <option value="design_change" className="bg-sq-black">تغيير تصميم</option>
                <option value="site_condition" className="bg-sq-black">ظروف الموقع</option>
                <option value="error" className="bg-sq-black">خطأ</option>
                <option value="other" className="bg-sq-black">أخرى</option>
              </select>
              <textarea
                placeholder="الوصف"
                value={variationForm.description || ""}
                onChange={(e) => setVariationForm({ ...variationForm, description: e.target.value })}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="الأثر المالي"
                  value={variationForm.costImpact ?? ""}
                  onChange={(e) => setVariationForm({ ...variationForm, costImpact: Number(e.target.value) })}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                />
                <input
                  type="number"
                  placeholder="تأثير الجدولة (يوم)"
                  value={variationForm.scheduleImpactDays ?? ""}
                  onChange={(e) =>
                    setVariationForm({ ...variationForm, scheduleImpactDays: Number(e.target.value) })
                  }
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveVariation}
                className="px-6 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setVariationModal(null)}
                className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {variationModal === "items" && activeVariation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sq-black border border-white/10 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">بنود: {activeVariation.title}</h3>
              <button
                type="button"
                onClick={() => setVariationModal(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 grid md:grid-cols-4 gap-3">
              <select
                value={variationItemForm.boqItemId || ""}
                onChange={(e) =>
                  setVariationItemForm({ ...variationItemForm, boqItemId: Number(e.target.value) || undefined })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50"
              >
                <option value="" className="bg-sq-black">اختياري: بند كميات</option>
                {boqItems.map((it) => (
                  <option key={it.id} value={it.id} className="bg-sq-black">
                    {it.itemCode || it.id} — {it.description}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="الوصف"
                value={variationItemForm.description || ""}
                onChange={(e) => setVariationItemForm({ ...variationItemForm, description: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="text"
                placeholder="الوحدة"
                value={variationItemForm.unit || ""}
                onChange={(e) => setVariationItemForm({ ...variationItemForm, unit: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.001"
                placeholder="التغيير في الكمية"
                value={variationItemForm.quantityChange ?? ""}
                onChange={(e) =>
                  setVariationItemForm({ ...variationItemForm, quantityChange: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="سعر الوحدة"
                value={variationItemForm.unitPrice ?? ""}
                onChange={(e) =>
                  setVariationItemForm({ ...variationItemForm, unitPrice: Number(e.target.value) })
                }
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50"
              />
              <div className="md:col-span-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveVariationItem}
                  disabled={activeVariation.status === "implemented"}
                  className="px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold disabled:opacity-40"
                >
                  {editingVariationItemId ? "تحديث" : "إضافة"}
                </button>
                {editingVariationItemId && (
                  <button
                    type="button"
                    onClick={() => {
                      setVariationItemForm({});
                      setEditingVariationItemId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-3 py-2 text-right">الوصف</th>
                    <th className="px-3 py-2 text-right">الوحدة</th>
                    <th className="px-3 py-2 text-right">التغيير</th>
                    <th className="px-3 py-2 text-right">سعر الوحدة</th>
                    <th className="px-3 py-2 text-right">الإجمالي</th>
                    <th className="px-3 py-2 text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeVariation.items || []).map((item) => (
                    <tr key={item.id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2 text-white">{item.description}</td>
                      <td className="px-3 py-2 text-white/70">{item.unit}</td>
                      <td className="px-3 py-2 text-white/80">{formatMoney(item.quantityChange)}</td>
                      <td className="px-3 py-2 text-white/80">{formatMoney(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-amber-300">{formatMoney(item.total)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setVariationItemForm(item);
                              setEditingVariationItemId(item.id);
                            }}
                            disabled={activeVariation.status === "implemented"}
                            className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVariationItem(item.id)}
                            disabled={activeVariation.status === "implemented"}
                            className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
