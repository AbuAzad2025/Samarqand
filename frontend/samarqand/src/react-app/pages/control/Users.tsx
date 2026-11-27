import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import {
  createOrUpdateUser,
  fetchAdminUsersList,
  fetchAuthMe,
  type AdminUserListItem,
} from "@/react-app/api/site";
import {
  isAccountingRole,
  isManagerRole,
  type ControlRole,
} from "@/react-app/utils/controlRole";

// نفس الأدوار المتاحة حالياً في نموذج الإنشاء/التعديل؛ لا تُضاف صلاحيات جديدة.
type Role = "employee" | "registrar" | "accountant" | "manager" | "superadmin";

const ROLE_OPTIONS: Role[] = [
  "employee",
  "registrar",
  "accountant",
  "manager",
  "superadmin",
];

const ROLE_LABELS: Record<string, string> = {
  guest: "ضيف",
  registered_guest: "ضيف مسجّل",
  employee: "موظف",
  staff: "موظف",
  registrar: "مسجّل",
  accountant: "محاسب",
  manager: "مدير",
  superadmin: "سوبر أدمن",
};

const GROUP_LABELS: Record<string, string> = {
  Managers: "المديرون",
  Accountants: "المحاسبون",
  Registrars: "المسجّلون",
  Employees: "الموظفون",
  Superadmins: "السوبر أدمن",
};

function groupLabel(group: string): string {
  return GROUP_LABELS[group] || group;
}

// عرض تقديري للصلاحيات حسب الدور والمجموعات فقط؛ لا يمنح أي صلاحية جديدة.
function permissionLabels(user: AdminUserListItem): string[] {
  const role: ControlRole = {
    isSuperuser: Boolean(user.isSuperuser),
    role: user.role || "",
    groups: user.groups || [],
  };
  const labels: string[] = [];
  if (isManagerRole(role)) {
    labels.push("إدارة كاملة", "العمليات والموظفون", "التقارير");
  }
  if (isAccountingRole(role)) {
    labels.push("المحاسبة والفواتير");
  }
  if (role.role === "registrar" || role.groups.includes("Registrars")) {
    labels.push("تسجيل العملاء والعقود");
  }
  if (role.role === "employee" || role.role === "staff" || role.groups.includes("Employees")) {
    labels.push("الوصول الأساسي");
  }
  if (labels.length === 0) {
    labels.push("صلاحيات محدودة أو غير محددة");
  }
  return [...new Set(labels)];
}

