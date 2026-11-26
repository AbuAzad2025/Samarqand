import { useCallback, useEffect, useState } from "react";
import {
  approveLeaveRequest,
  approveOvertime,
  createContract,
  createLeaveRequest,
  createOvertime,
  createSocialSecurity,
  deleteContract,
  deleteLeaveRequest,
  deleteOvertime,
  deleteSocialSecurity,
  fetchContracts,
  fetchLeaveBalance,
  fetchLeaveRequests,
  fetchOvertime,
  fetchSocialSecurity,
  fetchWorkers,
  markSocialSecurityPaid,
  rejectLeaveRequest,
  updateContract,
  updateLeaveRequest,
  updateOvertime,
  updateSocialSecurity,
  type ContractItem,
  type ContractType,
  type LeaveBalance,
  type LeaveRequestItem,
  type LeaveStatus,
  type LeaveType,
  type OvertimeItem,
  type SocialSecurityItem,
  type WorkerItem,
} from "@/react-app/api/hr";
import { todayInputValue, baseHumanizeErrorCode } from "@/react-app/utils/common";

function currentYear(): number {
  return new Date().getFullYear();
}

function currentMonth(): number {
  return new Date().getMonth() + 1;
}

function humanizeErrorCode(code: string): string {
  const shared = baseHumanizeErrorCode(code);
  if (shared) return shared;
  const c = String(code || "").trim();
  if (c === "worker_not_found") return "الموظف غير موجود.";
  if (c === "missing_dates") return "التواريخ مطلوبة.";
  if (c === "invalid_date_range") return "نطاق التاريخ غير صحيح.";
  if (c === "invalid_leave_type") return "نوع الإجازة غير صحيح.";
  if (c === "approved_leave_locked") return "الإجازة المعتمدة لا يمكن تعديلها.";
  if (c === "missing_start_date") return "تاريخ بداية العقد مطلوب.";
  if (c === "invalid_contract_type") return "نوع العقد غير صحيح.";
  if (c === "missing_date") return "التاريخ مطلوب.";
  if (c === "invalid_hours") return "عدد الساعات غير صحيح.";
  if (c === "invalid_year") return "السنة غير صحيحة.";
  if (c === "invalid_month") return "الشهر غير صحيح.";
  return c;
}

type Tab = "leave" | "contracts" | "overtime" | "social";

const TABS: { key: Tab; label: string }[] = [
  { key: "leave", label: "الإجازات" },
  { key: "contracts", label: "العقود" },
  { key: "overtime", label: "الوقت الإضافي" },
  { key: "social", label: "التأمينات الاجتماعية" },
];

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "annual", label: "سنوية" },
  { value: "sick", label: "مرضية" },
  { value: "unpaid", label: "بدون راتب" },
  { value: "emergency", label: "طارئة" },
  { value: "pilgrimage", label: "حج / عمرة" },
  { value: "other", label: "أخرى" },
];

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "full_time", label: "دوام كامل" },
  { value: "part_time", label: "دوام جزئي" },
  { value: "contract", label: "عقد عمل" },
  { value: "seasonal", label: "موسمي" },
];

