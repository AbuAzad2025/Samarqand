import { useState } from 'react';
import { FileText, Share2, Sparkles, Copy, Check } from 'lucide-react';

export default function AIContentShowcase() {
  const [contentType, setContentType] = useState<'blog' | 'social'>('blog');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);

  const generateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setContent('');

    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: contentType, topic }),
      });

      if (!response.ok) throw new Error('فشل إنشاء المحتوى');

      const data = await response.json();
      setContent(data.content);
    } catch (error) {
      console.error('Content generation error:', error);
      alert('حدث خطأ في إنشاء المحتوى');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-20 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full mb-6">
            <FileText className="text-white" size={48} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            مولّد المحتوى التسويقي بالذكاء الاصطناعي
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            احصل على محتوى احترافي لمدونتك أو وسائل التواصل في ثوانٍ
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Input */}
            <div className="p-8 bg-gradient-to-br from-indigo-500 to-purple-500">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Sparkles size={24} />
                اختر نوع المحتوى
              </h3>

              <div className="space-y-4 mb-6">
                <button
                  onClick={() => setContentType('blog')}
                  className={`w-full p-4 rounded-lg transition-all ${
                    contentType === 'blog'
                      ? 'bg-white text-indigo-600 shadow-lg scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <FileText className="inline-block ml-2" size={20} />
                  <span className="font-bold">مقالة مدونة</span>
                  <p className="text-sm mt-1 opacity-90">مقالة شاملة 300-400 كلمة</p>
                </button>

                <button
                  onClick={() => setContentType('social')}
                  className={`w-full p-4 rounded-lg transition-all ${
                    contentType === 'social'
                      ? 'bg-white text-indigo-600 shadow-lg scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Share2 className="inline-block ml-2" size={20} />
                  <span className="font-bold">منشور وسائل التواصل</span>
                  <p className="text-sm mt-1 opacity-90">منشور جذاب 100-150 كلمة</p>
                </button>
              </div>

              <form onSubmit={generateContent} className="space-y-4">
                <div>
                  <label className="block text-white font-semibold mb-2">
                    الموضوع
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="مثال: أهمية العزل الحراري في المباني"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-white text-indigo-600 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <div className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin ml-2" />
                      جارٍ الإنشاء...
                    </>
                  ) : (
                    <>
                      <Sparkles className="inline-block ml-2" size={20} />
                      إنشاء المحتوى
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Output */}
            <div className="p-8 bg-gray-50">
              {!content && !isGenerating && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Sparkles className="text-indigo-400 mb-4" size={64} />
                  <p className="text-gray-600">
                    اختر نوع المحتوى وأدخل الموضوع للبدء
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="relative">
                    <FileText className="text-indigo-500 animate-pulse" size={80} />
                    <Sparkles className="absolute -top-2 -right-2 text-purple-500 animate-bounce" size={24} />
                  </div>
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    الذكاء الاصطناعي يكتب المحتوى...
                  </p>
                </div>
              )}

              {content && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">المحتوى المُنشأ</h3>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition"
                    >
                      {copied ? (
                        <>
                          <Check size={18} />
                          تم النسخ
                        </>
                      ) : (
                        <>
                          <Copy size={18} />
                          نسخ
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-lg max-h-96 overflow-y-auto">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {content}
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      💡 <strong>نصيحة:</strong> يمكنك تعديل المحتوى حسب احتياجاتك قبل النشر
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
