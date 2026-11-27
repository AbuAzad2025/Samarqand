import { useState } from 'react';
import { AlertCircle, Check, Copy, FileText, Share2 } from 'lucide-react';
import { apiFetch } from '@/react-app/api/site';

const MAX_TOPIC_LENGTH = 200;

function readErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const obj = payload as { error?: { code?: string }; errorCode?: string };
  return obj.error?.code ?? obj.errorCode;
}

export default function AIContentShowcase() {
  const [contentType, setContentType] = useState<'blog' | 'social'>('blog');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCopied(false);

    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError('يرجى إدخال موضوع المحتوى.');
      return;
    }
    if (trimmedTopic.length > MAX_TOPIC_LENGTH) {
      setError(`لا يجب أن يتجاوز الموضوع ${MAX_TOPIC_LENGTH} حرفاً.`);
      return;
    }

    setIsGenerating(true);
    setContent('');

    try {
      const response = await apiFetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: contentType, topic: trimmedTopic }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const code = readErrorCode(payload);

        if (code === 'ai_not_configured' || response.status === 503) {
          setError(
            'مولّد المحتوى غير مُفعّل حالياً؛ لم يتم ضبط مفتاح الخدمة بعد. يمكنك التواصل معنا لطلب المحتوى مباشرة.',
          );
          return;
        }
        if (code === 'rate_limit' || response.status === 429) {
          setError('تم تجاوز عدد الطلبات المسموح بها. يرجى المحاولة بعد قليل.');
          return;
        }
        setError('تعذّر إنشاء المحتوى حالياً. يرجى المحاولة لاحقاً.');
        return;
      }

      const data = await response.json();
      if (typeof data?.content !== 'string' || !data.content.trim()) {
        setError('لم نحصل على محتوى صالح. يرجى المحاولة لاحقاً.');
        return;
      }

      setContent(data.content);
    } catch {
      setError('تعذّر إنشاء المحتوى حالياً. يرجى المحاولة لاحقاً.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذّر نسخ المحتوى. يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  return (
    <section className="section-corp-muted" id="content-generator">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--corp-green)] text-white">
            <FileText className="text-white" size={48} />
          </div>
          <h2 className="mb-4 text-3xl font-bold text-slate-900">
            مولّد المحتوى التسويقي
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            صياغة مسودة لمقالة أو منشور حول موضوع تختاره
          </p>
          <div className="mt-4">
            <span className="inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
              غير مُفعّل حالياً
            </span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-8 bg-gradient-to-br from-indigo-800 to-purple-900">
              <h3 id="acs-type-label" className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <FileText size={24} aria-hidden="true" />
                اختر نوع المحتوى
              </h3>

              <div role="group" aria-labelledby="acs-type-label" className="space-y-4 mb-6">
                <button
                  type="button"
                  aria-pressed={contentType === 'blog'}
                  onClick={() => setContentType('blog')}
                  className={`w-full p-4 rounded-lg transition-all ${
                    contentType === 'blog'
                      ? 'bg-white text-indigo-900 shadow-lg'
                      : 'border border-white/40 bg-indigo-950/50 text-white hover:bg-indigo-950/70'
                  }`}
                >
                  <FileText className="inline-block ml-2" size={20} aria-hidden="true" />
                  <span className="font-bold">مقالة مدونة</span>
                  <span className="mt-1 block text-sm">صياغة نص طويل</span>
                </button>

                <button
                  type="button"
                  aria-pressed={contentType === 'social'}
                  onClick={() => setContentType('social')}
                  className={`w-full p-4 rounded-lg transition-all ${
                    contentType === 'social'
                      ? 'bg-white text-indigo-900 shadow-lg'
                      : 'border border-white/40 bg-indigo-950/50 text-white hover:bg-indigo-950/70'
                  }`}
                >
                  <Share2 className="inline-block ml-2" size={20} aria-hidden="true" />
                  <span className="font-bold">منشور وسائل التواصل</span>
                  <span className="mt-1 block text-sm">صياغة نص قصير</span>
                </button>
              </div>

              <form onSubmit={generateContent} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="acs-topic" className="block text-white font-semibold mb-2">
                    الموضوع
                  </label>
                  <input id="acs-topic" aria-label="الموضوع"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="مثال: أهمية العزل الحراري في المباني"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-white"
                    aria-describedby={`acs-topic-hint${error ? ' acs-error' : ''}`}
                    maxLength={MAX_TOPIC_LENGTH}
                    required
                  />
                  <p id="acs-topic-hint" className="mt-1 text-xs text-indigo-100">
                    أدخل موضوعاً لا يتجاوز {MAX_TOPIC_LENGTH} حرفاً.
                  </p>
                  <p className="mt-1 text-left text-xs text-indigo-100" dir="ltr">
                    {topic.length} / {MAX_TOPIC_LENGTH}
                  </p>
                </div>

                {error ? (
                  <div id="acs-error" role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-relaxed text-red-800">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-white text-indigo-900 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:!opacity-100"
                >
                  {isGenerating ? (
                    <>
                      <div className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin ml-2" />
                      جارٍ التجهيز...
                    </>
                  ) : (
                    'اطلب المحتوى'
                  )}
                </button>
              </form>
            </div>

            {/* Output */}
            <div className="p-8 bg-gray-50">
              {!content && !isGenerating && !error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <FileText className="text-indigo-400 mb-4" size={64} />
                  <p className="text-gray-700">
                    اختر نوع المحتوى وأدخل الموضوع لطلب مسودة
                  </p>
                  <p className="mt-2 text-sm text-gray-600">
                    هذه الميزة غير مُفعّلة حالياً؛ ستحصل على رسالة واضحة عند المحاولة.
                  </p>
                </div>
              )}

              {!content && !isGenerating && error && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <AlertCircle className="mb-4 text-red-400" size={64} />
                  <p className="text-gray-700 text-lg font-semibold">لم يتم إنتاج محتوى</p>
                  <p className="mt-2 text-sm text-gray-600">راجع الرسالة أعلاه أو حاول مرة أخرى لاحقاً.</p>
                </div>
              )}

              {isGenerating && (
                <div role="status" className="h-full flex flex-col items-center justify-center" aria-busy="true">
                  <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    جارٍ تجهيز المحتوى...
                  </p>
                </div>
              )}

              {content && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-800">المسودة</h3>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-lg max-h-96 overflow-y-auto">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {content}
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      💡 <strong>نصيحة:</strong> راجع المسودة وعدّلها حسب احتياجاتك قبل النشر.
                    </p>
                  </div>
                </div>
              )}
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
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </section>
  );
}
