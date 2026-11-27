import { useEffect, useState } from 'react';
import { Image, Sparkles, Download, Share2, Loader } from 'lucide-react';
import { apiFetch, fetchCompany, type CompanyPayload } from '@/react-app/api/site';
import { whatsappUrl } from '@/react-app/utils/whatsapp';

export default function ArchitecturalVisualizer() {
  const [projectType, setProjectType] = useState('');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('modern');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);

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
    if (!projectType || !description) return;

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const response = await apiFetch('/api/images/generate-visualization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType,
          description,
          style,
          aspectRatio,
        }),
      });

      if (!response.ok) throw new Error('فشل في توليد الصورة');

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'فشل في توليد الصورة');
      }

      // تحويل base64 إلى data URI
      const dataUri = `data:${data.mimeType};base64,${data.image}`;
      setGeneratedImage(dataUri);
    } catch (error) {
      console.error('Image generation error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'حدث خطأ في توليد الصورة. يرجى المحاولة مرة أخرى.';
      alert(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;

    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `تصميم-${projectType.replace(/\s+/g, '-')}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareImage = async () => {
    if (!generatedImage) return;

    try {
      const blob = await fetch(generatedImage).then(r => r.blob());
      const file = new File([blob], 'design.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'تصميم معماري',
          text: `شاهد هذا التصميم المعماري الرائع من شركة سمر قند للمقاولات`,
          files: [file],
        });
      } else {
        // نسخ الرابط إذا لم تكن المشاركة متاحة
        alert('تم نسخ الصورة. يمكنك مشاركتها الآن!');
      }
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-[var(--corp-green)] mb-6">
            <Image className="text-white" size={48} />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            تخيل مشروعك قبل البناء
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            شاهد تصميماً واقعياً لمشروعك بالذكاء الاصطناعي - واجهات معمارية احترافية في ثوانٍ
          </p>
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className="inline-flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-full">
              <Sparkles className="text-purple-600" size={20} />
              <span className="text-purple-800 font-semibold">مدعوم بـ Gemini AI</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-pink-100 px-4 py-2 rounded-full">
              <Image className="text-pink-600" size={20} />
              <span className="text-pink-800 font-semibold">جودة فائقة</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Input Form */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Sparkles className="text-purple-500" />
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
                    required
                  />
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
                        <div className="text-2xl mb-1">{s.icon}</div>
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

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full btn-corp-primary font-bold text-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader className="animate-spin" size={24} />
                      جارٍ التوليد...
                    </>
                  ) : (
                    <>
                      <Sparkles size={24} />
                      ولّد التصميم
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-900">
                  💡 <strong>نصيحة:</strong> كلما كان الوصف أكثر تفصيلاً، كان التصميم أدق وأقرب لرؤيتك
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {!generatedImage && !isGenerating && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="relative">
                    <Image className="text-purple-400 mb-4" size={80} />
                    <Sparkles className="absolute -top-2 -right-2 text-pink-400 animate-pulse" size={32} />
                  </div>
                  <p className="text-gray-600 text-lg mb-2">
                    أدخل تفاصيل مشروعك لتوليد تصميم معماري واقعي
                  </p>
                  <p className="text-gray-500 text-sm">
                    تقنية Gemini AI تحول أفكارك إلى تصاميم مرئية
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="relative mb-6">
                    <div className="w-32 h-32 border-8 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500" size={40} />
                  </div>
                  <p className="text-gray-700 text-lg font-semibold mb-2">
                    الذكاء الاصطناعي يرسم مشروعك...
                  </p>
                  <p className="text-gray-500 text-sm">
                    هذا قد يستغرق 10-20 ثانية
                  </p>
                  <div className="mt-6 flex gap-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {generatedImage && (
                <div className="space-y-4 animate-fade-in">
                  <div className="relative group rounded-xl overflow-hidden shadow-lg">
                    <img loading="lazy" decoding="async"                       src={generatedImage}
                      alt="تصميم معماري"
                      className="w-full h-auto"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-4">
                      <p className="text-white text-sm">
                        {projectType} - {styles.find(s => s.value === style)?.label}
                      </p>
                    </div>
                  </div>

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
                    onClick={() => setGeneratedImage(null)}
                    className="w-full border-2 border-purple-500 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition"
                  >
                    ولّد تصميماً جديداً
                  </button>

                  <div className="rounded-xl border border-[var(--corp-border)] bg-[var(--corp-surface)] p-4">
                    <p className="text-sm text-purple-800 font-semibold mb-2">
                      ⭐ راضٍ عن التصميم؟
                    </p>
                    <a
                      href={contactLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full btn-corp-primary w-full font-bold hover:shadow-lg transition"
                    >
                      احجز استشارة مجانية
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Examples Gallery */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-gray-800 text-center mb-8">
            أمثلة على التصاميم الممكنة
          </h3>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { label: 'واجهة عصرية', emoji: '🏢' },
              { label: 'طراز تراثي', emoji: '🏛️' },
              { label: 'فيلا فاخرة', emoji: '🏰' },
              { label: 'تصميم بسيط', emoji: '✨' },
            ].map((ex, idx) => (
              <div
                key={idx}
                className="card-corp p-6 text-center hover:scale-105 transition cursor-pointer"
              >
                <div className="text-5xl mb-3">{ex.emoji}</div>
                <p className="font-semibold text-gray-700">{ex.label}</p>
              </div>
            ))}
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
