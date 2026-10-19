import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { sportsQuery } from "../../../entities/event";
import { ErrorState } from "../../../shared/ui/Feedback";
import { CreateEventForm } from "../../../features/create-event";

export function CreateEventPage() {
  const session = useQuery(sessionQuery);
  const sports = useQuery(sportsQuery);
  if (session.isPending)
    return (
      <p className="page-state" role="status">
        Восстанавливаем сессию…
      </p>
    );
  if (session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data)
    return (
      <section className="feedback page-state">
        <CalendarPlus size={36} />
        <h1>Собери свою компанию</h1>
        <p>Войди в аккаунт, чтобы создать спортивную встречу.</p>
        <Link className="button primary" to="/login?next=create-event">
          Войти и создать
        </Link>
      </section>
    );
  if (sports.isPending)
    return (
      <p className="page-state" role="status">
        Загружаем виды спорта…
      </p>
    );
  if (sports.isError)
    return (
      <ErrorState error={sports.error} retry={() => void sports.refetch()} />
    );
  return <CreateEventForm sports={sports.data} session={session.data} />;
}
