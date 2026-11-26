export interface Testimonial {
  id: string;
  name: string;
  project: string;
  text: string;
  rating: number;
}

// أضف آراء العملاء هنا
export const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "محمد أحمد",
    project: "فيلا سكنية في رام الله",
    text: "تجربة ممتازة من البداية للنهاية. فريق محترف والتزام بالمواعيد والجودة عالية.",
    rating: 5,
  },
  {
    id: "2",
    name: "عمر خليل",
    project: "مبنى تجاري في نابلس",
    text: "شركة موثوقة وأسعار منافسة. أنصح بالتعامل معهم.",
    rating: 5,
  },
  {
    id: "3",
    name: "فاطمة يوسف",
    project: "عمارة سكنية في الخليل",
    text: "تصميم رائع وتنفيذ متقن. سعيدة جداً بالنتيجة النهائية.",
    rating: 5,
  },
];

// يمكنك إضافة المزيد من آراء العملاء
