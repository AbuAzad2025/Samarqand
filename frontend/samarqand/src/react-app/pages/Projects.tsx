import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import AIChatbot from "@/react-app/components/AIChatbot";
import { MapPin, Calendar } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchCompany,
  fetchProjects,
  fetchSiteConfig,
  type CompanyPayload,
  type ProjectPayload,
  type SiteConfigPayload,
} from "@/react-app/api/site";

export default function Projects() {
  const [projects, setProjects] = useState<ProjectPayload[]>([]);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);

  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => {});
    fetchCompany().then(setCompany).catch(() => {});
    fetchSiteConfig().then(setConfig).catch(() => {});
  }, []);
  const v = config?.visibility;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">مشاريعنا</h1>
          <p className="text-xl max-w-3xl mx-auto">نفخر بإنجازاتنا ونلتزم بتقديم أفضل الخدمات</p>
        </div>
      </section>

      {/* Projects Grid */}
      {!(v?.showProjects ?? true) ? (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء صفحة المشاريع من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition group">
                <div className="relative h-64 overflow-hidden">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#4A90E2] to-[#5DADE2]" />
                  )}
                  <div className="absolute top-4 right-4 bg-[#4A90E2] text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {project.category}
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-3">{project.title}</h3>
                  <p className="text-gray-600 mb-4">{project.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#4A90E2]" />
                      <span>{project.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-[#4A90E2]" />
                      <span>{project.year}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add More Projects Info */}
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">هل تريد رؤية المزيد من مشاريعنا؟</p>
            <a
              href={
                company?.phone1
                  ? `https://wa.me/${encodeURIComponent(
                      company.phone1.replace(/\D/g, ""),
                    )}?text=${encodeURIComponent("مرحباً، أريد الاستفسار عن مشاريعكم")}`
                  : "/contact"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
            >
              تواصل معنا
            </a>
          </div>
        </div>
      </section>
      )}

      <WhatsAppButton />
      {(v?.showAIChatbot ?? true) && <AIChatbot />}
      <Footer />
    </div>
  );
}
