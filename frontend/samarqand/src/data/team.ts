export interface TeamMember {
  id: string;
  name: string;
  position: string;
  specialization: string;
  image: string;
  experience?: string;
  bio?: string;
}

export const team: TeamMember[] = [
  {
    id: "1",
    name: "م. أحمد الخالدي",
    position: "المدير التنفيذي",
    specialization: "هندسة مدنية",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400",
    experience: "15 سنة في إدارة المشاريع الكبرى",
    bio: "خبير في إدارة المشاريع الإنشائية الكبرى مع سجل حافل من المشاريع الناجحة في فلسطين والمنطقة. حاصل على ماجستير في إدارة المشاريع الهندسية من الجامعة الأردنية.",
  },
  {
    id: "2",
    name: "م. سارة النجار",
    position: "رئيسة قسم التصميم",
    specialization: "هندسة معمارية",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
    experience: "12 سنة في التصميم المعماري",
    bio: "مبدعة في التصاميم المعمارية الحديثة التي تجمع بين الأصالة والعصرية. حاصلة على جوائز عديدة في التصميم المعماري المستدام.",
  },
  {
    id: "3",
    name: "م. محمد السعدي",
    position: "مدير المشاريع",
    specialization: "إدارة وتنفيذ المشاريع",
    image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=400",
    experience: "10 سنوات في الإشراف الهندسي",
    bio: "متخصص في الإشراف الدقيق على تنفيذ المشاريع وضمان الجودة. معتمد كمدير مشاريع محترف PMP مع خبرة واسعة في التنفيذ الميداني.",
  },
];
