import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import TopBar from "@/react-app/components/TopBar";
import Navigation from "@/react-app/components/Navigation";
import WhatsAppButton from "@/react-app/components/WhatsAppButton";
import Footer from "@/react-app/components/Footer";
import AIChatbot from "@/react-app/components/AIChatbot";
import {
  fetchCompany,
  fetchSiteConfig,
  submitLead,
  type CompanyPayload,
  type SiteConfigPayload,
} from "@/react-app/api/site";
import {
  groupRfqTemplatesByCategory,
  RFQ_TEMPLATES,
  RFQ_TEMPLATES_BY_KEY,
} from "@/react-app/rfqTemplates";
import { whatsappUrl } from "@/react-app/utils/whatsapp";
import { useSiteContent, heading } from "@/react-app/utils/content";

const QUOTE_TYPE = "طلب عرض سعر";

type FieldKey =
  | "name"
  | "phone"
  | "email"
  | "projectType"
  | "rfqTemplate"
  | "message";
type FormErrors = Partial<Record<FieldKey, string>>;
type SubmitStatus = { kind: "success" | "error"; text: string } | null;

type FormValues = {
  name: string;
  phone: string;
  email: string;
  projectType: string;
  message: string;
};

/** Client-side checks with human-readable Arabic messages. */
function validateForm(
  values: FormValues,
  canUseRfq: boolean,
  rfqTemplate: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) {
    errors.name = "يرجى كتابة الاسم الكامل.";
  }

  const phone = values.phone.trim();
  if (!phone) {
    errors.phone = "يرجى كتابة رقم الهاتف.";
  } else if (!/^[\d+\-\s()٠-٩۰-۹]{7,20}$/.test(phone)) {
    errors.phone = "رقم الهاتف غير صالح. استخدم الأرقام و+ و- والمسافات فقط.";
  }

  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "يرجى كتابة بريد إلكتروني صحيح.";
  }

  if (!values.projectType) {
    errors.projectType = "يرجى اختيار نوع المشروع.";
  }

  if (canUseRfq && values.projectType === QUOTE_TYPE && !rfqTemplate) {
    errors.rfqTemplate = "يرجى اختيار نموذج عرض السعر الأنسب لطلبك.";
  }

  if (!values.message.trim()) {
    errors.message = "يرجى كتابة تفاصيل المشروع.";
  }

  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-red-600">
      {message}
    </p>
  );
}

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
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormValues>({
    name: "",
    phone: "",
    email: "",
    projectType: isQuote ? QUOTE_TYPE : "",
    message: "",
  });

  const lastAutoMessageRef = useRef("");
  const submittingRef = useRef(false);
  const groupedRfqTemplates = useMemo(() => groupRfqTemplatesByCategory(RFQ_TEMPLATES), []);
  const selectedRfq = rfqTemplate ? RFQ_TEMPLATES_BY_KEY[rfqTemplate] || null : null;
  const selectedRfqLabel = selectedRfq?.title || "";

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
    const message = selectedRfq?.whatsappMessage || "";
    if (!message) return;
    setFormData((prev) => {
      const canReplaceMessage =
        !prev.message || prev.message === lastAutoMessageRef.current;
      const nextMessage = canReplaceMessage ? message : prev.message;
      if (canReplaceMessage) lastAutoMessageRef.current = message;
      return {
        ...prev,
        projectType: prev.projectType || QUOTE_TYPE,
        message: nextMessage,
      };
    });
  }, [config?.visibility?.showRfqTemplates, selectedRfq]);

  const v = config?.visibility;
  const canUseRfq = v?.showRfqTemplates ?? true;
  const primaryPhone = (company?.phone1 || company?.phone2 || "").trim();
  const email = (company?.email || "").trim();
  const address = (company?.address || "").trim();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    const field = name as FieldKey;
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "projectType" && value !== QUOTE_TYPE) {
      setRfqTemplate("");
      setErrors((prev) => ({ ...prev, rfqTemplate: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Guard against rapid double clicks before React re-renders the button.
    if (submittingRef.current) return;

    const nextErrors = validateForm(formData, canUseRfq, rfqTemplate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitStatus({
        kind: "error",
        text: "يرجى تصحيح الحقول المشار إليها ثم إعادة الإرسال.",
      });
      return;
    }

    setSubmitStatus(null);
    submittingRef.current = true;
    setIsSubmitting(true);

    let savedOk = false;
    try {
      const result = await submitLead({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        projectType: formData.projectType,
        message: formData.message.trim(),
        source: isQuote ? "quote" : "website",
      });
      savedOk = result.ok;
    } catch {
      savedOk = false;
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }

    setSubmitStatus(
      savedOk
        ? {
            kind: "success",
            text: "تم استلام طلبك بنجاح، سنتواصل معك قريباً.",
          }
        : {
            kind: "error",
            text: "تعذّر حفظ الطلب حالياً. حاول مرة أخرى أو تابع عبر واتساب.",
          },
    );

    const whatsappMessage = [
      "مرحباً، أريد الاستفسار عن خدماتكم:",
      `الاسم: ${formData.name.trim()}`,
      `الهاتف: ${formData.phone.trim()}`,
      formData.email.trim() ? `البريد الإلكتروني: ${formData.email.trim()}` : "",
      `نوع المشروع: ${formData.projectType}`,
      selectedRfqLabel ? `نوع نموذج عرض السعر: ${selectedRfqLabel}` : "",
      `التفاصيل: ${formData.message.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const link = whatsappUrl(primaryPhone, whatsappMessage);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white" dir="rtl">
      <TopBar />
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-[#0D131D] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {heading(
              content,
              isQuote ? "requestQuote" : "contact",
              isQuote ? "طلب عرض سعر" : "تواصل معنا",
            )}
          </h1>
          <p className="text-xl max-w-3xl mx-auto">
            {isQuote
              ? "أخبرنا بتفاصيل مشروعك وسنرسل لك عرضاً مناسباً"
              : "نحن هنا لمساعدتك والإجابة على استفساراتك"}
          </p>
          {!isQuote && canUseRfq ? (
            <Link
              to="/request-quote"
              className="mt-6 inline-block rounded-xl border border-white/40 px-5 py-2 text-sm font-bold hover:bg-white/10 transition"
            >
              اطلب عرض سعر
            </Link>
          ) : null}
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
                <h2 className="text-3xl font-bold text-gray-800 mb-8">
                  معلومات الاتصال
                </h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sq-green text-white">
                      <Phone size={20} aria-hidden="true" />
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sq-green text-white">
                      <Mail size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">
                        البريد الإلكتروني
                      </h3>
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sq-green text-white">
                      <MapPin size={20} aria-hidden="true" />
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
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  أرسل لنا رسالة
                </h2>
                <p className="text-gray-600 mb-6">
                  الحقول المشار إليها بـ * مطلوبة.
                </p>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-gray-700 font-semibold mb-2">
                      الاسم <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact-name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "contact-name-error" : undefined}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green ${
                        errors.name ? "border-red-400" : "border-gray-300"
                      }`}
                      placeholder="اسمك الكامل"
                    />
                    <FieldError id="contact-name-error" message={errors.name} />
                  </div>

                  <div>
                    <label htmlFor="contact-phone" className="block text-gray-700 font-semibold mb-2">
                      رقم الهاتف <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      id="contact-phone"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      dir="ltr"
                      aria-invalid={Boolean(errors.phone)}
                      aria-describedby={errors.phone ? "contact-phone-error" : undefined}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green ${
                        errors.phone ? "border-red-400" : "border-gray-300"
                      }`}
                      placeholder="05xxxxxxxx"
                    />
                    <FieldError id="contact-phone-error" message={errors.phone} />
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-gray-700 font-semibold mb-2">
                      البريد الإلكتروني (اختياري)
                    </label>
                    <input
                      type="email"
                      id="contact-email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      dir="ltr"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "contact-email-error" : undefined}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green ${
                        errors.email ? "border-red-400" : "border-gray-300"
                      }`}
                      placeholder="email@example.com"
                    />
                    <FieldError id="contact-email-error" message={errors.email} />
                  </div>

                  <div>
                    <label htmlFor="contact-project" className="block text-gray-700 font-semibold mb-2">
                      نوع المشروع <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="contact-project"
                      name="projectType"
                      required
                      value={formData.projectType}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.projectType)}
                      aria-describedby={errors.projectType ? "contact-project-error" : undefined}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green ${
                        errors.projectType ? "border-red-400" : "border-gray-300"
                      }`}
                    >
                      <option value="">اختر نوع المشروع</option>
                      {canUseRfq && <option value={QUOTE_TYPE}>{QUOTE_TYPE}</option>}
                      {content.projectTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <FieldError
                      id="contact-project-error"
                      message={errors.projectType}
                    />
                  </div>

                  {canUseRfq && formData.projectType === QUOTE_TYPE ? (
                    <div>
                      <label htmlFor="contact-rfq" className="block text-gray-700 font-semibold mb-2">
                        نوع نموذج عرض السعر <span className="text-red-600">*</span>
                      </label>
                      <select
                        id="contact-rfq"
                        aria-label="نوع نموذج عرض السعر"
                        value={rfqTemplate}
                        onChange={(e) => {
                          setRfqTemplate(e.target.value);
                          setErrors((prev) => ({
                            ...prev,
                            rfqTemplate: undefined,
                          }));
                        }}
                        aria-invalid={Boolean(errors.rfqTemplate)}
                        aria-describedby={
                          errors.rfqTemplate
                            ? "contact-rfq-hint contact-rfq-error"
                            : "contact-rfq-hint"
                        }
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green ${
                          errors.rfqTemplate ? "border-red-400" : "border-gray-300"
                        }`}
                        required
                      >
                        <option value="">اختر النموذج الأنسب</option>
                        {groupedRfqTemplates.map((g) => (
                          <optgroup key={g.category} label={g.category}>
                            {g.templates.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <p id="contact-rfq-hint" className="mt-1 text-sm text-gray-500">
                        {selectedRfq
                          ? selectedRfq.description
                          : "اختر نموذجاً لتظهر قائمة المطلوب تلقائياً في حقل التفاصيل."}
                      </p>
                      <FieldError
                        id="contact-rfq-error"
                        message={errors.rfqTemplate}
                      />
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="contact-message" className="block text-gray-700 font-semibold mb-2">
                      تفاصيل المشروع <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? "contact-message-error" : undefined}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sq-green resize-none ${
                        errors.message ? "border-red-400" : "border-gray-300"
                      }`}
                      placeholder="أخبرنا عن مشروعك..."
                    />
                    <FieldError
                      id="contact-message-error"
                      message={errors.message}
                    />
                  </div>

                  {submitStatus ? (
                    <p
                      role={submitStatus.kind === "success" ? "status" : "alert"}
                      className={`text-sm font-semibold rounded-lg px-4 py-3 border ${
                        submitStatus.kind === "success"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {submitStatus.text}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="btn-corp-primary w-full font-semibold hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Send size={20} aria-hidden="true" />
                    )}
                    <span>{isSubmitting ? "جارٍ الإرسال…" : "إرسال الطلب"}</span>
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
