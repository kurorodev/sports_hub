import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { EventParticipation } from "../../../entities/event/model";
import {
  registrationErrorMessage,
  registrationPresentation,
} from "../../../entities/registration";
import { CancelParticipation } from "./CancelParticipation";
import { useNow } from "../../../shared/lib/use-now";
import { useJoinEvent } from "./use-join-event";

export function JoinAction({
  event,
  publicationClosed = false,
}: {
  event: EventParticipation;
  publicationClosed?: boolean;
}) {
  useLocale();
  const now = useNow();
  const location = useLocation();
  const { session, viewerId, own, mutation, join } = useJoinEvent(
    event.eventId,
    event.joinMode,
  );
  if (session.isPending)
    return (
      <p className="join-note" role="status">
        {tr("Проверяем сессию…")}
      </p>
    );
  if (session.isError)
    return (
      <div className="join-feedback" role="alert">
        <p>{tr("Не удалось проверить аккаунт.")}</p>
        <button
          className="button secondary full-width"
          onClick={() => void session.refetch()}
        >
          {tr("Повторить проверку аккаунта")}
        </button>
      </div>
    );
  if (session.data?.systemRoles.includes("ADMIN"))
    return (
      <p className="join-note">
        Вы просматриваете мероприятие как администратор.
      </p>
    );
  if (event.organizer)
    return (
      <div className="join-feedback">
        <p className="join-note">
          {tr("Вы организатор.")}{" "}
          {publicationClosed
            ? tr(
                "Новая запись закрыта. Существующие регистрации доступны для просмотра.",
              )
            : event.joinMode === "OPEN"
              ? tr("Участники появятся в списке ниже.")
              : tr("Решения по заявкам принимаете вы.")}
        </p>
        {event.joinMode === "APPROVAL" &&
          (event.pendingParticipants > 0 ? (
            <a
              className={`button ${publicationClosed ? "secondary" : "primary"} full-width`}
              href="#event-requests"
            >
              {publicationClosed
                ? tr("Посмотреть заявки")
                : tr("Рассмотреть заявки")}
            </a>
          ) : (
            <button
              type="button"
              className="button requests-empty-action full-width"
              disabled
            >
              {tr("Новых заявок нет")}
            </button>
          ))}
      </div>
    );
  if (!viewerId && !event.openForRegistration)
    return <p className="join-note">{tr("Запись на эту встречу закрыта.")}</p>;
  if (!viewerId)
    return (
      <div className="join-feedback">
        <Link
          className="button primary full-width"
          to={`/login?next=join-event&eventId=${encodeURIComponent(event.eventId)}`}
          state={location.state}
        >
          {tr("Войти для записи")}
          <ArrowUpRight size={18} />
        </Link>
        <p className="join-note">
          {tr("Войдите, чтобы проверить участие и присоединиться.")}
        </p>
      </div>
    );
  if (own.isPending)
    return (
      <p className="join-note" role="status">
        {tr("Проверяем ваше участие…")}
      </p>
    );
  if (own.isError)
    return (
      <div className="join-feedback" role="alert">
        <p>{tr(registrationErrorMessage(own.error))}</p>
        <button
          className="button secondary full-width"
          onClick={() => void own.refetch()}
        >
          {tr("Повторить проверку участия")}
        </button>
      </div>
    );
  if (own.data && own.data.status !== "CANCELLED") {
    const { label, tone, Icon } = registrationPresentation[own.data.status];
    return (
      <div className="join-feedback">
        <div className={`registration-status ${tone}`} role="status">
          <Icon size={20} />
          <div>
            <strong>{tr(label)}</strong>
            <p>
              {publicationClosed
                ? tr(
                    "Существующая запись сохранена. Мероприятие больше не опубликовано, новая запись закрыта.",
                  )
                : own.data.status === "CONFIRMED"
                  ? event.joinMode === "APPROVAL"
                    ? tr("Заявка одобрена. До встречи!")
                    : tr("Участие подтверждено. До встречи!")
                  : own.data.status === "PENDING"
                    ? tr(
                        "Организатор рассмотрит заявку. До одобрения место не занято.",
                      )
                    : (own.data.decisionReason ??
                      tr("Текущий статус получен от организатора."))}
            </p>
          </div>
        </div>
        {event.startsAt &&
          Date.parse(event.startsAt) > now &&
          ["CONFIRMED", "PENDING", "WAITLISTED"].includes(own.data.status) && (
            <CancelParticipation eventId={event.eventId} viewerId={viewerId} />
          )}
      </div>
    );
  }
  if (!event.openForRegistration)
    return <p className="join-note">{tr("Запись на эту встречу закрыта.")}</p>;
  if (
    event.joinMode === "OPEN" &&
    event.participantLimit != null &&
    event.confirmedParticipants >= event.participantLimit
  )
    return (
      <p className="join-note">
        {tr("Все места заняты. Выберите другую встречу.")}
      </p>
    );
  return (
    <div className="join-feedback">
      {own.data?.status === "CANCELLED" && (
        <p className="join-note" role="status">
          {tr("Участие отменено. Вы можете записаться снова.")}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={mutation.isPending}
        onClick={join}
      >
        {mutation.isPending
          ? event.joinMode === "APPROVAL"
            ? tr("Отправляем заявку…")
            : tr("Записываем…")
          : event.joinMode === "APPROVAL"
            ? tr("Подать заявку")
            : tr("Присоединиться")}
        <ArrowUpRight size={18} />
      </button>
      <p className="join-note">
        {mutation.isPending
          ? tr("Ждём подтверждение записи…")
          : event.joinMode === "APPROVAL"
            ? tr(
                "Участие после одобрения организатора. Заявка не резервирует место.",
              )
            : tr("Свободная запись — без ожидания одобрения.")}
      </p>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {tr(registrationErrorMessage(mutation.error))}
        </p>
      )}
    </div>
  );
}
