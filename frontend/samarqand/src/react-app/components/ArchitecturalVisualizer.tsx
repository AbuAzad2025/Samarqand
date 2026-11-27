import { useEffect, useState } from 'react';
import { AlertCircle, Download, Image, Loader, RefreshCw, Share2 } from 'lucide-react';
import { apiFetch, fetchCompany, type CompanyPayload } from '@/react-app/api/site';
import { whatsappUrl } from '@/react-app/utils/whatsapp';

const MAX_DESCRIPTION_LENGTH = 600;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg'];

type ErrorInfo = { message: string; unavailable: boolean };

function readErrorInfo(status: number, payload: unknown): ErrorInfo {
  const code =
    payload && typeof payload === 'object'
      ? (payload as { error?: { code?: string } }).error?.code
      : undefined;

  if (code === 'ai_not_configured' || status === 503) {
    return {
      unavailable: true,
      message:
        'ميزة التخيل البصري غير مُفعّلة حالياً؛ لم يتم ضبط مفتاح الخدمة بعد. يمكنك مناقشة تصميمك معنا مباشرة عبر الواتساب.',
    };
  }
  if (code === 'forbidden' || status === 403 || code === 'unauthorized' || status === 401) {
    return { unavailable: false, message: 'هذه الأداة متاحة لحسابات الإدارة فقط.' };
  }
  if (code === 'rate_limit' || status === 429) {
    return { unavailable: false, message: 'تم تجاوز عدد الطلبات المسموح بها. يرجى المحاولة بعد قليل.' };
  }
  return {
    unavailable: false,
    message: 'تعذّر تجهيز التصور حالياً. يرجى المحاولة لاحقاً.',
  };
}

