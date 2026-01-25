export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-[#4A90E2] via-[#5DADE2] to-[#87CEEB] py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=800&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
      <div className="relative max-w-7xl mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-white leading-relaxed drop-shadow-lg">
          نحن نقدم خدماتنا لجميع أنواع المشاريع الهندسية
          <br />
          بما في ذلك البناء والتصميم والتطوير
        </h2>
        <p className="mt-6 text-xl text-white/90 font-medium">
          شريكك الموثوق في تحقيق رؤيتك الهندسية
        </p>
      </div>
    </section>
  );
}
