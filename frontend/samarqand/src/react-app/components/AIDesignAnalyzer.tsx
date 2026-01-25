import { useState } from 'react';
import { Brain, Sparkles, DollarSign, Clock, Package, Lightbulb } from 'lucide-react';

interface AnalysisResult {
  design: string;
  materials: string[];
  estimatedCost: string;
  duration: string;
  tips: string[];
}

export default function AIDesignAnalyzer() {
  const [projectType, setProjectType] = useState('');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

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
    if (!projectType || !area) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch('/api/ai/analyze-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectType, area, description }),
      });

      if (!response.ok) throw new Error('فشل التحليل');

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('حدث خطأ في التحليل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white" id="ai-analyzer">
      <div className="container mx-auto px-4" dir="rtl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6">
            <Brain className="text-white" size={48} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            محلل التصاميم بالذكاء الاصطناعي
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            احصل على تحليل شامل لمشروعك في ثوانٍ - مدعوم بتقنية Gemini AI
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Sparkles className="text-yellow-500" size={20} />
            <span className="text-sm text-gray-500">تقنية متقدمة • نتائج فورية • توصيات احترافية</span>
            <Sparkles className="text-yellow-500" size={20} />
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

              <form onSubmit={handleAnalyze} className="space-y-6">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">نوع المشروع</label>
                  <select
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
                  <input
                    type="number"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="مثال: 200"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition"
                    required
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    تفاصيل إضافية (اختياري)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="أخبرنا عن متطلباتك الخاصة، التصميم المفضل، عدد الطوابق، إلخ..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition h-32 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-lg font-bold text-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جارٍ التحليل...
                    </>
                  ) : (
                    <>
                      <Brain size={24} />
                      تحليل بالذكاء الاصطناعي
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Results */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-8">
              {!result && !isAnalyzing && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Sparkles className="text-purple-400 mb-4" size={64} />
                  <p className="text-gray-600 text-lg">
                    أدخل معلومات مشروعك للحصول على تحليل شامل بالذكاء الاصطناعي
                  </p>
                </div>
              )}

              {isAnalyzing && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="relative">
                    <Brain className="text-purple-500 animate-pulse" size={80} />
                    <Sparkles className="absolute -top-2 -right-2 text-yellow-500 animate-bounce" size={24} />
                  </div>
                  <p className="text-gray-700 text-lg mt-6 font-semibold">
                    الذكاء الاصطناعي يحلل مشروعك...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">هذا قد يستغرق بضع ثوانٍ</p>
                </div>
              )}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="text-purple-500" size={24} />
                    <h3 className="text-2xl font-bold text-gray-800">نتائج التحليل</h3>
                  </div>

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
                      <Clock className="text-blue-500" />
                      <h4 className="font-bold text-gray-800">المدة الزمنية</h4>
                    </div>
                    <p className="text-gray-700 text-sm">{result.duration}</p>
                  </div>

                  {/* Materials */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="text-orange-500" />
                      <h4 className="font-bold text-gray-800">المواد الموصى بها</h4>
                    </div>
                    <ul className="text-gray-700 text-sm space-y-1">
                      {result.materials.map((material, idx) => (
                        <li key={idx}>• {material}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Tips */}
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="text-yellow-500" />
                      <h4 className="font-bold text-gray-800">نصائح هندسية</h4>
                    </div>
                    <ul className="text-gray-700 text-sm space-y-1">
                      {result.tips.map((tip, idx) => (
                        <li key={idx}>💡 {tip}</li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href="https://wa.me/970569953362?text=أريد الحصول على عرض سعر دقيق لمشروعي"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white text-center py-3 rounded-lg font-bold hover:shadow-lg transition"
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
