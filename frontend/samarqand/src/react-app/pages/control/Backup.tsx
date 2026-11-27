import { useEffect, useState } from "react";

import {
  downloadAdminBackup,
  fetchAuthMe,
  restoreAdminBackup,
  validateAdminBackup,
  type BackupValidation,
} from "@/react-app/api/site";

type StatusKind = "idle" | "saved" | "error";

export default function ControlBackup() {
  const [me, setMe] = useState<{
    authenticated: boolean;
    isSuperuser: boolean;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<BackupValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState<{
    kind: StatusKind;
    message: string;
  }>({ kind: "idle", message: "" });

  useEffect(() => {
    fetchAuthMe()
      .then((d) =>
        setMe({
          authenticated: Boolean(d.authenticated),
          isSuperuser: Boolean(d.isSuperuser),
        }),
      )
      .catch(() => setMe({ authenticated: false, isSuperuser: false }));
  }, []);

  if (!me) {
    return (
      <p role="status" className="text-slate-300">
        جارٍ التحقق من الصلاحيات…
      </p>
    );
  }
  if (!me.authenticated) return null;
  if (!me.isSuperuser) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">النسخ الاحتياطي</h1>
        <p className="text-slate-300">
          هذه الصفحة متاحة للسوبر أدمن فقط.
        </p>
      </div>
    );
  }

  async function onDownload() {
    if (downloading) return;
    setDownloading(true);
    setStatus({ kind: "idle", message: "" });
    try {
      await downloadAdminBackup();
      setStatus({
        kind: "saved",
        message: "تم تنزيل ملف النسخة الاحتياطية بنجاح. احتفظ به في مكان آمن.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "تعذر تنزيل النسخة الاحتياطية. حاول مرة أخرى بعد قليل.",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function onValidate() {
    if (!file || validating) return;
    setValidating(true);
    try {
      setValidation(await validateAdminBackup(file));
    } catch {
      setValidation({
        okToRestore: false,
        total: 0,
        counts: {},
        errors: [{ index: 0, error: "تعذر قراءة الملف أو فحصه" }],
      });
    } finally {
      setValidating(false);
    }
  }

  async function onRestore() {
    if (!file || !validation?.okToRestore || restoring) return;
    const confirmed = window.confirm(
      "تحذير: الاستعادة ستستبدل البيانات الحالية بالكامل بالبيانات الموجودة في الملف المختار، ولا يمكن التراجع عن ذلك.\n\nهل أخذت نسخة احتياطية حالية وهل تريد المتابعة؟",
    );
    if (!confirmed) return;
    setRestoring(true);
    setStatus({ kind: "idle", message: "" });
    try {
      const res = await restoreAdminBackup(file);
      setStatus(
        res.ok
          ? {
              kind: "saved",
              message: "تمت الاستعادة بنجاح. راجع بيانات الموقع للتأكد.",
            }
          : {
              kind: "error",
              message: "تعذرت الاستعادة. لم يتم تغيير البيانات. راجع الملف وحاول مرة أخرى.",
            },
      );
    } catch {
      setStatus({
        kind: "error",
        message: "تعذرت الاستعادة. لم يتم تغيير البيانات. حاول مرة أخرى بعد قليل.",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">النسخ الاحتياطي والاستعادة</h1>
        <p className="text-slate-300 mt-1">
          احتفظ بنسخة من بيانات الموقع، أو استعد بياناتك من ملف سابق. هذه الصفحة
          للسوبر أدمن فقط.
        </p>
      </div>

      {status.kind !== "idle" && (
        <div
          role={status.kind === "error" ? "alert" : "status"}
          aria-live={status.kind === "error" ? "assertive" : "polite"}
          className={`rounded-2xl p-4 mb-6 text-sm font-semibold border ${
            status.kind === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section
          aria-labelledby="backup-export-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
        >
          <h2 id="backup-export-title" className="text-lg font-bold text-gray-900 mb-2">
            تنزيل نسخة احتياطية
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            ينشئ هذا الزر ملف JSON على جهازك يحتوي على بيانات الموقع الحالية. لا
            يغيّر أي بيانات، ويمكنك استخدام الملف لاحقاً للاستعادة.
          </p>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            aria-busy={downloading}
            className="bg-gradient-to-r from-sq-green via-sq-black to-sq-red text-white px-6 py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
          >
            {downloading ? "جارٍ تجهيز الملف..." : "تنزيل نسخة احتياطية"}
          </button>
          {downloading && (
            <p role="status" className="text-sm text-gray-600 mt-3">
              جارٍ تجهيز الملف، يرجى الانتظار…
            </p>
          )}
        </section>

        <section
          aria-labelledby="backup-restore-title"
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
        >
          <h2 id="backup-restore-title" className="text-lg font-bold text-gray-900 mb-2">
            استعادة من ملف
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            يقرأ هذا الإجراء ملف نسخة احتياطية ويعيد بيانات الموقع إلى ما كانت
            عليه في ذلك الوقت. تأكد من الملف قبل المتابعة.
          </p>

          <div
            role="alert"
            className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 space-y-2"
          >
            <p className="font-bold">تنبيه مهم قبل الاستعادة</p>
            <ul className="list-disc pr-5 space-y-1">
              <li>الاستعادة تستبدل البيانات الحالية ولا يمكن التراجع عنها.</li>
              <li>نزّل نسخة احتياطية من البيانات الحالية أولاً.</li>
              <li>استخدم ملفاً من نفس المنظومة وفحصه قبل المتابعة.</li>
            </ul>
          </div>

          <label
            htmlFor="backup-file"
            className="block text-sm font-bold text-gray-700 mb-2"
          >
            ملف النسخة الاحتياطية (JSON)
          </label>
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            disabled={restoring}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setValidation(null);
              setStatus({ kind: "idle", message: "" });
            }}
            className="block w-full text-sm text-gray-700"
          />

          <button
            type="button"
            disabled={!file || validating || restoring}
            onClick={onValidate}
            aria-busy={validating}
            className="mt-4 bg-white border border-gray-200 text-gray-800 px-5 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sq-green"
          >
            {validating ? "جارٍ الفحص..." : "فحص الملف قبل الاستعادة"}
          </button>
          {validating && (
            <p role="status" className="text-sm text-gray-600 mt-2">
              جارٍ فحص محتوى الملف…
            </p>
          )}

          {validation && (
            <div
              role="status"
              className={`mt-4 rounded-xl p-4 text-sm ${
                validation.okToRestore
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {validation.okToRestore
                ? `الملف صالح ويحتوي على ${validation.total} سجلات. يمكنك المتابعة بعد التأكيد.`
                : `الملف غير صالح (${validation.errors.length} أخطاء). لا تُجرَ أي استعادة.`}
            </div>
          )}

          <button
            type="button"
            disabled={!file || !validation?.okToRestore || restoring}
            onClick={onRestore}
            aria-busy={restoring}
            className="mt-4 bg-white border border-red-300 text-red-700 px-5 py-2 rounded-lg font-bold hover:shadow-sm transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            {restoring ? "جارٍ الاستعادة..." : "استعادة البيانات"}
          </button>
          {!validation?.okToRestore && (
            <p className="mt-3 text-xs text-gray-600">
              يفعّل زر الاستعادة بعد فحص الملف والتأكد من صلاحيته.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
