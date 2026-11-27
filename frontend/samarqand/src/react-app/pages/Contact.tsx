import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import AIChatbot from "@/react-app/components/AIChatbot";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import {
  fetchCompany,
  fetchSiteConfig,
  submitLead,
  type CompanyPayload,
  type SiteConfigPayload,
} from "@/react-app/api/site";
import { useLocation } from "react-router";
import { groupRfqTemplatesByCategory, RFQ_TEMPLATES, RFQ_TEMPLATES_BY_KEY } from "@/react-app/rfqTemplates";
import { whatsappUrl } from "@/react-app/utils/whatsapp";
import { useSiteContent, heading } from "@/react-app/utils/content";

const QUOTE_TYPE = "طلب عرض سعر";

export default function Contact() {
  const content = useSiteContent();
  const [config, setConfig] = useState<SiteConfigPayload | null>(null);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const location = useLocation();
  const isQuote = location.pathname.startsWith("/request-quote");
  const rfqTemplateKey = useMemo(
    () => new URLSearchParams(location.search).get("rfqTemplate") || "",
    [location.search],
  );
  const [rfqTemplate, setRfqTemplate] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    projectType: isQuote ? QUOTE_TYPE : "",
    message: "",
  });

  const lastAutoMessageRef = useRef("");
  const groupedRfqTemplates = useMemo(() => groupRfqTemplatesByCategory(RFQ_TEMPLATES), []);
  const selectedRfq = rfqTemplate ? RFQ_TEMPLATES_BY_KEY[rfqTemplate] || null : null;
  const selectedRfqLabel = selectedRfq?.title || "";
  const selectedRfqMessage = selectedRfq?.whatsappMessage || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("");

    const saved = await submitLead({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      projectType: formData.projectType,
      message: formData.message,
      source: isQuote ? "quote" : "website",
    });
    setSubmitStatus(
      saved.ok
        ? "تم استلام طلبك، سنتواصل معك قريباً."
        : "تعذر حفظ الطلب، يمكنك المتابعة عبر واتساب.",
    );

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

    const link = whatsappUrl(
      company?.phone1 || company?.phone2,
      whatsappMessage,
    );
    if (link) window.open(link, "_blank");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === "projectType" && value !== QUOTE_TYPE) {
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
        projectType: prev.projectType === QUOTE_TYPE ? "" : prev.projectType,
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
        projectType: prev.projectType || QUOTE_TYPE,
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
      <section className="relative bg-[#0D131D] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {heading(content, isQuote ? "requestQuote" : "contact", isQuote ? "طلب عرض سعر" : "تواصل معنا")}
          </h1>
          <p className="text-xl max-w-3xl mx-auto">
            {isQuote
              ? "أخبرنا بتفاصيل مشروعك وسنرسل لك عرضاً مناسباً"
              : "نحن هنا لمساعدتك والإجابة على استفساراتك"}
          </p>
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Phone className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">الهاتف</h3>
                      {primaryPhone ? (
                        <a
                          href={`tel:${primaryPhone}`}
                          className="text-gray-600 hover:text-sq-green transition"
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Mail className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">البريد الإلكتروني</h3>
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="text-gray-600 hover:text-sq-green transition"
                        >
                          {email}
                        </a>
                      ) : (
                        <div className="text-gray-600">—</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <MapPin className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">العنوان</h3>
                      <p className="text-gray-600">{address || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 bg-gradient-to-br from-sq-green via-sq-black to-sq-red text-white p-8 rounded-lg">
                  <h3 className="text-2xl font-bold mb-4">ساعات العمل</h3>
                  <div className="space-y-2">
                    {content.workingHours.split("|").map((part) => (
                      <p key={part}>{part.trim()}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="bg-white p-8 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">أرسل لنا رسالة</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="block text-gray-700 font-semibold mb-2">الاسم *</label>
                  <input
                    type="text"
                    id="contact-name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green"
                    placeholder="اسمك الكامل"
                  />
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-gray-700 font-semibold mb-2">رقم الهاتف *</label>
                  <input
                    type="tel"
                    id="contact-phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green"
                    placeholder="05xxxxxxxx"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-gray-700 font-semibold mb-2">البريد الإلكتروني</label>
                  <input
                    type="email"
                    id="contact-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="contact-project" className="block text-gray-700 font-semibold mb-2">نوع المشروع *</label>
                  <select
                    id="contact-project"
                    name="projectType"
                    required
                    value={formData.projectType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green"
                  >
                    <option value="">اختر نوع المشروع</option>
                    {canUseRfq && <option value={QUOTE_TYPE}>{QUOTE_TYPE}</option>}
                    {content.projectTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {canUseRfq && formData.projectType === QUOTE_TYPE ? (
                  <div>
                    <label htmlFor="contact-rfq" className="block text-gray-700 font-semibold mb-2">نوع نموذج عرض السعر *</label>
                    <select
                      id="contact-rfq"
                      aria-label="نوع نموذج عرض السعر"
                      value={rfqTemplate}
                      onChange={(e) => setRfqTemplate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green"
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
                  <label htmlFor="contact-message" className="block text-gray-700 font-semibold mb-2">تفاصيل المشروع *</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green resize-none"
                    placeholder="أخبرنا عن مشروعك..."
                  />
                </div>

                {submitStatus ? (
                  <p className="text-sm font-semibold text-sq-green" role="status">
                    {submitStatus}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="btn-corp-primary w-full font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  <span>إرسال الطلب</span>
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
