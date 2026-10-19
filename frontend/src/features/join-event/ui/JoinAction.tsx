import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { EventParticipation } from "../../../entities/event/model";
import {
  registrationErrorMessage,
  registrationPresentation,
} from "../../../entities/registration";
import { useJoinEvent } from "./use-join-event";

export function JoinAction({ event }: { event: EventParticipation }) {
  const { session, viewerId, own, mutation, join } = useJoinEvent(
    event.eventId,
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
      <p className="join-note">
        Вы организатор. Участники появятся в списке ниже.
      </p>
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
          <p>Участие подтверждено. До встречи!</p>
        </div>
      </div>
    );
  }
  if (!event.openForRegistration)
    return <p className="join-note">Запись на эту встречу закрыта.</p>;
  if (event.confirmedParticipants >= event.participantLimit)
    return (
      <p className="join-note">Все места заняты. Выберите другую встречу.</p>
    );
  if (event.joinMode !== "OPEN")
    return (
      <p className="join-note">
        Эта встреча требует одобрения организатора. Подача заявки пока
        недоступна.
      </p>
    );
  return (
    <div className="join-feedback">
      <button
        className="button primary full-width"
        disabled={mutation.isPending}
        onClick={join}
      >
        {mutation.isPending ? "Записываем…" : "Присоединиться"}
        <ArrowUpRight size={18} />
      </button>
      <p className="join-note">
        {mutation.isPending
          ? "Ждём подтверждение записи…"
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
