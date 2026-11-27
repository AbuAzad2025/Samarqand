import { useEffect, useState } from "react";
import { Award, Briefcase, GraduationCap, UsersRound, X } from 'lucide-react';

import {
  fetchCompany,
  fetchTeam,
  type CompanyPayload,
  type TeamMemberPayload,
} from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";

export default function InteractiveTeam() {
  const [team, setTeam] = useState<TeamMemberPayload[]>([]);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMemberPayload | null>(
    null,
  );

  useEffect(() => {
    fetchTeam().then(setTeam).catch(() => {});
    fetchCompany().then(setCompany).catch(() => {});
  }, []);

  return (
    <>
      <section className="py-20 bg-gray-50" dir="rtl">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              تعرف على فريقنا
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              نخبة من المهندسين والخبراء المحترفين
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member) => (
              <div
                key={member.id}
                role="button"
                tabIndex={0}
                aria-label={`تفاصيل ${member.name}`}
                onClick={() => setSelectedMember(member)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedMember(member);
                  }
                }}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2"
              >
                {/* Image Container */}
                <div className="relative h-56 overflow-hidden">
                  {member.imageUrl ? (
                    <img loading="lazy" decoding="async"                       src={member.imageUrl}
                      alt={member.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--corp-surface)] text-slate-400">
                      <UsersRound size={44} strokeWidth={1.2} aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Hover Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-sm leading-relaxed">انقر لمعرفة المزيد</p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{member.name}</h3>
                  <p className="text-sq-green font-semibold mb-1">{member.position}</p>
                  <p className="text-gray-600 text-sm">{member.specialization}</p>
                </div>

                {/* Corner Badge */}
                <div className="absolute top-4 left-4 bg-gradient-to-br from-sq-green via-sq-black to-sq-red text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                  <Award size={16} className="inline mr-1" />
                  خبير
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <button
              type="button"
              aria-label="إغلاق التفاصيل"
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition shadow-lg z-10"
            >
              <X size={24} className="text-gray-600" />
            </button>

            {/* Header Image */}
            <div className="relative h-64">
              {selectedMember.imageUrl ? (
                <img loading="lazy" decoding="async"                   src={selectedMember.imageUrl}
                  alt={selectedMember.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--corp-surface)] text-slate-400">
                      <UsersRound size={44} strokeWidth={1.2} aria-hidden="true" />
                    </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-6 right-6 text-white">
                <h2 className="text-3xl font-bold mb-2">{selectedMember.name}</h2>
                <p className="text-xl text-emerald-200">{selectedMember.position}</p>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                    <GraduationCap className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2">التخصص</h3>
                    <p className="text-gray-600">{selectedMember.specialization}</p>
                  </div>
                </div>

                {selectedMember.experience && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Briefcase className="text-white" size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-2">الخبرة</h3>
                      <p className="text-gray-600">{selectedMember.experience}</p>
                    </div>
                  </div>
                )}

                {selectedMember.bio && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Award className="text-white" size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 mb-2">نبذة</h3>
                      <p className="text-gray-600 leading-relaxed">{selectedMember.bio}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <a
                  href={
                    whatsappUrl(
                      company?.phone1,
                      `مرحباً، أريد التحدث مع ${selectedMember.name}`,
                    ) || "/contact"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full btn-corp-primary w-full font-bold hover:shadow-lg transition"
                >
                  تواصل معنا
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
