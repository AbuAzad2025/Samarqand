import { useCallback, useEffect, useState } from "react";
import {
  addDeliveryNoteItem,
  createCorrespondence,
  createDailyReport,
  createDeliveryNote,
  createMeeting,
  createMeetingActionItem,
  createNcrItem,
  createRfiItem,
  createSubmittalItem,
  deleteCorrespondence,
  deleteDailyReport,
  deleteDeliveryNote,
  deleteMeeting,
  deleteMeetingActionItem,
  deleteNcrItem,
  deleteRfiItem,
  deleteSubmittalItem,
  fetchCorrespondence,
  fetchDailyReports,
  fetchDeliveryNotes,
  fetchDeliveryNoteItems,
  uploadFieldDocFile,
  fetchFieldDocsProjects,
  fetchMeetings,
  fetchMeetingActionItems,
  fetchNcrItems,
  fetchRfiItems,
  fetchSubmittalItems,
  removeDeliveryNoteItem,
  updateCorrespondence,
  updateDailyReport,
  updateDeliveryNote,
  updateDeliveryNoteItem,
  updateMeeting,
  updateMeetingActionItem,
  updateNcrItem,
  updateRfiItem,
  updateSubmittalItem,
  type CorrespondenceItem,
  type DailyReportItem,
  type DeliveryNoteItem,
  type DeliveryNoteLineItem,
  type FieldDocsProjectItem,
  type MeetingActionItem,
  type MeetingItem,
  type NcrItem,
  type RfiItem,
  type SubmittalItem,
} from "@/react-app/api/fieldDocs";
import { todayInputValue, baseHumanizeErrorCode } from "@/react-app/utils/common";

function humanizeErrorCode(code: string): string {
  const shared = baseHumanizeErrorCode(code);
  if (shared) return shared;
  const c = String(code || "").trim();
  if (c === "invalid_direction") return "الاتجاه غير صحيح.";
  if (c === "missing_reference_or_subject") return "الرقم والموضوع مطلوبان.";
  if (c === "missing_number") return "الرقم مطلوب.";
  if (c === "missing_number_or_subject") return "الرقم والموضوع مطلوبان.";
  if (c === "missing_number_or_title") return "الرقم والعنوان مطلوبان.";
  return c;
}

type Tab =
  | "correspondence"
  | "meetings"
  | "dailyReports"
  | "deliveryNotes"
  | "rfi"
  | "ncr"
  | "submittals";

const TABS: { key: Tab; label: string }[] = [
  { key: "correspondence", label: "المراسلات" },
  { key: "meetings", label: "محاضر الاجتماعات" },
  { key: "dailyReports", label: "التقارير اليومية" },
  { key: "deliveryNotes", label: "استلام مواد" },
  { key: "rfi", label: "طلبات معلومات" },
  { key: "ncr", label: "مخالفات الجودة" },
  { key: "submittals", label: "مستندات تسليم" },
];

