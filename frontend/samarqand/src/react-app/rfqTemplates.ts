import type { ComponentType } from "react";
import {
  BadgeCheck,
  BrickWall,
  Cable,
  Fan,
  FileText,
  GlassWater,
  Hammer,
  HardHat,
  Paintbrush,
  Ruler,
  Shovel,
  Truck,
  Wrench,
} from "lucide-react";

export type RfqTemplate = {
  key: string;
  title: string;
  label: string;
  description: string;
  category: string;
  tags: string[];
  icon: ComponentType<{ size?: number; className?: string }>;
  defaultCurrency: string;
  defaultData: Record<string, unknown>;
  whatsappMessage: string;
};

const baseDefaultData = {
  vendor: { name: "", contactName: "", phone: "", email: "", address: "" },
  rfq: {
    subject: "",
    dueDate: "",
    deliveryLocation: "",
    validityDays: 14,
    paymentTerms: "حسب الاتفاق",
    notes: "",
  },
  items: [{ description: "", qty: 1, unit: "بند", unitPrice: 0 }],
  taxRate: 0.0,
  discountRate: 0.0,
};

export const RFQ_TEMPLATES: RfqTemplate[] = [
  {
    key: "materials-supply",
    title: "توريد مواد",
    label: "توريد مواد (مواد بناء/تشطيبات)",
    description: "طلب عرض أسعار لتوريد مواد مع جدول كميات ووحدات وأسعار.",
    category: "توريد مواد",
    tags: ["مواد", "توريد", "تشطيبات"],
    icon: Truck,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لتوريد مواد", paymentTerms: "دفعات حسب الاتفاق" },
      items: [{ description: "", qty: 1, unit: "قطعة", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (توريد مواد)\n\nالرجاء تزويدنا بالتالي:\n- قائمة المواد والكميات\n- مكان التسليم\n- تاريخ التسليم المتوقع\n- شروط الدفع\n- مدة صلاحية العرض\n- أي ملاحظات إضافية",
  },
  {
    key: "ready-mix-concrete",
    title: "خرسانة جاهزة",
    label: "توريد خرسانة جاهزة + مضخة",
    description: "طلب تسعير خرسانة جاهزة مع تفاصيل الخلطة والضخ والبرنامج الزمني.",
    category: "توريد مواد",
    tags: ["خرسانة", "صب", "مضخة"],
    icon: BrickWall,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: {
        ...baseDefaultData.rfq,
        subject: "طلب عرض سعر لتوريد خرسانة جاهزة",
        validityDays: 7,
        paymentTerms: "حسب الدفعات/الجدول",
      },
      items: [{ description: "خرسانة جاهزة (درجة/خلطة)", qty: 1, unit: "م3", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (خرسانة جاهزة)\n\nالرجاء تزويدنا بالتالي:\n- درجة الخرسانة/الخلطة المطلوبة\n- الكمية (م3) وبرنامج الصب\n- هل يوجد حاجة لمضخة؟ (نوع/مدة)\n- موقع المشروع\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "reinforcement-steel",
    title: "حديد تسليح",
    label: "توريد حديد تسليح (قضبان/شبك)",
    description: "طلب تسعير حديد تسليح مع مواصفات القطر/النوع والتسليم.",
    category: "توريد مواد",
    tags: ["حديد", "تسليح", "قضبان"],
    icon: HardHat,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لتوريد حديد تسليح", validityDays: 7 },
      items: [{ description: "حديد تسليح (قطر/نوع)", qty: 1, unit: "طن", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (حديد تسليح)\n\nالرجاء تزويدنا بالتالي:\n- الأصناف (قطر/نوع) والكميات (طن/كغ)\n- معيار/منشأ الحديد إن وجد\n- مكان التسليم\n- موعد التوريد\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "finishing-materials",
    title: "مواد تشطيبات",
    label: "توريد مواد تشطيبات (دهانات/جبس/بلاط)",
    description: "طلب تسعير مواد تشطيب مع كميات ومواصفات وماركات بديلة.",
    category: "توريد مواد",
    tags: ["تشطيبات", "دهانات", "بلاط"],
    icon: Paintbrush,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لتوريد مواد تشطيبات" },
      items: [{ description: "مادة تشطيب (نوع/ماركة)", qty: 1, unit: "بند", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (مواد تشطيبات)\n\nالرجاء تزويدنا بالتالي:\n- قائمة المواد والكميات والمواصفات/الماركات\n- البدائل المتاحة (إن وجدت)\n- مكان التسليم\n- موعد التوريد\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "subcontractor",
    title: "مقاول باطن",
    label: "مقاول باطن (بنود تنفيذ)",
    description: "بنود أعمال تنفيذية لمقاول باطن مع كميات وتسعير وملاحظات.",
    category: "تنفيذ وأعمال مقاولين",
    tags: ["مقاول باطن", "تنفيذ", "أعمال"],
    icon: Hammer,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال مقاول باطن", paymentTerms: "دفعات حسب الإنجاز" },
      items: [{ description: "", qty: 1, unit: "م2", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (مقاول باطن)\n\nالرجاء تزويدنا بالتالي:\n- بنود الأعمال والكميات\n- الموقع\n- مدة التنفيذ المتوقعة\n- طريقة التسعير (مقطوع/وحدة)\n- شروط الدفع\n- أي ملاحظات إضافية",
  },
  {
    key: "excavation-earthworks",
    title: "حفريات وردم",
    label: "أعمال حفريات وردم + نقل ناتج",
    description: "طلب تسعير أعمال الحفر والردم مع النقل والطبقات والدمك.",
    category: "تنفيذ وأعمال مقاولين",
    tags: ["حفريات", "ردم", "دمك"],
    icon: Shovel,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال حفريات وردم", validityDays: 10 },
      items: [{ description: "حفر/ردم/نقل ناتج", qty: 1, unit: "م3", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (حفريات وردم)\n\nالرجاء تزويدنا بالتالي:\n- نطاق العمل (حفر/ردم/دمك/نقل ناتج)\n- الكميات التقريبية (م3)\n- موقع المشروع وسهولة الوصول\n- نوع التربة إن وجد\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "formwork-shuttering",
    title: "شدات ونجارة",
    label: "شدات/قوالب (نجارة/حدادة) للخرسانة",
    description: "طلب تسعير الشدات والقوالب والأيدي العاملة للصب.",
    category: "تنفيذ وأعمال مقاولين",
    tags: ["شدات", "قوالب", "صب"],
    icon: Ruler,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال شدات وقوالب", paymentTerms: "حسب الإنجاز" },
      items: [{ description: "شدات/قوالب", qty: 1, unit: "م2", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (شدات/قوالب)\n\nالرجاء تزويدنا بالتالي:\n- نوع الشدة (تقليدية/معدنية) ونطاق العمل\n- الكميات (م2) أو مخططات إن وجدت\n- موقع المشروع\n- مدة التنفيذ\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "electrical-works",
    title: "كهرباء",
    label: "أعمال كهرباء (تمديد/لوحات/إنارة)",
    description: "طلب تسعير أعمال كهرباء مع مخططات وبنود تنفيذ ومواصفات.",
    category: "MEP (كهرباء/سباكة/تكييف)",
    tags: ["كهرباء", "لوحات", "إنارة"],
    icon: Cable,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال كهرباء", paymentTerms: "حسب الاتفاق/الإنجاز" },
      items: [{ description: "بند كهرباء (تمديد/لوحات/إنارة)", qty: 1, unit: "بند", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (أعمال كهرباء)\n\nالرجاء تزويدنا بالتالي:\n- مخططات/بنود الأعمال المطلوبة\n- مساحة/عدد النقاط التقريبي\n- مستوى المواصفات (اقتصادي/متوسط/فاخر)\n- الموقع والمدة\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "plumbing-works",
    title: "سباكة",
    label: "أعمال سباكة (مياه/صرف/تمديدات)",
    description: "طلب تسعير أعمال السباكة مع عدد النقاط والمواصفات والاختبارات.",
    category: "MEP (كهرباء/سباكة/تكييف)",
    tags: ["سباكة", "مياه", "صرف"],
    icon: GlassWater,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال سباكة", paymentTerms: "حسب الاتفاق/الإنجاز" },
      items: [{ description: "بند سباكة (مياه/صرف)", qty: 1, unit: "بند", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (أعمال سباكة)\n\nالرجاء تزويدنا بالتالي:\n- عدد النقاط/الدورات/المطابخ إن وجدت\n- المواد المطلوبة (PPR/PEX/UPVC...)\n- مخططات/بنود العمل\n- الموقع والمدة\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "hvac-works",
    title: "تكييف",
    label: "أعمال تكييف (توريد+تركيب/تمديدات)",
    description: "طلب تسعير تكييف مع الأحمال/المساحات ونوع النظام (سبلت/سنترال).",
    category: "MEP (كهرباء/سباكة/تكييف)",
    tags: ["تكييف", "HVAC", "تبريد"],
    icon: Fan,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال تكييف", validityDays: 14 },
      items: [{ description: "وحدة تكييف/نظام (قدرة/نوع)", qty: 1, unit: "وحدة", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (أعمال تكييف)\n\nالرجاء تزويدنا بالتالي:\n- عدد الغرف/المساحات والأحمال إن وجدت\n- نوع النظام المطلوب (سبلت/مخفي/سنترال)\n- الماركات المفضلة\n- الموقع والمدة\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "aluminum-glass",
    title: "ألمنيوم وزجاج",
    label: "أعمال ألمنيوم وزجاج (شبابيك/واجهات)",
    description: "طلب تسعير ألمنيوم وزجاج مع المقاسات والسماكات والأنواع.",
    category: "تشطيبات وواجهات",
    tags: ["ألمنيوم", "زجاج", "واجهات"],
    icon: BadgeCheck,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال ألمنيوم وزجاج" },
      items: [{ description: "شباك/باب/واجهة (نوع/مقاس)", qty: 1, unit: "م2", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (ألمنيوم وزجاج)\n\nالرجاء تزويدنا بالتالي:\n- المقاسات والأنواع (سحاب/مفصلي/واجهة)\n- سماكة الزجاج ونوعه\n- لون/سماكة الألمنيوم\n- الموقع وموعد التركيب\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "carpentry-joinery",
    title: "نجارة وأبواب",
    label: "أعمال نجارة/أبواب/مطابخ",
    description: "طلب تسعير أعمال نجارة داخلية مع المواد والقياسات والتشطيب.",
    category: "تشطيبات وواجهات",
    tags: ["نجارة", "أبواب", "مطابخ"],
    icon: Hammer,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لأعمال نجارة وأبواب" },
      items: [{ description: "بند نجارة (باب/مطبخ/خزانة)", qty: 1, unit: "بند", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (نجارة وأبواب)\n\nالرجاء تزويدنا بالتالي:\n- البنود المطلوبة (أبواب/مطابخ/خزائن)\n- الأبعاد والتصاميم/الصور إن وجدت\n- نوع الخشب/الـ MDF والتشطيب\n- الموقع والمدة\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "equipment-rental",
    title: "استئجار معدات",
    label: "استئجار معدات",
    description: "طلب تسعير استئجار معدات باليوم/الساعة مع شروط التوريد.",
    category: "معدات ولوجستيات",
    tags: ["معدات", "استئجار", "تشغيل"],
    icon: Wrench,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: {
        ...baseDefaultData.rfq,
        subject: "طلب عرض سعر لاستئجار معدات",
        validityDays: 7,
        paymentTerms: "أسبوعيًا/شهريًا حسب الاتفاق",
      },
      items: [{ description: "", qty: 1, unit: "يوم", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (استئجار معدات)\n\nالرجاء تزويدنا بالتالي:\n- نوع المعدات والمدة (يوم/ساعة)\n- موقع العمل\n- تاريخ البدء\n- هل المطلوب مع مشغل؟\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "transport-logistics",
    title: "نقل ولوجستيات",
    label: "نقل وتوريد (شاحنات/رافعة/نقل مواد)",
    description: "طلب تسعير خدمات نقل/تحميل/تفريغ مع مسافة وحمولات.",
    category: "معدات ولوجستيات",
    tags: ["نقل", "شاحنات", "رافعة"],
    icon: Truck,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لخدمات نقل ولوجستيات", validityDays: 10 },
      items: [{ description: "نقل مواد/معدات (نوع الحمولة)", qty: 1, unit: "نقلة", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (نقل ولوجستيات)\n\nالرجاء تزويدنا بالتالي:\n- نوع الحمولة والوزن/الحجم التقريبي\n- نقطة التحميل ونقطة التفريغ\n- عدد النقلات المطلوبة\n- هل يوجد رافعة/تحميل/تفريغ؟\n- شروط الدفع وصلاحية العرض",
  },
  {
    key: "services",
    title: "خدمات عامة",
    label: "خدمات عامة (أعمال/صيانة)",
    description: "طلب عرض سعر لخدمات عامة مع بنود وخطة زمنية مختصرة.",
    category: "خدمات واستشارات",
    tags: ["خدمات", "صيانة", "أعمال"],
    icon: FileText,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لخدمات عامة" },
      items: [{ description: "", qty: 1, unit: "بند", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (خدمات عامة)\n\nالرجاء تزويدنا بالتالي:\n- وصف الخدمة المطلوبة\n- الموقع\n- الإطار الزمني\n- شروط الدفع\n- أي ملاحظات إضافية",
  },
  {
    key: "engineering-consulting",
    title: "استشارة هندسية",
    label: "استشارة هندسية (زيارة/تقرير/إشراف)",
    description: "طلب تسعير استشارة هندسية/زيارة موقع مع نطاق واضح ومخرجات.",
    category: "خدمات واستشارات",
    tags: ["استشارة", "هندسة", "تقرير"],
    icon: FileText,
    defaultCurrency: "ILS",
    defaultData: {
      ...baseDefaultData,
      rfq: { ...baseDefaultData.rfq, subject: "طلب عرض سعر لاستشارة هندسية", validityDays: 14 },
      items: [{ description: "زيارة/تقرير/إشراف", qty: 1, unit: "خدمة", unitPrice: 0 }],
    },
    whatsappMessage:
      "طلب عرض سعر (استشارة هندسية)\n\nالرجاء تزويدنا بالتالي:\n- نوع الاستشارة المطلوبة (زيارة/تقرير/إشراف)\n- موقع المشروع\n- وصف مختصر للمشكلة/المطلوب\n- الإطار الزمني\n- شروط الدفع",
  },
];

export const RFQ_TEMPLATES_BY_KEY: Record<string, RfqTemplate> = Object.fromEntries(
  RFQ_TEMPLATES.map((t) => [t.key, t]),
) as Record<string, RfqTemplate>;

export function groupRfqTemplatesByCategory(templates: RfqTemplate[]): { category: string; templates: RfqTemplate[] }[] {
  const categoryOrder = ["توريد مواد", "تنفيذ وأعمال مقاولين", "MEP (كهرباء/سباكة/تكييف)", "تشطيبات وواجهات", "معدات ولوجستيات", "خدمات واستشارات"];

  const map = new Map<string, RfqTemplate[]>();
  for (const t of templates) {
    const arr = map.get(t.category) || [];
    arr.push(t);
    map.set(t.category, arr);
  }

  const categories = Array.from(map.keys()).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "ar");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return categories.map((category) => ({
    category,
    templates: (map.get(category) || []).slice().sort((a, b) => a.title.localeCompare(b.title, "ar")),
  }));
}

