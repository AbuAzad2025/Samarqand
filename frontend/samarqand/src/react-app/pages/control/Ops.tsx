import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import {
  createAdminOpsContractAddendum,
  createAdminOpsContractPayment,
  createAdminOpsAttendance,
  createAdminOpsAssignment,
  createAdminOpsClient,
  createAdminOpsContract,
  createAdminOpsEquipment,
  createAdminOpsInventoryItem,
  createAdminOpsInventoryTransaction,
  createAdminOpsPayrollEntry,
  createAdminOpsPurchaseOrder,
  createAdminOpsSupplier,
  createAdminOpsWorker,
  deleteAdminOpsContractPayment,
  deleteAdminOpsAttendance,
  deleteAdminOpsAssignment,
  deleteAdminOpsClient,
  deleteAdminOpsContract,
  deleteAdminOpsEquipment,
  deleteAdminOpsInventoryItem,
  deleteAdminOpsPayrollEntry,
  deleteAdminOpsPurchaseOrder,
  deleteAdminOpsSupplier,
  deleteAdminOpsWorker,
  fetchAdminUsersList,
  fetchAdminOpsAuditLogs,
  fetchAdminOpsContractAddendums,
  fetchAdminOpsContractPayments,
  fetchAdminKpiProjects,
  fetchAuthMe,
  fetchAdminOpsAttendance,
  fetchAdminOpsAssignments,
  fetchAdminOpsClients,
  fetchAdminOpsContracts,
  fetchAdminOpsEquipment,
  fetchAdminOpsInventoryItems,
  fetchAdminOpsInventoryTransactions,
  fetchAdminOpsPayroll,
  generateAdminOpsPayrollFromAttendance,
  fetchAdminOpsPurchaseOrders,
  fetchAdminOpsSuppliers,
  fetchAdminOpsWorkers,
  importAdminOpsTimeclock,
  importAdminOpsTimeclockFromFolder,
  fetchAdminOpsTimeclockRuns,
  fetchAdminProjects,
  updateAdminOpsAttendance,
  updateAdminOpsAssignment,
  updateAdminOpsClient,
  updateAdminOpsContract,
  updateAdminOpsContractPayment,
  updateAdminOpsEquipment,
  updateAdminOpsInventoryItem,
  updateAdminOpsPayrollEntry,
  updateAdminOpsPurchaseOrder,
  updateAdminOpsSupplier,
  updateAdminOpsWorker,
  type AdminUserListItem,
  type AdminOpsAuditLog,
  type AdminKpiProjectItem,
  type AdminOpsAttendance,
  type AdminOpsAssignment,
  type AdminOpsClient,
  type AdminOpsContract,
  type AdminOpsContractAddendum,
  type AdminOpsContractPayment,
  type AdminOpsEquipment,
  type AdminOpsInventoryItem,
  type AdminOpsInventoryTransaction,
  type AdminOpsTimeclockImportItem,
  type AdminOpsTimeclockImportRun,
  type AdminOpsPayrollEntry,
  type AdminOpsPurchaseOrder,
  type AdminOpsSupplier,
  type AdminOpsWorker,
  type AdminProjectListItem,
} from "@/react-app/api/site";

type Tab = "clients" | "contracts" | "procurement" | "resources" | "kpi" | "audit";
type ProcurementTab = "suppliers" | "purchaseOrders" | "inventory";
type ResourcesTab = "workers" | "attendance" | "timeclock" | "payroll" | "equipment" | "assignments";

function formatMoney(n: number): string {
  try {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return String(n);
  }
}

function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload ?? {}, null, 2)], { type: "application/json; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function humanizeErrorCode(code: string): string {
  const c = String(code || "").trim();
  if (!c) return "تعذر تنفيذ العملية.";
  if (c === "forbidden") return "ليس لديك صلاحية لتنفيذ هذه العملية.";
  if (c === "unauthorized") return "يلزم تسجيل الدخول.";
  if (c === "not_found") return "العنصر غير موجود.";
  if (c === "missing_name") return "الاسم مطلوب.";
  if (c === "invalid_kind") return "نوع الموظف/العامل غير صالح.";
  if (c === "duplicate_time_clock_id") return "معرّف ساعة الدوام مستخدم مسبقاً.";
  if (c === "missing_items") return "البيانات غير صحيحة: items مفقود.";
  if (c === "default_project_not_found") return "المشروع الافتراضي غير موجود.";
  if (c === "timeclock_import_dir_not_set") return "مجلد الاستيراد غير مضبوط على السيرفر (TIME_CLOCK_IMPORT_DIR).";
  if (c === "timeclock_import_dir_not_found") return "مجلد الاستيراد غير موجود على السيرفر.";
  if (c === "invalid_year") return "السنة غير صحيحة.";
  if (c === "invalid_month") return "الشهر غير صحيح.";
  if (c === "missing_rate") return "لا يوجد راتب شهري أو أجر يومي للعامل.";
  if (c === "attendance_not_approved") return "لا يمكن قفل الدوام قبل اعتماده.";
  if (c === "attendance_locked") return "السجل مقفول ولا يمكن تعديله.";
  return c;
}

