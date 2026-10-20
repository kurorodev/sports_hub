import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { publishStory } from "../../../entities/story";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { appName } from "../../../shared/config/branding";
import { Dialog } from "../../../shared/ui/Dialog";
import { readImage } from "../../../shared/lib/read-image";
import { tr } from "../../../shared/i18n/translate";

export function StoryEditor({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => Promise<void>;
}) {
  const titleId = useId();
  const [image, setImage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const mutation = useMutation({
    mutationFn: publishStory,
    onSuccess: async () => {
      await onPublished();
      onClose();
    },
  });
  const busy = reading || mutation.isPending;
  const close = () => {
    if (!busy) onClose();
  };
  async function upload(file?: File) {
    if (!file) return;
    setReading(true);
    setUploadError("");
    try {
      setImage(await readImage(file));
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : tr("Не удалось прочитать файл."),
      );
    } finally {
      setReading(false);
    }
  }
  return (
    <Dialog
      labelledBy={titleId}
      onClose={close}
      className="story-editor-dialog"
    >
      <header className="story-editor-heading">
        <div>
          <h2 id={titleId}>{tr("Новая история")}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label={tr("Закрыть")}
          disabled={busy}
          onClick={close}
        >
          <X size={22} />
        </button>
      </header>
      <form
        className="story-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!image || busy || uploadError) return;
          // The existing API requires a title and text even for photo stories.
          mutation.mutate({ title: appName, text: "", imageData: image });
        }}
      >
        {image && (
          <div className="story-editor-preview">
            <img src={image} alt={tr("Предпросмотр изображения истории")} />
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setImage(null)}
            >
              {tr("Убрать изображение")}
            </button>
          </div>
        )}
        <label className="story-upload">
          <ImagePlus size={20} aria-hidden="true" />
          <span>
            {reading
              ? tr("Читаем фото…")
              : image
                ? tr("Заменить изображение")
                : tr("Добавить изображение")}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            aria-label={tr("Изображение истории")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void upload(file);
            }}
          />
        </label>
        <p className="field-hint">
          {tr(
            "PNG или JPEG до 2 МБ, не более 4096×4096 пикселей. Для историй лучше фото 9:16.",
          )}
        </p>
        {(uploadError || mutation.isError) && (
          <p className="field-error" role="alert">
            {uploadError ||
              (mutation.error instanceof ApiError
                ? mutation.error.body?.message || errorMessage(mutation.error)
                : errorMessage(mutation.error))}
          </p>
        )}
        <div className="story-editor-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={close}
          >
            {tr("Отмена")}
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || !image || Boolean(uploadError)}
          >
            {mutation.isPending
              ? tr("Публикуем…")
              : tr("Опубликовать на 24 часа")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
