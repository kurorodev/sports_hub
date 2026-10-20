import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { publishStory } from "../../../entities/story";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { storyCreateSchema } from "../../../shared/api/story-schema";
import type { StoryCreate } from "../../../shared/api/types";
import { Dialog } from "../../../shared/ui/Dialog";
import { Textarea } from "../../../shared/ui/Textarea";
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
  const titleFieldId = useId();
  const textId = useId();
  const [image, setImage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const form = useForm<StoryCreate>({
    resolver: zodResolver(storyCreateSchema),
    defaultValues: { title: "", text: "" },
  });
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
          <span className="eyebrow muted">{tr("Новости Стечения")}</span>
          <h2 id={titleId}>{tr("Новая сторис")}</h2>
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
      <p className="field-hint">
        {tr("Будет видна всем пользователям 24 часа. Можно удалить раньше.")}
      </p>
      <form
        className="story-editor-form"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate({ ...values, imageData: image }),
        )}
      >
        <div className="form-field">
          <label htmlFor={titleFieldId}>{tr("Заголовок")}</label>
          <input
            id={titleFieldId}
            {...form.register("title")}
            required
            minLength={3}
            maxLength={80}
            placeholder={tr("Например, встречаемся на городском забеге")}
            disabled={busy}
            aria-invalid={Boolean(form.formState.errors.title)}
            aria-describedby={
              form.formState.errors.title ? `${titleFieldId}-error` : undefined
            }
          />
          {form.formState.errors.title && (
            <p className="field-error" id={`${titleFieldId}-error`}>
              {tr(
                form.formState.errors.title.message ??
                  "Проверьте введённые данные.",
              )}
            </p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor={textId}>{tr("Текст")}</label>
          <Textarea
            id={textId}
            {...form.register("text")}
            maxLength={1000}
            rows={4}
            placeholder={tr("Что нового? Расскажите самое важное…")}
            disabled={busy}
            aria-invalid={Boolean(form.formState.errors.text)}
          />
        </div>
        {image && (
          <div className="story-editor-preview">
            <img src={image} alt={tr("Предпросмотр изображения сторис")} />
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
            aria-label={tr("Изображение сторис")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void upload(file);
            }}
          />
        </label>
        <p className="field-hint">
          {tr(
            "Изображение необязательно. PNG или JPEG до 2 МБ, не более 4096×4096 пикселей.",
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
        {uploadError && (
          <button
            className="reset-button"
            type="button"
            onClick={() => {
              setImage(null);
              setUploadError("");
            }}
          >
            {tr("Продолжить без изображения")}
          </button>
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
            disabled={busy || Boolean(uploadError)}
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
