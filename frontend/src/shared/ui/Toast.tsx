import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, X } from "lucide-react";

export function Toast({
  message,
  onDismiss,
  placement = "bottom",
  tone = "default",
}: {
  message: string;
  onDismiss: () => void;
  placement?: "bottom" | "top";
  tone?: "default" | "success";
}) {
  useLocale();
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return createPortal(
    <div
      className={`toast toast-${placement} toast-${tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <CircleCheck size={20} aria-hidden="true" />
      <span>{tr(message)}</span>
      <button
        type="button"
        aria-label={tr("Закрыть уведомление")}
        onClick={onDismiss}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
