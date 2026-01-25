export interface Project {
  id: string;
  title: string;
  category: string;
  location: string;
  year: number;
  description: string;
  image: string; // رابط الصورة
  featured?: boolean;
}

// أضف مشاريعك السابقة هنا
export const projects: Project[] = [
  {
    id: "1",
    title: "فيلا سكنية فاخرة",
    category: "مشاريع سكنية",
    location: "رام الله",
    year: 2023,
    description: "تصميم وتنفيذ فيلا سكنية فاخرة بمساحة 400 متر مربع",
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800", // استبدل بصور مشاريعك
    featured: true,
  },
  {
    id: "2",
    title: "مبنى تجاري",
    category: "مشاريع تجارية",
    location: "نابلس",
    year: 2023,
    description: "بناء مبنى تجاري من 4 طوابق",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    featured: true,
  },
  {
    id: "3",
    title: "عمارة سكنية",
    category: "مشاريع سكنية",
    location: "الخليل",
    year: 2022,
    description: "عمارة سكنية من 6 طوابق تحتوي على 12 شقة",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
    featured: true,
  },
];

// يمكنك إضافة المزيد من المشاريع بنفس الصيغة
