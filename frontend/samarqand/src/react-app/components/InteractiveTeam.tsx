import { useCallback, useEffect, useRef, useState } from "react";
import { Award, Briefcase, GraduationCap, RefreshCw, UsersRound, X } from "lucide-react";

import {
  fetchCompany,
  fetchTeam,
  type CompanyPayload,
  type TeamMemberPayload,
} from "@/react-app/api/site";
import { whatsappUrl } from "@/react-app/utils/whatsapp";

type LoadState = "loading" | "ready" | "error";

export default function InteractiveTeam() {
  const [team, setTeam] = useState<TeamMemberPayload[]>([]);
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [selectedMember, setSelectedMember] = useState<TeamMemberPayload | null>(null);
  const requestId = useRef(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setState("loading");
    fetchTeam()
      .then((data) => {
        if (id !== requestId.current) return;
        setTeam(Array.isArray(data) ? data : []);
        setState("ready");
      })
      .catch(() => {
        if (id === requestId.current) setState("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    fetchCompany().then((data) => { if (active) setCompany(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const closeMember = useCallback(() => {
    setSelectedMember(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  function openMember(member: TeamMemberPayload, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setSelectedMember(member);
  }

  useEffect(() => {
    if (!selectedMember) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMember();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedMember, closeMember]);

  return (
    <>
      <section className="section-corp-muted" dir="rtl" aria-labelledby="team-heading">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <h2 id="team-heading" className="mb-3 text-3xl font-bold text-gray-800 md:text-4xl">
              تعرف على فريقنا
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600">نخبة من المهندسين والخبراء المحترفين</p>
          </div>

          {state === "loading" && (
            <p role="status" className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center text-sm text-[var(--corp-muted)]">
              جارٍ تحميل بيانات الفريق...
            </p>
          )}

          {state === "error" && (
            <div role="alert" className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center">
              <p className="text-sm text-[var(--corp-muted)]">تعذّر عرض بيانات الفريق حالياً.</p>
              <button
                type="button"
                onClick={load}
                className="btn-corp-secondary mt-3 inline-flex items-center gap-2 text-sm focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
              >
                <RefreshCw size={15} aria-hidden="true" />
                إعادة المحاولة
              </button>
            </div>
          )}

          {state === "ready" && team.length === 0 && (
            <p className="rounded-xl border border-[var(--corp-border)] bg-white p-6 text-center text-sm text-[var(--corp-muted)]">
              لا يوجد أعضاء فريق معروضون حالياً.
            </p>
          )}

          {state === "ready" && team.length > 0 && (
            <div className="grid gap-6 md:grid-cols-3">
              {team.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  aria-label={`${member.name}، ${member.position} — اضغط لمعرفة المزيد`}
                  onClick={(event) => openMember(member, event.currentTarget)}
                  className="group relative w-full overflow-hidden rounded-2xl bg-white text-right shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
                >
                  <div className="relative h-56 overflow-hidden">
                    {member.imageUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={member.imageUrl}
                        alt={member.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--corp-surface)] text-slate-400">
                        <UsersRound size={44} strokeWidth={1.2} aria-hidden="true" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-x-0 bottom-0 translate-y-full p-6 text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
                      <p className="text-sm">اضغط لمعرفة المزيد</p>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="mb-2 text-2xl font-bold text-gray-800">{member.name}</h3>
                    <p className="mb-1 font-semibold text-sq-green">{member.position}</p>
                    <p className="text-sm text-gray-600">{member.specialization}</p>
                  </div>

                  <div className="absolute right-4 top-4 rounded-full bg-gradient-to-br from-sq-green via-sq-black to-sq-red px-4 py-2 text-sm font-bold text-white shadow-lg">
                    <Award size={16} className="ms-1 inline" aria-hidden="true" />
                    خبير
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeMember}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-dialog-title"
            onClick={(event) => event.stopPropagation()}
            dir="rtl"
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <button
              ref={closeRef}
              type="button"
              aria-label="إغلاق التفاصيل"
              onClick={closeMember}
              className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-sq-green"
            >
              <X size={24} className="text-gray-600" aria-hidden="true" />
            </button>

            <div className="relative h-64">
              {selectedMember.imageUrl ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={selectedMember.imageUrl}
                  alt={selectedMember.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--corp-surface)] text-slate-400">
                  <UsersRound size={44} strokeWidth={1.2} aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" aria-hidden="true" />
              <div className="absolute bottom-6 right-6 text-white">
                <h2 id="team-dialog-title" className="mb-2 text-3xl font-bold">{selectedMember.name}</h2>
                <p className="text-xl text-emerald-200">{selectedMember.position}</p>
              </div>
            </div>

            <div className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                    <GraduationCap size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-bold text-gray-800">التخصص</h3>
                    <p className="text-gray-600">{selectedMember.specialization}</p>
                  </div>
                </div>

                {selectedMember.experience && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Briefcase size={24} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="mb-2 font-bold text-gray-800">الخبرة</h3>
                      <p className="text-gray-600">{selectedMember.experience}</p>
                    </div>
                  </div>
                )}

                {selectedMember.bio && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--corp-green-soft)] text-[var(--corp-green)]">
                      <Award size={24} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="mb-2 font-bold text-gray-800">نبذة</h3>
                      <p className="leading-relaxed text-gray-600">{selectedMember.bio}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 border-t border-gray-200 pt-6">
                <a
                  href={
                    whatsappUrl(
                      company?.phone1,
                      `مرحباً، أريد التحدث مع ${selectedMember.name}`,
                    ) || "/contact"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`تواصل معنا بخصوص ${selectedMember.name}`}
                  className="btn-corp-primary w-full font-bold hover:shadow-lg focus-visible:ring-2 focus-visible:ring-sq-green focus-visible:ring-offset-2"
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
