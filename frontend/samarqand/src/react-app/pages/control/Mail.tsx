import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCw,
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
  const [mailUsers, setMailUsers] = useState<MailUser[]>([]);
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
    fetchMailUsers("")
      .then((d) => setMailUsers(d.users))
      .catch(() => setMailUsers([]));
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
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
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
            <h1 className="text-lg font-extrabold text-white">البريد الإلكتروني</h1>
            <p className="text-xs text-white/60">
              {FOLDER_LABELS[currentFolder] || currentFolder} • {totalMessages} رسالة
              {unreadCount > 0 && ` • ${unreadCount} غير مقروء`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadMessages();
              loadFolders();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw size={16} />
            <span>تحديث</span>
          </button>
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
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث في الرسائل..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-2 pr-10 pl-4 text-sm text-white placeholder-white/70 outline-none focus:border-emerald-500/50 transition"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
        {/* Folder sidebar */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-2 space-y-1">
            {folders.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-white/70">
                لا توجد مجلدات لعرضها.
              </div>
            ) : null}
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
                    <span className="text-white/60 text-[11px]">{f.count}</span>
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
              users={mailUsers}
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
                  <div className="p-8 text-center text-white/60 text-sm">جاري التحميل...</div>
                ) : messages.length === 0 ? (
                  <div className="p-10 text-center">
                    <Inbox size={30} className="mx-auto text-white/25" />
                    <div className="font-bold text-white/80 mt-3">
                      {search
                        ? "لا توجد رسائل مطابقة للبحث"
                        : `لا توجد رسائل في ${FOLDER_LABELS[currentFolder] || currentFolder}`}
                    </div>
                    <p className="text-xs text-white/70 mt-2">
                      {search
                        ? "جرّب كلمة بحث أخرى أو امسح عبارة البحث."
                        : "ستظهر الرسائل هنا عند وصولها أو بعد إنشاء رسالة جديدة."}
                    </p>
                    {search ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchInput("");
                          setSearch("");
                          setPage(1);
                        }}
                        className="mt-4 rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/15 transition"
                      >
                        مسح البحث
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openMessage(msg)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openMessage(msg);
                        }}
                        className={`w-full flex items-start gap-3 px-4 py-3.5 text-right transition cursor-pointer ${
                          msg.isRead
                            ? "hover:bg-white/5"
                            : "bg-emerald-500/5 border-r-2 border-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={msg.isStarred ? "إلغاء التمييز بنجمة" : "تمييز بنجمة"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStar(msg.id);
                          }}
                          className="mt-1 shrink-0"
                        >
                          <Star
                            size={14}
                            className={msg.isStarred ? "fill-yellow-400 text-yellow-400" : "text-white/60 hover:text-white/60"}
                          />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-sm truncate ${msg.isRead ? "text-white/70" : "text-white font-extrabold"}`}
                            >
                              {msg.isIncoming ? msg.senderName : "أنت"}
                            </span>
                            <span className="text-[11px] text-white/60 shrink-0">{formatTime(msg.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 min-w-0">
                            {!msg.isRead && msg.isIncoming ? (
                              <span className="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                                جديد
                              </span>
                            ) : null}
                            <span
                              className={`text-sm truncate ${msg.isRead ? "text-white/60" : "text-white font-bold"}`}
                            >
                              {msg.subject || "(بدون موضوع)"}
                            </span>
                          </div>
                          <div className="text-xs text-white/60 leading-relaxed mt-1 truncate">
                            {truncate(msg.body, 140) || "(لا يوجد محتوى)"}
                          </div>
                        </div>
                        {msg.attachments.length > 0 && (
                          <Paperclip size={12} className="mt-2 shrink-0 text-white/60" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="الصفحة السابقة"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span className="text-xs text-white/70">
                    صفحة {page} من {totalPages}
                  </span>
                  <button
                    type="button"
                    aria-label="الصفحة التالية"
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
          users={mailUsers}
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
  users,
  onBack,
  onStar,
  onDelete,
  onHardDelete,
  onReadUnread,
  onReply,
  onMoveToFolder,
}: {
  message: MailMessage;
  users: MailUser[];
  onBack: () => void;
  onStar: (id: number) => void;
  onDelete: (id: number) => void;
  onHardDelete: (id: number) => void;
  onReadUnread: (msg: MailMessage) => void;
  onReply: (msg: MailMessage) => void;
  onMoveToFolder: (id: number, folder: string) => void;
}) {
  const recipientNames = message.recipients.map((rid) => {
    const u = users.find((x) => x.id === rid);
    return u ? u.fullName || u.username : `#${rid}`;
  });

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
          {!message.isRead ? (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
              غير مقروء
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStar(message.id)}
            className="p-2 rounded-xl hover:bg-white/10 transition"
          >
            <Star
              size={15}
              className={message.isStarred ? "fill-yellow-400 text-yellow-400" : "text-white/60"}
            />
          </button>
          <button
            type="button"
            onClick={() => onReadUnread(message)}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/60"
          >
            {message.isRead ? <MailOpen size={15} /> : <Mail size={15} />}
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/60"
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
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/60"
            >
              <Trash2 size={15} />
            </button>
          )}
          {message.folder === "inbox" && (
            <button
              type="button"
              onClick={() => onMoveToFolder(message.id, "trash")}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/60"
            >
              <X size={15} />
            </button>
          )}
          {message.folder === "trash" && (
            <button
              type="button"
              onClick={() => onMoveToFolder(message.id, "inbox")}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/60 text-xs px-3 font-bold"
            >
              استعادة
            </button>
          )}
          {message.folder === "drafts" && (
            <button
              type="button"
              onClick={() => onReply(message)}
              className="p-2 rounded-xl hover:bg-white/10 transition text-white/60 text-xs px-3 font-bold"
            >
              تعديل
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4 text-right">
        <h2 className="text-xl font-extrabold leading-relaxed text-white">
          {message.subject || "(بدون موضوع)"}
        </h2>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-red-500 flex items-center justify-center text-sm font-extrabold text-white shrink-0">
              {(message.senderName || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-white/70">من</div>
              <div className="font-bold text-white text-sm mt-0.5">{message.senderName}</div>
            </div>
            <div className="text-xs text-white/70 shrink-0" dir="ltr">
              {new Date(message.createdAt).toLocaleString("ar-SA")}
            </div>
          </div>
          <div className="h-px bg-white/10 my-3" />
          <div className="text-xs text-white/70 mb-1">إلى</div>
          <div className="text-sm text-white/80 leading-relaxed">
            {recipientNames.length ? recipientNames.join("، ") : "—"}
          </div>
        </div>

        {message.attachments.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <div className="text-xs font-bold text-white/70 mb-2 flex items-center gap-2">
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
                    <span className="text-white/60">({Math.round(a.fileSize / 1024)} KB)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
          <div className="text-sm md:text-[15px] text-white/85 leading-8 whitespace-pre-wrap min-h-[100px]">
            {message.body || "(لا يوجد محتوى)"}
          </div>
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

function RecipientField({
  label,
  users,
  selected,
  onChange,
  error,
  hint,
  required = false,
}: {
  label: string;
  users: MailUser[];
  selected: number[];
  onChange: (ids: number[]) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MailUser[]>([]);
  const [searching, setSearching] = useState(false);
  const selectedKey = selected.join(",");

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const d = await fetchMailUsers(q);
        if (active) setResults(d.users.filter((u) => !selected.includes(u.id)));
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // selectedKey يغطي تغيّر القيم دون إعادة بحث عند تغيّر مرجع المصفوفة فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedKey]);

  function toggle(id: number) {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );
    setQuery("");
  }

  const selectedUsers = users.filter((u) => selected.includes(u.id));
  const unknownIds = selected.filter((id) => !users.some((u) => u.id === id));
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <label htmlFor={fieldId} className="text-xs font-bold text-white/60 block mb-1.5">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedUsers.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
            >
              {u.fullName || u.username}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`إزالة ${u.fullName || u.username}`}
                className="hover:text-white"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {unknownIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-white/70 text-xs font-bold"
            >
              #{id}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`إزالة المستلم ${id}`}
                className="hover:text-white"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          id={fieldId}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={hint || "ابحث عن مستخدم..."}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-sm text-white placeholder-white/70 outline-none transition ${
            error ? "border-red-400/70 focus:border-red-400" : "border-white/10 focus:border-emerald-500/50"
          }`}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="مسح البحث"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      {query.trim() ? (
        <div className="mt-1 max-h-32 overflow-y-auto bg-white/10 border border-white/10 rounded-xl">
          {searching ? (
            <div className="px-3 py-2 text-xs text-white/70">جارٍ البحث...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/70">
              لم يتم العثور على مستخدمين بهذا الاسم.
            </div>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="w-full text-right px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition"
              >
                {u.fullName || u.username} ({u.username})
              </button>
            ))
          )}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-red-400 mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ComposeModal({
  replyTo,
  users,
  onClose,
  onSent,
  showError,
}: {
  replyTo: MailMessage | null;
  users: MailUser[];
  onClose: () => void;
  onSent: () => void;
  showError: (msg: string) => void;
}) {
  const [recipients, setRecipients] = useState<number[]>(replyTo ? [replyTo.senderId] : []);
  const [ccRecipients, setCcRecipients] = useState<number[]>([]);
  const [bccRecipients, setBccRecipients] = useState<number[]>([]);
  const [subject, setSubject] = useState(replyTo ? `رد: ${replyTo.subject}` : "");
  const [body, setBody] = useState(replyTo ? `\n\n---\n${replyTo.body}` : "");
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ recipients?: string; subject?: string }>({});
  const subjectId = useId();
  const subjectErrorId = `${subjectId}-error`;
  const bodyId = useId();

  function validate(): boolean {
    const next: { recipients?: string; subject?: string } = {};
    if (recipients.length === 0) {
      next.recipients = "اختر مستلماً واحداً على الأقل قبل الإرسال.";
    }
    if (!subject.trim()) {
      next.subject = "اكتب موضوع الرسالة قبل الإرسال.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
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
    if (!validate()) return;
    setSending(true);
    try {
      const result = await sendMail({
        subject: subject.trim(),
        body,
        recipients,
        cc: ccRecipients,
        bcc: bccRecipients,
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
      const result = await sendMail({
        subject: subject.trim(),
        body,
        recipients,
        cc: ccRecipients,
        bcc: bccRecipients,
        saveAsDraft: true,
        attachmentIds: attachments.map((a) => a.id),
      });
      if (result.ok) {
        onSent();
      } else {
        showError(result.error || "فشل حفظ المسودة");
      }
    } catch {
      showError("فشل حفظ المسودة");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-2xl bg-sq-black border border-white/20 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="font-extrabold text-white text-lg">
              {replyTo ? "رد على الرسالة" : "رسالة جديدة"}
            </h2>
            <p className="text-xs text-white/70 mt-1">
              اختر المستلم واكتب الموضوع قبل الإرسال. الحقول المعلّمة بـ * مطلوبة.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition text-white/70"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Recipients */}
          <RecipientField
            label="إلى"
            users={users}
            selected={recipients}
            onChange={(ids) => {
              setRecipients(ids);
              setErrors((prev) => ({ ...prev, recipients: undefined }));
            }}
            error={errors.recipients}
            hint="ابحث عن مستخدم لإضافته إلى المستلمين"
            required
          />

          {/* CC / BCC toggles */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCc((v) => !v)}
              className="text-xs text-white/70 hover:text-white/80 transition font-bold"
            >
              {showCc ? "إخفاء CC" : "CC"}
            </button>
            <button
              type="button"
              onClick={() => setShowBcc((v) => !v)}
              className="text-xs text-white/70 hover:text-white/80 transition font-bold"
            >
              {showBcc ? "إخفاء BCC" : "BCC"}
            </button>
          </div>

          {showCc ? (
            <RecipientField
              label="CC (نسخة)"
              users={users}
              selected={ccRecipients}
              onChange={setCcRecipients}
              hint="ابحث عن مستخدم لإضافته إلى النسخة"
            />
          ) : null}

          {showBcc ? (
            <RecipientField
              label="BCC (نسخة مخفية)"
              users={users}
              selected={bccRecipients}
              onChange={setBccRecipients}
              hint="ابحث عن مستخدم لإضافته إلى النسخة المخفية"
            />
          ) : null}

          {/* Subject */}
          <div>
            <label htmlFor={subjectId} className="text-xs font-bold text-white/60 block mb-1.5">
              الموضوع <span className="text-red-400">*</span>
            </label>
            <input
              id={subjectId}
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (e.target.value.trim()) {
                  setErrors((prev) => ({ ...prev, subject: undefined }));
                }
              }}
              placeholder="اكتب موضوع الرسالة"
              aria-invalid={Boolean(errors.subject)}
              aria-describedby={errors.subject ? subjectErrorId : undefined}
              className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-sm text-white placeholder-white/70 outline-none transition ${
                errors.subject ? "border-red-400/70 focus:border-red-400" : "border-white/10 focus:border-emerald-500/50"
              }`}
            />
            {errors.subject ? (
              <p id={subjectErrorId} role="alert" className="text-xs text-red-400 mt-1">
                {errors.subject}
              </p>
            ) : null}
          </div>

          {/* Body */}
          <div>
            <label htmlFor={bodyId} className="text-xs font-bold text-white/60 block mb-1.5">محتوى الرسالة</label>
            <textarea
              id={bodyId}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب محتوى الرسالة هنا..."
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm leading-7 text-white placeholder-white/70 outline-none focus:border-emerald-500/50 transition resize-y"
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
              {uploading && <span className="text-xs text-white/70">جاري الرفع...</span>}
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
              <span>{sending ? "جارٍ الإرسال..." : "إرسال"}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={sending}
              title="حفظ بدون إرسال؛ لا يشترط وجود مستلم أو موضوع"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
            >
              <FileText size={16} />
              <span>حفظ مسودة</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
