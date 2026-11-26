import { Link } from "react-router";

export default function NotFound() {
  return (
    <main
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 px-4"
    >
      <div className="max-w-lg w-full text-center bg-white rounded-3xl shadow-xl p-10 border border-slate-200">
        <div className="text-6xl mb-4" aria-hidden="true">🧱</div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-3">
          الصفحة غير موجودة
        </h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          ربما تم نقل الصفحة أو أن الرابط غير صحيح. يمكنك العودة إلى الصفحة
          الرئيسية أو التواصل معنا لمساعدتك.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/"
            className="rounded-xl bg-[#007A3D] text-white px-6 py-3 font-bold hover:shadow-lg transition"
          >
            العودة للرئيسية
          </Link>
          <Link
            to="/contact"
            className="rounded-xl border border-slate-300 text-slate-800 px-6 py-3 font-bold hover:bg-slate-50 transition"
          >
            تواصل معنا
          </Link>
        </div>
      </div>
    </main>
  );
}
