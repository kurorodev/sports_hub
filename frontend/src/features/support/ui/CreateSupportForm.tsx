import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useSupportRepository } from "../../../entities/support";
import {
  categories,
  categoryLabels,
  reasonLabels,
  reportReasons,
  type SupportCategory,
  type SupportCreate,
} from "../../../entities/support/model";
import { sessionQuery } from "../../../entities/session";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { LocationPicker } from "../../../shared/ui/LocationPicker";
import type { Location } from "../../../shared/api/types";
import { hasPoint } from "../../../shared/lib/map";

export interface ReportTarget {
  id: string;
  text: string;
  author: string;
}
export function CreateSupportForm({
  viewerId,
  initialCategory = "HELP",
  comment,
  onCreated,
}: {
  viewerId: string;
  initialCategory?: SupportCategory;
  comment?: ReportTarget;
  onCreated?: () => void;
}) {
  const repo = useSupportRepository();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [category, setCategory] = useState<SupportCategory>(
    comment ? "COMMENT_REPORT" : initialCategory,
  );
  const [title, setTitle] = useState(comment ? "Жалоба на комментарий" : "");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState<(typeof reportReasons)[number]>("SPAM");
  const [location, setLocation] = useState<Location>({ city: "", address: "" });
  const mutation = useMutation({
    mutationFn: (input: SupportCreate) => repo.create(input),
    onSuccess: async (ticket) => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      await client.invalidateQueries({ queryKey: ["support", viewerId] });
      void client.invalidateQueries({ queryKey: ["notifications", viewerId] });
      onCreated?.();
      navigate(`/support/${ticket.id}`);
    },
  });
  return (
    <form
      className="support-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (mutation.isPending) return;
        mutation.mutate({
          category,
          title: title.trim(),
          description: description.trim(),
          ...(comment ? { commentId: comment.id, reportReason: reason } : {}),
          ...(category === "VENUE_SUGGESTION"
            ? {
                venueCity: location.city.trim(),
                venueAddress: location.address.trim(),
                ...(hasPoint(location)
                  ? {
                      venueLatitude: location.latitude,
                      venueLongitude: location.longitude,
                    }
                  : {}),
              }
            : {}),
        });
      }}
    >
      {comment ? (
        <div className="support-quote">
          <strong>{comment.author}</strong>
          <p>{comment.text}</p>
          <label className="form-field">
            Причина жалобы
            <select
              disabled={mutation.isPending}
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
            >
              {reportReasons.map((r) => (
                <option key={r} value={r}>
                  {reasonLabels[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <label className="form-field">
          Тема обращения
          <select
            disabled={mutation.isPending}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as SupportCategory);
              mutation.reset();
            }}
          >
            {categories
              .filter((c) => c !== "COMMENT_REPORT")
              .map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="form-field">
        {category === "VENUE_SUGGESTION" ? "Название площадки" : "Заголовок"}
        <input
          disabled={mutation.isPending}
          required
          minLength={3}
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            category === "VENUE_SUGGESTION"
              ? "Например, баскетбольная площадка в парке"
              : "Кратко опишите вопрос"
          }
        />
      </label>
      {category === "VENUE_SUGGESTION" && (
        <fieldset className="support-location" disabled={mutation.isPending}>
          <legend className="sr-only">Место площадки</legend>
          <LocationPicker
            idPrefix="support-venue"
            preserveAddressOnPoint
            cityLabel="Город площадки"
            addressLabel="Адрес площадки"
            value={location}
            onChange={(value) => {
              if (!mutation.isPending) setLocation(value);
            }}
            unmappedHint="Можно отправить город и адрес без точки или уточнить место на карте."
          />
        </fieldset>
      )}
      <label className="form-field">
        Подробности
        <textarea
          disabled={mutation.isPending}
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            category === "BUG"
              ? "Что вы делали, что произошло и чего ожидали? Укажите устройство и браузер."
              : category === "VENUE_SUGGESTION"
                ? "Какие виды спорта доступны? Как попасть на площадку, есть ли ограничения?"
                : "Расскажите, что случилось или что вы предлагаете."
          }
        />
        <span className="field-hint">
          {description.length} / 5000. Не отправляйте пароли и платёжные данные.
        </span>
      </label>
      {mutation.isError && (
        <p role="alert" className="notice error">
          {mutation.error instanceof ApiError && mutation.error.status === 409
            ? mutation.error.message
            : errorMessage(mutation.error)}{" "}
          {mutation.error instanceof ApiError &&
            mutation.error.status === 409 && (
              <Link to="/support">Мои обращения</Link>
            )}
        </p>
      )}
      <p className="join-note">
        Обращение и ответы доступны вам и администраторам. Ответ появится здесь
        и в уведомлениях.
      </p>
      <button
        className="button primary"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending
          ? "Отправляем…"
          : comment
            ? "Отправить жалобу"
            : "Отправить обращение"}
      </button>
    </form>
  );
}