export default function ArchitecturalVisualizer() {
  const [projectType, setProjectType] = useState('');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('modern');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(true);

  useEffect(() => {
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  const contactLink =
    whatsappUrl(company?.phone1, 'لدي استفسار عن تصميم مشروعي') || '/contact';

  const projectTypes = [
    'واجهة منزل',
    'واجهة فيلا',
    'واجهة عمارة',
    'واجهة مبنى تجاري',
    'تصميم داخلي',
    'حديقة',
    'مسجد',
    'مدرسة',
  ];

  const styles = [
    { value: 'modern', label: 'عصري حديث', icon: '🏢' },
    { value: 'traditional', label: 'تراثي فلسطيني', icon: '🏛️' },
    { value: 'mediterranean', label: 'متوسطي', icon: '🌊' },
    { value: 'minimalist', label: 'بسيط أنيق', icon: '✨' },
  ];

  const aspectRatios = [
    { value: '1:1', label: 'مربع' },
    { value: '16:9', label: 'عريض' },
    { value: '9:16', label: 'طولي' },
    { value: '4:3', label: 'كلاسيكي' },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectTypes.includes(projectType)) {
      setError('يرجى اختيار نوع مشروع من القائمة.');
      return;
    }
    const trimmed = description.trim();
    if (trimmed.length < MIN_DESCRIPTION_LENGTH) {
      setError(`يرجى كتابة وصف لا يقل عن ${MIN_DESCRIPTION_LENGTH} أحرف.`);
      return;
    }
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      setError(`لا يجب أن يتجاوز الوصف ${MAX_DESCRIPTION_LENGTH} حرفاً.`);
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const response = await apiFetch('/api/images/generate-visualization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType,
          description: trimmed,
          style,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const info = readErrorInfo(response.status, payload);
        setAiUnavailable(info.unavailable);
        setError(info.message);
        return;
      }

      const data = await response.json();
      if (!data?.success || typeof data.image !== 'string' || !data.image.trim()) {
        setError('لم نحصل على نتيجة صالحة. يرجى المحاولة لاحقاً.');
        return;
      }

      const mimeType = ALLOWED_IMAGE_TYPES.includes(data.mimeType)
        ? data.mimeType
        : 'image/png';
      const base64 = data.image.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        setError('الصورة المُرجعة غير صالحة. يرجى المحاولة لاحقاً.');
        return;
      }

      const byteLength = Math.floor((base64.length * 3) / 4);
      if (byteLength > MAX_IMAGE_BYTES) {
        setError('حجم الصورة المُرجعة يتجاوز الحد المسموح. يرجى تقليل تفاصيل الوصف والمحاولة مرة أخرى.');
        return;
      }

      setGeneratedImage(`data:${mimeType};base64,${base64}`);
      setAiUnavailable(false);
    } catch {
      setError('تعذّر تجهيز التصور حالياً. يرجى المحاولة لاحقاً.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;

    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `تصور-${projectType.replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareImage = async () => {
    if (!generatedImage) return;

    try {
      const blob = await fetch(generatedImage).then((r) => r.blob());
      const file = new File([blob], 'visualization.png', { type: blob.type || 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'تصور بصري لمشروع',
          text: 'تصور توضيحي لمشروع مع سمر قند للمقاولات',
          files: [file],
        });
      } else {
        setError('المشاركة غير متاحة على هذا الجهاز. يمكنك تنزيل الصورة بدلاً من ذلك.');
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError('تعذّت المشاركة. يمكنك تنزيل الصورة بدلاً من ذلك.');
    }
  };

  return (
    <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50" id="visualizer">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-[var(--corp-green)] mb-6">
            <Image className="text-white" size={48} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            تخيل مشروعك قبل البناء
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            اطلب تصوراً بصرياً توضيحياً لواجهة مشروعك أو تصميمه الداخلي حسب النوع والطراز الذي تختاره
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                aiUnavailable
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              {aiUnavailable ? 'غير مُفعّل حالياً' : 'متاح الآن'}
            </span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Input Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Image className="text-purple-500" />
                صمم مشروعك
              </h3>

              <form onSubmit={handleGenerate} className="space-y-6">
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
                    وصف المشروع
                  </label>
                  <textarea aria-label="وصف المشروع"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثال: منزل من طابقين بواجهة حجر أبيض، نوافذ كبيرة، حديقة أمامية، موقف سيارات..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition h-32 resize-none"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    required
                  />
                  <p className="mt-1 text-left text-xs text-gray-500" dir="ltr">
                    {description.length} / {MAX_DESCRIPTION_LENGTH}
                  </p>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-3">الطراز المعماري</label>
                  <div className="grid grid-cols-2 gap-3">
                    {styles.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStyle(s.value)}
                        className={`p-3 rounded-lg border-2 transition ${
                          style === s.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <div className="text-2xl mb-1" aria-hidden="true">{s.icon}</div>
                        <div className="text-sm font-semibold text-gray-700">{s.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">نسبة العرض</label>
                  <div className="grid grid-cols-4 gap-2">
                    {aspectRatios.map((ar) => (
                      <button
                        key={ar.value}
                        type="button"
                        onClick={() => setAspectRatio(ar.value)}
                        className={`py-2 rounded-lg border-2 transition text-sm ${
                          aspectRatio === ar.value
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {ar.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error ? (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full btn-corp-primary font-bold text-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader className="animate-spin" size={24} />
                      جارٍ التجهيز...
                    </>
                  ) : (
                    <>
                      <Image size={24} />
                      اطلب التصور
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-900">
                  💡 <strong>نصيحة:</strong> كلما كان الوصف أكثر تفصيلاً، كان التصور التوضيحي أقرب لرؤيتك. الحد الأقصى للوصف {MAX_DESCRIPTION_LENGTH} حرفاً.
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {!generatedImage && !isGenerating && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Image className="text-purple-400 mb-4" size={80} />
                  <p className="text-gray-600 text-lg mb-2">
                    أدخل تفاصيل مشروعك لطلب تصور بصري توضيحي
                  </p>
                  <p className="text-gray-500 text-sm">
                    {aiUnavailable
                      ? 'هذه الميزة غير مُفعّلة حالياً؛ ستحصل على رسالة واضحة عند المحاولة.'
                      : 'ستظهر الصورة هنا بعد تجهيزها.'}
                  </p>
                </div>
              )}

              {!generatedImage && !isGenerating && error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <AlertCircle className="mb-4 text-red-400" size={64} />
                  <p className="text-gray-700 text-lg font-semibold">لم يتم تجهيز أي تصور</p>
                  <p className="mt-2 text-sm text-gray-600">صحّح المدخلات أو أعد المحاولة لاحقاً.</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <RefreshCw size={16} />
                    متابعة التعديل
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="h-full flex flex-col items-center justify-center" aria-busy="true">
                  <div className="w-32 h-32 border-8 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                  <p className="text-gray-700 text-lg font-semibold mt-6">
                    جارٍ تجهيز التصور...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    هذا قد يستغرق بضع ثوانٍ
                  </p>
                </div>
              )}

              {generatedImage && (
                <div className="space-y-4 animate-fade-in">
                  <div className="relative group rounded-xl overflow-hidden shadow-lg">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={generatedImage}
                      alt="تصور بصري توضيحي للمشروع"
                      className="w-full h-auto"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-4">
                      <p className="text-white text-sm">
                        {projectType} - {styles.find((s) => s.value === style)?.label}
                      </p>
                    </div>
                  </div>
                  <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                    هذا تصور توضيحي وليس مخططاً معمارياً معتمداً للتنفيذ.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={downloadImage}
                      className="flex-1 btn-corp-primary font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <Download size={20} />
                      تنزيل الصورة
                    </button>
                    <button
                      onClick={shareImage}
                      className="flex-1 btn-corp-primary font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <Share2 size={20} />
                      مشاركة
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setGeneratedImage(null);
                      setError(null);
                    }}
                    className="w-full border-2 border-purple-500 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition"
                  >
                    طلب تصور جديد
                  </button>

                  <div className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-4">
                    <p className="mb-2 text-sm font-semibold text-purple-800">
                      هل تريد مخططاً معمارياً فعلياً؟
                    </p>
                    <a
                      href={contactLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full btn-corp-primary font-bold hover:shadow-lg transition"
                    >
                      تواصل مع فريقنا
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What to know */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-800 text-center mb-8">
            ما الذي يجب معرفته؟
          </h3>
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-700">
              التصور توضيحي للفكرة فقط، ولا يُعد مخططاً تنفيذياً أو بديلاً عن الاستشارة الهندسية.
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-700">
              تعتمد جودة التصور على دقة وصفك لنوع المشروع والطراز والتفاصيل المطلوبة.
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-800">
              الميزة غير مُفعّلة حالياً حتى يتم ضبط مفتاح الخدمة؛ يمكنك التواصل معنا مباشرة لمناقشة تصميمك.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </section>
  );
}
