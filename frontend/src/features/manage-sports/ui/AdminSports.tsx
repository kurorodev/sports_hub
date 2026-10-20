import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sportsQuery, sportImage } from "../../../entities/event";
import { ApiError, request, errorMessage } from "../../../shared/api/client";
import type { Sport } from "../../../shared/api/types";

async function readImage(file: File) {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    throw new Error("Выберите PNG или JPEG до 2 МБ.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}
export function AdminSports() {
  const client = useQueryClient();
  const sports = useQuery(sportsQuery);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const [version, setVersion] = useState(0);
  const [visible, setVisible] = useState(12);
  const mutation = useMutation({
    mutationFn: ({
      id,
      name,
      imageData,
    }: {
      id?: string;
      name?: string;
      imageData: string | null;
    }) =>
      request<Sport>(id ? `/admin/sports/${id}/image` : "/admin/sports", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(id ? { imageData } : { name, imageData }),
      }),
    onSuccess: async (result, input) => {
      if (!input.id) {
        setName("");
        setImage(null);
        setSearch(result.name);
        setVisible(12);
      }
      setNotice(input.id ? "Изображение сохранено" : "Категория создана");
      setVersion((v) => v + 1);
      await Promise.all([
        client.invalidateQueries({ queryKey: sportsQuery.queryKey }),
        client.invalidateQueries({ queryKey: ["events"] }),
        client.invalidateQueries({ queryKey: ["map", "events"] }),
      ]);
    },
  });
  async function upload(file: File | undefined, id?: string) {
    if (!file) return;
    setError("");
    setNotice("");
    setReading(true);
    try {
      const data = await readImage(file);
      if (id) mutation.mutate({ id, imageData: data });
      else setImage(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setReading(false);
    }
  }
  const matching = (sports.data ?? []).filter((s) =>
    s.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
  );
  const busy = mutation.isPending || reading;
  return (
    <section className="admin-sports" aria-labelledby="admin-sports-title">
      <div>
        <h2 id="admin-sports-title">Виды спорта</h2>
        <p className="muted">
          Категории и изображения для карточек мероприятий.
        </p>
      </div>
      <form
        className="admin-sport-create"
        onSubmit={(e) => {
          e.preventDefault();
          setNotice("");
          setError("");
          mutation.mutate({ name: name.trim(), imageData: image });
        }}
      >
        <h3>Новая категория</h3>
        <label>
          Название вида спорта
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, падел"
            disabled={busy}
          />
        </label>
        <label className="admin-image-field">
          Фото категории
          <input
            key={version}
            aria-label="Фото категории"
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void upload(file);
            }}
          />
          <span className="admin-image-button">Выбрать фото</span>
        </label>
        <p className="field-hint">
          PNG или JPEG до 2 МБ, не более 4096×4096 пикселей. Фото необязательно.
        </p>
        {image && (
          <img
            className="admin-sport-preview"
            src={image}
            alt="Предпросмотр фото категории"
          />
        )}
        <button
          className="button primary"
          disabled={busy || name.trim().length < 2}
        >
          {busy ? "Сохраняем…" : "Создать категорию"}
        </button>
      </form>
      {(error || mutation.isError) && (
        <p className="field-error" role="alert">
          {error ||
            (mutation.error instanceof ApiError
              ? mutation.error.body?.message || errorMessage(mutation.error)
              : errorMessage(mutation.error))}
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      <label className="admin-sports-search">
        Поиск вида спорта
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(12);
          }}
          placeholder="Название категории"
        />
      </label>
      {!sports.isPending && !sports.isError && (
        <p className="field-hint">
          Показано: {Math.min(visible, matching.length)} из {matching.length}
        </p>
      )}
      {sports.isPending ? (
        <p role="status">Загружаем категории…</p>
      ) : sports.isError ? (
        <div role="alert">
          <p>{errorMessage(sports.error)}</p>
          <button
            className="button secondary"
            onClick={() => void sports.refetch()}
          >
            Повторить загрузку
          </button>
        </div>
      ) : (
        <ul className="admin-sport-grid">
          {matching.slice(0, visible).map((s) => (
            <li key={s.id}>
              <img
                src={s.imageUrl ? s.imageUrl : sportImage(s.name)}
                alt={`Иллюстрация: ${s.name}`}
                loading="lazy"
              />
              <h3>{s.name}</h3>
              <span className="field-hint">
                {s.registryCode
                  ? `ВРВС: ${s.registryCode}`
                  : s.isCustom
                    ? "Общая категория"
                    : "Дополнительная категория"}
              </span>
              <label className="admin-sport-upload">
                {s.imageUrl ? "Заменить фото" : "Добавить фото"}
                <input
                  aria-label={`Фото: ${s.name}`}
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void upload(file, s.id);
                  }}
                />
              </label>
              {s.imageUrl && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => mutation.mutate({ id: s.id, imageData: null })}
                >
                  Убрать фото
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {matching.length > visible && (
        <button
          className="button secondary"
          onClick={() => setVisible((v) => v + 12)}
        >
          Показать ещё категории
        </button>
      )}
      {!sports.isPending && !sports.isError && matching.length === 0 && (
        <p>Категории не найдены. Измените поисковый запрос.</p>
      )}
    </section>
  );
}
