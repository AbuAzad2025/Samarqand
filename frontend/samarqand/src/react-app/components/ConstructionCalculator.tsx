import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Check,
  Copy,
  DollarSign,
  Download,
  FileText,
  Package,
  RefreshCw,
  Users,
} from 'lucide-react';
import { apiFetch, fetchCompany, type CompanyPayload } from '@/react-app/api/site';
import { whatsappUrl } from '@/react-app/utils/whatsapp';

type LineItem = { item: string; quantity: number; unit: string; unitPrice: number; total: number };

interface CalculationResult {
  boq?: {
    currency: string;
    usdToIlsRate: number;
    areaPerFloor: number;
    floors: number;
    areaTotal: number;
    sections: Array<{ label: string; items: LineItem[] }>;
  };
  quantities: {
    structural: LineItem[];
    finishes: LineItem[];
    other: LineItem[];
  };
  summary: {
    materialsCost: number;
    laborCost: number;
    overheadCost?: number;
    contingencyCost?: number;
    profitCost?: number;
    vatCost?: number;
    totalCost: number;
    currency: string;
  };
  notes: string[];
}

const MAX_AREA = 100000;
const MAX_FLOORS = 20;

export default function ConstructionCalculator() {
  const [projectType, setProjectType] = useState('');
  const [area, setArea] = useState('');
  const [floors, setFloors] = useState('1');
  const [currency, setCurrency] = useState<'ILS' | 'USD'>('ILS');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  const quoteLink =
    whatsappUrl(company?.phone1, 'أريد الحصول على عرض سعر دقيق لمشروعي') || '/contact';

  const projectTypes = [
    'منزل سكني',
    'فيلا',
    'عمارة سكنية',
    'مبنى تجاري',
    'محل تجاري',
    'مكتب',
    'مستودع',
    'مسجد',
  ];

  const validateInputs = (): string | null => {
    if (!projectType) return 'يرجى اختيار نوع المشروع.';
    const areaValue = Number(area);
    if (!area.trim() || !Number.isFinite(areaValue) || areaValue <= 0) {
      return 'يرجى إدخال مساحة صحيحة أكبر من صفر.';
    }
    if (areaValue > MAX_AREA) {
      return `لا يمكن أن تتجاوز المساحة ${MAX_AREA.toLocaleString('en-US')} متر مربع.`;
    }
    const floorsValue = Number(floors);
    if (!Number.isInteger(floorsValue) || floorsValue < 1 || floorsValue > MAX_FLOORS) {
      return `عدد الطوابق يجب أن يكون رقماً صحيحاً بين 1 و ${MAX_FLOORS}.`;
    }
    return null;
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCopied(false);

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCalculating(true);
    setResult(null);

    try {
      const response = await apiFetch('/api/calculator/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType,
          area: Number(area),
          floors: Number(floors),
          currency,
        }),
      });

      if (!response.ok) {
        throw new Error('تعذّر إكمال الحساب حالياً. يرجى المحاولة لاحقاً أو التواصل معنا.');
      }

      const data = (await response.json()) as CalculationResult;
      setResult(data);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : 'تعذّر إكمال الحساب حالياً. يرجى المحاولة لاحقاً أو التواصل معنا.',
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const resetForm = () => {
    setProjectType('');
    setArea('');
    setFloors('1');
    setCurrency('ILS');
    setResult(null);
    setError(null);
    setCopied(false);
    setIsCalculating(false);
  };

  const activeCurrency = (result?.summary?.currency || currency) as 'ILS' | 'USD';
  const currencyUnitLabel = activeCurrency === 'ILS' ? 'شيكل فلسطيني (₪)' : 'دولار أمريكي ($)';
  const formatCurrency = (amount: number) => {
    if (!Number.isFinite(amount)) return 'غير متوفر';
    return new Intl.NumberFormat('ar-PS', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: activeCurrency === 'USD' ? 2 : 0,
      maximumFractionDigits: activeCurrency === 'USD' ? 2 : 0,
    }).format(amount);
  };

  const buildReport = () => {
    if (!result) return '';
    let content = `تقرير حساب الكميات والتكاليف\n\n`;
    content += `نوع المشروع: ${projectType}\n`;
    content += `المساحة: ${area} متر مربع\n`;
    content += `عدد الطوابق: ${floors}\n`;
    content += `العملة: ${currencyUnitLabel}\n\n`;
    content += `========================================\n\n`;

    if (result.boq?.sections?.length) {
      result.boq.sections.forEach((sec) => {
        content += `${sec.label}:\n`;
        sec.items.forEach((item) => {
          content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
        });
        content += `\n`;
      });
    } else {
      content += `الأعمال الإنشائية:\n`;
      (result.quantities?.structural ?? []).forEach((item) => {
        content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
      });

      content += `\nأعمال التشطيبات:\n`;
      (result.quantities?.finishes ?? []).forEach((item) => {
        content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
      });

      content += `\nمواد أخرى:\n`;
      (result.quantities?.other ?? []).forEach((item) => {
        content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
      });
    }

    content += `\n========================================\n`;
    content += `\nالملخص المالي (${currencyUnitLabel}):\n`;
    content += `تكلفة المواد: ${formatCurrency(result.summary.materialsCost)}\n`;
    content += `تكلفة العمالة: ${formatCurrency(result.summary.laborCost)}\n`;
    if (typeof result.summary.overheadCost === 'number') {
      content += `مصروفات عامة: ${formatCurrency(result.summary.overheadCost)}\n`;
    }
    content += `التكلفة الإجمالية: ${formatCurrency(result.summary.totalCost)}\n`;

    const notes = result.notes ?? [];
    if (notes.length) {
      content += `\nملاحظات:\n`;
      notes.forEach((note, idx) => {
        content += `${idx + 1}. ${note}\n`;
      });
    }

    return content;
  };

  const downloadReport = () => {
    const content = buildReport();
    if (!content) return;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير-كميات-${projectType.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyResult = async () => {
    const content = buildReport();
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذّر نسخ النتيجة. يمكنك تنزيل التقرير بدلاً من ذلك.');
    }
  };

  const areaInvalid = Boolean(error && error.includes('مساحة'));
  const floorsInvalid = Boolean(error && error.includes('الطوابق'));
  const projectInvalid = Boolean(error && error.includes('نوع المشروع'));

  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--corp-green)] text-white mb-6">
            <Calculator className="text-white" size={48} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            حاسبة الكميات والتكاليف
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            احصل على حساب تقديري للكميات والتكاليف مبني على معاملات قابلة للتعديل من لوحة التحكم
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-full">
              <DollarSign className="text-green-600" size={20} />
              <span className="text-green-800 font-semibold">
                {currency === 'ILS' ? 'الأسعار بالشيكل (₪)' : 'الأسعار بالدولار ($)'}
              </span>
            </div>
            <label htmlFor="cc-currency" className="sr-only">العملة</label>
            <select id="cc-currency" aria-label="العملة"
              value={currency}
              onChange={(e) => setCurrency((e.target.value as 'ILS' | 'USD') || 'ILS')}
              className="px-4 py-2 rounded-full border border-green-300 bg-white text-green-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--corp-green)]"
              dir="rtl"
            >
              <option value="ILS">₪ شيكل</option>
              <option value="USD">$ دولار</option>
            </select>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Input Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FileText className="text-green-500" />
                معلومات المشروع
              </h3>

              <form onSubmit={handleCalculate} className="space-y-6" noValidate>
                <div>
                  <label htmlFor="cc-project-type" className="block text-gray-800 font-semibold mb-2">نوع المشروع</label>
                  <select id="cc-project-type" aria-label="نوع المشروع"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:border-sq-green focus:outline-none transition ${
                      projectInvalid ? 'border-red-500' : 'border-gray-300'
                    }`}
                    aria-invalid={projectInvalid}
                    aria-describedby={projectInvalid ? 'cc-error' : undefined}
                    required
                  >
                    <option value="">اختر نوع المشروع</option>
                    {projectTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cc-area" className="block text-gray-800 font-semibold mb-2">
                    المساحة (متر مربع)
                  </label>
                  <input id="cc-area" aria-label="المساحة (متر مربع)"
                    type="number"
                    inputMode="decimal"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="مثال: 200"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:border-sq-green focus:outline-none transition ${
                      areaInvalid ? 'border-red-500' : 'border-gray-300'
                    }`}
                    aria-invalid={areaInvalid}
                    aria-describedby={`cc-area-hint${areaInvalid ? ' cc-error' : ''}`}
                    required
                    min="1"
                    max={MAX_AREA}
                    step="0.01"
                  />
                  <p id="cc-area-hint" className="mt-1 text-xs text-gray-600">
                    أدخل قيمة أكبر من صفر ولا تتجاوز {MAX_AREA.toLocaleString('en-US')} متر مربع.
                  </p>
                </div>

                <div>
                  <label htmlFor="cc-floors" className="block text-gray-800 font-semibold mb-2">
                    عدد الطوابق
                  </label>
                  <input id="cc-floors" aria-label="عدد الطوابق"
                    type="number"
                    inputMode="numeric"
                    value={floors}
                    onChange={(e) => setFloors(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:border-sq-green focus:outline-none transition ${
                      floorsInvalid ? 'border-red-500' : 'border-gray-300'
                    }`}
                    aria-invalid={floorsInvalid}
                    aria-describedby={`cc-floors-hint${floorsInvalid ? ' cc-error' : ''}`}
                    required
                    min="1"
                    max={MAX_FLOORS}
                    step="1"
                  />
                  <p id="cc-floors-hint" className="mt-1 text-xs text-gray-600">
                    عدد صحيح من 1 إلى {MAX_FLOORS}.
                  </p>
                </div>

                {error ? (
                  <div id="cc-error" role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isCalculating}
                    className="btn-corp-primary flex-1 font-bold text-lg hover:shadow-xl transition disabled:!opacity-100 disabled:bg-slate-600 flex items-center justify-center gap-2"
                  >
                    {isCalculating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جارٍ الحساب...
                      </>
                    ) : (
                      <>
                        <Calculator size={24} />
                        احسب الكميات والتكاليف
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-200 px-6 py-3 font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    <RefreshCw size={20} />
                    إعادة تعيين
                  </button>
                </div>
              </form>

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  💡 <strong>ملاحظة:</strong> الحسابات تقديرية مبنية على معاملات السوق الفلسطيني وقد تختلف
                  حسب المنطقة والموردين. النتيجة ليست عرض سعر نهائي.
                </p>
              </div>
            </div>

            {/* Results */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {!result && !isCalculating && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Package className="text-green-400 mb-4" size={64} />
                  <p className="text-gray-600 text-lg">
                    أدخل معلومات المشروع للحصول على حساب تقديري للكميات والتكاليف
                  </p>
                  <p className="mt-2 text-sm text-gray-600">ستظهر النتائج هنا مع بيان العملة والوحدات.</p>
                </div>
              )}

              {!result && !isCalculating && error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <AlertCircle className="mb-4 text-red-400" size={64} />
                  <p className="text-gray-600 text-lg">لم يتم إنتاج نتائج بعد.</p>
                  <p className="mt-2 text-sm text-gray-600">صحّح المدخلات أو أعد المحاولة.</p>
                </div>
              )}

              {isCalculating && (
                <div role="status" className="h-full flex flex-col items-center justify-center" aria-busy="true">
                  <div className="relative">
                    <Calculator className="text-green-500 animate-pulse" size={80} />
                    <DollarSign className="absolute -top-2 -right-2 text-emerald-500 animate-bounce" size={32} />
                  </div>
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    جارٍ حساب الكميات والتكاليف...
                  </p>
                </div>
              )}

              {result && (
                <div className="space-y-6 max-h-[600px] overflow-y-auto animate-fade-in">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">نتائج الحساب</h3>
                      <p className="mt-1 text-sm text-gray-700">جميع المبالغ بـ {currencyUnitLabel}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={copyResult}
                        className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-2 font-semibold text-green-700 transition hover:bg-green-50"
                      >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'تم النسخ' : 'نسخ النتيجة'}
                      </button>
                      <button
                        type="button"
                        onClick={downloadReport}
                        className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
                      >
                        <Download size={18} />
                        تنزيل التقرير
                      </button>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="card-corp p-4 text-gray-800">
                      <Package className="mb-2 text-[var(--corp-green)]" size={24} />
                      <p className="text-sm text-gray-700">المواد</p>
                      <p className="text-xl font-bold">{formatCurrency(result.summary.materialsCost)}</p>
                      <p className="mt-1 text-xs text-gray-600">{currencyUnitLabel}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--corp-green-soft)] p-4 text-green-900">
                      <Users className="mb-2" size={24} />
                      <p className="text-sm">العمالة</p>
                      <p className="text-xl font-bold">{formatCurrency(result.summary.laborCost)}</p>
                      <p className="mt-1 text-xs">{currencyUnitLabel}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--corp-green-soft)] p-4 text-green-900">
                      <DollarSign className="mb-2" size={24} />
                      <p className="text-sm">الإجمالي</p>
                      <p className="text-xl font-bold">{formatCurrency(result.summary.totalCost)}</p>
                      <p className="mt-1 text-xs">{currencyUnitLabel}</p>
                    </div>
                  </div>

                  {result.boq?.sections?.length ? (
                    <div className="space-y-4">
                      {result.boq.sections.map((sec) => (
                        <div key={sec.label} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="text-sq-green" size={20} />
                            {sec.label}
                          </h4>
                          <div className="space-y-2">
                            {sec.items.map((item, idx) => (
                              <div key={`${item.item}_${idx}`} className="flex justify-between gap-3 text-sm">
                                <span className="text-gray-700">
                                  {item.item} ({item.quantity} {item.unit})
                                </span>
                                <span className="flex-shrink-0 font-semibold text-gray-800">
                                  {formatCurrency(item.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <Package className="text-sq-green" size={20} />
                          الأعمال الإنشائية
                        </h4>
                        <div className="space-y-2">
                          {(result.quantities?.structural ?? []).map((item, idx) => (
                            <div key={idx} className="flex justify-between gap-3 text-sm">
                              <span className="text-gray-700">
                                {item.item} ({item.quantity} {item.unit})
                              </span>
                              <span className="flex-shrink-0 font-semibold text-gray-800">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <Package className="text-purple-500" size={20} />
                          أعمال التشطيبات
                        </h4>
                        <div className="space-y-2">
                          {(result.quantities?.finishes ?? []).map((item, idx) => (
                            <div key={idx} className="flex justify-between gap-3 text-sm">
                              <span className="text-gray-700">
                                {item.item} ({item.quantity} {item.unit})
                              </span>
                              <span className="flex-shrink-0 font-semibold text-gray-800">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {(result.quantities?.other?.length ?? 0) > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="text-orange-500" size={20} />
                            مواد أخرى
                          </h4>
                          <div className="space-y-2">
                            {(result.quantities?.other ?? []).map((item, idx) => (
                              <div key={idx} className="flex justify-between gap-3 text-sm">
                                <span className="text-gray-700">
                                  {item.item} ({item.quantity} {item.unit})
                                </span>
                                <span className="flex-shrink-0 font-semibold text-gray-800">
                                  {formatCurrency(item.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Notes */}
                  {(result.notes ?? []).length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h4 className="font-bold text-emerald-900 mb-2">ملاحظات مهمة:</h4>
                      <ul className="space-y-1 text-sm text-emerald-800">
                        {(result.notes ?? []).map((note, idx) => (
                          <li key={idx}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <a
                    href={quoteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full btn-corp-primary font-bold hover:shadow-lg transition"
                  >
                    احصل على عرض سعر نهائي
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </section>
  );
}