export default function ControlUsers() {
  const [me, setMe] = useState<{
    authenticated: boolean;
    isSuperuser: boolean;
    username: string;
  } | null>(null);

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [result, setResult] = useState<{ password?: string; message: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    fetchAuthMe()
      .then((data) =>
        setMe({
          authenticated: Boolean(data.authenticated),
          isSuperuser: Boolean(data.isSuperuser),
          username: data.username || "",
        }),
      )
      .catch(() =>
        setMe({ authenticated: false, isSuperuser: false, username: "" }),
      );
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      setUsers(await fetchAdminUsersList({ limit: 500 }));
    } catch {
      setUsers([]);
      setUsersError("تعذر تحميل قائمة المستخدمين. استخدم زر تحديث للمحاولة مجدداً.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (me?.isSuperuser) loadUsers();
  }, [me?.isSuperuser, loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${u.username} ${u.role} ${(u.groups || []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, userSearch]);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startCreate() {
    setEditingUsername(null);
    setUsername("");
    setPassword("");
    setRole("employee");
    setResult(null);
    setError(null);
    scrollToForm();
  }

  function startEdit(user: AdminUserListItem) {
    setEditingUsername(user.username);
    setUsername(user.username);
    setPassword("");
    setRole(ROLE_OPTIONS.includes(user.role as Role) ? (user.role as Role) : "employee");
    setResult(null);
    setError(null);
    scrollToForm();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError(null);
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError("اسم المستخدم مطلوب.");
      return;
    }
    if (editingUsername && cleanUsername !== editingUsername) {
      setError("لا يمكن تغيير اسم المستخدم أثناء التعديل.");
      return;
    }
    setLoading(true);
    try {
      const res = await createOrUpdateUser({
        username: cleanUsername,
        // لا تُغيّر كلمة المرور لمستخدم موجود؛ الحقل معطّل في وضع التعديل.
        password: editingUsername ? undefined : password || undefined,
        role,
      });
      if (!res.ok) {
        setError(res.error || "غير مصرح.");
        return;
      }
      setResult({
        message: res.created ? "تم إنشاء المستخدم." : "تم تحديث المستخدم.",
        password: res.generatedPassword,
      });
      setPassword("");
      setUsername("");
      setRole("employee");
      setEditingUsername(null);
      await loadUsers();
    } catch {
      setError("تعذر حفظ المستخدم.");
    } finally {
      setLoading(false);
    }
  }

  if (!me) {
    return null;
  }

  if (!me.authenticated) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">غير مسجل دخول</h1>
        <p className="text-slate-300 mb-6">سجل الدخول للوصول إلى لوحة التحكم.</p>
        <Link
          to="/control/login"
          className="inline-block bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition"
        >
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (!me.isSuperuser) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">غير مصرح</h1>
        <p className="text-slate-300">
          إدارة المستخدمين متاحة للسوبر أدمن فقط.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">إدارة المستخدمين</h1>
          <p className="text-slate-300">
            عرض المستخدمين وأدوارهم ومجموعاتهم، وإنشاء مستخدم أو تعديل دوره.
            الصفحة متاحة للسوبر أدمن فقط.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-xl bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-5 py-3 font-bold hover:shadow-lg transition"
        >
          إضافة مستخدم
        </button>
      </div>

      {result?.password && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="font-bold text-emerald-900 mb-2">{result.message}</div>
          <div className="text-emerald-900 mb-2">
            كلمة المرور تم توليدها تلقائياً. انسخها الآن لأننا لن نعرضها مرة أخرى:
          </div>
          <pre className="bg-white border border-emerald-200 rounded-lg p-3 overflow-auto" dir="ltr">
{result.password}
          </pre>
        </div>
      )}

      {result && !result.password && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="font-bold text-emerald-900">{result.message}</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
          {error}
        </div>
      )}

      {/* قائمة المستخدمين */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-gray-900">قائمة المستخدمين</div>
            <div className="text-xs text-gray-500 mt-1">
              {users.length} مستخدم
              {userSearch ? ` • ${filteredUsers.length} نتيجة للبحث` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="بحث بالاسم أو الدور أو المجموعة"
              aria-label="البحث في المستخدمين"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900"
            />
            <button
              type="button"
              onClick={() => loadUsers()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 transition"
            >
              تحديث
            </button>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-600 border-b border-gray-200">
          الصلاحيات أدناه استنتاجية للعرض فقط حسب الدور والمجموعات؛ لا تُمنح صلاحيات جديدة من هذه الصفحة.
        </div>

        {usersLoading ? (
          <div className="p-8 text-center text-gray-500">جارٍ تحميل المستخدمين…</div>
        ) : usersError ? (
          <div className="p-8 text-center">
            <div className="font-bold text-gray-800">{usersError}</div>
            <button
              type="button"
              onClick={() => loadUsers()}
              className="mt-4 rounded-lg bg-gray-900 text-white font-bold px-4 py-2 hover:bg-gray-800 transition"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-bold text-gray-800">لا يوجد مستخدمون لعرضهم.</div>
            <p className="text-sm text-gray-500 mt-2">
              استخدم زر «إضافة مستخدم» لإنشاء أول مستخدم.
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-bold text-gray-800">لا يوجد مستخدمون مطابقون للبحث.</div>
            <p className="text-sm text-gray-500 mt-2">جرّب اسماً أو دوراً آخر.</p>
            <button
              type="button"
              onClick={() => setUserSearch("")}
              className="mt-4 rounded-lg bg-gray-100 text-gray-800 font-bold px-4 py-2 hover:bg-gray-200 transition"
            >
              مسح البحث
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-800">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-3 text-right font-bold">اسم المستخدم</th>
                  <th className="p-3 text-right font-bold">الدور</th>
                  <th className="p-3 text-right font-bold">المجموعات</th>
                  <th className="p-3 text-right font-bold">الصلاحيات (للعرض)</th>
                  <th className="p-3 text-right font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="align-top">
                    <td className="p-3">
                      <div className="font-bold text-gray-900" dir="ltr">{u.username}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {u.isSuperuser ? "سوبر أدمن" : "حساب عادي"}
                        {u.workerId ? ` • مرتبط بعامل #${u.workerId}` : ""}
                      </div>
                      {me.username === u.username ? (
                        <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800">
                          أنت
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800">
                        {ROLE_LABELS[u.role] || u.role || "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.groups && u.groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {u.groups.map((g) => (
                            <span
                              key={g}
                              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {groupLabel(g)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">لا توجد مجموعات</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {permissionLabels(u).map((p) => (
                          <span
                            key={p}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="rounded-lg border border-gray-300 bg-white text-gray-800 px-3 py-2 text-xs font-bold hover:bg-gray-50 transition"
                      >
                        تعديل الدور
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* النموذج */}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingUsername ? "تعديل مستخدم" : "إضافة مستخدم"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {editingUsername
                ? `تعديل دور المستخدم «${editingUsername}». كلمة المرور لا تُغيّر من هنا.`
                : "أدخل اسم المستخدم واختر الدور. يمكنك ترك كلمة المرور فارغة لتوليدها تلقائياً."}
            </p>
          </div>
          {editingUsername ? (
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg border border-gray-300 px-4 py-2 font-bold text-gray-700 hover:bg-gray-50 transition"
            >
              إلغاء التعديل
            </button>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            اسم المستخدم
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:bg-gray-100"
            autoComplete="off"
            disabled={Boolean(editingUsername)}
            required
          />
          {editingUsername ? (
            <p className="text-xs text-gray-500 mt-1">
              اسم المستخدم هو معرّف الحساب ولا يمكن تغييره أثناء التعديل.
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            كلمة المرور {editingUsername ? "(غير قابلة للتغيير هنا)" : "(اختياري)"}
          </label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green disabled:bg-gray-100"
            type="text"
            autoComplete="new-password"
            disabled={Boolean(editingUsername)}
            placeholder={editingUsername ? "لا تُغيّر كلمة المرور من هذه الصفحة" : "اتركها فارغة للتوليد التلقائي"}
          />
          {editingUsername ? (
            <p className="text-xs text-gray-500 mt-1">
              لتغيير كلمة المرور استخدم صفحة تغيير كلمة المرور الخاصة بحسابك.
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            الدور
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sq-green"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
        >
          {loading
            ? "جارٍ الحفظ..."
            : editingUsername
              ? "حفظ الدور"
              : "إضافة المستخدم"}
        </button>
      </form>
    </div>
  );
}
