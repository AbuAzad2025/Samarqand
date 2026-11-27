import { useEffect, useState } from 'react';
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
  const [aiUnavailable, setAiUnavailable] = useState(true);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  const quoteLink =
    whatsappUrl(company?.phone1, 'أريد الحصول على عرض سعر دقيق لمشروعي') || '/contact';

  const projectTypes = [
    'منزل سكني',
    'بناية تجارية',
    'فيلا',
    'عمارة سكنية',
    'مكتب',
    'مطعم',
    'محل تجاري',
    'مستودع',
  ];

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
      setError(`لا يمكن أن تتجاوز المساحة ${MAX_AREA.toLocaleString('en-US')} متر مربع.`);
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
          setAiUnavailable(true);
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
      setAiUnavailable(false);
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
            <span
              className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                aiUnavailable
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-emerald-50 text-emerald-800'
              }`}
            >
              {aiUnavailable ? 'غير مُفعّل حالياً' : 'متاح الآن'}
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
                  <label className="block text-gray-700 font-semibold mb-2">نوع المشروع</label>
                  <select aria-label="نوع المشروع"
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition"
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
                  <input aria-label="مساحة المشروع"
                    type="number"
                    inputMode="decimal"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="مثال: 200"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition"
                    required
                    min="1"
                    max={MAX_AREA}
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    تفاصيل إضافية (اختياري)
                  </label>
                  <textarea aria-label="تفاصيل المشروع"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="أخبرنا عن متطلباتك الخاصة، التصميم المفضل، عدد الطوابق، إلخ..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition h-32 resize-none"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                  />
                  <p className="mt-1 text-left text-xs text-gray-500" dir="ltr">
                    {description.length} / {MAX_DESCRIPTION_LENGTH}
                  </p>
                </div>

                {error ? (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="w-full btn-corp-primary font-bold text-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                  <p className="mt-2 text-sm text-gray-500">
                    {aiUnavailable
                      ? 'هذه الميزة غير مُفعّلة حالياً؛ ستحصل على رسالة واضحة عند المحاولة.'
                      : 'ستظهر النتائج هنا بعد تجهيزها.'}
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
                <div className="h-full flex flex-col items-center justify-center" aria-busy="true">
                  <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    جارٍ تحليل المعلومات...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">هذا قد يستغرق بضع ثوانٍ</p>
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
                      {(result.materials ?? []).map((material, idx) => (
                        <li key={idx}>• {material}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Tips */}
                  {(result.tips ?? []).length > 0 && (
                    <div className="bg-white rounded-lg p-4 shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="text-yellow-500" />
                        <h4 className="font-bold text-gray-800">نصائح هندسية</h4>
                      </div>
                      <ul className="text-gray-700 text-sm space-y-1">
                        {(result.tips ?? []).map((tip, idx) => (
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
