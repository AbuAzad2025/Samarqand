import Footer from "@/react-app/components/Footer";
import Navigation from "@/react-app/components/Navigation";
import TopBar from "@/react-app/components/TopBar";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";

export type LegalSection = { heading: string; paragraphs: string[] };

export default function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />
      <div className="min-h-[60vh]">
        <section className="bg-[var(--corp-dark)] text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-3">{title}</h1>
            <p className="text-white/80">آخر تحديث: {updated}</p>
          </div>
        </section>
        <section className="py-14">
          <div className="container mx-auto px-4 max-w-4xl">
            <p className="text-lg leading-loose text-gray-700 mb-10">{intro}</p>
            <div className="space-y-8">
              {sections.map((section) => (
                <article
                  key={section.heading}
                  className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm"
                >
                  <h2 className="text-xl font-extrabold text-sq-green mb-4">
                    {section.heading}
                  </h2>
                  <div className="space-y-3">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph.slice(0, 40)}
                        className="leading-loose text-gray-700"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