export default function ControlOps() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("clients");
  const [procTab, setProcTab] = useState<ProcurementTab>("suppliers");
  const [resTab, setResTab] = useState<ResourcesTab>("workers");

  const [me, setMe] = useState<{ isSuperuser: boolean; role: string; workerId: number } | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [projects, setProjects] = useState<AdminProjectListItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [clients, setClients] = useState<AdminOpsClient[]>([]);
  const [suppliers, setSuppliers] = useState<AdminOpsSupplier[]>([]);
  const [contracts, setContracts] = useState<AdminOpsContract[]>([]);
  const [contractDetailsId, setContractDetailsId] = useState<number | null>(null);
  const [contractAddendums, setContractAddendums] = useState<AdminOpsContractAddendum[]>([]);
  const [contractPayments, setContractPayments] = useState<AdminOpsContractPayment[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<AdminOpsPurchaseOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<AdminOpsInventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<AdminOpsInventoryTransaction[]>([]);
  const [workers, setWorkers] = useState<AdminOpsWorker[]>([]);
  const [attendanceItems, setAttendanceItems] = useState<AdminOpsAttendance[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState(() => {
    const now = new Date();
    return { workerId: "0", year: String(now.getFullYear()), month: String(now.getMonth() + 1) };
  });
  const [payrollEntries, setPayrollEntries] = useState<AdminOpsPayrollEntry[]>([]);
  const [payrollFilter, setPayrollFilter] = useState(() => {
    const now = new Date();
    return { workerId: "0", year: String(now.getFullYear()), month: String(now.getMonth() + 1) };
  });
  const [payrollGenDryRun, setPayrollGenDryRun] = useState(true);
  const [payrollGenResult, setPayrollGenResult] = useState<{
    dryRun: boolean;
    year: number;
    month: number;
    workerId: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: unknown[];
    results: unknown[];
  } | null>(null);
  const [equipment, setEquipment] = useState<AdminOpsEquipment[]>([]);
  const [assignments, setAssignments] = useState<AdminOpsAssignment[]>([]);
  const [kpis, setKpis] = useState<AdminKpiProjectItem[]>([]);
  const [auditItems, setAuditItems] = useState<AdminOpsAuditLog[]>([]);
  const [auditExpandedId, setAuditExpandedId] = useState<number | null>(null);
  const [auditFilter, setAuditFilter] = useState(() => ({
    action: "",
    entityType: "",
    entityId: "",
    actorId: "",
    sinceId: "",
    limit: "200",
  }));

  useEffect(() => {
    const t = String(searchParams.get("tab") || "").trim();
    const allowedTabs: Tab[] = ["clients", "contracts", "procurement", "resources", "kpi", "audit"];
    if (t && allowedTabs.includes(t as Tab)) {
      setTab(t as Tab);
    }
    const p = String(searchParams.get("procTab") || "").trim();
    const allowedProc: ProcurementTab[] = ["suppliers", "purchaseOrders", "inventory"];
    if (p && allowedProc.includes(p as ProcurementTab)) {
      setProcTab(p as ProcurementTab);
    }
    const r = String(searchParams.get("resTab") || "").trim();
    const allowedRes: ResourcesTab[] = ["workers", "attendance", "timeclock", "payroll", "equipment", "assignments"];
    if (r && allowedRes.includes(r as ResourcesTab)) {
      setResTab(r as ResourcesTab);
    }
  }, [searchParams]);

  useEffect(() => {
    setMeLoading(true);
    fetchAuthMe()
      .then((data) => {
        setMe({ isSuperuser: Boolean(data.isSuperuser), role: data.role || "staff", workerId: Number(data.workerId || 0) || 0 });
        setMeLoading(false);
      })
      .catch(() => {
        setMe({ isSuperuser: false, role: "staff", workerId: 0 });
        setMeLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchAdminProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!me?.isSuperuser) return;
    fetchAdminUsersList({ limit: 500 }).then(setAdminUsers).catch(() => setAdminUsers([]));
  }, [me?.isSuperuser]);

  const role = me?.role || "staff";
  const canAccounting = Boolean(me?.isSuperuser || role === "manager" || role === "accountant");
  const canCrm = Boolean(me?.isSuperuser || role === "manager" || role === "accountant" || role === "registrar");
  const canContracts = canAccounting;
  const canProcurement = canAccounting;
  const canKpi = Boolean(me?.isSuperuser || role === "manager");
  const canAudit = Boolean(me?.isSuperuser || role === "manager");
  const canWorkersWrite = Boolean(me?.isSuperuser || role === "manager" || role === "registrar");

  useEffect(() => {
    if (meLoading) return;
    if (!canKpi && tab === "kpi") setTab("resources");
    if (!canAudit && tab === "audit") setTab("resources");
    if (!canCrm && tab === "clients") setTab("resources");
    if (!canContracts && tab === "contracts") setTab("resources");
    if (!canProcurement && tab === "procurement") setTab("resources");
    if (!canAccounting && tab === "procurement" && procTab !== "suppliers") setProcTab("suppliers");
    if (!canAccounting && tab === "resources" && resTab === "payroll") setResTab("workers");
  }, [canAccounting, canAudit, canContracts, canCrm, canKpi, canProcurement, meLoading, procTab, resTab, tab]);

  useEffect(() => {
    if (meLoading) return;
    if (!me) return;
    if (me.role === "employee") {
      setTab("resources");
      setResTab("attendance");
      const wid = Number(me.workerId) || 0;
      if (wid) {
        setAttendanceFilter((s) => ({ ...s, workerId: String(wid) }));
      }
    }
  }, [me, meLoading]);

  const reloadCurrent = useCallback(async () => {
    if (meLoading) return;
    setError("");
    setLoading(true);
    try {
      if (tab === "clients") {
        setClients(await fetchAdminOpsClients());
      } else if (tab === "contracts") {
        const [cs, ps] = await Promise.all([fetchAdminOpsClients(), fetchAdminOpsContracts()]);
        setClients(cs);
        setContracts(ps);
        if (contractDetailsId) {
          setContractAddendums(await fetchAdminOpsContractAddendums(contractDetailsId).catch(() => [] as AdminOpsContractAddendum[]));
          if (canAccounting) {
            setContractPayments(await fetchAdminOpsContractPayments(contractDetailsId).catch(() => [] as AdminOpsContractPayment[]));
          } else {
            setContractPayments([]);
          }
        }
      } else if (tab === "procurement") {
        if (procTab === "suppliers") {
          setSuppliers(await fetchAdminOpsSuppliers());
        } else if (procTab === "purchaseOrders") {
          if (!canAccounting) return;
          const [ss, pos] = await Promise.all([fetchAdminOpsSuppliers(), fetchAdminOpsPurchaseOrders()]);
          setSuppliers(ss);
          setPurchaseOrders(pos);
        } else {
          if (!canAccounting) return;
          const [ss, items, tx] = await Promise.all([
            fetchAdminOpsSuppliers().catch(() => [] as AdminOpsSupplier[]),
            fetchAdminOpsInventoryItems(),
            fetchAdminOpsInventoryTransactions(),
          ]);
          setSuppliers(ss);
          setInventoryItems(items);
          setInventoryTransactions(tx);
        }
      } else if (tab === "resources") {
        if (resTab === "workers") {
          setWorkers(await fetchAdminOpsWorkers());
        } else if (resTab === "attendance") {
          const workerId = Number(attendanceFilter.workerId) || 0;
          const year = Number(attendanceFilter.year) || 0;
          const month = Number(attendanceFilter.month) || 0;
          const [ws, items] = await Promise.all([
            fetchAdminOpsWorkers(),
            fetchAdminOpsAttendance({
              workerId: workerId || undefined,
              year: year || undefined,
              month: month || undefined,
            }),
          ]);
          setWorkers(ws);
          setAttendanceItems(items);
        } else if (resTab === "timeclock") {
          const [ws, runs] = await Promise.all([
            fetchAdminOpsWorkers(),
            fetchAdminOpsTimeclockRuns().catch(() => [] as AdminOpsTimeclockImportRun[]),
          ]);
          setWorkers(ws);
          setTimeclockRuns(runs);
        } else if (resTab === "payroll") {
          if (!canAccounting) return;
          const workerId = Number(payrollFilter.workerId) || 0;
          const year = Number(payrollFilter.year) || 0;
          const month = Number(payrollFilter.month) || 0;
          const [ws, items] = await Promise.all([
            fetchAdminOpsWorkers(),
            fetchAdminOpsPayroll({
              workerId: workerId || undefined,
              year: year || undefined,
              month: month || undefined,
            }),
          ]);
          setWorkers(ws);
          setPayrollEntries(items);
        } else if (resTab === "equipment") {
          setEquipment(await fetchAdminOpsEquipment());
        } else {
          const [ws, es, as] = await Promise.all([
            fetchAdminOpsWorkers(),
            fetchAdminOpsEquipment(),
            fetchAdminOpsAssignments(),
          ]);
          setWorkers(ws);
          setEquipment(es);
          setAssignments(as);
        }
      } else if (tab === "kpi") {
        if (!canKpi) return;
        setKpis(await fetchAdminKpiProjects());
      } else if (tab === "audit") {
        if (!canAudit) return;
        const limit = Math.max(1, Math.min(500, Number(auditFilter.limit) || 200));
        const actorId = Number(auditFilter.actorId) || 0;
        const sinceId = Number(auditFilter.sinceId) || 0;
        setAuditItems(
          await fetchAdminOpsAuditLogs({
            action: auditFilter.action.trim() || undefined,
            entityType: auditFilter.entityType.trim() || undefined,
            entityId: auditFilter.entityId.trim() || undefined,
            actorId: actorId || undefined,
            sinceId: sinceId || undefined,
            limit,
          }),
        );
      }
    } catch {
      setError("تعذر تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }, [
    attendanceFilter.month,
    attendanceFilter.workerId,
    attendanceFilter.year,
    canAccounting,
    canAudit,
    canKpi,
    contractDetailsId,
    meLoading,
    payrollFilter.month,
    payrollFilter.workerId,
    payrollFilter.year,
    procTab,
    resTab,
    tab,
    auditFilter.action,
    auditFilter.actorId,
    auditFilter.entityId,
    auditFilter.entityType,
    auditFilter.limit,
    auditFilter.sinceId,
  ]);

  useEffect(() => {
    reloadCurrent().catch(() => {});
  }, [reloadCurrent]);

  const projectOptions = useMemo(() => [{ id: 0, title: "—" }, ...projects.map((p) => ({ id: p.id, title: p.title }))], [projects]);

  const clientOptions = useMemo(() => [{ id: 0, title: "—" }, ...clients.map((c) => ({ id: c.id, title: c.name }))], [clients]);

  const supplierOptions = useMemo(
    () => [{ id: 0, title: "—" }, ...suppliers.map((s) => ({ id: s.id, title: s.name }))],
    [suppliers],
  );

  const workerOptions = useMemo(() => [{ id: 0, title: "—" }, ...workers.map((w) => ({ id: w.id, title: w.name }))], [workers]);

  const equipmentOptions = useMemo(
    () => [{ id: 0, title: "—" }, ...equipment.map((e) => ({ id: e.id, title: e.name }))],
    [equipment],
  );

  const inventoryItemOptions = useMemo(
    () => [{ id: 0, title: "—" }, ...inventoryItems.map((it) => ({ id: it.id, title: it.name }))],
    [inventoryItems],
  );

  const selectedContract = useMemo(
    () => (contractDetailsId ? contracts.find((c) => c.id === contractDetailsId) || null : null),
    [contractDetailsId, contracts],
  );
  const selectedContractAddendumsTotal = useMemo(
    () => contractAddendums.reduce((sum, a) => sum + (Number(a.amountDelta) || 0), 0),
    [contractAddendums],
  );
  const selectedContractPaidTotal = useMemo(
    () => contractPayments.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0),
    [contractPayments],
  );

  const [clientEditingId, setClientEditingId] = useState<number | null>(null);
  const [clientForm, setClientForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!clientForm.name.trim()) return;
    setError("");
    setLoading(true);
    try {
      if (clientEditingId) {
        const res = await updateAdminOpsClient(clientEditingId, clientForm);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsClient(clientForm);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setClientEditingId(null);
      setClientForm({ name: "", phone: "", email: "", address: "", notes: "" });
      setClients(await fetchAdminOpsClients());
    } catch {
      setError("تعذر حفظ العميل.");
    } finally {
      setLoading(false);
    }
  }

  async function removeClient(id: number) {
    if (!window.confirm("حذف العميل؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsClient(id);
      if (!res.ok) throw new Error(res.error || "error");
      setClients(await fetchAdminOpsClients());
    } catch {
      setError("تعذر حذف العميل.");
    } finally {
      setLoading(false);
    }
  }

  const [supplierEditingId, setSupplierEditingId] = useState<number | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", category: "", phone: "", email: "", address: "", notes: "" });

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;
    setError("");
    setLoading(true);
    try {
      if (supplierEditingId) {
        const res = await updateAdminOpsSupplier(supplierEditingId, supplierForm);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsSupplier(supplierForm);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setSupplierEditingId(null);
      setSupplierForm({ name: "", category: "", phone: "", email: "", address: "", notes: "" });
      setSuppliers(await fetchAdminOpsSuppliers());
    } catch {
      setError("تعذر حفظ المورد.");
    } finally {
      setLoading(false);
    }
  }

  async function removeSupplier(id: number) {
    if (!window.confirm("حذف المورد؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsSupplier(id);
      if (!res.ok) throw new Error(res.error || "error");
      setSuppliers(await fetchAdminOpsSuppliers());
    } catch {
      setError("تعذر حذف المورد.");
    } finally {
      setLoading(false);
    }
  }

  const [contractEditingId, setContractEditingId] = useState<number | null>(null);
  const [contractForm, setContractForm] = useState({
    projectId: "0",
    clientId: "0",
    title: "",
    number: "",
    status: "active",
    startDate: "",
    endDate: "",
    amount: "",
    notes: "",
  });

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        projectId: Number(contractForm.projectId) || null,
        clientId: Number(contractForm.clientId) || null,
        title: contractForm.title,
        number: contractForm.number,
        status: contractForm.status,
        startDate: contractForm.startDate || "",
        endDate: contractForm.endDate || "",
        amount: contractForm.amount,
        notes: contractForm.notes,
      };
      if (contractEditingId) {
        const res = await updateAdminOpsContract(contractEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsContract(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setContractEditingId(null);
      setContractForm({
        projectId: "0",
        clientId: "0",
        title: "",
        number: "",
        status: "active",
        startDate: "",
        endDate: "",
        amount: "",
        notes: "",
      });
      setContracts(await fetchAdminOpsContracts());
    } catch {
      setError("تعذر حفظ العقد.");
    } finally {
      setLoading(false);
    }
  }

  async function removeContract(id: number) {
    if (!window.confirm("حذف العقد؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsContract(id);
      if (!res.ok) throw new Error(res.error || "error");
      if (contractDetailsId === id) {
        setContractDetailsId(null);
        setContractAddendums([]);
        setContractPayments([]);
      }
      setContracts(await fetchAdminOpsContracts());
    } catch {
      setError("تعذر حذف العقد.");
    } finally {
      setLoading(false);
    }
  }

  const [addendumForm, setAddendumForm] = useState({
    title: "",
    amountDelta: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const [paymentEditingId, setPaymentEditingId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    title: "",
    dueDate: "",
    amount: "",
    paidAmount: "",
    paidDate: "",
    status: "pending",
    notes: "",
  });

  async function openContractDetails(id: number) {
    setContractDetailsId(id);
    setAddendumForm({ title: "", amountDelta: "", startDate: "", endDate: "", notes: "" });
    setPaymentEditingId(null);
    setPaymentForm({ title: "", dueDate: "", amount: "", paidAmount: "", paidDate: "", status: "pending", notes: "" });
    setLoading(true);
    setError("");
    try {
      setContractAddendums(await fetchAdminOpsContractAddendums(id));
      if (canAccounting) {
        setContractPayments(await fetchAdminOpsContractPayments(id));
      } else {
        setContractPayments([]);
      }
    } catch {
      setError("تعذر تحميل ملاحق/دفعات العقد.");
      setContractAddendums([]);
      setContractPayments([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveContractAddendum(e: React.FormEvent) {
    e.preventDefault();
    if (!contractDetailsId) return;
    setLoading(true);
    setError("");
    try {
      const res = await createAdminOpsContractAddendum(contractDetailsId, {
        title: addendumForm.title,
        amountDelta: addendumForm.amountDelta,
        startDate: addendumForm.startDate || "",
        endDate: addendumForm.endDate || "",
        notes: addendumForm.notes,
      });
      if (!res.ok) throw new Error(res.error || "error");
      setAddendumForm({ title: "", amountDelta: "", startDate: "", endDate: "", notes: "" });
      setContractAddendums(await fetchAdminOpsContractAddendums(contractDetailsId));
    } catch {
      setError("تعذر حفظ ملحق العقد.");
    } finally {
      setLoading(false);
    }
  }

  async function saveContractPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!contractDetailsId) return;
    setLoading(true);
    setError("");
    try {
      if (paymentEditingId) {
        const res = await updateAdminOpsContractPayment(paymentEditingId, {
          title: paymentForm.title,
          dueDate: paymentForm.dueDate || "",
          amount: paymentForm.amount,
          paidAmount: paymentForm.paidAmount,
          paidDate: paymentForm.paidDate || "",
          status: paymentForm.status,
          notes: paymentForm.notes,
        });
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsContractPayment(contractDetailsId, {
          title: paymentForm.title,
          dueDate: paymentForm.dueDate || "",
          amount: paymentForm.amount,
          paidAmount: paymentForm.paidAmount,
          paidDate: paymentForm.paidDate || "",
          status: paymentForm.status,
          notes: paymentForm.notes,
        });
        if (!res.ok) throw new Error(res.error || "error");
      }
      setPaymentEditingId(null);
      setPaymentForm({ title: "", dueDate: "", amount: "", paidAmount: "", paidDate: "", status: "pending", notes: "" });
      setContractPayments(await fetchAdminOpsContractPayments(contractDetailsId));
    } catch {
      setError("تعذر حفظ دفعة العقد.");
    } finally {
      setLoading(false);
    }
  }

  async function removeContractPayment(id: number) {
    if (!window.confirm("حذف الدفعة؟")) return;
    if (!contractDetailsId) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsContractPayment(id);
      if (!res.ok) throw new Error(res.error || "error");
      setContractPayments(await fetchAdminOpsContractPayments(contractDetailsId));
    } catch {
      setError("تعذر حذف الدفعة.");
    } finally {
      setLoading(false);
    }
  }

  const [poEditingId, setPoEditingId] = useState<number | null>(null);
  const [poForm, setPoForm] = useState({
    supplierId: "0",
    projectId: "0",
    number: "",
    date: "",
    status: "draft",
    totalAmount: "",
    notes: "",
  });

  async function savePurchaseOrder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        supplierId: Number(poForm.supplierId) || null,
        projectId: Number(poForm.projectId) || null,
        number: poForm.number,
        date: poForm.date || "",
        status: poForm.status,
        totalAmount: poForm.totalAmount,
        notes: poForm.notes,
      };
      if (poEditingId) {
        const res = await updateAdminOpsPurchaseOrder(poEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsPurchaseOrder(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setPoEditingId(null);
      setPoForm({ supplierId: "0", projectId: "0", number: "", date: "", status: "draft", totalAmount: "", notes: "" });
      setPurchaseOrders(await fetchAdminOpsPurchaseOrders());
    } catch {
      setError("تعذر حفظ أمر الشراء.");
    } finally {
      setLoading(false);
    }
  }

  async function removePurchaseOrder(id: number) {
    if (!window.confirm("حذف أمر الشراء؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsPurchaseOrder(id);
      if (!res.ok) throw new Error(res.error || "error");
      setPurchaseOrders(await fetchAdminOpsPurchaseOrders());
    } catch {
      setError("تعذر حذف أمر الشراء.");
    } finally {
      setLoading(false);
    }
  }

  const [invEditingId, setInvEditingId] = useState<number | null>(null);
  const [invItemForm, setInvItemForm] = useState({
    sku: "",
    name: "",
    unit: "",
    currentQty: "0",
    reorderLevel: "",
    notes: "",
  });

  async function saveInventoryItem(e: React.FormEvent) {
    e.preventDefault();
    if (!invItemForm.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        sku: invItemForm.sku,
        name: invItemForm.name,
        unit: invItemForm.unit,
        currentQty: invItemForm.currentQty,
        reorderLevel: invItemForm.reorderLevel === "" ? null : invItemForm.reorderLevel,
        notes: invItemForm.notes,
      };
      if (invEditingId) {
        const res = await updateAdminOpsInventoryItem(invEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsInventoryItem(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setInvEditingId(null);
      setInvItemForm({ sku: "", name: "", unit: "", currentQty: "0", reorderLevel: "", notes: "" });
      setInventoryItems(await fetchAdminOpsInventoryItems());
    } catch {
      setError("تعذر حفظ الصنف.");
    } finally {
      setLoading(false);
    }
  }

  async function removeInventoryItem(id: number) {
    if (!window.confirm("حذف الصنف؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsInventoryItem(id);
      if (!res.ok) throw new Error(res.error || "error");
      setInventoryItems(await fetchAdminOpsInventoryItems());
    } catch {
      setError("تعذر حذف الصنف.");
    } finally {
      setLoading(false);
    }
  }

  const [txForm, setTxForm] = useState({
    itemId: "0",
    projectId: "0",
    kind: "in",
    quantity: "",
    unitCost: "",
    date: "",
    reference: "",
    notes: "",
  });

  async function addInventoryTx(e: React.FormEvent) {
    e.preventDefault();
    const itemId = Number(txForm.itemId) || 0;
    if (!itemId) return;
    if (!txForm.quantity.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await createAdminOpsInventoryTransaction({
        itemId,
        projectId: Number(txForm.projectId) || null,
        kind: txForm.kind,
        quantity: txForm.quantity,
        unitCost: txForm.unitCost === "" ? null : txForm.unitCost,
        date: txForm.date || "",
        reference: txForm.reference,
        notes: txForm.notes,
      });
      if (!res.ok) throw new Error(res.error || "error");
      setTxForm({
        itemId: txForm.itemId,
        projectId: "0",
        kind: "in",
        quantity: "",
        unitCost: "",
        date: "",
        reference: "",
        notes: "",
      });
      const [items, tx] = await Promise.all([fetchAdminOpsInventoryItems(), fetchAdminOpsInventoryTransactions()]);
      setInventoryItems(items);
      setInventoryTransactions(tx);
    } catch {
      setError("تعذر إضافة حركة المخزون.");
    } finally {
      setLoading(false);
    }
  }

  const [workerEditingId, setWorkerEditingId] = useState<number | null>(null);
  const [workerForm, setWorkerForm] = useState({
    userId: "0",
    kind: "worker",
    active: true,
    name: "",
    role: "",
    phone: "",
    timeClockId: "",
    dailyCost: "",
    monthlySalary: "",
    notes: "",
  });

  const [clockLinkEdits, setClockLinkEdits] = useState<Record<number, string>>({});
  const [clockLinkOnlyUnlinked, setClockLinkOnlyUnlinked] = useState(false);
  const [clockLinkQuery, setClockLinkQuery] = useState("");

  const [timeclockDryRun, setTimeclockDryRun] = useState(true);
  const [timeclockDefaultProjectId, setTimeclockDefaultProjectId] = useState("0");
  const [timeclockImportText, setTimeclockImportText] = useState("");
  const [timeclockFolderLimitFiles, setTimeclockFolderLimitFiles] = useState("5");
  const [timeclockRuns, setTimeclockRuns] = useState<AdminOpsTimeclockImportRun[]>([]);
  const [timeclockImportResult, setTimeclockImportResult] = useState<{
    dryRun: boolean;
    createdCount: number;
    updatedCount: number;
    errors: unknown[];
    results: unknown[];
  } | null>(null);
  const [timeclockFolderImportResult, setTimeclockFolderImportResult] = useState<{
    dryRun: boolean;
    files: string[];
    createdCount: number;
    updatedCount: number;
    errors: unknown[];
    results: unknown[];
  } | null>(null);

  async function saveClockLink(workerId: number) {
    const edited = Object.prototype.hasOwnProperty.call(clockLinkEdits, workerId);
    const current = workers.find((w) => w.id === workerId)?.timeClockId || "";
    const value = String(edited ? clockLinkEdits[workerId] : current).trim();
    setLoading(true);
    setError("");
    try {
      const res = await updateAdminOpsWorker(workerId, { timeClockId: value });
      if (!res.ok) throw new Error(res.error || "error");
      if (edited) {
        setClockLinkEdits((s) => {
          const next: Record<number, string> = { ...s };
          delete next[workerId];
          return next;
        });
      }
      setWorkers(await fetchAdminOpsWorkers());
    } catch (e) {
      const msg = e instanceof Error ? String(e.message || "").trim() : "";
      if (msg && msg !== "error") setError(humanizeErrorCode(msg));
      else setError("تعذر حفظ ربط ساعة الدوام.");
    } finally {
      setLoading(false);
    }
  }

  async function importTimeclock() {
    setLoading(true);
    setError("");
    setTimeclockImportResult(null);
    try {
      const raw = JSON.parse(timeclockImportText || "null") as unknown;
      let itemsRaw: unknown[] = [];
      if (Array.isArray(raw)) {
        itemsRaw = raw;
      } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        itemsRaw = Array.isArray(obj.items) ? (obj.items as unknown[]) : [];
      }
      if (!itemsRaw.length) {
        setError("صيغة JSON غير صحيحة. المطلوب: مصفوفة items أو كائن يحتوي items.");
        return;
      }
      const defaultProjectId = Number(timeclockDefaultProjectId) || 0;
      const prepared = itemsRaw.map((v) => {
        const obj = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
        if (obj.projectId == null && defaultProjectId) return { ...obj, projectId: defaultProjectId };
        return obj;
      });

      for (let i = 0; i < prepared.length; i++) {
        const it = prepared[i] || {};
        const hasWorker = Boolean(Number(it.workerId || 0) || String(it.timeClockId || "").trim());
        if (!hasWorker) {
          setError(`السطر ${i + 1}: مطلوب workerId أو timeClockId`);
          return;
        }
        if (!String(it.date || "").trim()) {
          setError(`السطر ${i + 1}: مطلوب date`);
          return;
        }
        const hasTime =
          it.hours != null ||
          (String(it.checkIn || "").trim() && String(it.checkOut || "").trim()) ||
          (String(it.checkInAt || "").trim() && String(it.checkOutAt || "").trim());
        if (!hasTime && !String(it.status || "").trim()) {
          setError(`السطر ${i + 1}: مطلوب hours أو (checkIn/checkOut) أو status`);
          return;
        }
      }

      const res = await importAdminOpsTimeclock(prepared as unknown as AdminOpsTimeclockImportItem[], {
        dryRun: timeclockDryRun,
        defaultProjectId: defaultProjectId || null,
      });
      if (!res.ok) throw new Error(res.error || "error");
      setTimeclockImportResult({
        dryRun: Boolean(res.dryRun),
        createdCount: Number(res.createdCount || 0),
        updatedCount: Number(res.updatedCount || 0),
        errors: Array.isArray(res.errors) ? res.errors : [],
        results: Array.isArray(res.results) ? res.results : [],
      });
      setWorkers(await fetchAdminOpsWorkers());
    } catch (e) {
      const msg = e instanceof Error ? String(e.message || "").trim() : "";
      if (msg && msg !== "error") setError(humanizeErrorCode(msg));
      else setError("تعذر استيراد سجل ساعة الدوام.");
    } finally {
      setLoading(false);
    }
  }

  async function importTimeclockFromFolder() {
    setLoading(true);
    setError("");
    setTimeclockFolderImportResult(null);
    try {
      const defaultProjectId = Number(timeclockDefaultProjectId) || 0;
      const limitFiles = Number(timeclockFolderLimitFiles) || 0;
      if (!limitFiles || limitFiles < 1 || limitFiles > 50) {
        setError("limitFiles يجب أن يكون بين 1 و 50.");
        return;
      }
      const res = await importAdminOpsTimeclockFromFolder({
        dryRun: timeclockDryRun,
        defaultProjectId: defaultProjectId || null,
        limitFiles,
      });
      if (!res.ok) throw new Error(res.error || "error");
      setTimeclockFolderImportResult({
        dryRun: Boolean(res.dryRun),
        files: Array.isArray(res.files) ? (res.files as string[]) : [],
        createdCount: Number(res.createdCount || 0),
        updatedCount: Number(res.updatedCount || 0),
        errors: Array.isArray(res.errors) ? res.errors : [],
        results: Array.isArray(res.results) ? res.results : [],
      });
      const [ws, runs] = await Promise.all([
        fetchAdminOpsWorkers().catch(() => [] as AdminOpsWorker[]),
        fetchAdminOpsTimeclockRuns().catch(() => [] as AdminOpsTimeclockImportRun[]),
      ]);
      setWorkers(ws);
      setTimeclockRuns(runs);
    } catch (e) {
      const msg = e instanceof Error ? String(e.message || "").trim() : "";
      if (msg && msg !== "error") setError(humanizeErrorCode(msg));
      else setError("تعذر استيراد سجل ساعة الدوام من المجلد.");
    } finally {
      setLoading(false);
    }
  }

  async function saveWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!workerForm.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const userId = Number(workerForm.userId) || 0;
      const payload = {
        userId: userId || null,
        kind: workerForm.kind,
        active: workerForm.active,
        name: workerForm.name,
        role: workerForm.role,
        phone: workerForm.phone,
        timeClockId: workerForm.timeClockId,
        dailyCost: workerForm.dailyCost === "" ? null : workerForm.dailyCost,
        monthlySalary: workerForm.monthlySalary === "" ? null : workerForm.monthlySalary,
        notes: workerForm.notes,
      };
      if (workerEditingId) {
        const res = await updateAdminOpsWorker(workerEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsWorker(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setWorkerEditingId(null);
      setWorkerForm({
        userId: "0",
        kind: "worker",
        active: true,
        name: "",
        role: "",
        phone: "",
        timeClockId: "",
        dailyCost: "",
        monthlySalary: "",
        notes: "",
      });
      setWorkers(await fetchAdminOpsWorkers());
    } catch (e) {
      const msg = e instanceof Error ? String(e.message || "").trim() : "";
      if (msg && msg !== "error") setError(humanizeErrorCode(msg));
      else setError("تعذر حفظ الموظف/العامل.");
    } finally {
      setLoading(false);
    }
  }

  async function removeWorker(id: number) {
    if (!window.confirm("حذف الموظف/العامل؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsWorker(id);
      if (!res.ok) throw new Error(res.error || "error");
      setWorkers(await fetchAdminOpsWorkers());
    } catch {
      setError("تعذر حذف الموظف/العامل.");
    } finally {
      setLoading(false);
    }
  }

  const [attendanceEditingId, setAttendanceEditingId] = useState<number | null>(null);
  const [attendanceForm, setAttendanceForm] = useState({
    workerId: "0",
    projectId: "0",
    date: "",
    status: "present",
    hours: "",
    notes: "",
  });

  useEffect(() => {
    if (me?.role !== "employee") return;
    const wid = Number(me.workerId) || 0;
    if (!wid) return;
    setAttendanceForm((s) => ({ ...s, workerId: String(wid) }));
    setAttendanceFilter((s) => ({ ...s, workerId: String(wid) }));
  }, [me?.role, me?.workerId]);

  async function saveAttendance(e: React.FormEvent) {
    e.preventDefault();
    const workerId = Number(attendanceForm.workerId) || 0;
    if (!workerId) return;
    if (!attendanceForm.date.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        workerId,
        projectId: Number(attendanceForm.projectId) || null,
        date: attendanceForm.date,
        status: attendanceForm.status,
        hours: attendanceForm.hours === "" ? null : attendanceForm.hours,
        notes: attendanceForm.notes,
      };
      if (attendanceEditingId) {
        const res = await updateAdminOpsAttendance(attendanceEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsAttendance(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setAttendanceEditingId(null);
      setAttendanceForm({ workerId: attendanceForm.workerId, projectId: "0", date: "", status: "present", hours: "", notes: "" });
      setAttendanceItems(
        await fetchAdminOpsAttendance({
          workerId: Number(attendanceFilter.workerId) || undefined,
          year: Number(attendanceFilter.year) || undefined,
          month: Number(attendanceFilter.month) || undefined,
        }),
      );
    } catch {
      setError("تعذر حفظ الدوام.");
    } finally {
      setLoading(false);
    }
  }

  async function removeAttendance(id: number) {
    if (!window.confirm("حذف سجل الدوام؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsAttendance(id);
      if (!res.ok) throw new Error(res.error || "error");
      setAttendanceItems(
        await fetchAdminOpsAttendance({
          workerId: Number(attendanceFilter.workerId) || undefined,
          year: Number(attendanceFilter.year) || undefined,
          month: Number(attendanceFilter.month) || undefined,
        }),
      );
    } catch {
      setError("تعذر حذف الدوام.");
    } finally {
      setLoading(false);
    }
  }

  const [payrollEditingId, setPayrollEditingId] = useState<number | null>(null);
  const [payrollForm, setPayrollForm] = useState(() => {
    const now = new Date();
    return {
      workerId: "0",
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1),
      kind: "salary",
      amount: "",
      date: "",
      notes: "",
    };
  });

  async function savePayrollEntry(e: React.FormEvent) {
    e.preventDefault();
    const workerId = Number(payrollForm.workerId) || 0;
    const year = Number(payrollForm.year) || 0;
    const month = Number(payrollForm.month) || 0;
    if (!workerId) return;
    if (!year || !month) return;
    if (!payrollForm.amount.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        workerId,
        year,
        month,
        kind: payrollForm.kind,
        amount: payrollForm.amount,
        date: payrollForm.date || undefined,
        notes: payrollForm.notes,
      };
      if (payrollEditingId) {
        const res = await updateAdminOpsPayrollEntry(payrollEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsPayrollEntry(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setPayrollEditingId(null);
      setPayrollForm((s) => ({ ...s, amount: "", date: "", notes: "" }));
      setPayrollEntries(
        await fetchAdminOpsPayroll({
          workerId: Number(payrollFilter.workerId) || undefined,
          year: Number(payrollFilter.year) || undefined,
          month: Number(payrollFilter.month) || undefined,
        }),
      );
    } catch {
      setError("تعذر حفظ حركة الرواتب.");
    } finally {
      setLoading(false);
    }
  }

  async function removePayrollEntry(id: number) {
    if (!window.confirm("حذف حركة الرواتب؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsPayrollEntry(id);
      if (!res.ok) throw new Error(res.error || "error");
      setPayrollEntries(
        await fetchAdminOpsPayroll({
          workerId: Number(payrollFilter.workerId) || undefined,
          year: Number(payrollFilter.year) || undefined,
          month: Number(payrollFilter.month) || undefined,
        }),
      );
    } catch {
      setError("تعذر حذف حركة الرواتب.");
    } finally {
      setLoading(false);
    }
  }

  async function generatePayrollFromAttendance() {
    setLoading(true);
    setError("");
    setPayrollGenResult(null);
    try {
      const year = Number(payrollFilter.year) || 0;
      const month = Number(payrollFilter.month) || 0;
      const workerId = Number(payrollFilter.workerId) || 0;
      const res = await generateAdminOpsPayrollFromAttendance({
        year,
        month,
        workerId: workerId ? workerId : null,
        dryRun: payrollGenDryRun,
      });
      if (!res.ok) throw new Error(res.error || "error");
      setPayrollGenResult({
        dryRun: Boolean(res.dryRun),
        year: Number(res.year || year),
        month: Number(res.month || month),
        workerId: Number(res.workerId || 0),
        createdCount: Number(res.createdCount || 0),
        updatedCount: Number(res.updatedCount || 0),
        skippedCount: Number(res.skippedCount || 0),
        errors: Array.isArray(res.errors) ? res.errors : [],
        results: Array.isArray(res.results) ? res.results : [],
      });
      setPayrollEntries(
        await fetchAdminOpsPayroll({
          workerId: Number(payrollFilter.workerId) || undefined,
          year: Number(payrollFilter.year) || undefined,
          month: Number(payrollFilter.month) || undefined,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? String(e.message || "").trim() : "";
      if (msg && msg !== "error") setError(humanizeErrorCode(msg));
      else setError("تعذر توليد الرواتب من الدوام.");
    } finally {
      setLoading(false);
    }
  }

  const [equipmentEditingId, setEquipmentEditingId] = useState<number | null>(null);
  const [equipmentForm, setEquipmentForm] = useState({
    name: "",
    code: "",
    status: "available",
    hourlyCost: "",
    notes: "",
  });

  async function saveEquipment(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentForm.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: equipmentForm.name,
        code: equipmentForm.code,
        status: equipmentForm.status,
        hourlyCost: equipmentForm.hourlyCost === "" ? null : equipmentForm.hourlyCost,
        notes: equipmentForm.notes,
      };
      if (equipmentEditingId) {
        const res = await updateAdminOpsEquipment(equipmentEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsEquipment(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setEquipmentEditingId(null);
      setEquipmentForm({ name: "", code: "", status: "available", hourlyCost: "", notes: "" });
      setEquipment(await fetchAdminOpsEquipment());
    } catch {
      setError("تعذر حفظ المعدة.");
    } finally {
      setLoading(false);
    }
  }

  async function removeEquipment(id: number) {
    if (!window.confirm("حذف المعدة؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsEquipment(id);
      if (!res.ok) throw new Error(res.error || "error");
      setEquipment(await fetchAdminOpsEquipment());
    } catch {
      setError("تعذر حذف المعدة.");
    } finally {
      setLoading(false);
    }
  }

  const [assignmentEditingId, setAssignmentEditingId] = useState<number | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    projectId: "0",
    resourceType: "worker",
    workerId: "0",
    equipmentId: "0",
    startDate: "",
    endDate: "",
    hoursPerDay: "",
    costOverride: "",
    notes: "",
  });

  async function saveAssignment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        projectId: Number(assignmentForm.projectId) || null,
        resourceType: assignmentForm.resourceType,
        workerId: assignmentForm.resourceType === "worker" ? Number(assignmentForm.workerId) || null : null,
        equipmentId: assignmentForm.resourceType === "equipment" ? Number(assignmentForm.equipmentId) || null : null,
        startDate: assignmentForm.startDate || "",
        endDate: assignmentForm.endDate || "",
        hoursPerDay: assignmentForm.hoursPerDay === "" ? null : assignmentForm.hoursPerDay,
        costOverride: assignmentForm.costOverride === "" ? null : assignmentForm.costOverride,
        notes: assignmentForm.notes,
      };
      if (assignmentEditingId) {
        const res = await updateAdminOpsAssignment(assignmentEditingId, payload);
        if (!res.ok) throw new Error(res.error || "error");
      } else {
        const res = await createAdminOpsAssignment(payload);
        if (!res.ok) throw new Error(res.error || "error");
      }
      setAssignmentEditingId(null);
      setAssignmentForm({
        projectId: "0",
        resourceType: "worker",
        workerId: "0",
        equipmentId: "0",
        startDate: "",
        endDate: "",
        hoursPerDay: "",
        costOverride: "",
        notes: "",
      });
      setAssignments(await fetchAdminOpsAssignments());
    } catch {
      setError("تعذر حفظ التعيين.");
    } finally {
      setLoading(false);
    }
  }

  async function removeAssignment(id: number) {
    if (!window.confirm("حذف التعيين؟")) return;
    setLoading(true);
    setError("");
    try {
      const res = await deleteAdminOpsAssignment(id);
      if (!res.ok) throw new Error(res.error || "error");
      setAssignments(await fetchAdminOpsAssignments());
    } catch {
      setError("تعذر حذف التعيين.");
    } finally {
      setLoading(false);
    }
  }

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`px-4 py-2 rounded-lg font-semibold border transition ${
        tab === key ? "bg-[#007A3D] text-white border-[#007A3D]" : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة العمليات</h1>
          <p className="text-gray-600 mt-1">العملاء • العقود • المشتريات • الموارد • تقارير KPI</p>
        </div>
        <button
          type="button"
          onClick={() => reloadCurrent()}
          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
        >
          تحديث
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {canCrm ? tabBtn("clients", "العملاء") : null}
        {canContracts ? tabBtn("contracts", "العقود") : null}
        {canProcurement ? tabBtn("procurement", "المشتريات") : null}
        {tabBtn("resources", "الموارد")}
        {canKpi ? tabBtn("kpi", "تقارير KPI") : null}
        {canAudit ? tabBtn("audit", "سجل التدقيق") : null}
      </div>

      {error ? <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div> : null}

      {tab === "clients" ? (
        <div className="space-y-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">{clientEditingId ? "تعديل عميل" : "إضافة عميل"}</div>
            <form onSubmit={saveClient} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                <input
                  value={clientForm.name}
                  onChange={(e) => setClientForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
                <input
                  value={clientForm.phone}
                  onChange={(e) => setClientForm((s) => ({ ...s, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">البريد</label>
                <input
                  value={clientForm.email}
                  onChange={(e) => setClientForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <input
                  value={clientForm.address}
                  onChange={(e) => setClientForm((s) => ({ ...s, address: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm((s) => ({ ...s, notes: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                >
                  {clientEditingId ? "حفظ" : "إضافة"}
                </button>
                {clientEditingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setClientEditingId(null);
                      setClientForm({ name: "", phone: "", email: "", address: "", notes: "" });
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    إلغاء
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-bold text-gray-900">قائمة العملاء</div>
              {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
            </div>
            <div className="divide-y">
              {clients.map((c) => (
                <div key={c.id} className="p-6 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-bold text-gray-900">{c.name}</div>
                    <div className="text-sm text-gray-600 mt-1" dir="ltr">
                      {[c.phone, c.email].filter(Boolean).join(" • ") || "—"}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{c.address || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClientEditingId(c.id);
                        setClientForm({ name: c.name, phone: c.phone, email: c.email, address: c.address, notes: c.notes });
                      }}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => removeClient(c.id)}
                      className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
              {!clients.length ? <div className="p-6 text-gray-600">لا يوجد عملاء.</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">سجل التدقيق</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reloadCurrent().catch(() => {});
              }}
              className="grid md:grid-cols-3 gap-4"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Action</label>
                <input
                  value={auditFilter.action}
                  onChange={(e) => setAuditFilter((s) => ({ ...s, action: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  placeholder="ops_contract_payment_update"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Entity Type</label>
                <input
                  value={auditFilter.entityType}
                  onChange={(e) => setAuditFilter((s) => ({ ...s, entityType: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  placeholder="contract_payment"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Entity ID</label>
                <input
                  value={auditFilter.entityId}
                  onChange={(e) => setAuditFilter((s) => ({ ...s, entityId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  placeholder="123"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Actor ID</label>
                <input
                  value={auditFilter.actorId}
                  onChange={(e) => setAuditFilter((s) => ({ ...s, actorId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  placeholder="1"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Since ID</label>
                <input
                  value={auditFilter.sinceId}
                  onChange={(e) => setAuditFilter((s) => ({ ...s, sinceId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  placeholder="0"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Limit</label>
                <input
                  value={auditFilter.limit}
                  onChange={(e) => setAuditFilter((s) => ({ ...s, limit: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  placeholder="200"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                >
                  {loading ? "جارٍ التحميل..." : "تحديث"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setAuditExpandedId(null);
                    setAuditFilter({ action: "", entityType: "", entityId: "", actorId: "", sinceId: "", limit: "200" });
                    setTimeout(() => reloadCurrent().catch(() => {}), 0);
                  }}
                  className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
                >
                  إعادة تعيين
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="font-bold text-gray-900">آخر العمليات</div>
              <div className="text-sm text-gray-600">إظهار {auditItems.length} سجل</div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-3 text-right font-bold">ID</th>
                    <th className="p-3 text-right font-bold">الوقت</th>
                    <th className="p-3 text-right font-bold">المستخدم</th>
                    <th className="p-3 text-right font-bold">الدور</th>
                    <th className="p-3 text-right font-bold">Action</th>
                    <th className="p-3 text-right font-bold">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.map((r) => {
                    const isOpen = auditExpandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          className="border-t hover:bg-gray-50 cursor-pointer"
                          onClick={() => setAuditExpandedId((prev) => (prev === r.id ? null : r.id))}
                        >
                          <td className="p-3 font-semibold">{r.id}</td>
                          <td className="p-3">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</td>
                          <td className="p-3">{r.actorUsername || (r.actorId ? `#${r.actorId}` : "")}</td>
                          <td className="p-3">{r.role}</td>
                          <td className="p-3 font-mono" dir="ltr">
                            {r.action}
                          </td>
                          <td className="p-3 font-mono" dir="ltr">
                            {r.entityType}:{r.entityId}
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="border-t bg-white">
                            <td colSpan={6} className="p-4">
                              <div className="grid lg:grid-cols-3 gap-4">
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-auto">
                                  <div className="text-xs font-bold text-gray-600 mb-2">Before</div>
                                  <pre className="text-xs" dir="ltr">
                                    {JSON.stringify(r.before ?? null, null, 2)}
                                  </pre>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-auto">
                                  <div className="text-xs font-bold text-gray-600 mb-2">After</div>
                                  <pre className="text-xs" dir="ltr">
                                    {JSON.stringify(r.after ?? null, null, 2)}
                                  </pre>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 overflow-auto">
                                  <div className="text-xs font-bold text-gray-600 mb-2">Meta</div>
                                  <pre className="text-xs" dir="ltr">
                                    {JSON.stringify(r.meta ?? null, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!auditItems.length ? <div className="p-6 text-gray-600">لا يوجد سجلات.</div> : null}
          </div>
        </div>
      ) : null}

      {tab === "contracts" ? (
        <div className="space-y-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-bold text-gray-900 mb-4">{contractEditingId ? "تعديل عقد" : "إضافة عقد"}</div>
            <form onSubmit={saveContract} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">المشروع</label>
                <select
                  value={contractForm.projectId}
                  onChange={(e) => setContractForm((s) => ({ ...s, projectId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                >
                  {projectOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">العميل</label>
                <select
                  value={contractForm.clientId}
                  onChange={(e) => setContractForm((s) => ({ ...s, clientId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                >
                  {clientOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                <input
                  value={contractForm.title}
                  onChange={(e) => setContractForm((s) => ({ ...s, title: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">رقم العقد</label>
                <input
                  value={contractForm.number}
                  onChange={(e) => setContractForm((s) => ({ ...s, number: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                <select
                  value={contractForm.status}
                  onChange={(e) => setContractForm((s) => ({ ...s, status: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                >
                  <option value="draft">مسودة</option>
                  <option value="active">ساري</option>
                  <option value="closed">مغلق</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">المبلغ</label>
                <input
                  value={contractForm.amount}
                  onChange={(e) => setContractForm((s) => ({ ...s, amount: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ البداية</label>
                <input
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm((s) => ({ ...s, startDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ النهاية</label>
                <input
                  type="date"
                  value={contractForm.endDate}
                  onChange={(e) => setContractForm((s) => ({ ...s, endDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  dir="ltr"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                <textarea
                  value={contractForm.notes}
                  onChange={(e) => setContractForm((s) => ({ ...s, notes: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                  rows={3}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                >
                  {contractEditingId ? "حفظ" : "إضافة"}
                </button>
                {contractEditingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setContractEditingId(null);
                      setContractForm({
                        projectId: "0",
                        clientId: "0",
                        title: "",
                        number: "",
                        status: "active",
                        startDate: "",
                        endDate: "",
                        amount: "",
                        notes: "",
                      });
                    }}
                    className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                  >
                    إلغاء
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="font-bold text-gray-900">قائمة العقود</div>
              {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
            </div>
            <div className="divide-y">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  className={`p-6 flex items-center gap-4 flex-wrap ${contractDetailsId === c.id ? "bg-green-50" : ""}`}
                >
                  <div className="flex-1 min-w-[260px]">
                    <div className="font-bold text-gray-900">{c.title || c.number || `عقد #${c.id}`}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {(c.projectTitle || "—") + " • " + (c.clientName || "—")}
                    </div>
                    <div className="text-sm text-gray-600 mt-1" dir="ltr">
                      {[c.startDate, c.endDate].filter(Boolean).join(" → ") || "—"}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 min-w-[140px]" dir="ltr">
                    {formatMoney(Number(c.amount || 0))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openContractDetails(c.id)}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      ملاحق/دفعات
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContractEditingId(c.id);
                        setContractForm({
                          projectId: String(c.projectId || 0),
                          clientId: String(c.clientId || 0),
                          title: c.title || "",
                          number: c.number || "",
                          status: c.status || "active",
                          startDate: c.startDate || "",
                          endDate: c.endDate || "",
                          amount: String(c.amount ?? ""),
                          notes: c.notes || "",
                        });
                      }}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContract(c.id)}
                      className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
              {!contracts.length ? <div className="p-6 text-gray-600">لا يوجد عقود.</div> : null}
            </div>
          </div>

          {contractDetailsId ? (
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <div className="text-lg font-bold text-gray-900">ملاحق العقد</div>
                    <div className="text-sm text-gray-600 mt-1">{selectedContract?.title || selectedContract?.number || ""}</div>
                  </div>
                  <div className="text-sm text-gray-700" dir="ltr">
                    إجمالي الملاحق: {formatMoney(selectedContractAddendumsTotal)}
                  </div>
                </div>

                <form onSubmit={saveContractAddendum} className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                    <input
                      value={addendumForm.title}
                      onChange={(e) => setAddendumForm((s) => ({ ...s, title: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">فرق المبلغ (+/-)</label>
                    <input
                      value={addendumForm.amountDelta}
                      onChange={(e) => setAddendumForm((s) => ({ ...s, amountDelta: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ البداية</label>
                    <input
                      type="date"
                      value={addendumForm.startDate}
                      onChange={(e) => setAddendumForm((s) => ({ ...s, startDate: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={addendumForm.endDate}
                      onChange={(e) => setAddendumForm((s) => ({ ...s, endDate: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={addendumForm.notes}
                      onChange={(e) => setAddendumForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    >
                      إضافة ملحق
                    </button>
                  </div>
                </form>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="divide-y">
                    {contractAddendums.map((a) => (
                      <div key={a.id} className="p-4 flex items-start gap-4 flex-wrap">
                        <div className="flex-1 min-w-[220px]">
                          <div className="font-bold text-gray-900">{a.title || `ملحق #${a.id}`}</div>
                          <div className="text-sm text-gray-600 mt-1" dir="ltr">
                            {[a.startDate, a.endDate].filter(Boolean).join(" → ") || "—"}
                          </div>
                          {a.notes ? <div className="text-sm text-gray-600 mt-1">{a.notes}</div> : null}
                        </div>
                        <div className="text-sm font-bold text-gray-900 min-w-[140px]" dir="ltr">
                          {formatMoney(Number(a.amountDelta || 0))}
                        </div>
                      </div>
                    ))}
                    {!contractAddendums.length ? <div className="p-4 text-gray-600">لا يوجد ملاحق.</div> : null}
                  </div>
                </div>
              </div>

              {canAccounting ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div>
                      <div className="text-lg font-bold text-gray-900">الدفعات/المستخلصات</div>
                      <div className="text-sm text-gray-600 mt-1">{selectedContract?.title || selectedContract?.number || ""}</div>
                    </div>
                    <div className="text-sm text-gray-700" dir="ltr">
                      {(() => {
                        const base = Number(selectedContract?.amount || 0);
                        const total = base + selectedContractAddendumsTotal;
                        const remaining = total - selectedContractPaidTotal;
                        return `الإجمالي: ${formatMoney(total)} • المدفوع: ${formatMoney(selectedContractPaidTotal)} • المتبقي: ${formatMoney(remaining)}`;
                      })()}
                    </div>
                  </div>

                  <form onSubmit={saveContractPayment} className="grid md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                      <input
                        value={paymentForm.title}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, title: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                      <select
                        value={paymentForm.status}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, status: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      >
                        <option value="pending">معلق</option>
                        <option value="partial">جزئي</option>
                        <option value="paid">مدفوع</option>
                        <option value="overdue">متأخر</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                      <input
                        type="date"
                        value={paymentForm.dueDate}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, dueDate: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الدفع</label>
                      <input
                        type="date"
                        value={paymentForm.paidDate}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, paidDate: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">المبلغ</label>
                      <input
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">المدفوع</label>
                      <input
                        value={paymentForm.paidAmount}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, paidAmount: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, notes: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                      >
                        {paymentEditingId ? "حفظ" : "إضافة"}
                      </button>
                      {paymentEditingId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentEditingId(null);
                            setPaymentForm({
                              title: "",
                              dueDate: "",
                              amount: "",
                              paidAmount: "",
                              paidDate: "",
                              status: "pending",
                              notes: "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          إلغاء
                        </button>
                      ) : null}
                    </div>
                  </form>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="divide-y">
                      {contractPayments.map((p) => (
                        <div key={p.id} className="p-4 flex items-start gap-4 flex-wrap">
                          <div className="flex-1 min-w-[220px]">
                            <div className="font-bold text-gray-900">{p.title || `دفعة #${p.id}`}</div>
                            <div className="text-sm text-gray-600 mt-1" dir="ltr">
                              {[p.dueDate ? `استحقاق: ${p.dueDate}` : "", p.paidDate ? `دفع: ${p.paidDate}` : ""]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </div>
                            {p.notes ? <div className="text-sm text-gray-600 mt-1">{p.notes}</div> : null}
                          </div>
                          <div className="text-sm text-gray-700 min-w-[220px]" dir="ltr">
                            {`المبلغ: ${formatMoney(Number(p.amount || 0))} • المدفوع: ${formatMoney(Number(p.paidAmount || 0))}`}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentEditingId(p.id);
                                setPaymentForm({
                                  title: p.title || "",
                                  dueDate: p.dueDate || "",
                                  amount: String(p.amount ?? ""),
                                  paidAmount: String(p.paidAmount ?? ""),
                                  paidDate: p.paidDate || "",
                                  status: p.status || "pending",
                                  notes: p.notes || "",
                                });
                              }}
                              className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => removeContractPayment(p.id)}
                              className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                      {!contractPayments.length ? <div className="p-4 text-gray-600">لا يوجد دفعات.</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-gray-600">
              اختر عقدًا من القائمة لعرض الملاحق والدفعات.
            </div>
          )}
        </div>
      ) : null}

      {tab === "procurement" ? (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setProcTab("suppliers")}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                procTab === "suppliers"
                  ? "bg-[#007A3D] text-white border-[#007A3D]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              الموردون
            </button>
            {canAccounting ? (
              <button
                type="button"
                onClick={() => setProcTab("purchaseOrders")}
                className={`px-4 py-2 rounded-lg font-semibold border transition ${
                  procTab === "purchaseOrders"
                    ? "bg-[#007A3D] text-white border-[#007A3D]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                }`}
              >
                أوامر الشراء
              </button>
            ) : null}
            {canAccounting ? (
              <button
                type="button"
                onClick={() => setProcTab("inventory")}
                className={`px-4 py-2 rounded-lg font-semibold border transition ${
                  procTab === "inventory"
                    ? "bg-[#007A3D] text-white border-[#007A3D]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                }`}
              >
                المخزون
              </button>
            ) : null}
          </div>

          {procTab === "suppliers" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">
                  {supplierEditingId ? "تعديل مورد" : "إضافة مورد"}
                </div>
                <form onSubmit={saveSupplier} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                    <input
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm((s) => ({ ...s, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">التصنيف</label>
                    <input
                      value={supplierForm.category}
                      onChange={(e) => setSupplierForm((s) => ({ ...s, category: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
                    <input
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm((s) => ({ ...s, phone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">البريد</label>
                    <input
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm((s) => ({ ...s, email: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">العنوان</label>
                    <input
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm((s) => ({ ...s, address: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={supplierForm.notes}
                      onChange={(e) => setSupplierForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {supplierEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {supplierEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierEditingId(null);
                          setSupplierForm({ name: "", category: "", phone: "", email: "", address: "", notes: "" });
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">قائمة الموردين</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {suppliers.map((s) => (
                    <div key={s.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <div className="font-bold text-gray-900">{s.name}</div>
                        <div className="text-sm text-gray-600 mt-1">{s.category || "—"}</div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {[s.phone, s.email].filter(Boolean).join(" • ") || "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierEditingId(s.id);
                            setSupplierForm({
                              name: s.name,
                              category: s.category,
                              phone: s.phone,
                              email: s.email,
                              address: s.address,
                              notes: s.notes,
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSupplier(s.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!suppliers.length ? <div className="p-6 text-gray-600">لا يوجد موردون.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {procTab === "purchaseOrders" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">
                  {poEditingId ? "تعديل أمر شراء" : "إضافة أمر شراء"}
                </div>
                <form onSubmit={savePurchaseOrder} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">المورد</label>
                    <select
                      value={poForm.supplierId}
                      onChange={(e) => setPoForm((s) => ({ ...s, supplierId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {supplierOptions.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">المشروع</label>
                    <select
                      value={poForm.projectId}
                      onChange={(e) => setPoForm((s) => ({ ...s, projectId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {projectOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الرقم</label>
                    <input
                      value={poForm.number}
                      onChange={(e) => setPoForm((s) => ({ ...s, number: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">التاريخ</label>
                    <input
                      type="date"
                      value={poForm.date}
                      onChange={(e) => setPoForm((s) => ({ ...s, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                    <select
                      value={poForm.status}
                      onChange={(e) => setPoForm((s) => ({ ...s, status: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      <option value="draft">مسودة</option>
                      <option value="sent">مرسل</option>
                      <option value="received">مستلم</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الإجمالي</label>
                    <input
                      value={poForm.totalAmount}
                      onChange={(e) => setPoForm((s) => ({ ...s, totalAmount: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={poForm.notes}
                      onChange={(e) => setPoForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {poEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {poEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPoEditingId(null);
                          setPoForm({
                            supplierId: "0",
                            projectId: "0",
                            number: "",
                            date: "",
                            status: "draft",
                            totalAmount: "",
                            notes: "",
                          });
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">قائمة أوامر الشراء</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {purchaseOrders.map((po) => (
                    <div key={po.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{po.number || `PO #${po.id}`}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {(po.supplierName || "—") + " • " + (po.projectTitle || "—")}
                        </div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {po.date || "—"}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-gray-900 min-w-[140px]" dir="ltr">
                        {formatMoney(Number(po.totalAmount || 0))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPoEditingId(po.id);
                            setPoForm({
                              supplierId: String(po.supplierId || 0),
                              projectId: String(po.projectId || 0),
                              number: po.number || "",
                              date: po.date || "",
                              status: po.status || "draft",
                              totalAmount: String(po.totalAmount ?? ""),
                              notes: po.notes || "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removePurchaseOrder(po.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!purchaseOrders.length ? <div className="p-6 text-gray-600">لا يوجد أوامر شراء.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {procTab === "inventory" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">{invEditingId ? "تعديل صنف" : "إضافة صنف"}</div>
                <form onSubmit={saveInventoryItem} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                    <input
                      value={invItemForm.name}
                      onChange={(e) => setInvItemForm((s) => ({ ...s, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">SKU</label>
                    <input
                      value={invItemForm.sku}
                      onChange={(e) => setInvItemForm((s) => ({ ...s, sku: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الوحدة</label>
                    <input
                      value={invItemForm.unit}
                      onChange={(e) => setInvItemForm((s) => ({ ...s, unit: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الكمية الحالية</label>
                    <input
                      value={invItemForm.currentQty}
                      onChange={(e) => setInvItemForm((s) => ({ ...s, currentQty: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">حد إعادة الطلب</label>
                    <input
                      value={invItemForm.reorderLevel}
                      onChange={(e) => setInvItemForm((s) => ({ ...s, reorderLevel: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={invItemForm.notes}
                      onChange={(e) => setInvItemForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {invEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {invEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInvEditingId(null);
                          setInvItemForm({ sku: "", name: "", unit: "", currentQty: "0", reorderLevel: "", notes: "" });
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">الأصناف</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {inventoryItems.map((it) => (
                    <div key={it.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{it.name}</div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {(it.sku || "—") + " • " + (it.unit || "—")}
                        </div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {String(it.currentQty ?? 0)} {it.reorderLevel != null ? ` • Reorder: ${String(it.reorderLevel)}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInvEditingId(it.id);
                            setInvItemForm({
                              sku: it.sku || "",
                              name: it.name || "",
                              unit: it.unit || "",
                              currentQty: String(it.currentQty ?? 0),
                              reorderLevel: it.reorderLevel == null ? "" : String(it.reorderLevel),
                              notes: it.notes || "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeInventoryItem(it.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!inventoryItems.length ? <div className="p-6 text-gray-600">لا يوجد أصناف.</div> : null}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">إضافة حركة مخزون</div>
                <form onSubmit={addInventoryTx} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الصنف</label>
                    <select
                      value={txForm.itemId}
                      onChange={(e) => setTxForm((s) => ({ ...s, itemId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      required
                    >
                      {inventoryItemOptions.map((it) => (
                        <option key={it.id} value={String(it.id)}>
                          {it.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">المشروع</label>
                    <select
                      value={txForm.projectId}
                      onChange={(e) => setTxForm((s) => ({ ...s, projectId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {projectOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">النوع</label>
                    <select
                      value={txForm.kind}
                      onChange={(e) => setTxForm((s) => ({ ...s, kind: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      <option value="in">إدخال</option>
                      <option value="out">إخراج</option>
                      <option value="adjust">تسوية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الكمية</label>
                    <input
                      value={txForm.quantity}
                      onChange={(e) => setTxForm((s) => ({ ...s, quantity: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">سعر الوحدة (اختياري)</label>
                    <input
                      value={txForm.unitCost}
                      onChange={(e) => setTxForm((s) => ({ ...s, unitCost: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">التاريخ</label>
                    <input
                      type="date"
                      value={txForm.date}
                      onChange={(e) => setTxForm((s) => ({ ...s, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">مرجع</label>
                    <input
                      value={txForm.reference}
                      onChange={(e) => setTxForm((s) => ({ ...s, reference: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={txForm.notes}
                      onChange={(e) => setTxForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      إضافة
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">حركات المخزون</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {inventoryTransactions.map((t) => (
                    <div key={t.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{t.itemName}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {(t.projectTitle || "—") + " • " + t.kind}
                        </div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {(t.date || "—") + " • " + String(t.quantity)}
                          {t.unitCost != null ? ` • ${formatMoney(Number(t.unitCost))}` : ""}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 min-w-[200px]" dir="ltr">
                        {t.reference || "—"}
                      </div>
                    </div>
                  ))}
                  {!inventoryTransactions.length ? <div className="p-6 text-gray-600">لا يوجد حركات.</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "resources" ? (
        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setResTab("workers")}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                resTab === "workers"
                  ? "bg-[#007A3D] text-white border-[#007A3D]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              الموظفون والعمال
            </button>
            <button
              type="button"
              onClick={() => setResTab("attendance")}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                resTab === "attendance"
                  ? "bg-[#007A3D] text-white border-[#007A3D]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              الدوام
            </button>
            <button
              type="button"
              onClick={() => setResTab("timeclock")}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                resTab === "timeclock"
                  ? "bg-[#007A3D] text-white border-[#007A3D]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              ساعة الدوام
            </button>
            {canAccounting ? (
              <button
                type="button"
                onClick={() => setResTab("payroll")}
                className={`px-4 py-2 rounded-lg font-semibold border transition ${
                  resTab === "payroll"
                    ? "bg-[#007A3D] text-white border-[#007A3D]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                }`}
              >
                الرواتب
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setResTab("equipment")}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                resTab === "equipment"
                  ? "bg-[#007A3D] text-white border-[#007A3D]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              المعدات
            </button>
            <button
              type="button"
              onClick={() => setResTab("assignments")}
              className={`px-4 py-2 rounded-lg font-semibold border transition ${
                resTab === "assignments"
                  ? "bg-[#007A3D] text-white border-[#007A3D]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
            >
              التعيينات
            </button>
          </div>

          {resTab === "workers" ? (
            <div className="space-y-8">
              {canWorkersWrite ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="text-lg font-bold text-gray-900 mb-4">{workerEditingId ? "تعديل موظف/عامل" : "إضافة موظف/عامل"}</div>
                  <form onSubmit={saveWorker} className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">النوع</label>
                      <select
                        value={workerForm.kind}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, kind: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      >
                        <option value="worker">عامل</option>
                        <option value="employee">موظف</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-7">
                      <input
                        id="workerActive"
                        type="checkbox"
                        checked={workerForm.active}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, active: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <label htmlFor="workerActive" className="text-sm font-semibold text-gray-700">
                        نشط
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                      <input
                        value={workerForm.name}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, name: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الدور</label>
                      <input
                        value={workerForm.role}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, role: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
                      <input
                        value={workerForm.phone}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, phone: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">معرّف ساعة الدوام</label>
                      <input
                        value={workerForm.timeClockId}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, timeClockId: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>

                    {me?.isSuperuser ? (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">ربط حساب مستخدم (اختياري)</label>
                        <select
                          value={workerForm.userId}
                          onChange={(e) => setWorkerForm((s) => ({ ...s, userId: e.target.value }))}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        >
                          <option value="0">—</option>
                          {adminUsers
                            .filter((u) => !u.workerId || (workerEditingId && u.workerId === workerEditingId))
                            .map((u) => (
                              <option key={u.id} value={String(u.id)}>
                                {u.username} • {u.role}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">التكلفة اليومية</label>
                      <input
                        value={workerForm.dailyCost}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, dailyCost: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الراتب الشهري</label>
                      <input
                        value={workerForm.monthlySalary}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, monthlySalary: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                      <textarea
                        value={workerForm.notes}
                        onChange={(e) => setWorkerForm((s) => ({ ...s, notes: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                      >
                        {workerEditingId ? "حفظ" : "إضافة"}
                      </button>
                      {workerEditingId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setWorkerEditingId(null);
                            setWorkerForm({
                              userId: "0",
                              kind: "worker",
                              active: true,
                              name: "",
                              role: "",
                              phone: "",
                              timeClockId: "",
                              dailyCost: "",
                              monthlySalary: "",
                              notes: "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          إلغاء
                        </button>
                      ) : null}
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <div className="text-lg font-bold text-gray-900 mb-2">إدارة الموظفين/العمال</div>
                  <div className="text-gray-600">لا تملك صلاحية الإضافة/التعديل. يمكنك عرض البيانات فقط.</div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">قائمة الموظفين/العمال</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {workers.map((w) => (
                    <div key={w.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{w.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {(w.kind === "employee" ? "موظف" : "عامل") + (w.active ? " • نشط" : " • متوقف")}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{w.role || "—"}</div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {[
                            w.userUsername ? `User: ${w.userUsername}` : "",
                            w.phone || "—",
                            w.timeClockId ? `Clock: ${w.timeClockId}` : "",
                            w.dailyCost != null ? `Daily: ${formatMoney(Number(w.dailyCost))}` : "",
                            w.monthlySalary != null ? `Monthly: ${formatMoney(Number(w.monthlySalary))}` : "",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canWorkersWrite ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setWorkerEditingId(w.id);
                                setWorkerForm({
                                  userId: String(w.userId || 0),
                                  kind: w.kind || "worker",
                                  active: Boolean(w.active),
                                  name: w.name || "",
                                  role: w.role || "",
                                  phone: w.phone || "",
                                  timeClockId: w.timeClockId || "",
                                  dailyCost: w.dailyCost == null ? "" : String(w.dailyCost),
                                  monthlySalary: w.monthlySalary == null ? "" : String(w.monthlySalary),
                                  notes: w.notes || "",
                                });
                              }}
                              className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                            >
                              تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => removeWorker(w.id)}
                              className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                            >
                              حذف
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {!workers.length ? <div className="p-6 text-gray-600">لا يوجد موظفون/عمال.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {resTab === "attendance" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">فلترة الدوام</div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الموظف/العامل</label>
                    <select
                      value={attendanceFilter.workerId}
                      onChange={(e) => setAttendanceFilter((s) => ({ ...s, workerId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      disabled={role === "employee" && Boolean(me?.workerId)}
                    >
                      {workerOptions.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
                    <input
                      value={attendanceFilter.year}
                      onChange={(e) => setAttendanceFilter((s) => ({ ...s, year: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الشهر</label>
                    <input
                      value={attendanceFilter.month}
                      onChange={(e) => setAttendanceFilter((s) => ({ ...s, month: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">{attendanceEditingId ? "تعديل سجل دوام" : "إضافة سجل دوام"}</div>
                <form onSubmit={saveAttendance} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الموظف/العامل</label>
                    <select
                      value={attendanceForm.workerId}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, workerId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      required
                      disabled={role === "employee" && Boolean(me?.workerId)}
                    >
                      {workerOptions.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">المشروع (اختياري)</label>
                    <select
                      value={attendanceForm.projectId}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, projectId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {projectOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">التاريخ</label>
                    <input
                      type="date"
                      value={attendanceForm.date}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                    <select
                      value={attendanceForm.status}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, status: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      <option value="present">حاضر</option>
                      <option value="absent">غائب</option>
                      <option value="half_day">نصف يوم</option>
                      <option value="leave">إجازة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الساعات (اختياري)</label>
                    <input
                      value={attendanceForm.hours}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, hours: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={attendanceForm.notes}
                      onChange={(e) => setAttendanceForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {attendanceEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {attendanceEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAttendanceEditingId(null);
                          setAttendanceForm({ workerId: "0", projectId: "0", date: "", status: "present", hours: "", notes: "" });
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">سجلات الدوام</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {attendanceItems.map((it) => (
                    <div key={it.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{it.workerName || `#${it.workerId}`}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {(it.projectTitle || "—") + " • " + (it.status === "present" ? "حاضر" : it.status === "absent" ? "غائب" : it.status === "half_day" ? "نصف يوم" : it.status === "leave" ? "إجازة" : it.status)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {(it.date || "—") + (it.hours != null ? ` • ${String(it.hours)}h` : "")}
                        </div>
                        {it.notes ? <div className="text-sm text-gray-600 mt-1">{it.notes}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceEditingId(it.id);
                            setAttendanceForm({
                              workerId: String(it.workerId || 0),
                              projectId: String(it.projectId || 0),
                              date: it.date || "",
                              status: it.status || "present",
                              hours: it.hours == null ? "" : String(it.hours),
                              notes: it.notes || "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttendance(it.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!attendanceItems.length ? <div className="p-6 text-gray-600">لا يوجد سجلات.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {resTab === "timeclock" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-lg font-bold text-gray-900">ربط الموظفين بساعة الدوام</div>
                  <div className="text-sm text-gray-600">
                    {`${workers.filter((w) => Boolean(w.timeClockId)).length} مرتبط • ${
                      workers.filter((w) => !w.timeClockId).length
                    } غير مرتبط`}
                  </div>
                </div>
                <div className="mt-4 grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <input
                      value={clockLinkQuery}
                      onChange={(e) => setClockLinkQuery(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      placeholder="بحث بالاسم أو رقم ساعة الدوام"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="clockOnlyUnlinked"
                      type="checkbox"
                      checked={clockLinkOnlyUnlinked}
                      onChange={(e) => setClockLinkOnlyUnlinked(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="clockOnlyUnlinked" className="text-sm font-semibold text-gray-700">
                      غير المرتبط فقط
                    </label>
                  </div>
                </div>
                <div className="mt-4 divide-y border border-gray-200 rounded-xl overflow-hidden">
                  {workers
                    .filter((w) => (clockLinkOnlyUnlinked ? !w.timeClockId : true))
                    .filter((w) => {
                      const q = clockLinkQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        String(w.name || "").toLowerCase().includes(q) ||
                        String(w.timeClockId || "").toLowerCase().includes(q) ||
                        String(w.phone || "").toLowerCase().includes(q)
                      );
                    })
                    .map((w) => (
                      <div key={w.id} className="p-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <div className="font-bold text-gray-900">{w.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {(w.kind === "employee" ? "موظف" : "عامل") + (w.active ? " • نشط" : " • متوقف")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" dir="ltr">
                        <input
                          value={clockLinkEdits[w.id] ?? w.timeClockId ?? ""}
                          onChange={(e) => setClockLinkEdits((s) => ({ ...s, [w.id]: e.target.value }))}
                          className="w-[220px] px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                          placeholder="TimeClock ID"
                        />
                        <button
                          type="button"
                          onClick={() => saveClockLink(w.id)}
                          disabled={loading}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                        >
                          حفظ
                        </button>
                      </div>
                      </div>
                    ))}
                  {!workers.length ? <div className="p-6 text-gray-600">لا يوجد موظفون/عمال.</div> : null}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-lg font-bold text-gray-900">استيراد سجل ساعة الدوام</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <input
                        id="timeclockDryRun"
                        type="checkbox"
                        checked={timeclockDryRun}
                        onChange={(e) => setTimeclockDryRun(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor="timeclockDryRun" className="text-sm font-semibold text-gray-700">
                        اختبار فقط
                      </label>
                    </div>
                    <select
                      value={timeclockDefaultProjectId}
                      onChange={(e) => setTimeclockDefaultProjectId(e.target.value)}
                      className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {projectOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.id ? `مشروع: ${p.title}` : "مشروع افتراضي: —"}
                        </option>
                      ))}
                    </select>
                    <input
                      value={timeclockFolderLimitFiles}
                      onChange={(e) => setTimeclockFolderLimitFiles(e.target.value)}
                      className="w-[140px] px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                      placeholder="limitFiles"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTimeclockImportText(
                          JSON.stringify(
                            [
                              { timeClockId: "123", date: "2026-01-30", checkIn: "08:00", checkOut: "16:00", projectId: 0 },
                              { workerId: 1, date: "2026-01-30", hours: 7.5, status: "present", projectId: 0 },
                            ],
                            null,
                            2,
                          ),
                        )
                      }
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      مثال
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadJsonFile("timeclock-template.json", {
                          items: [
                            { timeClockId: "123", date: "2026-01-30", checkIn: "08:00", checkOut: "16:00", projectId: 0 },
                            { workerId: 1, date: "2026-01-30", hours: 7.5, status: "present", projectId: 0 },
                          ],
                        })
                      }
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                    >
                      تحميل قالب
                    </button>
                    <button
                      type="button"
                      onClick={() => importTimeclock()}
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      استيراد
                    </button>
                    <button
                      type="button"
                      onClick={() => importTimeclockFromFolder()}
                      disabled={loading}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    >
                      استيراد من مجلد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!timeclockImportResult) return;
                        const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
                        downloadJsonFile(`timeclock-import-result-${stamp}.json`, timeclockImportResult);
                      }}
                      disabled={!timeclockImportResult}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    >
                      تصدير النتيجة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!timeclockImportResult) return;
                        const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
                        downloadJsonFile(`timeclock-import-errors-${stamp}.json`, timeclockImportResult.errors || []);
                      }}
                      disabled={!timeclockImportResult?.errors?.length}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    >
                      تصدير الأخطاء
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <textarea
                    value={timeclockImportText}
                    onChange={(e) => setTimeclockImportText(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    rows={10}
                    dir="ltr"
                    placeholder='JSON: [{ "timeClockId": "123", "date": "2026-01-30", "checkIn": "08:00", "checkOut": "16:00" }]'
                  />
                </div>

                {timeclockImportResult ? (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="font-bold text-gray-900">نتيجة الاستيراد</div>
                    <div className="text-sm text-gray-700 mt-1">
                      {`${timeclockImportResult.dryRun ? "اختبار" : "تنفيذ"} • تمت الإضافة: ${timeclockImportResult.createdCount} • تم التحديث: ${timeclockImportResult.updatedCount} • أخطاء: ${timeclockImportResult.errors.length}`}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto" dir="ltr">
                        {JSON.stringify(timeclockImportResult.results.slice(0, 20), null, 2)}
                      </pre>
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto" dir="ltr">
                        {JSON.stringify(timeclockImportResult.errors.slice(0, 20), null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}

                {timeclockFolderImportResult ? (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="font-bold text-gray-900">نتيجة استيراد المجلد</div>
                    <div className="text-sm text-gray-700 mt-1">
                      {`${timeclockFolderImportResult.dryRun ? "اختبار" : "تنفيذ"} • ملفات: ${
                        timeclockFolderImportResult.files.length
                      } • تمت الإضافة: ${timeclockFolderImportResult.createdCount} • تم التحديث: ${
                        timeclockFolderImportResult.updatedCount
                      } • أخطاء: ${timeclockFolderImportResult.errors.length}`}
                    </div>
                    {timeclockFolderImportResult.files.length ? (
                      <div className="text-xs text-gray-600 mt-2" dir="ltr">
                        {timeclockFolderImportResult.files.join(", ")}
                      </div>
                    ) : null}
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto" dir="ltr">
                        {JSON.stringify(timeclockFolderImportResult.results.slice(0, 20), null, 2)}
                      </pre>
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto" dir="ltr">
                        {JSON.stringify(timeclockFolderImportResult.errors.slice(0, 20), null, 2)}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!timeclockFolderImportResult) return;
                          const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
                          downloadJsonFile(`timeclock-folder-import-result-${stamp}.json`, timeclockFolderImportResult);
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        تصدير النتيجة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!timeclockFolderImportResult) return;
                          const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
                          downloadJsonFile(
                            `timeclock-folder-import-errors-${stamp}.json`,
                            timeclockFolderImportResult.errors || [],
                          );
                        }}
                        disabled={!timeclockFolderImportResult.errors.length}
                        className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                      >
                        تصدير الأخطاء
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-lg font-bold text-gray-900">سجل الاستيراد</div>
                  <button
                    type="button"
                    onClick={async () => {
                      setLoading(true);
                      setError("");
                      try {
                        setTimeclockRuns(await fetchAdminOpsTimeclockRuns());
                      } catch {
                        setError("تعذر تحميل سجل الاستيراد.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                  >
                    تحديث
                  </button>
                </div>
                <div className="mt-4 divide-y border border-gray-200 rounded-xl overflow-hidden">
                  {timeclockRuns.map((r) => (
                    <div key={r.id} className="p-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <div className="font-bold text-gray-900">{`#${r.id} • ${r.source}`}</div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {`${r.createdAt || ""} • ${r.actorUsername || "—"} • ${r.dryRun ? "اختبار" : "تنفيذ"}`}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {`items: ${r.itemsCount} • +${r.createdCount} • ~${r.updatedCount} • errors: ${r.errorCount}`}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700">{r.defaultProjectTitle ? `مشروع افتراضي: ${r.defaultProjectTitle}` : ""}</div>
                    </div>
                  ))}
                  {!timeclockRuns.length ? <div className="p-6 text-gray-600">لا يوجد عمليات استيراد.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {resTab === "payroll" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">فلترة الرواتب</div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الموظف/العامل</label>
                    <select
                      value={payrollFilter.workerId}
                      onChange={(e) => setPayrollFilter((s) => ({ ...s, workerId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {workerOptions.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
                    <input
                      value={payrollFilter.year}
                      onChange={(e) => setPayrollFilter((s) => ({ ...s, year: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الشهر</label>
                    <input
                      value={payrollFilter.month}
                      onChange={(e) => setPayrollFilter((s) => ({ ...s, month: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="text-lg font-bold text-gray-900">توليد تلقائي من الدوام</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <input
                        id="payrollGenDryRun"
                        type="checkbox"
                        checked={payrollGenDryRun}
                        onChange={(e) => setPayrollGenDryRun(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor="payrollGenDryRun" className="text-sm font-semibold text-gray-700">
                        اختبار فقط
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => generatePayrollFromAttendance()}
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      توليد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!payrollGenResult) return;
                        const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
                        downloadJsonFile(`payroll-gen-result-${stamp}.json`, payrollGenResult);
                      }}
                      disabled={!payrollGenResult}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    >
                      تصدير النتيجة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!payrollGenResult) return;
                        const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
                        downloadJsonFile(`payroll-gen-errors-${stamp}.json`, payrollGenResult.errors || []);
                      }}
                      disabled={!payrollGenResult?.errors?.length}
                      className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition disabled:opacity-50"
                    >
                      تصدير الأخطاء
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  يتم احتساب الراتب من الدوام (غير مسودة). يتم تحديث/إنشاء بند راتب (salary) تلقائي.
                </div>

                {payrollGenResult ? (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <div className="font-bold text-gray-900">نتيجة التوليد</div>
                    <div className="text-sm text-gray-700 mt-1">
                      {`${payrollGenResult.dryRun ? "اختبار" : "تنفيذ"} • +${payrollGenResult.createdCount} • ~${payrollGenResult.updatedCount} • تخطي: ${payrollGenResult.skippedCount} • أخطاء: ${payrollGenResult.errors.length}`}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto" dir="ltr">
                        {JSON.stringify(payrollGenResult.results.slice(0, 20), null, 2)}
                      </pre>
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-auto" dir="ltr">
                        {JSON.stringify(payrollGenResult.errors.slice(0, 20), null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">{payrollEditingId ? "تعديل حركة رواتب" : "إضافة حركة رواتب"}</div>
                <form onSubmit={savePayrollEntry} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الموظف/العامل</label>
                    <select
                      value={payrollForm.workerId}
                      onChange={(e) => setPayrollForm((s) => ({ ...s, workerId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      required
                    >
                      {workerOptions.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
                      <input
                        value={payrollForm.year}
                        onChange={(e) => setPayrollForm((s) => ({ ...s, year: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">الشهر</label>
                      <input
                        value={payrollForm.month}
                        onChange={(e) => setPayrollForm((s) => ({ ...s, month: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">النوع</label>
                    <select
                      value={payrollForm.kind}
                      onChange={(e) => setPayrollForm((s) => ({ ...s, kind: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      <option value="salary">راتب</option>
                      <option value="advance">سلفة</option>
                      <option value="bonus">مكافأة</option>
                      <option value="deduction">خصم</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">المبلغ</label>
                    <input
                      value={payrollForm.amount}
                      onChange={(e) => setPayrollForm((s) => ({ ...s, amount: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ الدفعة (اختياري)</label>
                    <input
                      type="date"
                      value={payrollForm.date}
                      onChange={(e) => setPayrollForm((s) => ({ ...s, date: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={payrollForm.notes}
                      onChange={(e) => setPayrollForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {payrollEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {payrollEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPayrollEditingId(null);
                          setPayrollForm((s) => ({ ...s, kind: "salary", amount: "", date: "", notes: "" }));
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">حركات الرواتب</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {payrollEntries.map((p) => (
                    <div key={p.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{p.workerName || `#${p.workerId}`}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {String(p.year) + "/" + String(p.month) + " • " + (p.kind === "salary" ? "راتب" : p.kind === "advance" ? "سلفة" : p.kind === "bonus" ? "مكافأة" : p.kind === "deduction" ? "خصم" : p.kind)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {p.amount != null ? formatMoney(Number(p.amount)) : "—"}
                          {p.date ? ` • ${p.date}` : ""}
                        </div>
                        {p.notes ? <div className="text-sm text-gray-600 mt-1">{p.notes}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPayrollEditingId(p.id);
                            setPayrollForm({
                              workerId: String(p.workerId || 0),
                              year: String(p.year || ""),
                              month: String(p.month || ""),
                              kind: p.kind || "salary",
                              amount: p.amount == null ? "" : String(p.amount),
                              date: p.date || "",
                              notes: p.notes || "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removePayrollEntry(p.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!payrollEntries.length ? <div className="p-6 text-gray-600">لا يوجد حركات.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {resTab === "equipment" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">{equipmentEditingId ? "تعديل معدة" : "إضافة معدة"}</div>
                <form onSubmit={saveEquipment} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الاسم</label>
                    <input
                      value={equipmentForm.name}
                      onChange={(e) => setEquipmentForm((s) => ({ ...s, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الكود</label>
                    <input
                      value={equipmentForm.code}
                      onChange={(e) => setEquipmentForm((s) => ({ ...s, code: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                    <select
                      value={equipmentForm.status}
                      onChange={(e) => setEquipmentForm((s) => ({ ...s, status: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      <option value="available">متاح</option>
                      <option value="on_site">على الموقع</option>
                      <option value="maintenance">صيانة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">التكلفة بالساعة</label>
                    <input
                      value={equipmentForm.hourlyCost}
                      onChange={(e) => setEquipmentForm((s) => ({ ...s, hourlyCost: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={equipmentForm.notes}
                      onChange={(e) => setEquipmentForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {equipmentEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {equipmentEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEquipmentEditingId(null);
                          setEquipmentForm({ name: "", code: "", status: "available", hourlyCost: "", notes: "" });
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">قائمة المعدات</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {equipment.map((e) => (
                    <div key={e.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">{e.name}</div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {(e.code || "—") + " • " + (e.status || "—")}
                        </div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {e.hourlyCost != null ? formatMoney(Number(e.hourlyCost)) : "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEquipmentEditingId(e.id);
                            setEquipmentForm({
                              name: e.name || "",
                              code: e.code || "",
                              status: e.status || "available",
                              hourlyCost: e.hourlyCost == null ? "" : String(e.hourlyCost),
                              notes: e.notes || "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEquipment(e.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!equipment.length ? <div className="p-6 text-gray-600">لا يوجد معدات.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {resTab === "assignments" ? (
            <div className="space-y-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="text-lg font-bold text-gray-900 mb-4">{assignmentEditingId ? "تعديل تعيين" : "إضافة تعيين"}</div>
                <form onSubmit={saveAssignment} className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">المشروع</label>
                    <select
                      value={assignmentForm.projectId}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, projectId: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      {projectOptions.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">نوع المورد</label>
                    <select
                      value={assignmentForm.resourceType}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, resourceType: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                    >
                      <option value="worker">عامل</option>
                      <option value="equipment">معدة</option>
                    </select>
                  </div>
                  {assignmentForm.resourceType === "worker" ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">العامل</label>
                      <select
                        value={assignmentForm.workerId}
                        onChange={(e) => setAssignmentForm((s) => ({ ...s, workerId: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      >
                        {workerOptions.map((w) => (
                          <option key={w.id} value={String(w.id)}>
                            {w.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">المعدة</label>
                      <select
                        value={assignmentForm.equipmentId}
                        onChange={(e) => setAssignmentForm((s) => ({ ...s, equipmentId: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      >
                        {equipmentOptions.map((w) => (
                          <option key={w.id} value={String(w.id)}>
                            {w.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ البداية</label>
                    <input
                      type="date"
                      value={assignmentForm.startDate}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, startDate: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={assignmentForm.endDate}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, endDate: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ساعات/يوم</label>
                    <input
                      value={assignmentForm.hoursPerDay}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, hoursPerDay: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">تجاوز التكلفة</label>
                    <input
                      value={assignmentForm.costOverride}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, costOverride: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      dir="ltr"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={assignmentForm.notes}
                      onChange={(e) => setAssignmentForm((s) => ({ ...s, notes: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                    >
                      {assignmentEditingId ? "حفظ" : "إضافة"}
                    </button>
                    {assignmentEditingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentEditingId(null);
                          setAssignmentForm({
                            projectId: "0",
                            resourceType: "worker",
                            workerId: "0",
                            equipmentId: "0",
                            startDate: "",
                            endDate: "",
                            hoursPerDay: "",
                            costOverride: "",
                            notes: "",
                          });
                        }}
                        className="bg-white border border-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:shadow-sm transition"
                      >
                        إلغاء
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="font-bold text-gray-900">قائمة التعيينات</div>
                  {loading ? <div className="text-sm text-gray-600">جارٍ التنفيذ...</div> : null}
                </div>
                <div className="divide-y">
                  {assignments.map((a) => (
                    <div key={a.id} className="p-6 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[260px]">
                        <div className="font-bold text-gray-900">
                          {a.resourceType === "worker" ? a.workerName || "—" : a.equipmentName || "—"}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{a.projectTitle || "—"}</div>
                        <div className="text-sm text-gray-600 mt-1" dir="ltr">
                          {[a.startDate, a.endDate].filter(Boolean).join(" → ") || "—"}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 min-w-[200px]" dir="ltr">
                        {(a.hoursPerDay != null ? `h/d ${String(a.hoursPerDay)}` : "—") +
                          (a.costOverride != null ? ` • ${formatMoney(Number(a.costOverride))}` : "")}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignmentEditingId(a.id);
                            setAssignmentForm({
                              projectId: String(a.projectId || 0),
                              resourceType: a.resourceType || "worker",
                              workerId: String(a.workerId || 0),
                              equipmentId: String(a.equipmentId || 0),
                              startDate: a.startDate || "",
                              endDate: a.endDate || "",
                              hoursPerDay: a.hoursPerDay == null ? "" : String(a.hoursPerDay),
                              costOverride: a.costOverride == null ? "" : String(a.costOverride),
                              notes: a.notes || "",
                            });
                          }}
                          className="bg-white border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAssignment(a.id)}
                          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold hover:shadow-sm transition"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                  {!assignments.length ? <div className="p-6 text-gray-600">لا يوجد تعيينات.</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "kpi" ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="font-bold text-gray-900">مؤشرات المشاريع (KPI)</div>
            {loading ? <div className="text-sm text-gray-600">جارٍ التحميل...</div> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-right text-gray-600">
                  <th className="p-4 font-bold">المشروع</th>
                  <th className="p-4 font-bold">التقدم</th>
                  <th className="p-4 font-bold">الميزانية</th>
                  <th className="p-4 font-bold">العقود</th>
                  <th className="p-4 font-bold">أوامر الشراء</th>
                  <th className="p-4 font-bold">مدفوع</th>
                  <th className="p-4 font-bold">الفارق</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {kpis.map((k) => (
                  <tr key={k.projectId} className="text-gray-800">
                    <td className="p-4 font-semibold">{k.title}</td>
                    <td className="p-4" dir="ltr">
                      {String(k.progressPercent)}%
                    </td>
                    <td className="p-4" dir="ltr">
                      {formatMoney(k.budgetAmount)}
                    </td>
                    <td className="p-4" dir="ltr">
                      {formatMoney(k.contractsTotal)}
                    </td>
                    <td className="p-4" dir="ltr">
                      {formatMoney(k.purchaseOrdersTotal)}
                    </td>
                    <td className="p-4" dir="ltr">
                      {formatMoney(k.paidTotal)}
                    </td>
                    <td className={`p-4 font-bold ${k.variance < 0 ? "text-red-700" : "text-emerald-700"}`} dir="ltr">
                      {formatMoney(k.variance)}
                    </td>
                  </tr>
                ))}
                {!kpis.length ? (
                  <tr>
                    <td className="p-6 text-gray-600" colSpan={7}>
                      لا توجد بيانات.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
