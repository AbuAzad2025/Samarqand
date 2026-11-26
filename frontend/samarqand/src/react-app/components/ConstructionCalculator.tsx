import { useEffect, useState } from 'react';
import { Calculator, DollarSign, Package, Users, FileText, Download } from 'lucide-react';
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

export default function ConstructionCalculator() {
  const [projectType, setProjectType] = useState('');
  const [area, setArea] = useState('');
  const [floors, setFloors] = useState('1');
  const [currency, setCurrency] = useState<'ILS' | 'USD'>('ILS');
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);

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

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectType || !area) return;

    setIsCalculating(true);
    setResult(null);

    try {
      const response = await apiFetch('/api/calculator/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType,
          area: parseFloat(area),
          floors: parseInt(floors),
          currency,
        }),
      });

      if (!response.ok) throw new Error('فشل في حساب الكميات');

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Calculation error:', error);
      alert('حدث خطأ في حساب الكميات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsCalculating(false);
    }
  };

  const activeCurrency = (result?.summary?.currency || currency) as 'ILS' | 'USD';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-PS', {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: activeCurrency === 'USD' ? 2 : 0,
      maximumFractionDigits: activeCurrency === 'USD' ? 2 : 0,
    }).format(amount || 0);
  };

  const downloadPDF = () => {
    if (!result) return;
    
    // إنشاء محتوى نصي للتقرير
    let content = `تقرير حساب الكميات والتكاليف\n\n`;
    content += `نوع المشروع: ${projectType}\n`;
    content += `المساحة: ${area} متر مربع\n`;
    content += `عدد الطوابق: ${floors}\n\n`;
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
      result.quantities.structural.forEach(item => {
        content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
      });
      
      content += `\nأعمال التشطيبات:\n`;
      result.quantities.finishes.forEach(item => {
        content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
      });
      
      content += `\nمواد أخرى:\n`;
      result.quantities.other.forEach(item => {
        content += `- ${item.item}: ${item.quantity} ${item.unit} × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}\n`;
      });
    }
    
    content += `\n========================================\n`;
    content += `\nالملخص المالي:\n`;
    content += `تكلفة المواد: ${formatCurrency(result.summary.materialsCost)}\n`;
    content += `تكلفة العمالة: ${formatCurrency(result.summary.laborCost)}\n`;
    if (typeof result.summary.overheadCost === 'number') {
      content += `مصروفات عامة: ${formatCurrency(result.summary.overheadCost)}\n`;
    }
    content += `التكلفة الإجمالية: ${formatCurrency(result.summary.totalCost)}\n`;
    
    content += `\nملاحظات:\n`;
    result.notes.forEach((note, idx) => {
      content += `${idx + 1}. ${note}\n`;
    });
    
    // إنشاء وتنزيل الملف
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

  return (
    <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-50" id="calculator">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-6">
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
            <select
              value={currency}
              onChange={(e) => setCurrency((e.target.value as 'ILS' | 'USD') || 'ILS')}
              className="px-4 py-2 rounded-full border border-green-200 bg-white text-green-800 font-semibold"
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

              <form onSubmit={handleCalculate} className="space-y-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">نوع المشروع</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-sq-green focus:outline-none transition"
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
                  <label className="block text-gray-700 font-semibold mb-2">
                    المساحة (متر مربع)
                  </label>
                  <input
                    type="number"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="مثال: 200"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-sq-green focus:outline-none transition"
                    required
                    min="1"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    عدد الطوابق
                  </label>
                  <input
                    type="number"
                    value={floors}
                    onChange={(e) => setFloors(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-sq-green focus:outline-none transition"
                    required
                    min="1"
                    max="20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCalculating}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-lg font-bold text-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
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
              </form>

              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  💡 <strong>ملاحظة:</strong> الحسابات مبنية على أسعار السوق الفلسطيني الحالية وقد تختلف
                  حسب المنطقة والموردين
                </p>
              </div>
            </div>

            {/* Results */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {!result && !isCalculating && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Package className="text-green-400 mb-4" size={64} />
                  <p className="text-gray-600 text-lg">
                    أدخل معلومات المشروع للحصول على حساب دقيق للكميات والتكاليف
                  </p>
                </div>
              )}

              {isCalculating && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="relative">
                    <Calculator className="text-green-500 animate-pulse" size={80} />
                    <DollarSign className="absolute -top-2 -right-2 text-emerald-500 animate-bounce" size={32} />
                  </div>
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    الذكاء الاصطناعي يحسب الكميات...
                  </p>
                </div>
              )}

              {result && (
                <div className="space-y-6 max-h-[600px] overflow-y-auto animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">نتائج الحساب</h3>
                    <button
                      onClick={downloadPDF}
                      className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
                    >
                      <Download size={18} />
                      تنزيل التقرير
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-sq-green via-sq-black to-sq-red text-white p-4 rounded-lg">
                      <Package className="mb-2" size={24} />
                      <p className="text-sm opacity-90">المواد</p>
                      <p className="text-xl font-bold">{formatCurrency(result.summary.materialsCost)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg">
                      <Users className="mb-2" size={24} />
                      <p className="text-sm opacity-90">العمالة</p>
                      <p className="text-xl font-bold">{formatCurrency(result.summary.laborCost)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-4 rounded-lg">
                      <DollarSign className="mb-2" size={24} />
                      <p className="text-sm opacity-90">الإجمالي</p>
                      <p className="text-xl font-bold">{formatCurrency(result.summary.totalCost)}</p>
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
                              <div key={`${item.item}_${idx}`} className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {item.item} ({item.quantity} {item.unit})
                                </span>
                                <span className="font-semibold text-gray-800">
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
                          {result.quantities.structural.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {item.item} ({item.quantity} {item.unit})
                              </span>
                              <span className="font-semibold text-gray-800">
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
                          {result.quantities.finishes.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                {item.item} ({item.quantity} {item.unit})
                              </span>
                              <span className="font-semibold text-gray-800">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {result.quantities.other.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="text-orange-500" size={20} />
                            مواد أخرى
                          </h4>
                          <div className="space-y-2">
                            {result.quantities.other.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-700">
                                  {item.item} ({item.quantity} {item.unit})
                                </span>
                                <span className="font-semibold text-gray-800">
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
                  {result.notes.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h4 className="font-bold text-emerald-900 mb-2">ملاحظات مهمة:</h4>
                      <ul className="space-y-1 text-sm text-emerald-800">
                        {result.notes.map((note, idx) => (
                          <li key={idx}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <a
                    href={quoteLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white text-center py-3 rounded-lg font-bold hover:shadow-lg transition"
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
