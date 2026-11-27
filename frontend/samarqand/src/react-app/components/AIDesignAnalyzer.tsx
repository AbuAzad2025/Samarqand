import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Brain,
  Clock,
  DollarSign,
  Lightbulb,
  Package,
} from 'lucide-react';
import { apiFetch, fetchCompany, type CompanyPayload } from '@/react-app/api/site';
import { whatsappUrl } from '@/react-app/utils/whatsapp';

interface AnalysisResult {
  design: string;
  materials: string[];
  estimatedCost: string;
  duration: string;
  tips: string[];
}

const MAX_AREA = 100000;
const MAX_DESCRIPTION_LENGTH = 1000;

// Stable values created once at module load instead of on every render.
const MAX_AREA_LABEL = MAX_AREA.toLocaleString('en-US');
const PROJECT_TYPES = [
  'منزل سكني',
  'بناية تجارية',
  'فيلا',
  'عمارة سكنية',
  'مكتب',
  'مطعم',
  'محل تجاري',
  'مستودع',
];
const EMPTY_STRING_ARRAY: string[] = [];
const ANALYZER_STYLES = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }
`;

function readErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const obj = payload as { error?: { code?: string }; errorCode?: string };
  return obj.error?.code ?? obj.errorCode;
}

export default function AIDesignAnalyzer() {
  const [projectType, setProjectType] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const companyRequested = useRef(false);

  // Company data is only needed for the quote link in the result panel, so
  // request it on first analysis instead of on initial page load.
  useEffect(() => {
    if (!result || companyRequested.current) return;
    companyRequested.current = true;
    fetchCompany().then(setCompany).catch(() => {});
  }, [result]);

  const quoteLink = useMemo(
    () => whatsappUrl(company?.phone1, 'أريد الحصول على عرض سعر دقيق لمشروعي') || '/contact',
    [company],
  );

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectType) {
      setError('يرجى اختيار نوع المشروع.');
      return;
    }
    const areaValue = Number(area);
    if (!area.trim() || !Number.isFinite(areaValue) || areaValue <= 0) {
      setError('يرجى إدخال مساحة صحيحة أكبر من صفر.');
      return;
    }
    if (areaValue > MAX_AREA) {
      setError(`لا يمكن أن تتجاوز المساحة ${MAX_AREA_LABEL} متر مربع.`);
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(`لا يجب أن تتجاوز التفاصيل الإضافية ${MAX_DESCRIPTION_LENGTH} حرفاً.`);
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const response = await apiFetch('/api/ai/analyze-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectType, area: areaValue, description: description.trim() }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const code = readErrorCode(payload);

        if (code === 'ai_not_configured' || response.status === 503) {
          setError(
            'هذا التحليل غير مُفعّل حالياً؛ لم يتم ضبط مفتاح الخدمة بعد. يمكنك التواصل معنا مباشرة لمناقشة مشروعك.',
          );
          return;
        }
        if (code === 'rate_limit' || response.status === 429) {
          setError('تم تجاوز عدد الطلبات المسموح بها. يرجى المحاولة بعد قليل.');
          return;
        }
        setError('تعذّر إكمال التحليل حالياً. يرجى المحاولة لاحقاً.');
        return;
      }

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
    } catch {
      setError('تعذّر إكمال التحليل حالياً. يرجى المحاولة لاحقاً.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white" id="ai-analyzer">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-[var(--corp-green)] mb-6">
            <Brain className="text-white" size={48} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            محلل التصاميم
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            أدخل مواصفات مشروعك للحصول على تحليل أولي منظّم للتكلفة والمدة والمواد
          </p>
          <div className="mt-4">
            <span className="inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
              غير مُفعّل حالياً
            </span>
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Input Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Brain className="text-purple-500" />
                معلومات المشروع
              </h3>

              <form onSubmit={handleAnalyze} className="space-y-6" noValidate>
                <div>
                  <label htmlFor="ada-project-type" className="block text-gray-800 font-semibold mb-2">نوع المشروع</label>
                  <select id="ada-project-type" aria-label="نوع المشروع"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none transition"
                    aria-describedby={error ? 'ada-error' : undefined}
                    required
                  >
                    <option value="">اختر نوع المشروع</option>
                    {PROJECT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ada-area" className="block text-gray-800 font-semibold mb-2">
                    المساحة (متر مربع)
                  </label>
                  <input id="ada-area" aria-label="المساحة (متر مربع)"
                    type="number"
                    inputMode="decimal"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="مثال: 200"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none transition"
                    aria-describedby={`ada-area-hint${error ? ' ada-error' : ''}`}
                    required
                    min="1"
                    max={MAX_AREA}
                    step="0.01"
                  />
                  <p id="ada-area-hint" className="mt-1 text-xs text-gray-600">
                    أدخل قيمة أكبر من صفر ولا تتجاوز {MAX_AREA_LABEL} متر مربع.
                  </p>
                </div>

                <div>
                  <label htmlFor="ada-details" className="block text-gray-800 font-semibold mb-2">
                    تفاصيل إضافية (اختياري)
                  </label>
                  <textarea id="ada-details" aria-label="تفاصيل إضافية (اختياري)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="أخبرنا عن متطلباتك الخاصة، التصميم المفضل، عدد الطوابق، إلخ..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-600 focus:outline-none transition h-32 resize-none"
                    aria-describedby={`ada-details-hint${error ? ' ada-error' : ''}`}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                  />
                  <p id="ada-details-hint" className="mt-1 text-xs text-gray-600">
                    لا تتجاوز {MAX_DESCRIPTION_LENGTH} حرفاً.
                  </p>
                  <p className="mt-1 text-left text-xs text-gray-600" dir="ltr">
                    {description.length} / {MAX_DESCRIPTION_LENGTH}
                  </p>
                </div>

                {error ? (
                  <div id="ada-error" role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="w-full btn-corp-primary font-bold text-lg hover:shadow-xl transition disabled:!opacity-100 disabled:bg-slate-600 flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جارٍ التحليل...
                    </>
                  ) : (
                    <>
                      <Brain size={24} />
                      اطلب التحليل
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Results */}
            <div className="card-corp p-8">
              {!result && !isAnalyzing && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Brain className="text-purple-400 mb-4" size={64} />
                  <p className="text-gray-600 text-lg">
                    أدخل معلومات مشروعك لطلب تحليل أولي منظم
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    هذه الميزة غير مُفعّلة حالياً؛ ستحصل على رسالة واضحة عند المحاولة.
                  </p>
                </div>
              )}

              {!result && !isAnalyzing && error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <AlertCircle className="mb-4 text-red-400" size={64} />
                  <p className="text-gray-700 text-lg font-semibold">لم يتم إنتاج تحليل</p>
                  <p className="mt-2 text-sm text-gray-600">راجع الرسالة أعلاه أو حاول مرة أخرى لاحقاً.</p>
                </div>
              )}

              {isAnalyzing && (
                <div role="status" className="h-full flex flex-col items-center justify-center" aria-busy="true">
                  <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    جارٍ تحليل المعلومات...
                  </p>
                  <p className="text-gray-600 text-sm mt-2">هذا قد يستغرق بضع ثوانٍ</p>
                </div>
              )}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="text-purple-500" size={24} />
                    <h3 className="text-2xl font-bold text-gray-800">نتيجة التحليل</h3>
                  </div>

                  <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                    النتائج تقديرية وليست بديلاً عن الاستشارة الهندسية أو عرض السعر المعتمد.
                  </p>

                  {/* Design */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="text-purple-500" />
                      <h4 className="font-bold text-gray-800">التصميم المقترح</h4>
                    </div>
                    <p className="text-gray-700 text-sm">{result.design}</p>
                  </div>

                  {/* Cost */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="text-green-500" />
                      <h4 className="font-bold text-gray-800">التكلفة التقديرية</h4>
                    </div>
                    <p className="text-gray-700 text-sm font-semibold">{result.estimatedCost}</p>
                  </div>

                  {/* Duration */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="text-sq-green" />
                      <h4 className="font-bold text-gray-800">المدة الزمنية</h4>
                    </div>
                    <p className="text-gray-700 text-sm">{result.duration}</p>
                  </div>

                  {/* Materials */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="text-orange-500" />
                      <h4 className="font-bold text-gray-800">المواد المقترحة</h4>
                    </div>
                    <ul className="text-gray-700 text-sm space-y-1">
                      {(result.materials ?? EMPTY_STRING_ARRAY).map((material, idx) => (
                        <li key={idx}>• {material}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Tips */}
                  {(result.tips ?? EMPTY_STRING_ARRAY).length > 0 && (
                    <div className="bg-white rounded-lg p-4 shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="text-yellow-500" />
                        <h4 className="font-bold text-gray-800">نصائح هندسية</h4>
                      </div>
                      <ul className="text-gray-700 text-sm space-y-1">
                        {(result.tips ?? EMPTY_STRING_ARRAY).map((tip, idx) => (
                          <li key={idx}>💡 {tip}</li>
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
                    احصل على عرض سعر دقيق
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{ANALYZER_STYLES}</style>
    </section>
  );
}
