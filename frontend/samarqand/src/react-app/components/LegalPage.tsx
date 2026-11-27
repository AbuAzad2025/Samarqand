import { Printer } from "lucide-react";
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
  updated?: string;
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
            {updated ? (
              <p className="text-white/80">آخر تحديث: {updated}</p>
            ) : null}
          </div>
        </section>

        <section className="py-14">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="legal-actions mb-8 flex justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="legal-print-button inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50 transition"
              >
                <Printer size={18} aria-hidden="true" />
                طباعة الصفحة
              </button>
            </div>

            <p className="text-lg leading-loose text-gray-700 mb-10">{intro}</p>

            {sections.length > 1 ? (
              <nav
                aria-label="محتويات الصفحة"
                className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-lg font-extrabold text-gray-800 mb-4">
                  محتويات الصفحة
                </h2>
                <ol className="grid gap-2 md:grid-cols-2">
                  {sections.map((section, index) => (
                    <li key={section.heading}>
                      <a
                        href={`#legal-section-${index}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1 text-gray-700 hover:bg-gray-50 hover:text-sq-green transition"
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--corp-green-soft)] text-xs font-bold text-sq-green"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <div className="space-y-8">
              {sections.map((section, index) => (
                <article
                  key={section.heading}
                  id={`legal-section-${index}`}
                  aria-labelledby={`legal-heading-${index}`}
                  className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm"
                >
                  <h2
                    id={`legal-heading-${index}`}
                    className="text-xl font-extrabold text-sq-green mb-4"
                  >
                    <span className="me-2 text-gray-400" aria-hidden="true">
                      {index + 1}.
                    </span>
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
