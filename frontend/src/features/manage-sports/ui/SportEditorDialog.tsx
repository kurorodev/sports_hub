import { useId, useState } from "react";
import { X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { sportImage } from "../../../entities/event";
import { ApiError, errorMessage, request } from "../../../shared/api/client";
import type { Sport } from "../../../shared/api/types";
import { Dialog } from "../../../shared/ui/Dialog";
import { readImage } from "./sport-image";

export function SportEditorDialog({
  sport,
  onClose,
  onSaved,
}: {
  sport: Sport;
  onClose: () => void;
  onSaved: (sport?: Sport) => Promise<void>;
}) {
  const titleId = useId();
  const hintId = useId();
  const [name, setName] = useState(sport.name);
  const [image, setImage] = useState<string | null | undefined>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: "save" | "delete"): Promise<Sport | void> =>
      action === "delete"
        ? request<void>(`/admin/sports/${sport.id}`, { method: "DELETE" })
        : request<Sport>(`/admin/sports/${sport.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: name.trim(),
              ...(image !== undefined ? { imageData: image } : {}),
            }),
          }),
    onSuccess: (result) => onSaved(result || undefined),
  });
  const busy = reading || mutation.isPending;
  const changed = name.trim() !== sport.name || image !== undefined;
  const preview =
    image === undefined
      ? sport.imageUrl || sportImage(sport.name)
      : image || sportImage(name);
  const close = () => {
    if (!busy) onClose();
  };
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    mutation.reset();
    setReading(true);
    try {
      setImage(await readImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать фото");
    } finally {
      setReading(false);
    }
  }
  return (
    <Dialog
      labelledBy={titleId}
      onClose={close}
      className="sport-editor-dialog"
    >
      <header className="sport-editor-header">
        <h2 id={titleId}>Настройки категории</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть настройки категории"
          disabled={busy}
          onClick={close}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <form
        className="sport-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate("save");
        }}
      >
        <label>
          Название категории
          <input
            value={name}
            required
            minLength={2}
            maxLength={80}
            disabled={busy || sport.isCustom}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <img
          className="sport-editor-preview"
          src={preview}
          alt={`Фото категории: ${name}`}
        />
        <label className="admin-image-field">
          <input
            type="file"
            aria-label="Заменить фото категории"
            accept="image/png,image/jpeg"
            disabled={busy}
            aria-describedby={hintId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void upload(file);
            }}
          />
          <span className="admin-image-button">
            {reading ? "Читаем фото…" : "Заменить фото"}
          </span>
        </label>
        <p className="field-hint" id={hintId}>
          PNG или JPEG до 2 МБ, не более 4096×4096 пикселей. Изменения
          применятся после сохранения.
        </p>
        {(image || (image === undefined && sport.imageUrl)) && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setImage(null)}
          >
            Вернуть стандартное фото
          </button>
        )}
        {(error || mutation.isError) && (
          <p className="field-error" role="alert">
            {error ||
              (mutation.error instanceof ApiError
                ? mutation.error.body?.message || errorMessage(mutation.error)
                : errorMessage(mutation.error))}
          </p>
        )}
        <div className="sport-editor-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || !changed || name.trim().length < 2}
          >
            {mutation.isPending ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </div>
      </form>
      <div className="sport-editor-delete">
        {sport.isCustom ? (
          <p className="field-hint">
            «Другое» — общая категория для произвольных активностей. Её название
            и удаление недоступны.
          </p>
        ) : confirmDelete ? (
          <div role="group" aria-label="Подтверждение удаления категории">
            <p>Удалить «{sport.name}»?</p>
            <p className="field-hint">
              Категория исчезнет из выбора. В существующих мероприятиях,
              организациях, площадках и профилях она сохранится.
            </p>
            <div className="sport-editor-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Оставить
              </button>
              <button
                type="button"
                className="button danger-button"
                disabled={busy}
                onClick={() => {
                  setError("");
                  mutation.mutate("delete");
                }}
              >
                {mutation.isPending ? "Удаляем…" : "Подтвердить удаление"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="button sport-delete-trigger"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Удалить категорию
          </button>
        )}
      </div>
    </Dialog>
  );
}
