import { useId } from "react";
import { Dialog } from "../../../shared/ui/Dialog";
import { CreateSupportForm, type ReportTarget } from "./CreateSupportForm";
export function ReportCommentDialog({
  viewerId,
  comment,
  onClose,
}: {
  viewerId: string;
  comment: ReportTarget;
  onClose: () => void;
}) {
  const id = useId();
  return (
    <Dialog labelledBy={id} onClose={onClose} className="support-report-dialog">
      <div className="support-section-heading">
        <h2 id={id}>Пожаловаться на комментарий</h2>
        <button
          className="button secondary icon-button"
          aria-label="Закрыть жалобу"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p>Администратор получит жалобу и проверит сообщение.</p>
      <CreateSupportForm
        viewerId={viewerId}
        comment={comment}
        onCreated={onClose}
      />
    </Dialog>
  );
}
