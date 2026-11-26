import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        dir="rtl"
        className="min-h-screen flex items-center justify-center bg-slate-50 px-4"
      >
        <div className="max-w-lg w-full text-center bg-white rounded-3xl shadow-lg p-10 border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            حدث خطأ غير متوقع
          </h1>
          <p className="text-slate-600 mb-6">
            تعذّر عرض هذه الصفحة. أعد تحميل الصفحة أو ارجع للرئيسية.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-sq-green text-white px-6 py-3 font-bold"
          >
            إعادة التحميل
          </button>
        </div>
      </main>
    );
  }
}
