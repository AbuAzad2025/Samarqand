import { useState } from 'react';
import { Mail, Send } from 'lucide-react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // Send WhatsApp message with email
      const message = `اشتراك جديد في النشرة الإخبارية: ${email}`;
      window.open(`https://wa.me/970569953362?text=${encodeURIComponent(message)}`, '_blank');
      setIsSubmitted(true);
      setEmail('');
      setTimeout(() => setIsSubmitted(false), 3000);
    }
  };

  return (
    <section className="py-16 bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126]">
      <div className="container mx-auto px-4" dir="rtl">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block p-4 bg-white/20 rounded-full mb-6">
            <Mail className="text-white" size={48} />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            اشترك في نشرتنا الإخبارية
          </h2>
          <p className="text-white/90 text-lg mb-8">
            احصل على آخر العروض والنصائح الهندسية مباشرة على بريدك
          </p>

          {isSubmitted ? (
            <div className="bg-green-500 text-white px-6 py-4 rounded-lg font-bold inline-block animate-bounce">
              ✓ شكراً لاشتراكك! سنتواصل معك قريباً
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="أدخل بريدك الإلكتروني"
                className="flex-1 px-6 py-4 rounded-lg text-gray-800 focus:outline-none focus:ring-4 focus:ring-white/50"
              />
              <button
                type="submit"
                className="bg-white text-[#007A3D] px-8 py-4 rounded-lg font-bold hover:bg-gray-100 transition flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span>اشترك الآن</span>
                <Send size={20} />
              </button>
            </form>
          )}

          <p className="text-white/70 text-sm mt-6">
            لن نشارك بريدك مع أي طرف ثالث • يمكنك إلغاء الاشتراك في أي وقت
          </p>
        </div>
      </div>
    </section>
  );
}
