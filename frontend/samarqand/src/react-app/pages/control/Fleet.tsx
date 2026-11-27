import { useCallback, useEffect, useState } from "react";
import {
  createFuelLog,
  createMaintenance,
  createVehicle,
  deleteFuelLog,
  deleteMaintenance,
  deleteVehicle,
  fetchFuelLogs,
  fetchMaintenance,
  fetchVehicles,
  updateFuelLog,
  updateMaintenance,
  updateVehicle,
  type FuelLogItem,
  type MaintenanceItem,
  type MaintenanceType,
  type VehicleItem,
  type VehicleStatus,
  type VehicleType,
} from "@/react-app/api/fleet";
import { todayInputValue, baseHumanizeErrorCode } from "@/react-app/utils/common";
import { fetchWorkers, type WorkerItem } from "@/react-app/api/hr";

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
  if (c === "vehicle_not_found") return "المركبة غير موجودة.";
  if (c === "missing_name") return "الاسم مطلوب.";
  if (c === "missing_plate_number") return "رقم اللوحة مطلوب.";
  if (c === "duplicate_plate_number") return "رقم اللوحة مستخدم.";
  if (c === "invalid_vehicle_type") return "نوع المركبة غير صحيح.";
  if (c === "invalid_status") return "الحالة غير صحيحة.";
  if (c === "missing_name_or_plate") return "الاسم ورقم اللوحة مطلوبان.";
  if (c === "missing_date") return "التاريخ مطلوب.";
  if (c === "invalid_liters") return "عدد اللترات غير صحيح.";
  if (c === "invalid_maintenance_type") return "نوع الصيانة غير صحيح.";
  return c;
}

type Tab = "vehicles" | "fuel" | "maintenance";

const TABS: { key: Tab; label: string }[] = [
  { key: "vehicles", label: "المركبات" },
  { key: "fuel", label: "الوقود" },
  { key: "maintenance", label: "الصيانة" },
];

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "truck", label: "شاحنة" },
  { value: "pickup", label: "بيك أب" },
  { value: "sedan", label: "سيدان" },
  { value: "bus", label: "باص" },
  { value: "forklift", label: "رافعة شوكية" },
  { value: "trailer", label: "مقطورة" },
  { value: "heavy_equipment", label: "معدات ثقيلة" },
];

const VEHICLE_STATUSES: { value: VehicleStatus; label: string }[] = [
  { value: "available", label: "متاحة" },
  { value: "in_use", label: "قيد الاستخدام" },
  { value: "maintenance", label: "صيانة" },
  { value: "out_of_service", label: "خارج الخدمة" },
  { value: "retired", label: "تقاعد" },
];

const MAINTENANCE_TYPES: { value: MaintenanceType; label: string }[] = [
  { value: "oil_change", label: "تغيير زيت" },
  { value: "tires", label: "إطارات" },
  { value: "repair", label: "إصلاح" },
  { value: "inspection", label: "فحص" },
  { value: "insurance", label: "تأمين" },
  { value: "registration", label: "ترخيص" },
  { value: "other", label: "أخرى" },
];

