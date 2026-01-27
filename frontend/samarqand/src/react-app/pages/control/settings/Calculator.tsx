import { useEffect, useState } from "react";

import {
  fetchAdminCalculatorSettings,
  updateAdminCalculatorSettings,
  type AdminCalculatorSettingsItem,
  type AdminCalculatorSettingsPayload,
} from "@/react-app/api/site";

function groupByCategory(items: AdminCalculatorSettingsItem[]) {
  const map = new Map<string, AdminCalculatorSettingsItem[]>();
  for (const it of items) {
    const cat = (it.category || "أخرى").trim() || "أخرى";
    map.set(cat, [...(map.get(cat) || []), it]);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "ar"));
}

function ensureNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function ControlCalculatorSettings() {
  const [data, setData] = useState<AdminCalculatorSettingsPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    fetchAdminCalculatorSettings()
      .then((payload) => {
        setData({
          ...payload,
          currencyDefault: (payload.currencyDefault as "ILS" | "USD") || "ILS",
          usdToIlsRate: ensureNumber(payload.usdToIlsRate, 3.65),
          laborPercent: ensureNumber(payload.laborPercent, 0.28),
          overheadPercent: ensureNumber(payload.overheadPercent, 0.1),
          profitPercent: ensureNumber(payload.profitPercent, 0.1),
          contingencyPercent: ensureNumber(payload.contingencyPercent, 0.05),
          includeVat: !!payload.includeVat,
          vatPercent: ensureNumber(payload.vatPercent, 0.16),
          items: Array.isArray(payload.items) ? payload.items : [],
        });
      })
      .catch(() => {});
  }, []);

  async function onSave() {
    if (!data) return;
    setSaving(true);
    setStatus("idle");
    try {
      const res = await updateAdminCalculatorSettings(data);
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 1500);
    }
  }

  if (!data) return null;

  function numberInput(
    label: string,
    value: number,
    onChange: (value: number) => void,
    opts?: { step?: string; min?: number; dir?: "ltr" | "rtl" },
  ) {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
        <input
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
          type="number"
          step={opts?.step || "0.01"}
          min={opts?.min}
          dir={opts?.dir || "ltr"}
        />
      </div>
    );
  }

  const usdToIlsRate = ensureNumber(data.usdToIlsRate, 3.65);
  const items = Array.isArray(data.items) ? data.items : [];
  const groups = groupByCategory(items);

  function updateItem(index: number, patch: Partial<AdminCalculatorSettingsItem>) {
    const next = items.slice();
    const curr = next[index];
    if (!curr) return;
    next[index] = { ...curr, ...patch };
    setData((prev) => (prev ? { ...prev, items: next } : prev));
  }

  function removeItem(index: number) {
    const next = items.slice();
    next.splice(index, 1);
    setData((prev) => (prev ? { ...prev, items: next } : prev));
  }

  function addItem(category: string) {
    const key = `custom_${Date.now()}`;
    const next = items.slice();
    next.push({
      key,
      label: "بند جديد",
      category,
      unit: "م²",
      basis: "area_total",
      factor: 1,
      unitPriceIls: 0,
      enabled: true,
    });
    setData((prev) => (prev ? { ...prev, items: next } : prev));
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات الحاسبة</h1>
          <p className="text-gray-600 mt-1">
            جدول كميات تقديري + أسعار السوق (قابل للتعديل).
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>

      {status === "saved" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تم الحفظ.
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر الحفظ.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              العملة الافتراضية
            </label>
            <select
              value={data.currencyDefault}
              onChange={(e) =>
                setData({
                  ...data,
                  currencyDefault: (e.target.value as "ILS" | "USD") || "ILS",
                })
              }
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#007A3D]"
            >
              <option value="ILS">₪ شيكل</option>
              <option value="USD">$ دولار</option>
            </select>
          </div>
          {numberInput("سعر صرف الدولار (1$ = ؟ ₪)", usdToIlsRate, (v) =>
            setData({ ...data, usdToIlsRate: v }),
          )}
          {numberInput("نسبة العمالة", ensureNumber(data.laborPercent, 0.28), (v) =>
            setData({ ...data, laborPercent: v }),
          )}
          {numberInput(
            "مصروفات عامة (Overhead)",
            ensureNumber(data.overheadPercent, 0.1),
            (v) => setData({ ...data, overheadPercent: v }),
          )}
          {numberInput("نسبة الربح", ensureNumber(data.profitPercent, 0.1), (v) =>
            setData({ ...data, profitPercent: v }),
          )}
          {numberInput(
            "احتياطي مخاطر/هدر (Contingency)",
            ensureNumber(data.contingencyPercent, 0.05),
            (v) => setData({ ...data, contingencyPercent: v }),
          )}
          <div className="flex items-center gap-3 pt-8">
            <input
              id="includeVat"
              type="checkbox"
              checked={!!data.includeVat}
              onChange={(e) => setData({ ...data, includeVat: e.target.checked })}
              className="h-4 w-4"
            />
            <label htmlFor="includeVat" className="text-sm font-semibold text-gray-700">
              إضافة ضريبة (VAT)
            </label>
          </div>
          {numberInput(
            "نسبة الضريبة",
            ensureNumber(data.vatPercent, 0.16),
            (v) => setData({ ...data, vatPercent: v }),
            { step: "0.001" },
          )}
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h2 className="text-lg font-bold text-gray-900">بنود جدول الكميات</h2>
            <div className="text-sm text-gray-600">
              سعر الدولار الحالي: 1$ = {usdToIlsRate} ₪
            </div>
          </div>

          <div className="space-y-6">
            {groups.map(([category, groupItems]) => (
              <div key={category} className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gray-50">
                  <div className="font-bold text-gray-800">{category}</div>
                  <button
                    type="button"
                    onClick={() => addItem(category)}
                    className="text-sm font-semibold text-[#007A3D] hover:underline"
                  >
                    إضافة بند
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-600">
                        <th className="text-right font-semibold px-4 py-3">تفعيل</th>
                        <th className="text-right font-semibold px-4 py-3">البند</th>
                        <th className="text-right font-semibold px-4 py-3">الوحدة</th>
                        <th className="text-right font-semibold px-4 py-3">أساس الحساب</th>
                        <th className="text-right font-semibold px-4 py-3">معامل الكمية</th>
                        <th className="text-right font-semibold px-4 py-3">سعر الوحدة (₪)</th>
                        <th className="text-right font-semibold px-4 py-3">سعر الوحدة ($)</th>
                        <th className="text-right font-semibold px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupItems.map((it) => {
                        const index = items.findIndex((x) => x.key === it.key);
                        const unitPriceUsd =
                          usdToIlsRate > 0 ? ensureNumber(it.unitPriceIls, 0) / usdToIlsRate : 0;
                        return (
                          <tr key={it.key} className="border-t border-gray-100">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={!!it.enabled}
                                onChange={(e) => updateItem(index, { enabled: e.target.checked })}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={it.label}
                                onChange={(e) => updateItem(index, { label: e.target.value })}
                                className="w-64 px-3 py-2 rounded-lg border border-gray-200"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={it.unit}
                                onChange={(e) => updateItem(index, { unit: e.target.value })}
                                className="w-24 px-3 py-2 rounded-lg border border-gray-200"
                                dir="rtl"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={it.basis}
                                onChange={(e) =>
                                  updateItem(index, {
                                    basis: (e.target.value as "area_total" | "area_per_floor") || "area_total",
                                  })
                                }
                                className="w-40 px-3 py-2 rounded-lg border border-gray-200"
                              >
                                <option value="area_total">المساحة × الطوابق</option>
                                <option value="area_per_floor">مساحة الطابق</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={it.factor}
                                onChange={(e) => updateItem(index, { factor: Number(e.target.value) })}
                                className="w-28 px-3 py-2 rounded-lg border border-gray-200"
                                type="number"
                                step="0.01"
                                dir="ltr"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={it.unitPriceIls}
                                onChange={(e) =>
                                  updateItem(index, { unitPriceIls: Number(e.target.value) })
                                }
                                className="w-32 px-3 py-2 rounded-lg border border-gray-200"
                                type="number"
                                step="0.01"
                                dir="ltr"
                              />
                            </td>
                            <td className="px-4 py-3" dir="ltr">
                              {unitPriceUsd.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-xs font-semibold text-red-600 hover:underline"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
