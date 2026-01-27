import { useEffect, useState } from "react";

import { downloadAdminBackup, fetchAuthMe, restoreAdminBackup } from "@/react-app/api/site";

export default function ControlBackup() {
  const [me, setMe] = useState<{ authenticated: boolean; isSuperuser: boolean } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "downloading" | "restoring" | "saved" | "error">("idle");

  useEffect(() => {
    fetchAuthMe()
      .then((d) => setMe({ authenticated: Boolean(d.authenticated), isSuperuser: Boolean(d.isSuperuser) }))
      .catch(() => setMe({ authenticated: false, isSuperuser: false }));
  }, []);

  if (!me) return null;
  if (!me.authenticated) return null;
  if (!me.isSuperuser) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">النسخ الاحتياطي</h1>
        <p className="text-gray-600">هذه الصفحة متاحة للسوبر أدمن فقط.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">النسخ الاحتياطي والاستعادة</h1>
          <p className="text-gray-600 mt-1">
            تصدير/استيراد بيانات الموقع كملف JSON (سوبر أدمن فقط).
          </p>
        </div>
      </div>

      {status === "saved" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-emerald-800">
          تمت العملية بنجاح.
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          تعذر إتمام العملية.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="text-lg font-bold text-gray-900 mb-4">تصدير</div>
          <button
            type="button"
            onClick={async () => {
              setStatus("downloading");
              try {
                await downloadAdminBackup();
                setStatus("saved");
              } catch {
                setStatus("error");
              } finally {
                setTimeout(() => setStatus("idle"), 1500);
              }
            }}
            className="bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition"
          >
            تنزيل نسخة احتياطية
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="text-lg font-bold text-gray-900 mb-4">استعادة</div>
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            الاستعادة قد تفشل إذا كان الملف غير متوافق مع قاعدة البيانات الحالية.
          </div>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            disabled={!file}
            onClick={async () => {
              if (!file) return;
              if (!confirm("هل تريد استعادة البيانات من هذا الملف؟")) return;
              setStatus("restoring");
              try {
                const res = await restoreAdminBackup(file);
                setStatus(res.ok ? "saved" : "error");
              } catch {
                setStatus("error");
              } finally {
                setTimeout(() => setStatus("idle"), 1500);
              }
            }}
            className="mt-4 bg-white border border-gray-200 text-gray-800 px-5 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50"
          >
            استعادة
          </button>
        </div>
      </div>
    </div>
  );
}