export default function ControlFleet() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [tab, setTab] = useState<Tab>("vehicles");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filterVehicleId, setFilterVehicleId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<VehicleStatus | "">("");
  const [filterYear, setFilterYear] = useState<number>(currentYear());
  const [filterMonth, setFilterMonth] = useState<number>(currentMonth());

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLogItem[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);

  const showError = useCallback((err: unknown) => {
    const code = typeof err === "string" ? err : humanizeErrorCode(String(err));
    setError(code);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }, []);

  useEffect(() => {
    fetchWorkers()
      .then(setWorkers)
      .catch(() => showError("تعذر تحميل الموظفين."));
  }, [showError]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "vehicles") {
        const items = await fetchVehicles({
          status: (filterStatus as VehicleStatus) || undefined,
        });
        setVehicles(items);
      } else if (tab === "fuel") {
        const items = await fetchFuelLogs({
          vehicleId: filterVehicleId || undefined,
          year: filterYear,
          month: filterMonth,
        });
        setFuelLogs(items);
      } else if (tab === "maintenance") {
        const items = await fetchMaintenance({
          vehicleId: filterVehicleId || undefined,
          year: filterYear,
          month: filterMonth,
        });
        setMaintenanceItems(items);
      }
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [tab, filterVehicleId, filterStatus, filterYear, filterMonth, showError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function vehicleOptions() {
    return (
      <>
        <option value="" className="bg-sq-black">كل المركبات</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id} className="bg-sq-black">
            {v.name} ({v.plateNumber})
          </option>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">إدارة المركبات</h1>
          <p className="text-white/60 mt-1">تتبع المركبات والوقود والصيانة</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {tab !== "vehicles" && (
            <Select
              value={filterVehicleId || ""}
              onChange={(e) => setFilterVehicleId(Number(e.target.value) || null)}
              className="min-w-[180px]"
            >
              {vehicleOptions()}
            </Select>
          )}
          {tab === "vehicles" && (
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as VehicleStatus | "")}
              className="w-40"
            >
              <option value="" className="bg-sq-black">كل الحالات</option>
              {VEHICLE_STATUSES.map((s) => (
                <option key={s.value} value={s.value} className="bg-sq-black">
                  {s.label}
                </option>
              ))}
            </Select>
          )}
          {tab !== "vehicles" && (
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
          {tab === "vehicles" && (
            <VehiclesSection
              workers={workers}
              vehicles={vehicles}
              onRefresh={refresh}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
          {tab === "fuel" && (
            <FuelSection
              workers={workers}
              vehicles={vehicles}
              items={fuelLogs}
              onRefresh={refresh}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
          {tab === "maintenance" && (
            <MaintenanceSection
              vehicles={vehicles}
              items={maintenanceItems}
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
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
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
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
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

function VehiclesSection({
  workers,
  vehicles,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  workers: WorkerItem[];
  vehicles: VehicleItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<VehicleItem>>({
    status: "available",
    vehicleType: "truck",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.name || !form.plateNumber) {
      onShowError("missing_name_or_plate");
      return;
    }
    const payload = {
      name: form.name,
      plateNumber: form.plateNumber,
      vehicleType: form.vehicleType || "truck",
      brand: form.brand || "",
      modelName: form.modelName || "",
      year: form.year || null,
      color: form.color || "",
      chassisNumber: form.chassisNumber || "",
      engineNumber: form.engineNumber || "",
      status: form.status || "available",
      assignedToId: form.assignedToId || null,
      currentProjectId: form.currentProjectId || null,
      insuranceExpiry: form.insuranceExpiry || null,
      registrationExpiry: form.registrationExpiry || null,
      fuelType: form.fuelType || "",
      tankCapacityLiters: form.tankCapacityLiters ?? null,
      notes: form.notes || "",
    };
    const res = editingId ? await updateVehicle(editingId, payload) : await createVehicle(payload);
    if (res.ok) {
      setForm({ status: "available", vehicleType: "truck" });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteVehicle(id);
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
          <Input
            placeholder="اسم المركبة"
            value={form.name || ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="رقم اللوحة"
            value={form.plateNumber || ""}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
          />
          <Select
            value={form.vehicleType || "truck"}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value as VehicleType })}
          >
            {VEHICLE_TYPES.map((vt) => (
              <option key={vt.value} value={vt.value} className="bg-sq-black">
                {vt.label}
              </option>
            ))}
          </Select>
          <Select
            value={form.status || "available"}
            onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
          >
            {VEHICLE_STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-sq-black">
                {s.label}
              </option>
            ))}
          </Select>
          <Input
            placeholder="الماركة"
            value={form.brand || ""}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
          <Input
            placeholder="الموديل"
            value={form.modelName || ""}
            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
          />
          <Input
            type="number"
            placeholder="السنة"
            value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
          />
          <Input
            placeholder="اللون"
            value={form.color || ""}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
          />
          <Input
            placeholder="رقم الشاسيه"
            value={form.chassisNumber || ""}
            onChange={(e) => setForm({ ...form, chassisNumber: e.target.value })}
          />
          <Input
            placeholder="رقم المحرك"
            value={form.engineNumber || ""}
            onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
          />
          <WorkerSelect
            workers={workers}
            value={form.assignedToId || null}
            onChange={(id) => setForm({ ...form, assignedToId: id || undefined })}
          />
          <Input
            type="number"
            placeholder="رقم المشروع"
            value={form.currentProjectId ?? ""}
            onChange={(e) =>
              setForm({ ...form, currentProjectId: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Input
            type="date"
            value={form.insuranceExpiry || ""}
            onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })}
          />
          <Input
            type="date"
            value={form.registrationExpiry || ""}
            onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })}
          />
          <Input
            placeholder="نوع الوقود"
            value={form.fuelType || ""}
            onChange={(e) => setForm({ ...form, fuelType: e.target.value })}
          />
          <Input
            type="number"
            step="0.1"
            placeholder="سعة الخزان (لتر)"
            value={form.tankCapacityLiters ?? ""}
            onChange={(e) =>
              setForm({ ...form, tankCapacityLiters: e.target.value ? Number(e.target.value) : null })
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
                setForm({ status: "available", vehicleType: "truck" });
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
              <th className="px-4 py-3 text-right">المركبة</th>
              <th className="px-4 py-3 text-right">اللوحة</th>
              <th className="px-4 py-3 text-right">النوع</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">المسؤول</th>
              <th className="px-4 py-3 text-right">المشروع</th>
              <th className="px-4 py-3 text-right">تأمين / ترخيص</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{v.name}</td>
                <td className="px-4 py-3 text-white/80">{v.plateNumber}</td>
                <td className="px-4 py-3 text-white/80">
                  {VEHICLE_TYPES.find((x) => x.value === v.vehicleType)?.label || v.vehicleType}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(v.status)}`}>
                    {statusLabel(v.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/80">{v.assignedToName || "—"}</td>
                <td className="px-4 py-3 text-white/80">{v.currentProjectTitle || "—"}</td>
                <td className="px-4 py-3 text-white/80">
                  {v.insuranceExpiry || "—"} / {v.registrationExpiry || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(v);
                        setEditingId(v.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(v.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-white/60">
                  لا توجد مركبات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    available: "bg-emerald-500/20 text-emerald-300",
    in_use: "bg-blue-500/20 text-blue-300",
    maintenance: "bg-amber-500/20 text-amber-300",
    out_of_service: "bg-red-500/20 text-red-300",
    retired: "bg-slate-500/20 text-slate-300",
  };
  return map[status] || "bg-white/10 text-white/80";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    available: "متاحة",
    in_use: "قيد الاستخدام",
    maintenance: "صيانة",
    out_of_service: "خارج الخدمة",
    retired: "تقاعد",
  };
  return map[status] || status;
}

function FuelSection({
  workers,
  vehicles,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  workers: WorkerItem[];
  vehicles: VehicleItem[];
  items: FuelLogItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<FuelLogItem>>({ date: todayInputValue() });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.vehicleId || !form.date || !form.liters) {
      onShowError("المركبة والتاريخ وعدد اللترات مطلوبة.");
      return;
    }
    const payload = {
      vehicleId: form.vehicleId,
      date: form.date,
      liters: form.liters,
      cost: form.cost ?? 0,
      odometerKm: form.odometerKm ?? null,
      station: form.station || "",
      filledById: form.filledById || null,
      notes: form.notes || "",
    };
    const res = editingId ? await updateFuelLog(editingId, payload) : await createFuelLog(payload);
    if (res.ok) {
      setForm({ date: todayInputValue() });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteFuelLog(id);
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
        <div className="grid md:grid-cols-5 gap-3">
          <Select
            value={form.vehicleId || ""}
            onChange={(e) => setForm({ ...form, vehicleId: Number(e.target.value) || undefined })}
          >
            <option value="" className="bg-sq-black">اختر مركبة</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id} className="bg-sq-black">
                {v.name} ({v.plateNumber})
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="اللترات"
            value={form.liters ?? ""}
            onChange={(e) => setForm({ ...form, liters: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="التكلفة"
            value={form.cost ?? ""}
            onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            placeholder="عداد (كم)"
            value={form.odometerKm ?? ""}
            onChange={(e) =>
              setForm({ ...form, odometerKm: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Input
            placeholder="المحطة"
            value={form.station || ""}
            onChange={(e) => setForm({ ...form, station: e.target.value })}
          />
          <WorkerSelect
            workers={workers}
            value={form.filledById || null}
            onChange={(id) => setForm({ ...form, filledById: id || undefined })}
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
                setForm({ date: todayInputValue() });
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
              <th className="px-4 py-3 text-right">المركبة</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">اللترات</th>
              <th className="px-4 py-3 text-right">التكلفة</th>
              <th className="px-4 py-3 text-right">العداد</th>
              <th className="px-4 py-3 text-right">المحطة</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.vehicleName}</td>
                <td className="px-4 py-3 text-white/70">{it.date}</td>
                <td className="px-4 py-3 text-white/80">{it.liters}</td>
                <td className="px-4 py-3 text-white/80">{it.cost.toFixed(2)}</td>
                <td className="px-4 py-3 text-white/80">{it.odometerKm || "—"}</td>
                <td className="px-4 py-3 text-white/80">{it.station || "—"}</td>
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
                <td colSpan={7} className="px-4 py-8 text-center text-white/60">
                  لا توجد سجلات وقود.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceSection({
  vehicles,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  vehicles: VehicleItem[];
  items: MaintenanceItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<MaintenanceItem>>({
    date: todayInputValue(),
    maintenanceType: "other",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    if (!form.vehicleId || !form.date) {
      onShowError("المركبة والتاريخ مطلوبة.");
      return;
    }
    const payload = {
      vehicleId: form.vehicleId,
      date: form.date,
      maintenanceType: form.maintenanceType || "other",
      description: form.description || "",
      cost: form.cost ?? 0,
      odometerKm: form.odometerKm ?? null,
      nextDueDate: form.nextDueDate || null,
      garage: form.garage || "",
      notes: form.notes || "",
    };
    const res = editingId
      ? await updateMaintenance(editingId, payload)
      : await createMaintenance(payload);
    if (res.ok) {
      setForm({ date: todayInputValue(), maintenanceType: "other" });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteMaintenance(id);
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
        <div className="grid md:grid-cols-5 gap-3">
          <Select
            value={form.vehicleId || ""}
            onChange={(e) => setForm({ ...form, vehicleId: Number(e.target.value) || undefined })}
          >
            <option value="" className="bg-sq-black">اختر مركبة</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id} className="bg-sq-black">
                {v.name} ({v.plateNumber})
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Select
            value={form.maintenanceType || "other"}
            onChange={(e) => setForm({ ...form, maintenanceType: e.target.value as MaintenanceType })}
          >
            {MAINTENANCE_TYPES.map((mt) => (
              <option key={mt.value} value={mt.value} className="bg-sq-black">
                {mt.label}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            step="0.01"
            placeholder="التكلفة"
            value={form.cost ?? ""}
            onChange={(e) => setForm({ ...form, cost: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            placeholder="عداد (كم)"
            value={form.odometerKm ?? ""}
            onChange={(e) =>
              setForm({ ...form, odometerKm: e.target.value ? Number(e.target.value) : null })
            }
          />
          <Input
            type="date"
            placeholder="موعد الصيانة التالية"
            value={form.nextDueDate || ""}
            onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
          />
          <Input
            placeholder="الورشة"
            value={form.garage || ""}
            onChange={(e) => setForm({ ...form, garage: e.target.value })}
          />
        </div>
        <TextArea
          placeholder="الوصف"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
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
                setForm({ date: todayInputValue(), maintenanceType: "other" });
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
              <th className="px-4 py-3 text-right">المركبة</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">النوع</th>
              <th className="px-4 py-3 text-right">الوصف</th>
              <th className="px-4 py-3 text-right">التكلفة</th>
              <th className="px-4 py-3 text-right">موعد لاحق</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.vehicleName}</td>
                <td className="px-4 py-3 text-white/70">{it.date}</td>
                <td className="px-4 py-3 text-white/80">
                  {MAINTENANCE_TYPES.find((x) => x.value === it.maintenanceType)?.label || it.maintenanceType}
                </td>
                <td className="px-4 py-3 text-white/80">{it.description || "—"}</td>
                <td className="px-4 py-3 text-white/80">{it.cost.toFixed(2)}</td>
                <td className="px-4 py-3 text-white/80">{it.nextDueDate || "—"}</td>
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
                <td colSpan={7} className="px-4 py-8 text-center text-white/60">
                  لا توجد سجلات صيانة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
