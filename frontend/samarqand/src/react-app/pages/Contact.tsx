import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import AIChatbot from "@/react-app/components/AIChatbot";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { fetchCompany, fetchSiteConfig, type CompanyPayload, type SiteConfigPayload } from "@/react-app/api/site";
import { useLocation } from "react-router";
import { groupRfqTemplatesByCategory, RFQ_TEMPLATES, RFQ_TEMPLATES_BY_KEY } from "@/react-app/rfqTemplates";

export default function Contact() {
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const location = useLocation();
  const rfqTemplateKey = useMemo(
    () => new URLSearchParams(location.search).get("rfqTemplate") || "",
    [location.search],
  );
  const [rfqTemplate, setRfqTemplate] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    projectType: "",
    message: "",
  });

  const lastAutoMessageRef = useRef("");
  const groupedRfqTemplates = useMemo(() => groupRfqTemplatesByCategory(RFQ_TEMPLATES), []);
  const selectedRfq = rfqTemplate ? RFQ_TEMPLATES_BY_KEY[rfqTemplate] || null : null;
  const selectedRfqLabel = selectedRfq?.title || "";
  const selectedRfqMessage = selectedRfq?.whatsappMessage || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // إنشاء رسالة واتساب
    const whatsappMessage = `
مرحباً، أريد الاستفسار عن خدماتكم:
الاسم: ${formData.name}
الهاتف: ${formData.phone}
${formData.email ? `البريد الإلكتروني: ${formData.email}` : ''}
نوع المشروع: ${formData.projectType}
${selectedRfqLabel ? `نوع نموذج عرض السعر: ${selectedRfqLabel}` : ''}
التفاصيل: ${formData.message}
    `.trim();

    const digits = ((company?.phone1 || company?.phone2 || "970569953362") as string).replace(/[^\d]/g, "") || "970569953362";
    const whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === "projectType" && value !== "طلب عرض سعر") {
      setRfqTemplate("");
    }
  };

  useEffect(() => {
    fetchSiteConfig().then(setConfig).catch(() => {});
    fetchCompany().then(setCompany).catch(() => {});
  }, []);
  useEffect(() => {
    const canUseRfq = config?.visibility?.showRfqTemplates ?? true;
    if (!canUseRfq) {
      setRfqTemplate("");
      setFormData((prev) => ({
        ...prev,
        projectType: prev.projectType === "طلب عرض سعر" ? "" : prev.projectType,
      }));
      return;
    }
    if (!rfqTemplateKey) return;
    setRfqTemplate(rfqTemplateKey);
  }, [config?.visibility?.showRfqTemplates, rfqTemplateKey]);
  useEffect(() => {
    const canUseRfq = config?.visibility?.showRfqTemplates ?? true;
    if (!canUseRfq) return;
    if (!selectedRfqMessage) return;
    setFormData((prev) => {
      const canReplaceMessage = !prev.message || prev.message === lastAutoMessageRef.current;
      const nextMessage = canReplaceMessage ? selectedRfqMessage : prev.message;
      if (canReplaceMessage) lastAutoMessageRef.current = selectedRfqMessage;
      return {
        ...prev,
        projectType: prev.projectType || "طلب عرض سعر",
        message: nextMessage,
      };
    });
  }, [config?.visibility?.showRfqTemplates, selectedRfqMessage]);
  const v = config?.visibility;
  const canUseRfq = v?.showRfqTemplates ?? true;
  const primaryPhone = (company?.phone1 || company?.phone2 || "").trim();
  const email = (company?.email || "").trim();
  const address = (company?.address || "").trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">تواصل معنا</h1>
          <p className="text-xl max-w-3xl mx-auto">نحن هنا لخدمتك والإجابة على استفساراتك</p>
        </div>
      </section>

      {!(v?.showContact ?? true) ? (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                هذا القسم مخفي حالياً
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                تم إخفاء صفحة التواصل من لوحة التحكم.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Contact Info */}
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-8">معلومات الاتصال</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#4A90E2] to-[#5DADE2] rounded-full flex items-center justify-center flex-shrink-0">
                      <Phone className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">الهاتف</h3>
                      {primaryPhone ? (
                        <a
                          href={`tel:${primaryPhone}`}
                          className="text-gray-600 hover:text-[#4A90E2] transition"
                          dir="ltr"
                        >
                          {primaryPhone}
                        </a>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#4A90E2] to-[#5DADE2] rounded-full flex items-center justify-center flex-shrink-0">
                      <Mail className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">البريد الإلكتروني</h3>
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="text-gray-600 hover:text-[#4A90E2] transition"
                        >
                          {email}
                        </a>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#4A90E2] to-[#5DADE2] rounded-full flex items-center justify-center flex-shrink-0">
                      <MapPin className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">العنوان</h3>
                      <p className="text-gray-600">{address || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 bg-gradient-to-br from-[#4A90E2] to-[#5DADE2] text-white p-8 rounded-lg">
                  <h3 className="text-2xl font-bold mb-4">ساعات العمل</h3>
                  <div className="space-y-2">
                    <p>السبت - الخميس: 8:00 صباحاً - 6:00 مساءً</p>
                    <p>الجمعة: مغلق</p>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-white p-8 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">أرسل لنا رسالة</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">الاسم *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                    placeholder="اسمك الكامل"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">رقم الهاتف *</label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                    placeholder="05xxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">البريد الإلكتروني</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">نوع المشروع *</label>
                  <select
                    name="projectType"
                    required
                    value={formData.projectType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                  >
                    <option value="">اختر نوع المشروع</option>
                    {canUseRfq && <option value="طلب عرض سعر">طلب عرض سعر</option>}
                    <option value="منزل سكني">منزل سكني</option>
                    <option value="فيلا">فيلا</option>
                    <option value="عمارة سكنية">عمارة سكنية</option>
                    <option value="مبنى تجاري">مبنى تجاري</option>
                    <option value="استشارة هندسية">استشارة هندسية</option>
                    <option value="تصميم معماري">تصميم معماري</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                {canUseRfq && formData.projectType === "طلب عرض سعر" ? (
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">نوع نموذج عرض السعر *</label>
                    <select
                      value={rfqTemplate}
                      onChange={(e) => setRfqTemplate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2]"
                      required
                    >
                      <option value="">اختر النموذج</option>
                      {groupedRfqTemplates.map((g) => (
                        <optgroup key={g.category} label={g.category}>
                          {g.templates.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.title}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div>
                  <label className="block text-gray-700 font-semibold mb-2">تفاصيل المشروع *</label>
                  <textarea
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A90E2] resize-none"
                    placeholder="أخبرنا عن مشروعك..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#4A90E2] to-[#5DADE2] text-white py-3 rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  <span>إرسال عبر واتساب</span>
                </button>
              </form>
            </div>
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
