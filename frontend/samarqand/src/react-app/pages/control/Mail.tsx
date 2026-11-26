import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Search,
  Send,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteMailMessage,
  fetchMailFolders,
  fetchMailMessages,
  fetchMailUsers,
  hardDeleteMailMessage,
  markMailRead,
  markMailUnread,
  moveMailMessage,
  sendMail,
  toggleStarMailMessage,
  uploadMailAttachment,
  type MailAttachment,
  type MailFolder,
  type MailMessage,
  type MailUser,
} from "@/react-app/api/mail";

const FOLDER_LABELS: Record<string, string> = {
  inbox: "الوارد",
  sent: "المرسل",
  drafts: "المسودات",
  trash: "سلة المهملات",
};

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return d.toLocaleDateString("ar-SA", { weekday: "long" });
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export default function ControlMail() {
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState("inbox");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<MailMessage | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeReplyTo, setComposeReplyTo] = useState<MailMessage | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 4000);
  }, []);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchMailFolders();
      setFolders(data.folders);
    } catch {
      // ignore
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMailMessages({ folder: currentFolder, search, page, pageSize: 30 });
      setMessages(data.items);
      setTotalMessages(data.total);
    } catch {
      showError("تعذر تحميل الرسائل.");
    } finally {
      setLoading(false);
    }
  }, [currentFolder, search, page, showError]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    setPage(1);
    setSelectedMsg(null);
    setShowDetail(false);
  }, [currentFolder]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!searchTimer.current) return;
    clearTimeout(searchTimer.current);
  }, []);

  function onSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  }

  async function openMessage(msg: MailMessage) {
    setSelectedMsg(msg);
    setShowDetail(true);
    if (!msg.isRead && msg.isIncoming) {
      await markMailRead(msg.id).catch(() => {});
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
      loadFolders();
    }
  }

  async function handleStar(msgId: number) {
    const prev = messages.find((m) => m.id === msgId);
    if (!prev) return;
    setMessages((prevMsgs) => prevMsgs.map((m) => (m.id === msgId ? { ...m, isStarred: !m.isStarred } : m)));
    const result = await toggleStarMailMessage(msgId);
    if (!result.ok) {
      setMessages((prevMsgs) => prevMsgs.map((m) => (m.id === msgId ? { ...m, isStarred: prev.isStarred } : m)));
    }
  }

  async function handleDelete(msgId: number) {
    setSelectedMsg(null);
    setShowDetail(false);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    const result = await deleteMailMessage(msgId);
    if (result.ok) {
      showSuccess("نقل إلى سلة المهملات");
      loadFolders();
    } else {
      showError("تعذر الحذف");
      loadMessages();
    }
  }

  async function handleHardDelete(msgId: number) {
    setSelectedMsg(null);
    setShowDetail(false);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    const result = await hardDeleteMailMessage(msgId);
    if (result.ok) {
      showSuccess("حذف نهائي");
      loadFolders();
    } else {
      showError("تعذر الحذف");
      loadMessages();
    }
  }

  async function handleReadUnread(msg: MailMessage) {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: !m.isRead } : m)));
    if (msg.isRead) {
      await markMailUnread(msg.id);
    } else {
      await markMailRead(msg.id);
    }
    loadFolders();
  }

  async function handleMoveToFolder(msgId: number, folder: string) {
    await moveMailMessage(msgId, folder);
    setSelectedMsg(null);
    setShowDetail(false);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    showSuccess(`نقل إلى ${FOLDER_LABELS[folder] || folder}`);
    loadFolders();
  }

  function openCompose(replyTo?: MailMessage) {
    setComposeReplyTo(replyTo || null);
    setShowCompose(true);
  }

  const unreadCount = useMemo(() => {
    const f = folders.find((x) => x.key === "inbox");
    return f?.unread || 0;
  }, [folders]);

  const totalPages = Math.max(1, Math.ceil(totalMessages / 30));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 via-white/5 to-red-500/30 flex items-center justify-center border border-white/10">
            <Mail size={18} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">البريد الإلكتروني</h2>
            <p className="text-xs text-white/60">
              {FOLDER_LABELS[currentFolder] || currentFolder} • {totalMessages} رسالة
              {unreadCount > 0 && ` • ${unreadCount} غير مقروء`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCompose()}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-emerald-400 transition shadow-lg"
          >
            <Send size={16} />
            <span>رسالة جديدة</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{errorMsg}</div>
      )}
      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm">
          {successMsg}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث في الرسائل..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 pr-10 pl-4 text-sm text-white placeholder-white/40 outline-none focus:border-emerald-500/50 transition"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
        {/* Folder sidebar */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-2 space-y-1">
            {folders.map((f) => {
              const icons: Record<string, React.FC<{ size?: number }>> = {
                inbox: Inbox,
                sent: Send,
                drafts: FileText,
                trash: Trash2,
              };
              const Icon = icons[f.key] || Mail;
              const active = currentFolder === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setCurrentFolder(f.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/20 via-white/5 to-red-500/20 border border-white/15 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  <Icon size={16} />
                  <span className="flex-1 text-right">{f.label}</span>
                  {f.key === "inbox" && f.unread > 0 ? (
                    <span className="bg-emerald-500/30 text-emerald-300 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                      {f.unread}
                    </span>
                  ) : f.count > 0 ? (
                    <span className="text-white/40 text-[11px]">{f.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message list + detail */}
        <div className="space-y-4">
          {selectedMsg && showDetail ? (
            <MessageDetail
              message={selectedMsg}
              onBack={() => setShowDetail(false)}
              onStar={handleStar}
              onDelete={handleDelete}
              onHardDelete={handleHardDelete}
              onReadUnread={handleReadUnread}
              onReply={(msg) => openCompose(msg)}
              onMoveToFolder={handleMoveToFolder}
            />
          ) : (
            <>
              {/* Message list */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-white/40 text-sm">جاري التحميل...</div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-white/40 text-sm">لا توجد رسائل</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {messages.map((msg) => (
                      <button
                        key={msg.id}
                        type="button"
                        onClick={() => openMessage(msg)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-white/5 transition text-right"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStar(msg.id);
                          }}
                          className="mt-1 shrink-0"
                        >
                          <Star
                            size={14}
                            className={msg.isStarred ? "fill-yellow-400 text-yellow-400" : "text-white/20 hover:text-white/40"}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm truncate ${msg.isRead ? "text-white/70" : "text-white font-extrabold"}`}
                            >
                              {msg.isIncoming ? msg.senderName : "أنت"}
                            </span>
                            <span className="text-[11px] text-white/40 shrink-0">{formatTime(msg.createdAt)}</span>
                          </div>
                          <div
                            className={`text-sm truncate mt-0.5 ${msg.isRead ? "text-white/50" : "text-white/80 font-bold"}`}
                          >
                            {msg.subject || "(بدون موضوع)"}
                          </div>
                          <div className="text-xs text-white/40 truncate mt-0.5">{truncate(msg.body, 100)}</div>
                        </div>
                        {msg.attachments.length > 0 && (
                          <Paperclip size={12} className="mt-2 shrink-0 text-white/30" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span className="text-xs text-white/50">
                    صفحة {page} من {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          replyTo={composeReplyTo}
          onClose={() => {
            setShowCompose(false);
            setComposeReplyTo(null);
          }}
          onSent={() => {
            setShowCompose(false);
            setComposeReplyTo(null);
            loadMessages();
            loadFolders();
            showSuccess("تم الإرسال بنجاح");
          }}
          showError={showError}
        />
      )}
    </div>
  );
}

function MessageDetail({
  message,
  onBack,
  onStar,
  onDelete,
  onHardDelete,
  onReadUnread,
  onReply,
  onMoveToFolder,
}: {
  message: MailMessage;
  onBack: () => void;
  onStar: (id: number) => void;
  onDelete: (id: number) => void;
  onHardDelete: (id: number) => void;
  onReadUnread: (msg: MailMessage) => void;
  onReply: (msg: MailMessage) => void;
  onMoveToFolder: (id: number, folder: string) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/70"
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-sm font-bold text-white/80">تفاصيل الرسالة</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStar(message.id)}
            className="p-2 rounded-xl hover:bg-white/10 transition"
          >
            <Star
              size={15}
              className={message.isStarred ? "fill-yellow-400 text-yellow-400" : "text-white/40"}
            />
          </button>
          <button
            type="button"
            onClick={() => onReadUnread(message)}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/40"
          >
            {message.isRead ? <MailOpen size={15} /> : <Mail size={15} />}
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/40"
          >
            <Reply size={15} />
          </button>
          {message.folder === "trash" ? (
            <button
              type="button"
              onClick={() => onHardDelete(message.id)}
              className="p-2 rounded-xl hover:bg-red-500/20 transition text-red-400"
            >
              <Trash2 size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/40"
            >
              <Trash2 size={15} />
            </button>
          )}
          {message.folder === "inbox" && (
            <button
              type="button"
              onClick={() => onMoveToFolder(message.id, "trash")}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/40"
            >
              <X size={15} />
            </button>
          )}
          {message.folder === "trash" && (
            <button
              type="button"
              onClick={() => onMoveToFolder(message.id, "inbox")}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/40 text-xs px-3 font-bold"
            >
              استعادة
            </button>
          )}
          {message.folder === "drafts" && (
            <button
              type="button"
              onClick={() => onReply(message)}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/40 text-xs px-3 font-bold"
            >
              تعديل
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4 text-right">
        <h3 className="text-lg font-extrabold text-white">{message.subject || "(بدون موضوع)"}</h3>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-red-500 flex items-center justify-center text-sm font-extrabold text-white shrink-0">
            {(message.senderName || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white text-sm">{message.senderName}</div>
            <div className="text-xs text-white/50 mt-1">
              {new Date(message.createdAt).toLocaleString("ar-SA")}
            </div>
          </div>
        </div>

        {message.attachments.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="text-xs font-bold text-white/50 mb-2 flex items-center gap-2">
              <Paperclip size={12} />
              <span>مرفقات ({message.attachments.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70"
                >
                  <FileText size={12} />
                  <span>{a.filename}</span>
                  {a.fileSize > 0 && (
                    <span className="text-white/40">({Math.round(a.fileSize / 1024)} KB)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap min-h-[100px]">
          {message.body || "(لا يوجد محتوى)"}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition text-sm font-bold text-white"
          >
            <Reply size={14} />
            <span>رد</span>
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-bold text-white/70"
          >
            <ReplyAll size={14} />
            <span>رد للكل</span>
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm font-bold text-white/70"
          >
            <Forward size={14} />
            <span>إعادة توجيه</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposeModal({
  replyTo,
  onClose,
  onSent,
  showError,
}: {
  replyTo: MailMessage | null;
  onClose: () => void;
  onSent: () => void;
  showError: (msg: string) => void;
}) {
  const [recipients, setRecipients] = useState<number[]>(replyTo ? [replyTo.senderId] : []);
  const [subject, setSubject] = useState(replyTo ? `رد: ${replyTo.subject}` : "");
  const [body, setBody] = useState(replyTo ? `\n\n---\n${replyTo.body}` : "");
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [users, setUsers] = useState<MailUser[]>([]);
  const [searchUser, setSearchUser] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMailUsers("").then((d) => setUsers(d.users)).catch(() => {});
  }, []);

  async function handleSearchUser(val: string) {
    setSearchUser(val);
    if (val.length < 1) {
      fetchMailUsers("").then((d) => setUsers(d.users)).catch(() => {});
      return;
    }
    try {
      const d = await fetchMailUsers(val);
      setUsers(d.users);
    } catch {
      // ignore
    }
  }

  function toggleRecipient(uid: number) {
    setRecipients((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMailAttachment(file);
      if (result.ok && result.attachment) {
        setAttachments((prev) => [...prev, result.attachment!]);
      } else {
        showError("فشل رفع الملف");
      }
    } catch {
      showError("فشل رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id: number) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSend() {
    if (recipients.length === 0) {
      showError("يرجى اختيار مستلم واحد على الأقل.");
      return;
    }
    setSending(true);
    try {
      const result = await sendMail({
        subject,
        body,
        recipients,
        cc: [],
        bcc: [],
        parentId: replyTo?.id || null,
        attachmentIds: attachments.map((a) => a.id),
      });
      if (result.ok) {
        onSent();
      } else {
        showError(result.error || "فشل الإرسال");
      }
    } catch {
      showError("فشل الإرسال");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    setSending(true);
    try {
      await sendMail({
        subject,
        body,
        recipients,
        cc: [],
        bcc: [],
        saveAsDraft: true,
        attachmentIds: attachments.map((a) => a.id),
      });
      onSent();
    } catch {
      showError("فشل حفظ المسودة");
    } finally {
      setSending(false);
    }
  }

  const selectedUsers = useMemo(
    () => users.filter((u) => recipients.includes(u.id)),
    [users, recipients],
  );

  const availableUsers = useMemo(
    () => users.filter((u) => !recipients.includes(u.id)),
    [users, recipients],
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-2xl bg-[#0B0F19] border border-white/20 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-extrabold text-white text-lg">
            {replyTo ? "رد على الرسالة" : "رسالة جديدة"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Recipients */}
          <div>
            <label className="text-xs font-bold text-white/50 block mb-1.5">إلى</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                >
                  {u.fullName || u.username}
                  <button type="button" onClick={() => toggleRecipient(u.id)} className="hover:text-white">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={searchUser}
              onChange={(e) => handleSearchUser(e.target.value)}
              placeholder="ابحث عن مستخدم..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500/50 transition"
            />
            {searchUser && availableUsers.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto bg-white/10 border border-white/10 rounded-xl">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      toggleRecipient(u.id);
                      setSearchUser("");
                    }}
                    className="w-full text-right px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
                  >
                    {u.fullName || u.username} ({u.username})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CC / BCC toggles */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCc((v) => !v)}
              className="text-xs text-white/50 hover:text-white/80 transition font-bold"
            >
              {showCc ? "إخفاء CC" : "CC"}
            </button>
            <button
              type="button"
              onClick={() => setShowBcc((v) => !v)}
              className="text-xs text-white/50 hover:text-white/80 transition font-bold"
            >
              {showBcc ? "إخفاء BCC" : "BCC"}
            </button>
          </div>

          {showCc && (
            <div>
              <label className="text-xs font-bold text-white/50 block mb-1.5">CC</label>
              <input
                type="text"
                placeholder="..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
              />
            </div>
          )}

          {showBcc && (
            <div>
              <label className="text-xs font-bold text-white/50 block mb-1.5">BCC</label>
              <input
                type="text"
                placeholder="..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
              />
            </div>
          )}

          {/* Subject */}
          <div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="الموضوع"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500/50 transition"
            />
          </div>

          {/* Body */}
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="محتوى الرسالة..."
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500/50 transition resize-y"
            />
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer text-xs font-bold text-white/70">
                <Paperclip size={14} />
                <span>إرفاق ملف</span>
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
              {uploading && <span className="text-xs text-white/50">جاري الرفع...</span>}
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/70"
                  >
                    <FileText size={12} />
                    <span>{a.filename}</span>
                    <button type="button" onClick={() => removeAttachment(a.id)} className="hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-extrabold hover:from-emerald-500 hover:to-emerald-400 transition disabled:opacity-50 shadow-lg"
            >
              <Send size={16} />
              <span>{sending ? "..." : "إرسال"}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
            >
              <FileText size={16} />
              <span>مسودة</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/50 text-sm hover:bg-white/10 transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
