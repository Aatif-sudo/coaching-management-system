import { useToast } from "../context/ToastContext";

const COLOR_BY_TYPE: Record<string, string> = {
  success: "border-emerald-500 bg-emerald-50 text-emerald-900",
  error: "border-red-500 bg-red-50 text-red-900",
  info: "border-sky-500 bg-sky-50 text-sky-900",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  if (!toasts.length) {
    return null;
  }
  return (
    <div className="fixed right-3 top-3 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => removeToast(toast.id)}
          className={`rounded-lg border px-4 py-3 text-left text-sm shadow-card ${COLOR_BY_TYPE[toast.type]}`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}

