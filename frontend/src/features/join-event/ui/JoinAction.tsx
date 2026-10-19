import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { EventParticipation } from "../../../entities/event/model";
import {
  registrationErrorMessage,
  registrationPresentation,
} from "../../../entities/registration";
import { useJoinEvent } from "./use-join-event";

export function JoinAction({
  event,
  publicationClosed = false,
}: {
  event: EventParticipation;
  publicationClosed?: boolean;
}) {
  const { session, viewerId, own, mutation, join } = useJoinEvent(
    event.eventId,
    event.joinMode,
  );
  if (session.isPending)
    return (
      <p className="join-note" role="status">
        Проверяем сессию…
      </p>
    );
  if (session.isError)
    return (
      <div className="join-feedback" role="alert">
        <p>Не удалось проверить аккаунт.</p>
        <button
          className="button secondary full-width"
          onClick={() => void session.refetch()}
        >
          Повторить проверку аккаунта
        </button>
      </div>
    );
  if (event.organizer)
    return (
      <div className="join-feedback">
        <p className="join-note">
          Вы организатор.{" "}
          {publicationClosed
            ? "Новая запись закрыта. Существующие регистрации доступны для просмотра."
            : event.joinMode === "OPEN"
              ? "Участники появятся в списке ниже."
              : "Решения по заявкам принимаете вы."}
        </p>
        {event.joinMode === "APPROVAL" && (
          <a className="button secondary full-width" href="#event-requests">
            {publicationClosed ? "Посмотреть заявки" : "Рассмотреть заявки"}
          </a>
        )}
      </div>
    );
  if (!viewerId && !event.openForRegistration)
    return <p className="join-note">Запись на эту встречу закрыта.</p>;
  if (!viewerId)
    return (
      <div className="join-feedback">
        <Link
          className="button primary full-width"
          to={`/login?next=join-event&eventId=${encodeURIComponent(event.eventId)}`}
        >
          Войти для записи
          <ArrowUpRight size={18} />
        </Link>
        <p className="join-note">
          Войдите, чтобы проверить участие и присоединиться.
        </p>
      </div>
    );
  if (own.isPending)
    return (
      <p className="join-note" role="status">
        Проверяем ваше участие…
      </p>
    );
  if (own.isError)
    return (
      <div className="join-feedback" role="alert">
        <p>{registrationErrorMessage(own.error)}</p>
        <button
          className="button secondary full-width"
          onClick={() => void own.refetch()}
        >
          Повторить проверку участия
        </button>
      </div>
    );
  if (own.data) {
    const { label, tone, Icon } = registrationPresentation[own.data.status];
    return (
      <div className={`registration-status ${tone}`} role="status">
        <Icon size={20} />
        <div>
          <strong>{label}</strong>
          <p>
            {publicationClosed
              ? "Существующая запись сохранена. Мероприятие больше не опубликовано, новая запись закрыта."
              : own.data.status === "CONFIRMED"
                ? event.joinMode === "APPROVAL"
                  ? "Заявка одобрена. До встречи!"
                  : "Участие подтверждено. До встречи!"
                : own.data.status === "PENDING"
                  ? "Организатор рассмотрит заявку. До одобрения место не занято."
                  : (own.data.decisionReason ??
                    "Текущий статус получен от организатора.")}
          </p>
        </div>
      </div>
    );
  }
  if (!event.openForRegistration)
    return <p className="join-note">Запись на эту встречу закрыта.</p>;
  if (
    event.joinMode === "OPEN" &&
    event.participantLimit != null &&
    event.confirmedParticipants >= event.participantLimit
  )
    return (
      <p className="join-note">Все места заняты. Выберите другую встречу.</p>
    );
  return (
    <div className="join-feedback">
      <button
        className="button primary full-width"
        disabled={mutation.isPending}
        onClick={join}
      >
        {mutation.isPending
          ? event.joinMode === "APPROVAL"
            ? "Отправляем заявку…"
            : "Записываем…"
          : event.joinMode === "APPROVAL"
            ? "Подать заявку"
            : "Присоединиться"}
        <ArrowUpRight size={18} />
      </button>
      <p className="join-note">
        {mutation.isPending
          ? "Ждём подтверждение записи…"
          : event.joinMode === "APPROVAL"
            ? "Участие после одобрения организатора. Заявка не резервирует место."
            : "Свободная запись — без ожидания одобрения."}
      </p>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {registrationErrorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