export default function ControlHR() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [tab, setTab] = useState<Tab>("leave");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filterWorkerId, setFilterWorkerId] = useState<number | null>(null);
  const [filterYear, setFilterYear] = useState<number>(currentYear());
  const [filterMonth, setFilterMonth] = useState<number>(currentMonth());
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | "">("");

  const [leaveItems, setLeaveItems] = useState<LeaveRequestItem[]>([]);
  const [contractItems, setContractItems] = useState<ContractItem[]>([]);
  const [overtimeItems, setOvertimeItems] = useState<OvertimeItem[]>([]);
  const [socialItems, setSocialItems] = useState<SocialSecurityItem[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);

  const showError = useCallback((err: unknown) => {
    const code = typeof err === "string" ? err : humanizeErrorCode(String(err));
    setError(code);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "leave") {
        const items = await fetchLeaveRequests({
          workerId: filterWorkerId || undefined,
          status: (filterStatus as LeaveStatus) || undefined,
        });
        setLeaveItems(items);
        if (filterWorkerId) {
          const balance = await fetchLeaveBalance(filterWorkerId, filterYear);
          setLeaveBalance(balance);
        } else {
          setLeaveBalance(null);
        }
      } else if (tab === "contracts") {
        const items = await fetchContracts({ workerId: filterWorkerId || undefined });
        setContractItems(items);
      } else if (tab === "overtime") {
        const items = await fetchOvertime({
          workerId: filterWorkerId || undefined,
          year: filterYear,
          month: filterMonth,
        });
        setOvertimeItems(items);
      } else if (tab === "social") {
        const items = await fetchSocialSecurity({
          workerId: filterWorkerId || undefined,
          year: filterYear,
          month: filterMonth,
        });
        setSocialItems(items);
      }
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [tab, filterWorkerId, filterYear, filterMonth, filterStatus, showError]);

  useEffect(() => {
    fetchWorkers()
      .then(setWorkers)
      .catch(() => showError("تعذر تحميل الموظفين."));
  }, [showError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function workerOptions() {
    return (
      <>
        <option value="" className="bg-sq-black">كل الموظفين</option>
        {workers.map((w) => (
          <option key={w.id} value={w.id} className="bg-sq-black">
            {w.name}
          </option>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">الموارد البشرية</h1>
          <p className="text-white/60 mt-1">إدارة الإجازات والعقود والوقت الإضافي والتأمينات الاجتماعية</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={filterWorkerId || ""}
            onChange={(e) => setFilterWorkerId(Number(e.target.value) || null)}
            className="min-w-[180px]"
          >
            {workerOptions()}
          </Select>
          {tab !== "contracts" && (
            <>
              <Input
                type="number"
                placeholder="السنة"
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value) || currentYear())}
                className="w-28"
              />
              <Select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value) || currentMonth())}
                className="w-32"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m} className="bg-sq-black">
                    {m}
                  </option>
                ))}
              </Select>
            </>
          )}
          {tab === "leave" && (
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as LeaveStatus | "")}
              className="w-36"
            >
              <option value="" className="bg-sq-black">كل الحالات</option>
              <option value="pending" className="bg-sq-black">معلقة</option>
              <option value="approved" className="bg-sq-black">معتمدة</option>
              <option value="rejected" className="bg-sq-black">مرفوضة</option>
            </Select>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
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

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {TABS.map((t) => (
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

      {loading ? (
        <div className="text-center py-20 text-white/50">جاري التحميل…</div>
      ) : (
        <>
          {tab === "leave" && (
            <LeaveSection
              workers={workers}
              items={leaveItems}
              balance={leaveBalance}
              onRefresh={refresh}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
          {tab === "contracts" && (
            <ContractsSection
              workers={workers}
              items={contractItems}
              onRefresh={refresh}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
          {tab === "overtime" && (
            <OvertimeSection
              workers={workers}
              items={overtimeItems}
              onRefresh={refresh}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
          {tab === "social" && (
            <SocialSection
              workers={workers}
              items={socialItems}
              onRefresh={refresh}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
        </>
      )}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold disabled:opacity-50 ${props.className || ""}`}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition ${props.className || ""}`}
    />
  );
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300",
    approved: "bg-emerald-500/20 text-emerald-300",
    rejected: "bg-red-500/20 text-red-300",
    open: "bg-amber-500/20 text-amber-300",
    action_taken: "bg-blue-500/20 text-blue-300",
    closed: "bg-slate-500/20 text-slate-300",
    draft: "bg-white/10 text-white/80",
    submitted: "bg-blue-500/20 text-blue-300",
    under_review: "bg-amber-500/20 text-amber-300",
    implemented: "bg-emerald-500/20 text-emerald-300",
  };
  return map[status] || "bg-white/10 text-white/80";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "معلقة",
    approved: "معتمدة",
    rejected: "مرفوضة",
  };
  return map[status] || status;
}

function WorkerSelect({
  workers,
  value,
  onChange,
  className,
}: {
  workers: WorkerItem[];
  value: number | null;
  onChange: (id: number | null) => void;
  className?: string;
}) {
  return (
    <Select
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || null)}
      className={className}
    >
      <option value="" className="bg-sq-black">اختر موظفاً</option>
      {workers.map((w) => (
        <option key={w.id} value={w.id} className="bg-sq-black">
          {w.name}
        </option>
      ))}
    </Select>
  );
}

function LeaveSection({
  workers,
  items,
  balance,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  workers: WorkerItem[];
  items: LeaveRequestItem[];
  balance: LeaveBalance | null;
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<LeaveRequestItem>>({
    startDate: todayInputValue(),
    endDate: todayInputValue(),
    leaveType: "annual",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.workerId || !form.startDate || !form.endDate) {
      onShowError("الموظف وتاريخا بداية ونهاية الإجازة مطلوبان.");
      return;
    }
    const payload = {
      workerId: form.workerId,
      leaveType: form.leaveType || "annual",
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason || "",
    };
    const res = editingId
      ? await updateLeaveRequest(editingId, payload)
      : await createLeaveRequest(payload);
    if (res.ok) {
      setForm({ startDate: todayInputValue(), endDate: todayInputValue(), leaveType: "annual" });
      setEditingId(null);
      onShowSuccess(editingId ? "تم تحديث الإجازة." : "تم إنشاء الإجازة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    const res = await deleteLeaveRequest(id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleApprove(id: number) {
    const res = await approveLeaveRequest(id);
    if (res.ok) {
      onShowSuccess("تمت الموافقة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleReject(id: number) {
    const res = await rejectLeaveRequest(id);
    if (res.ok) {
      onShowSuccess("تم الرفض.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {balance !== null && (
        <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white">
          <span className="text-white/60">رصيد الإجازات السنوية المتبقي:</span>{" "}
          <span className="font-extrabold text-emerald-300">{balance.remainingAnnualDays} يوم</span>
          <span className="text-white/50 text-sm"> (الاستحقاق {balance.annualEntitlement} — مستهلك {balance.approvedAnnualDays})</span>
        </div>
      )}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-5 gap-3">
          <WorkerSelect
            workers={workers}
            value={form.workerId || null}
            onChange={(id) => setForm({ ...form, workerId: id || undefined })}
            className="md:col-span-2"
          />
          <Select
            value={form.leaveType || "annual"}
            onChange={(e) => setForm({ ...form, leaveType: e.target.value as LeaveType })}
          >
            {LEAVE_TYPES.map((lt) => (
              <option key={lt.value} value={lt.value} className="bg-sq-black">
                {lt.label}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={form.startDate || ""}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            type="date"
            value={form.endDate || ""}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
        <TextArea
          placeholder="السبب"
          value={form.reason || ""}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ startDate: todayInputValue(), endDate: todayInputValue(), leaveType: "annual" });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الموظف</th>
              <th className="px-4 py-3 text-right">النوع</th>
              <th className="px-4 py-3 text-right">من</th>
              <th className="px-4 py-3 text-right">إلى</th>
              <th className="px-4 py-3 text-right">الأيام</th>
              <th className="px-4 py-3 text-right">السبب</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.workerName}</td>
                <td className="px-4 py-3 text-white/80">
                  {LEAVE_TYPES.find((x) => x.value === it.leaveType)?.label || it.leaveType}
                </td>
                <td className="px-4 py-3 text-white/70">{it.startDate}</td>
                <td className="px-4 py-3 text-white/70">{it.endDate}</td>
                <td className="px-4 py-3 text-white/80">{it.totalDays}</td>
                <td className="px-4 py-3 text-white/80">{it.reason || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                    {statusLabel(it.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {it.status === "pending" && (
                      <>
                        <Button className="px-2 py-1 text-xs" onClick={() => handleApprove(it.id)}>
                          موافقة
                        </Button>
                        <SecondaryButton
                          className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                          onClick={() => handleReject(it.id)}
                        >
                          رفض
                        </SecondaryButton>
                      </>
                    )}
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-white/40">
                  لا توجد إجازات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContractsSection({
  workers,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  workers: WorkerItem[];
  items: ContractItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<ContractItem>>({
    startDate: todayInputValue(),
    contractType: "full_time",
    isActive: true,
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.workerId || !form.startDate) {
      onShowError("الموظف وتاريخ بداية العقد مطلوبان.");
      return;
    }
    const payload = {
      workerId: form.workerId,
      contractNumber: form.contractNumber || "",
      contractType: form.contractType || "full_time",
      startDate: form.startDate,
      endDate: form.endDate || null,
      basicSalary: form.basicSalary ?? 0,
      transportationAllowance: form.transportationAllowance ?? 0,
      housingAllowance: form.housingAllowance ?? 0,
      position: form.position || "",
      department: form.department || "",
      probationPeriodDays: form.probationPeriodDays ?? 90,
      isActive: form.isActive ?? true,
    };
    const res = editingId ? await updateContract(editingId, payload) : await createContract(payload);
    if (res.ok) {
      setForm({ startDate: todayInputValue(), contractType: "full_time", isActive: true });
      setEditingId(null);
      onShowSuccess(editingId ? "تم تحديث العقد." : "تم إنشاء العقد.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    const res = await deleteContract(id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <WorkerSelect
            workers={workers}
            value={form.workerId || null}
            onChange={(id) => setForm({ ...form, workerId: id || undefined })}
          />
          <Input
            placeholder="رقم العقد"
            value={form.contractNumber || ""}
            onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
          />
          <Select
            value={form.contractType || "full_time"}
            onChange={(e) => setForm({ ...form, contractType: e.target.value as ContractType })}
          >
            {CONTRACT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value} className="bg-sq-black">
                {ct.label}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={form.startDate || ""}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <Input
            type="date"
            value={form.endDate || ""}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
          <Input
            type="number"
            placeholder="الراتب الأساسي"
            value={form.basicSalary ?? ""}
            onChange={(e) => setForm({ ...form, basicSalary: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            placeholder="بدل النقل"
            value={form.transportationAllowance ?? ""}
            onChange={(e) => setForm({ ...form, transportationAllowance: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            placeholder="بدل السكن"
            value={form.housingAllowance ?? ""}
            onChange={(e) => setForm({ ...form, housingAllowance: Number(e.target.value) || 0 })}
          />
          <Input
            placeholder="المسمى الوظيفي"
            value={form.position || ""}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
          <Input
            placeholder="القسم"
            value={form.department || ""}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <Input
            type="number"
            placeholder="فترة التجربة (يوم)"
            value={form.probationPeriodDays ?? ""}
            onChange={(e) => setForm({ ...form, probationPeriodDays: Number(e.target.value) || 90 })}
          />
          <label className="flex items-center gap-2 text-white/80">
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 accent-sq-green"
            />
            نشط
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ startDate: todayInputValue(), contractType: "full_time", isActive: true });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الموظف</th>
              <th className="px-4 py-3 text-right">رقم العقد</th>
              <th className="px-4 py-3 text-right">النوع</th>
              <th className="px-4 py-3 text-right">بداية</th>
              <th className="px-4 py-3 text-right">نهاية</th>
              <th className="px-4 py-3 text-right">الراتب</th>
              <th className="px-4 py-3 text-right">البدلات</th>
              <th className="px-4 py-3 text-right">الوظيفة</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.workerName}</td>
                <td className="px-4 py-3 text-white/80">{it.contractNumber || "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  {CONTRACT_TYPES.find((x) => x.value === it.contractType)?.label || it.contractType}
                </td>
                <td className="px-4 py-3 text-white/70">{it.startDate}</td>
                <td className="px-4 py-3 text-white/70">{it.endDate || "—"}</td>
                <td className="px-4 py-3 text-white/80">{it.basicSalary.toFixed(2)}</td>
                <td className="px-4 py-3 text-white/80">
                  {(it.transportationAllowance + it.housingAllowance).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-white/80">{it.position || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      it.isActive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-500/20 text-slate-300"
                    }`}
                  >
                    {it.isActive ? "نشط" : "غير نشط"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-white/40">
                  لا توجد عقود.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OvertimeSection({
  workers,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  workers: WorkerItem[];
  items: OvertimeItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<OvertimeItem>>({
    date: todayInputValue(),
    hours: 0,
    multiplier: 1.5,
    projectId: null,
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.workerId || !form.date || !form.hours) {
      onShowError("الموظف والتاريخ وعدد الساعات مطلوبة.");
      return;
    }
    const payload = {
      workerId: form.workerId,
      projectId: form.projectId || null,
      date: form.date,
      hours: form.hours,
      multiplier: form.multiplier ?? 1.5,
      hourlyRate: form.hourlyRate ?? null,
      notes: form.notes || "",
    };
    const res = editingId ? await updateOvertime(editingId, payload) : await createOvertime(payload);
    if (res.ok) {
      setForm({ date: todayInputValue(), hours: 0, multiplier: 1.5, projectId: null });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteOvertime(id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleApprove(id: number) {
    const res = await approveOvertime(id);
    if (res.ok) {
      onShowSuccess("تمت الموافقة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-5 gap-3">
          <WorkerSelect
            workers={workers}
            value={form.workerId || null}
            onChange={(id) => setForm({ ...form, workerId: id || undefined })}
            className="md:col-span-2"
          />
          <Input
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            type="number"
            step="0.5"
            placeholder="عدد الساعات"
            value={form.hours ?? ""}
            onChange={(e) => setForm({ ...form, hours: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            step="0.1"
            placeholder="المضاعف"
            value={form.multiplier ?? ""}
            onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) || 1.5 })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="الأجر الساعي"
            value={form.hourlyRate ?? ""}
            onChange={(e) =>
              setForm({ ...form, hourlyRate: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Input
            type="number"
            placeholder="رقم المشروع"
            value={form.projectId ?? ""}
            onChange={(e) =>
              setForm({ ...form, projectId: e.target.value ? Number(e.target.value) : null })
            }
          />
        </div>
        <TextArea
          placeholder="ملاحظات"
          value={form.notes || ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ date: todayInputValue(), hours: 0, multiplier: 1.5, projectId: null });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الموظف</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">المشروع</th>
              <th className="px-4 py-3 text-right">الساعات</th>
              <th className="px-4 py-3 text-right">المضاعف</th>
              <th className="px-4 py-3 text-right">الأجر الساعي</th>
              <th className="px-4 py-3 text-right">المبلغ</th>
              <th className="px-4 py-3 text-right">الموافقة</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.workerName}</td>
                <td className="px-4 py-3 text-white/70">{it.date}</td>
                <td className="px-4 py-3 text-white/80">{it.projectTitle || "—"}</td>
                <td className="px-4 py-3 text-white/80">{it.hours}</td>
                <td className="px-4 py-3 text-white/80">{it.multiplier}</td>
                <td className="px-4 py-3 text-white/80">{it.hourlyRate?.toFixed(2) || "—"}</td>
                <td className="px-4 py-3 text-white/80">{it.amount?.toFixed(2) || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      it.approved
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {it.approved ? "معتمد" : "معلقة"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!it.approved && (
                      <Button className="px-2 py-1 text-xs" onClick={() => handleApprove(it.id)}>
                        موافقة
                      </Button>
                    )}
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                  لا توجد سجلات وقت إضافي.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SocialSection({
  workers,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  workers: WorkerItem[];
  items: SocialSecurityItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<SocialSecurityItem>>({
    year: currentYear(),
    month: currentMonth(),
    paid: false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.workerId || !form.year || !form.month) {
      onShowError("الموظف والسنة والشهر مطلوبة.");
      return;
    }
    const payload = {
      workerId: form.workerId,
      year: form.year,
      month: form.month,
      grossSalary: form.grossSalary ?? 0,
      employeeShare: form.employeeShare ?? 0,
      employerShare: form.employerShare ?? 0,
      paid: form.paid ?? false,
      paidDate: form.paidDate || null,
    };
    const res = editingId
      ? await updateSocialSecurity(editingId, payload)
      : await createSocialSecurity(payload);
    if (res.ok) {
      setForm({ year: currentYear(), month: currentMonth(), paid: false });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteSocialSecurity(id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleMarkPaid(id: number) {
    const res = await markSocialSecurityPaid(id, todayInputValue());
    if (res.ok) {
      onShowSuccess("تم التسديد.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-5 gap-3">
          <WorkerSelect
            workers={workers}
            value={form.workerId || null}
            onChange={(id) => setForm({ ...form, workerId: id || undefined })}
            className="md:col-span-2"
          />
          <Input
            type="number"
            placeholder="السنة"
            value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) || currentYear() })}
          />
          <Select
            value={form.month ?? currentMonth()}
            onChange={(e) => setForm({ ...form, month: Number(e.target.value) || currentMonth() })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m} className="bg-sq-black">
                {m}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            step="0.01"
            placeholder="الراتب الخاضع"
            value={form.grossSalary ?? ""}
            onChange={(e) => setForm({ ...form, grossSalary: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="حصة الموظف"
            value={form.employeeShare ?? ""}
            onChange={(e) => setForm({ ...form, employeeShare: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="حصة صاحب العمل"
            value={form.employerShare ?? ""}
            onChange={(e) => setForm({ ...form, employerShare: Number(e.target.value) || 0 })}
          />
          <Input
            type="date"
            value={form.paidDate || ""}
            onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
          />
          <label className="flex items-center gap-2 text-white/80">
            <input
              type="checkbox"
              checked={form.paid ?? false}
              onChange={(e) => setForm({ ...form, paid: e.target.checked })}
              className="w-4 h-4 accent-sq-green"
            />
            مسدد
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ year: currentYear(), month: currentMonth(), paid: false });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الموظف</th>
              <th className="px-4 py-3 text-right">السنة</th>
              <th className="px-4 py-3 text-right">الشهر</th>
              <th className="px-4 py-3 text-right">الراتب الخاضع</th>
              <th className="px-4 py-3 text-right">حصة الموظف</th>
              <th className="px-4 py-3 text-right">حصة صاحب العمل</th>
              <th className="px-4 py-3 text-right">الإجمالي</th>
              <th className="px-4 py-3 text-right">السداد</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.workerName}</td>
                <td className="px-4 py-3 text-white/80">{it.year}</td>
                <td className="px-4 py-3 text-white/80">{it.month}</td>
                <td className="px-4 py-3 text-white/80">{it.grossSalary.toFixed(2)}</td>
                <td className="px-4 py-3 text-white/80">{it.employeeShare.toFixed(2)}</td>
                <td className="px-4 py-3 text-white/80">{it.employerShare.toFixed(2)}</td>
                <td className="px-4 py-3 text-white/80">{it.total.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      it.paid
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {it.paid ? `مسدد ${it.paidDate || ""}` : "غير مسدد"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!it.paid && (
                      <Button className="px-2 py-1 text-xs" onClick={() => handleMarkPaid(it.id)}>
                        تسديد
                      </Button>
                    )}
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                  لا توجد سجلات تأمينات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
