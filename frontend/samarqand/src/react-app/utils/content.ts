import { useEffect, useState } from "react";

import {
  fetchSiteContent,
  type SiteContentTexts,
} from "@/react-app/api/site";

export const DEFAULT_CONTENT: SiteContentTexts = {
  workingHours: "السبت - الخميس: 8:00 صباحاً - 6:00 مساءً | الجمعة: مغلق",
  values: [
    "الجودة والإتقان",
    "الالتزام بالمواعيد",
    "الشفافية والمصداقية",
    "السلامة المهنية",
    "رضا العميل أولاً",
    "دعم المنتج المحلي",
  ],
  headings: {
    projects: { title: "مشاريعنا", subtitle: "نفخر بإنجازاتنا ومشاريعنا المنجزة" },
    testimonials: { title: "آراء عملائنا", subtitle: "ما يقوله عملاؤنا عن خدماتنا" },
    services: { title: "خدماتنا", subtitle: "نقدم خدمات متكاملة تلبي احتياجاتكم" },
    showcase: { title: "معرض الأعمال", subtitle: "شاهد التحول الذي نحققه في مشاريعنا" },
    tools: { title: "الأدوات الذكية", subtitle: "أدوات تساعدك في تخطيط مشروعك" },
    contact: { title: "تواصل معنا", subtitle: "نحن هنا لمساعدتك في كل خطوة" },
    requestQuote: { title: "طلب عرض سعر", subtitle: "أخبرنا بتفاصيل مشروعك وسنرسل لك عرضاً مناسباً" },
    rfq: { title: "نماذج عروض الأسعار", subtitle: "اختر قالباً مناسباً واطلب عرض سعر بسرعة" },
  },
  projectTypes: [
    "منزل سكني",
    "فيلا",
    "عمارة سكنية",
    "مبنى تجاري",
    "استشارة هندسية",
    "تصميم معماري",
    "أخرى",
  ],
};

export function useSiteContent(): SiteContentTexts {
  const [content, setContent] = useState<SiteContentTexts>(DEFAULT_CONTENT);
  useEffect(() => {
    let active = true;
    fetchSiteContent()
      .then((data) => {
        if (!active) return;
        setContent((prev) => ({
          ...prev,
          ...data,
          values: Array.isArray(data.values) ? data.values : prev.values,
          projectTypes: Array.isArray(data.projectTypes) ? data.projectTypes : prev.projectTypes,
          headings: { ...prev.headings, ...(data.headings || {}) },
        }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return content;
}

export function heading(
  content: SiteContentTexts,
  key: string,
  fallback: string,
): string {
  return content.headings[key]?.title || fallback;
}
