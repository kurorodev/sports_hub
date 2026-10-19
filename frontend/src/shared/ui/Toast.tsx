import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, X } from "lucide-react";

export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return createPortal(
    <div className="toast" role="status" aria-live="polite" aria-atomic="true">
      <CircleCheck size={20} aria-hidden="true" />
      <span>{message}</span>
      <button
        type="button"
        aria-label="Закрыть уведомление"
        onClick={onDismiss}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