export default function ControlFieldDocs() {
  const [projects, setProjects] = useState<FieldDocsProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("correspondence");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [correspondence, setCorrespondence] = useState<CorrespondenceItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportItem[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteItem[]>([]);
  const [rfiItems, setRfiItems] = useState<RfiItem[]>([]);
  const [ncrItems, setNcrItems] = useState<NcrItem[]>([]);
  const [submittalItems, setSubmittalItems] = useState<SubmittalItem[]>([]);

  const [modal, setModal] = useState<"meetingActions" | "deliveryItems" | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<MeetingItem | null>(null);
  const [activeDeliveryNote, setActiveDeliveryNote] = useState<DeliveryNoteItem | null>(null);

  useEffect(() => {
    fetchFieldDocsProjects()
      .then(setProjects)
      .catch(() => setError("تعذر تحميل المشاريع."));
  }, []);

  const showError = useCallback((err: unknown) => {
    const code = typeof err === "string" ? err : humanizeErrorCode(String(err));
    setError(code);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    setError("");
    try {
      const [
        correspondenceData,
        meetingsData,
        dailyReportsData,
        deliveryNotesData,
        rfiData,
        ncrData,
        submittalsData,
      ] = await Promise.all([
        fetchCorrespondence(selectedProjectId),
        fetchMeetings(selectedProjectId),
        fetchDailyReports(selectedProjectId),
        fetchDeliveryNotes(selectedProjectId),
        fetchRfiItems(selectedProjectId),
        fetchNcrItems(selectedProjectId),
        fetchSubmittalItems(selectedProjectId),
      ]);
      setCorrespondence(correspondenceData);
      setMeetings(meetingsData);
      setDailyReports(dailyReportsData);
      setDeliveryNotes(deliveryNotesData);
      setRfiItems(rfiData);
      setNcrItems(ncrData);
      setSubmittalItems(submittalsData);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, showError]);

  useEffect(() => {
    if (!selectedProjectId) return;
    refreshAll();
  }, [refreshAll, selectedProjectId]);

  function statusBadge(status: string): string {
    const map: Record<string, string> = {
      pending_reply: "bg-amber-500/20 text-amber-300",
      replied: "bg-blue-500/20 text-blue-300",
      closed: "bg-slate-500/20 text-slate-300",
      draft: "bg-white/10 text-white/80",
      reviewed: "bg-blue-500/20 text-blue-300",
      approved: "bg-emerald-500/20 text-emerald-300",
      open: "bg-amber-500/20 text-amber-300",
      in_progress: "bg-blue-500/20 text-blue-300",
      completed: "bg-emerald-500/20 text-emerald-300",
      answered: "bg-blue-500/20 text-blue-300",
      action_taken: "bg-blue-500/20 text-blue-300",
      submitted: "bg-blue-500/20 text-blue-300",
      under_review: "bg-amber-500/20 text-amber-300",
      approved_with_comments: "bg-purple-500/20 text-purple-300",
      rejected: "bg-red-500/20 text-red-300",
    };
    return map[status] || "bg-white/10 text-white/80";
  }

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_reply: "بانتظار الرد",
      replied: "تم الرد",
      closed: "مغلق",
      draft: "مسودة",
      reviewed: "مراجعة",
      approved: "معتمد",
      open: "مفتوح",
      in_progress: "قيد التنفيذ",
      completed: "مكتمل",
      answered: "تم الرد",
      action_taken: "تم اتخاذ إجراء",
      submitted: "مرسل",
      under_review: "قيد المراجعة",
      approved_with_comments: "معتمد بملاحظات",
      rejected: "مرفوض",
    };
    return map[status] || status;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">التوثيق الميداني</h1>
          <p className="text-white/60 mt-1">مراسلات — محاضر اجتماعات — تقارير يومية — استلام مواد — RFI — NCR — مستندات</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white min-w-[220px] focus:outline-none focus:border-sq-green/50"
          >
            <option value="" className="bg-sq-black">اختر مشروعاً</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-sq-black">
                {p.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refreshAll}
            disabled={!selectedProjectId || loading}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white disabled:opacity-50"
          >
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-emerald-200">
          {success}
        </div>
      )}

      {!selectedProjectId ? (
        <div className="text-center py-20 text-white/50">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-lg font-bold">اختر مشروعاً لبدء العمل</div>
        </div>
      ) : loading ? (
        <div className="text-center py-20 text-white/50">جاري التحميل…</div>
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl border text-sm font-bold transition whitespace-nowrap ${
                  tab === t.key
                    ? "bg-gradient-to-r from-sq-green/25 via-white/5 to-sq-red/25 border-white/20 text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "correspondence" && (
            <CorrespondenceSection
              projectId={selectedProjectId}
              items={correspondence}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
              statusBadge={statusBadge}
              statusLabel={statusLabel}
            />
          )}
          {tab === "meetings" && (
            <MeetingsSection
              projectId={selectedProjectId}
              items={meetings}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
              statusBadge={statusBadge}
              statusLabel={statusLabel}
              onOpenActionItems={(meeting) => {
                setActiveMeeting(meeting);
                setModal("meetingActions");
              }}
            />
          )}
          {tab === "dailyReports" && (
            <DailyReportsSection
              projectId={selectedProjectId}
              items={dailyReports}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
            />
          )}
          {tab === "deliveryNotes" && (
            <DeliveryNotesSection
              projectId={selectedProjectId}
              items={deliveryNotes}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
              onOpenItems={(note) => {
                setActiveDeliveryNote(note);
                setModal("deliveryItems");
              }}
            />
          )}
          {tab === "rfi" && (
            <RfiSection
              projectId={selectedProjectId}
              items={rfiItems}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
              statusBadge={statusBadge}
              statusLabel={statusLabel}
            />
          )}
          {tab === "ncr" && (
            <NcrSection
              projectId={selectedProjectId}
              items={ncrItems}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
              statusBadge={statusBadge}
              statusLabel={statusLabel}
            />
          )}
          {tab === "submittals" && (
            <SubmittalsSection
              projectId={selectedProjectId}
              items={submittalItems}
              onRefresh={refreshAll}
              onShowError={showError}
              onShowSuccess={showSuccess}
              statusBadge={statusBadge}
              statusLabel={statusLabel}
            />
          )}
        </>
      )}

      {selectedProjectId && modal === "meetingActions" && activeMeeting && (
        <MeetingActionItemsModal
          projectId={selectedProjectId}
          meeting={activeMeeting}
          onClose={() => {
            setModal(null);
            setActiveMeeting(null);
          }}
          onShowError={showError}
          onShowSuccess={showSuccess}
          statusBadge={statusBadge}
          statusLabel={statusLabel}
        />
      )}

      {selectedProjectId && modal === "deliveryItems" && activeDeliveryNote && (
        <DeliveryItemsModal
          projectId={selectedProjectId}
          note={activeDeliveryNote}
          onClose={() => {
            setModal(null);
            setActiveDeliveryNote(null);
          }}
          onShowError={showError}
          onShowSuccess={showSuccess}
        />
      )}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-sq-green/50 ${props.className || ""}`}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl bg-sq-green/20 border border-sq-green/30 text-emerald-200 hover:bg-sq-green/30 transition font-bold disabled:opacity-50 ${props.className || ""}`}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition ${props.className || ""}`}
    />
  );
}

function CorrespondenceSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
  statusBadge,
  statusLabel,
}: {
  projectId: number;
  items: CorrespondenceItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  statusBadge: (s: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [form, setForm] = useState<Partial<CorrespondenceItem>>({ date: todayInputValue() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFieldDocFile(file);
      if (!res.ok || res.id == null) throw new Error(res.error || "upload");
      setForm((s) => ({ ...s, documentFileId: res.id, documentFile: res.url }));
      onShowSuccess("تم رفع الملف.");
    } catch {
      onShowError("تعذر رفع الملف.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateCorrespondence(projectId, editingId, payload)
      : await createCorrespondence(projectId, payload);
    if (res.ok) {
      setForm({ date: todayInputValue() });
      setEditingId(null);
      onShowSuccess(editingId ? "تم تحديث المراسلة." : "تم إنشاء المراسلة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    const res = await deleteCorrespondence(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Select
            value={form.direction || "incoming"}
            onChange={(e) => setForm({ ...form, direction: e.target.value as CorrespondenceItem["direction"] })}
          >
            <option value="incoming" className="bg-sq-black">وارد</option>
            <option value="outgoing" className="bg-sq-black">صادر</option>
          </Select>
          <Input
            placeholder="رقم المرجع"
            value={form.referenceNumber || ""}
            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
          />
          <Input
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            type="date"
            placeholder="تاريخ استحقاق الرد"
            value={form.responseDueDate || ""}
            onChange={(e) => setForm({ ...form, responseDueDate: e.target.value })}
          />
          <Input
            placeholder="من"
            value={form.fromEntity || ""}
            onChange={(e) => setForm({ ...form, fromEntity: e.target.value })}
          />
          <Input
            placeholder="إلى"
            value={form.toEntity || ""}
            onChange={(e) => setForm({ ...form, toEntity: e.target.value })}
          />
          <Input
            placeholder="الموضوع"
            value={form.subject || ""}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="md:col-span-2"
          />
          <Select
            value={form.status || "pending_reply"}
            onChange={(e) => setForm({ ...form, status: e.target.value as CorrespondenceItem["status"] })}
          >
            <option value="pending_reply" className="bg-sq-black">بانتظار الرد</option>
            <option value="replied" className="bg-sq-black">تم الرد</option>
            <option value="closed" className="bg-sq-black">مغلق</option>
          </Select>
          <Input
            placeholder="رقم الرد"
            value={form.responseRef || ""}
            onChange={(e) => setForm({ ...form, responseRef: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-white/80">
          <input
            type="file"
            disabled={uploading}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white"
          />
          {form.documentFile ? <a href={form.documentFile} target="_blank" rel="noreferrer" className="text-emerald-300 underline">ملف مرفق</a> : null}
          {uploading ? <span>جارٍ الرفع…</span> : null}
        </div>
        <TextArea
          placeholder="الوصف"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ date: todayInputValue() });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الاتجاه</th>
              <th className="px-4 py-3 text-right">الرقم</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">من / إلى</th>
              <th className="px-4 py-3 text-right">الموضوع</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white/70">{it.direction === "incoming" ? "وارد" : "صادر"}</td>
                <td className="px-4 py-3 text-white font-bold">{it.referenceNumber}</td>
                <td className="px-4 py-3 text-white/70">{it.date}</td>
                <td className="px-4 py-3 text-white/80">{it.fromEntity} → {it.toEntity}</td>
                <td className="px-4 py-3 text-white">{it.subject}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                    {statusLabel(it.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  لا توجد مراسلات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MeetingsSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
  statusBadge,
  statusLabel,
  onOpenActionItems,
}: {
  projectId: number;
  items: MeetingItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  statusBadge: (s: string) => string;
  statusLabel: (s: string) => string;
  onOpenActionItems: (meeting: MeetingItem) => void;
}) {
  const [form, setForm] = useState<Partial<MeetingItem>>({ meetingDate: todayInputValue() });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateMeeting(projectId, editingId, payload)
      : await createMeeting(projectId, payload);
    if (res.ok) {
      setForm({ meetingDate: todayInputValue() });
      setEditingId(null);
      onShowSuccess(editingId ? "تم تحديث المحضر." : "تم إنشاء المحضر.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    const res = await deleteMeeting(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Input
            placeholder="رقم الاجتماع"
            value={form.meetingNumber || ""}
            onChange={(e) => setForm({ ...form, meetingNumber: e.target.value })}
          />
          <Input
            type="date"
            value={form.meetingDate || ""}
            onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
          />
          <Select
            value={form.meetingType || "site"}
            onChange={(e) => setForm({ ...form, meetingType: e.target.value as MeetingItem["meetingType"] })}
          >
            <option value="site" className="bg-sq-black">موقع</option>
            <option value="progress" className="bg-sq-black">تقدم أعمال</option>
            <option value="technical" className="bg-sq-black">فني</option>
            <option value="coordination" className="bg-sq-black">تنسيق</option>
            <option value="safety" className="bg-sq-black">سلامة</option>
          </Select>
          <Input
            placeholder="المكان"
            value={form.location || ""}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <Input
            placeholder="رئيس الاجتماع"
            value={form.chairperson || ""}
            onChange={(e) => setForm({ ...form, chairperson: e.target.value })}
          />
          <Input
            placeholder="محرر المحضر"
            value={form.minutesBy || ""}
            onChange={(e) => setForm({ ...form, minutesBy: e.target.value })}
          />
          <Select
            value={form.status || "draft"}
            onChange={(e) => setForm({ ...form, status: e.target.value as MeetingItem["status"] })}
          >
            <option value="draft" className="bg-sq-black">مسودة</option>
            <option value="reviewed" className="bg-sq-black">مراجعة</option>
            <option value="approved" className="bg-sq-black">معتمد</option>
          </Select>
        </div>
        <TextArea
          placeholder="الحاضرون"
          value={form.attendees || ""}
          onChange={(e) => setForm({ ...form, attendees: e.target.value })}
          rows={2}
        />
        <TextArea
          placeholder="الملخص"
          value={form.summary || ""}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ meetingDate: todayInputValue() });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الرقم</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">النوع</th>
              <th className="px-4 py-3 text-right">المكان</th>
              <th className="px-4 py-3 text-right">رئيس الاجتماع</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.meetingNumber}</td>
                <td className="px-4 py-3 text-white/70">{it.meetingDate}</td>
                <td className="px-4 py-3 text-white/80">{it.meetingType}</td>
                <td className="px-4 py-3 text-white/80">{it.location}</td>
                <td className="px-4 py-3 text-white/80">{it.chairperson}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                    {statusLabel(it.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton className="px-2 py-1 text-xs" onClick={() => onOpenActionItems(it)}>
                      بنود الإجراء ({it.actionItemsCount})
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  لا توجد محاضر اجتماعات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MeetingActionItemsModal({
  projectId,
  meeting,
  onClose,
  onShowError,
  onShowSuccess,
  statusBadge,
  statusLabel,
}: {
  projectId: number;
  meeting: MeetingItem;
  onClose: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  statusBadge: (s: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [items, setItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<MeetingActionItem>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMeetingActionItems(projectId, meeting.id)
      .then(setItems)
      .catch(() => onShowError("تعذر تحميل بنود الإجراء."))
      .finally(() => setLoading(false));
  }, [projectId, meeting.id, onShowError]);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateMeetingActionItem(projectId, meeting.id, editingId, payload)
      : await createMeetingActionItem(projectId, meeting.id, payload);
    if (res.ok) {
      setForm({});
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      const updated = await fetchMeetingActionItems(projectId, meeting.id);
      setItems(updated);
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteMeetingActionItem(projectId, meeting.id, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      const updated = await fetchMeetingActionItems(projectId, meeting.id);
      setItems(updated);
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-sq-black border border-white/10 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold text-white">بنود الإجراء — {meeting.meetingNumber}</h3>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 mb-4">
          <div className="grid md:grid-cols-4 gap-3">
            <Input
              placeholder="رقم البند"
              value={form.itemNumber || ""}
              onChange={(e) => setForm({ ...form, itemNumber: e.target.value })}
            />
            <Input
              placeholder="المسؤول"
              value={form.responsible || ""}
              onChange={(e) => setForm({ ...form, responsible: e.target.value })}
            />
            <Input
              type="date"
              value={form.dueDate || ""}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <Select
              value={form.status || "open"}
              onChange={(e) => setForm({ ...form, status: e.target.value as MeetingActionItem["status"] })}
            >
              <option value="open" className="bg-sq-black">مفتوح</option>
              <option value="in_progress" className="bg-sq-black">قيد التنفيذ</option>
              <option value="completed" className="bg-sq-black">مكتمل</option>
              <option value="closed" className="bg-sq-black">مغلق</option>
            </Select>
          </div>
          <TextArea
            placeholder="الوصف"
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
            {editingId && (
              <SecondaryButton
                onClick={() => {
                  setForm({});
                  setEditingId(null);
                }}
              >
                إلغاء
              </SecondaryButton>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-white/50">جاري التحميل…</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-3 text-right">رقم البند</th>
                  <th className="px-4 py-3 text-right">الوصف</th>
                  <th className="px-4 py-3 text-right">المسؤول</th>
                  <th className="px-4 py-3 text-right">تاريخ الاستحقاق</th>
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-bold">{it.itemNumber}</td>
                    <td className="px-4 py-3 text-white">{it.description}</td>
                    <td className="px-4 py-3 text-white/80">{it.responsible}</td>
                    <td className="px-4 py-3 text-white/70">{it.dueDate || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                        {statusLabel(it.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SecondaryButton
                          className="px-2 py-1 text-xs"
                          onClick={() => {
                            setForm(it);
                            setEditingId(it.id);
                          }}
                        >
                          تعديل
                        </SecondaryButton>
                        <SecondaryButton
                          className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                          onClick={() => handleDelete(it.id)}
                        >
                          حذف
                        </SecondaryButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                      لا توجد بنود إجراء.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyReportsSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
}: {
  projectId: number;
  items: DailyReportItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [form, setForm] = useState<Partial<DailyReportItem>>({ date: todayInputValue() });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateDailyReport(projectId, editingId, payload)
      : await createDailyReport(projectId, payload);
    if (res.ok) {
      setForm({ date: todayInputValue() });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteDailyReport(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Input
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            placeholder="الطقس"
            value={form.weather || ""}
            onChange={(e) => setForm({ ...form, weather: e.target.value })}
          />
          <Input
            placeholder="درجة الحرارة"
            value={form.temperature || ""}
            onChange={(e) => setForm({ ...form, temperature: e.target.value })}
          />
          <Input
            type="number"
            placeholder="إجمالي العمال"
            value={form.totalWorkers ?? ""}
            onChange={(e) => setForm({ ...form, totalWorkers: Number(e.target.value) })}
          />
        </div>
        <TextArea
          placeholder="ملخص الأعمال المنفذة"
          value={form.workDoneSummary || ""}
          onChange={(e) => setForm({ ...form, workDoneSummary: e.target.value })}
          rows={2}
        />
        <TextArea
          placeholder="الكميات المنفذة"
          value={form.quantitiesExecuted || ""}
          onChange={(e) => setForm({ ...form, quantitiesExecuted: e.target.value })}
          rows={2}
        />
        <TextArea
          placeholder="المواد المستلمة"
          value={form.materialsReceived || ""}
          onChange={(e) => setForm({ ...form, materialsReceived: e.target.value })}
          rows={2}
        />
        <TextArea
          placeholder="المشاكل / التأخيرات / ملاحظات السلامة"
          value={form.issuesEncountered || ""}
          onChange={(e) =>
            setForm({
              ...form,
              issuesEncountered: e.target.value,
            })
          }
          rows={2}
        />
        <TextArea
          placeholder="خطة اليوم التالي"
          value={form.planForNextDay || ""}
          onChange={(e) => setForm({ ...form, planForNextDay: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ date: todayInputValue() });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">الطقس</th>
              <th className="px-4 py-3 text-right">العمال</th>
              <th className="px-4 py-3 text-right">ملخص الأعمال</th>
              <th className="px-4 py-3 text-right">المواد</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.date}</td>
                <td className="px-4 py-3 text-white/70">{it.weather}</td>
                <td className="px-4 py-3 text-white/80">{it.totalWorkers}</td>
                <td className="px-4 py-3 text-white">{it.workDoneSummary}</td>
                <td className="px-4 py-3 text-white/70">{it.materialsReceived}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  لا توجد تقارير يومية.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeliveryNotesSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
  onOpenItems,
}: {
  projectId: number;
  items: DeliveryNoteItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  onOpenItems: (note: DeliveryNoteItem) => void;
}) {
  const [form, setForm] = useState<Partial<DeliveryNoteItem>>({ deliveryDate: todayInputValue() });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateDeliveryNote(projectId, editingId, payload)
      : await createDeliveryNote(projectId, payload);
    if (res.ok) {
      setForm({ deliveryDate: todayInputValue() });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteDeliveryNote(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Input
            type="date"
            value={form.deliveryDate || ""}
            onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
          />
          <Input
            placeholder="المورد"
            value={form.supplierName || ""}
            onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
          />
          <Input
            placeholder="رقم اللوحة"
            value={form.vehiclePlate || ""}
            onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })}
          />
          <Input
            placeholder="اسم السائق"
            value={form.driverName || ""}
            onChange={(e) => setForm({ ...form, driverName: e.target.value })}
          />
        </div>
        <TextArea
          placeholder="ملاحظات"
          value={form.notes || ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ deliveryDate: todayInputValue() });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">المورد</th>
              <th className="px-4 py-3 text-right">رقم اللوحة</th>
              <th className="px-4 py-3 text-right">السائق</th>
              <th className="px-4 py-3 text-right">البنود</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.deliveryDate}</td>
                <td className="px-4 py-3 text-white">{it.supplierName}</td>
                <td className="px-4 py-3 text-white/70">{it.vehiclePlate}</td>
                <td className="px-4 py-3 text-white/70">{it.driverName}</td>
                <td className="px-4 py-3 text-white/80">{it.itemsCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton className="px-2 py-1 text-xs" onClick={() => onOpenItems(it)}>
                      البنود
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  لا توجد مذكرات استلام.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeliveryItemsModal({
  projectId,
  note,
  onClose,
  onShowError,
  onShowSuccess,
}: {
  projectId: number;
  note: DeliveryNoteItem;
  onClose: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
}) {
  const [items, setItems] = useState<DeliveryNoteLineItem[]>([]);
  const [form, setForm] = useState<Partial<DeliveryNoteLineItem>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDeliveryNoteItems(projectId, note.id)
      .then((loaded) => {
        if (!cancelled) setItems(loaded);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [note.id, projectId]);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateDeliveryNoteItem(projectId, note.id, editingId, payload)
      : await addDeliveryNoteItem(projectId, note.id, payload);
    if (res.ok) {
      setForm({});
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onClose();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await removeDeliveryNoteItem(projectId, note.id, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      setItems(items.filter((it) => it.id !== id));
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-sq-black border border-white/10 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold text-white">بنود مذكرة الاستلام — {note.supplierName}</h3>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 mb-4">
          <div className="grid md:grid-cols-5 gap-3">
            <Input
              placeholder="الوصف"
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="md:col-span-2"
            />
            <Input
              placeholder="الكمية"
              type="number"
              step="0.001"
              value={form.quantity ?? ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
            <Input
              placeholder="الوحدة"
              value={form.unit || ""}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <Input
              placeholder="سعر الوحدة"
              type="number"
              step="0.01"
              value={form.unitPrice ?? ""}
              onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
            {editingId && (
              <SecondaryButton
                onClick={() => {
                  setForm({});
                  setEditingId(null);
                }}
              >
                إلغاء
              </SecondaryButton>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-right">الوصف</th>
                <th className="px-4 py-3 text-right">الكمية</th>
                <th className="px-4 py-3 text-right">الوحدة</th>
                <th className="px-4 py-3 text-right">سعر الوحدة</th>
                <th className="px-4 py-3 text-right">الإجمالي</th>
                <th className="px-4 py-3 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 text-white">{it.description}</td>
                  <td className="px-4 py-3 text-white/80">{it.quantity}</td>
                  <td className="px-4 py-3 text-white/70">{it.unit}</td>
                  <td className="px-4 py-3 text-white/80">{it.unitPrice}</td>
                  <td className="px-4 py-3 text-emerald-300">{it.total}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <SecondaryButton
                        className="px-2 py-1 text-xs"
                        onClick={() => {
                          setForm(it);
                          setEditingId(it.id);
                        }}
                      >
                        تعديل
                      </SecondaryButton>
                      <SecondaryButton
                        className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                        onClick={() => handleDelete(it.id)}
                      >
                        حذف
                      </SecondaryButton>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                    لا توجد بنود. أضف البنود يدوياً حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RfiSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
  statusBadge,
  statusLabel,
}: {
  projectId: number;
  items: RfiItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  statusBadge: (s: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [form, setForm] = useState<Partial<RfiItem>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateRfiItem(projectId, editingId, payload)
      : await createRfiItem(projectId, payload);
    if (res.ok) {
      setForm({});
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteRfiItem(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Input
            placeholder="رقم RFI"
            value={form.rfiNumber || ""}
            onChange={(e) => setForm({ ...form, rfiNumber: e.target.value })}
          />
          <Input
            placeholder="الموضوع"
            value={form.subject || ""}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <Select
            value={form.category || "other"}
            onChange={(e) => setForm({ ...form, category: e.target.value as RfiItem["category"] })}
          >
            <option value="design" className="bg-sq-black">تصميم</option>
            <option value="specification" className="bg-sq-black">مواصفات</option>
            <option value="site_condition" className="bg-sq-black">ظروف الموقع</option>
            <option value="material" className="bg-sq-black">مواد</option>
            <option value="other" className="bg-sq-black">أخرى</option>
          </Select>
          <Select
            value={form.priority || "medium"}
            onChange={(e) => setForm({ ...form, priority: e.target.value as RfiItem["priority"] })}
          >
            <option value="low" className="bg-sq-black">منخفض</option>
            <option value="medium" className="bg-sq-black">متوسط</option>
            <option value="high" className="bg-sq-black">عالي</option>
            <option value="urgent" className="bg-sq-black">عاجل</option>
          </Select>
          <Select
            value={form.status || "open"}
            onChange={(e) => setForm({ ...form, status: e.target.value as RfiItem["status"] })}
          >
            <option value="open" className="bg-sq-black">مفتوح</option>
            <option value="answered" className="bg-sq-black">تم الرد</option>
            <option value="closed" className="bg-sq-black">مغلق</option>
          </Select>
          <Input
            placeholder="مقدم إلى"
            value={form.submittedTo || ""}
            onChange={(e) => setForm({ ...form, submittedTo: e.target.value })}
          />
          <Input
            type="number"
            placeholder="أيام للرد"
            value={form.daysToRespond ?? ""}
            onChange={(e) => setForm({ ...form, daysToRespond: Number(e.target.value) })}
          />
        </div>
        <TextArea
          placeholder="السؤال"
          value={form.question || ""}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          rows={2}
        />
        <TextArea
          placeholder="الرد"
          value={form.response || ""}
          onChange={(e) => setForm({ ...form, response: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({});
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الرقم</th>
              <th className="px-4 py-3 text-right">الموضوع</th>
              <th className="px-4 py-3 text-right">التصنيف</th>
              <th className="px-4 py-3 text-right">الأولوية</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">مقدم إلى</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.rfiNumber}</td>
                <td className="px-4 py-3 text-white">{it.subject}</td>
                <td className="px-4 py-3 text-white/70">{it.category}</td>
                <td className="px-4 py-3 text-white/80">{it.priority}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                    {statusLabel(it.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/80">{it.submittedTo}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  لا توجد طلبات معلومات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NcrSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
  statusBadge,
  statusLabel,
}: {
  projectId: number;
  items: NcrItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  statusBadge: (s: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [form, setForm] = useState<Partial<NcrItem>>({ date: todayInputValue() });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateNcrItem(projectId, editingId, payload)
      : await createNcrItem(projectId, payload);
    if (res.ok) {
      setForm({ date: todayInputValue() });
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteNcrItem(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Input
            placeholder="رقم NCR"
            value={form.ncrNumber || ""}
            onChange={(e) => setForm({ ...form, ncrNumber: e.target.value })}
          />
          <Input
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            placeholder="الموقع"
            value={form.location || ""}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <Select
            value={form.severity || "minor"}
            onChange={(e) => setForm({ ...form, severity: e.target.value as NcrItem["severity"] })}
          >
            <option value="minor" className="bg-sq-black">بسيط</option>
            <option value="major" className="bg-sq-black">كبير</option>
            <option value="critical" className="bg-sq-black">حرج</option>
          </Select>
          <Select
            value={form.status || "open"}
            onChange={(e) => setForm({ ...form, status: e.target.value as NcrItem["status"] })}
          >
            <option value="open" className="bg-sq-black">مفتوح</option>
            <option value="action_taken" className="bg-sq-black">تم اتخاذ إجراء</option>
            <option value="closed" className="bg-sq-black">مغلق</option>
          </Select>
          <Input
            type="date"
            placeholder="موعد الإجراء"
            value={form.actionDeadline || ""}
            onChange={(e) => setForm({ ...form, actionDeadline: e.target.value })}
          />
          <Input
            placeholder="مرجع البند"
            value={form.clauseRef || ""}
            onChange={(e) => setForm({ ...form, clauseRef: e.target.value })}
          />
        </div>
        <TextArea
          placeholder="الوصف"
          value={form.description || ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
        <TextArea
          placeholder="الإجراء التصحيحي"
          value={form.correctiveAction || ""}
          onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({ date: todayInputValue() });
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الرقم</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">الموقع</th>
              <th className="px-4 py-3 text-right">الخطورة</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">موعد الإجراء</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.ncrNumber}</td>
                <td className="px-4 py-3 text-white/70">{it.date}</td>
                <td className="px-4 py-3 text-white">{it.location}</td>
                <td className="px-4 py-3 text-white/80">{it.severity}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                    {statusLabel(it.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/70">{it.actionDeadline || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  لا توجد مخالفات جودة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmittalsSection({
  projectId,
  items,
  onRefresh,
  onShowError,
  onShowSuccess,
  statusBadge,
  statusLabel,
}: {
  projectId: number;
  items: SubmittalItem[];
  onRefresh: () => void;
  onShowError: (err: unknown) => void;
  onShowSuccess: (msg: string) => void;
  statusBadge: (s: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [form, setForm] = useState<Partial<SubmittalItem>>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  async function handleSave() {
    const payload = { ...form };
    const res = editingId
      ? await updateSubmittalItem(projectId, editingId, payload)
      : await createSubmittalItem(projectId, payload);
    if (res.ok) {
      setForm({});
      setEditingId(null);
      onShowSuccess(editingId ? "تم التحديث." : "تمت الإضافة.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("هل أنت متأكد؟")) return;
    const res = await deleteSubmittalItem(projectId, id);
    if (res.ok) {
      onShowSuccess("تم الحذف.");
      onRefresh();
    } else {
      onShowError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-3">
          <Input
            placeholder="رقم المستند"
            value={form.submittalNumber || ""}
            onChange={(e) => setForm({ ...form, submittalNumber: e.target.value })}
          />
          <Input
            placeholder="العنوان"
            value={form.title || ""}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Select
            value={form.category || "material_sample"}
            onChange={(e) => setForm({ ...form, category: e.target.value as SubmittalItem["category"] })}
          >
            <option value="material_sample" className="bg-sq-black">عينة مادة</option>
            <option value="shop_drawing" className="bg-sq-black">رسم ورشة</option>
            <option value="method_statement" className="bg-sq-black">ميثاق عمل</option>
            <option value="test_report" className="bg-sq-black">تقرير اختبار</option>
            <option value="certificate" className="bg-sq-black">شهادة</option>
          </Select>
          <Select
            value={form.status || "submitted"}
            onChange={(e) => setForm({ ...form, status: e.target.value as SubmittalItem["status"] })}
          >
            <option value="submitted" className="bg-sq-black">مرسل</option>
            <option value="under_review" className="bg-sq-black">قيد المراجعة</option>
            <option value="approved" className="bg-sq-black">معتمد</option>
            <option value="approved_with_comments" className="bg-sq-black">معتمد بملاحظات</option>
            <option value="rejected" className="bg-sq-black">مرفوض</option>
          </Select>
          <Input
            placeholder="مقدم إلى"
            value={form.submittedTo || ""}
            onChange={(e) => setForm({ ...form, submittedTo: e.target.value })}
          />
        </div>
        <TextArea
          placeholder="الرد"
          value={form.response || ""}
          onChange={(e) => setForm({ ...form, response: e.target.value })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>{editingId ? "تحديث" : "حفظ"}</Button>
          {editingId && (
            <SecondaryButton
              onClick={() => {
                setForm({});
                setEditingId(null);
              }}
            >
              إلغاء
            </SecondaryButton>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-right">الرقم</th>
              <th className="px-4 py-3 text-right">العنوان</th>
              <th className="px-4 py-3 text-right">التصنيف</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">مقدم إلى</th>
              <th className="px-4 py-3 text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="px-4 py-3 text-white font-bold">{it.submittalNumber}</td>
                <td className="px-4 py-3 text-white">{it.title}</td>
                <td className="px-4 py-3 text-white/70">{it.category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusBadge(it.status)}`}>
                    {statusLabel(it.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/80">{it.submittedTo}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SecondaryButton
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(it);
                        setEditingId(it.id);
                      }}
                    >
                      تعديل
                    </SecondaryButton>
                    <SecondaryButton
                      className="px-2 py-1 text-xs bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                      onClick={() => handleDelete(it.id)}
                    >
                      حذف
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  لا توجد مستندات تسليم.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
