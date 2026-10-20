import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { EventCard } from "../../../entities/event";
import { Dialog } from "../../../shared/ui/Dialog";
import { ErrorState } from "../../../shared/ui/Feedback";
import { questionnaireQuery, recommendationsQuery } from "../api";
import { QuestionnaireDialog } from "./QuestionnaireDialog";

const reasonLabels = {
  FAVORITE_SPORT: "Любимый вид спорта",
  SUITABLE_LEVEL: "Подходит по уровню",
  PREFERRED_TIME: "Удобное время",
  AVAILABLE_SPOTS: "Есть свободные места",
};

export function ProfileRecommendations({ userId }: { userId: string }) {
  const id = useId();
  const query = useQuery(questionnaireQuery(userId));
  const [dialog, setDialog] = useState<"confirm" | "questionnaire" | null>(
    null,
  );
  const completed = query.data?.status === "COMPLETED";
  const events = useQuery({
    ...recommendationsQuery(userId),
    enabled: completed,
  });
  return (
    <section
      className="profile-recommendations"
      aria-labelledby={`${id}-title`}
    >
      <div className="recommendations-heading">
        <div>
          <span className="eyebrow muted">
            <Sparkles size={16} aria-hidden="true" /> Персональная подборка
          </span>
          <h2 id={`${id}-title`}>Твой спорт — твои встречи</h2>
          <p>
            {completed
              ? `Мероприятия в городе ${query.data?.city ?? "из профиля"} с учётом твоих интересов, уровня и удобного времени.`
              : "Ответь на несколько вопросов, и мы подберём мероприятия по твоим интересам."}
          </p>
        </div>
        <button
          className="button primary"
          disabled={!query.data || query.isError}
          onClick={() => setDialog(completed ? "confirm" : "questionnaire")}
        >
          <Sparkles size={18} />
          Сформировать рекомендации
        </button>
      </div>
      {query.isPending && <p role="status">Загружаем предпочтения…</p>}
      {query.isError && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {completed &&
        (events.isPending ? (
          <p role="status">Подбираем мероприятия…</p>
        ) : events.isError ? (
          <ErrorState
            error={events.error}
            retry={() => void events.refetch()}
          />
        ) : events.data && events.data.items.length > 0 ? (
          <div className="event-grid">
            {events.data.items.map((item) => (
              <div className="recommended-event" key={item.event.id}>
                <div className="recommendation-reasons">
                  {item.matchReasons.map((reason) => (
                    <span key={reason}>{reasonLabels[reason]}</span>
                  ))}
                </div>
                <EventCard event={item.event} />
              </div>
            ))}
          </div>
        ) : (
          <div className="recommendations-empty">
            <h3>Предпочтения сохранены</h3>
            <p>
              Пока нет подходящих будущих мероприятий в твоём городе. Подборка
              обновится, когда они появятся.
            </p>
            <Link className="button secondary" to="/">
              Посмотреть все мероприятия
            </Link>
          </div>
        ))}
      {dialog === "confirm" && (
        <Dialog
          labelledBy={`${id}-confirm`}
          className="questionnaire-confirm"
          onClose={() => setDialog(null)}
        >
          <Sparkles size={30} aria-hidden="true" />
          <h2 id={`${id}-confirm`}>Ваши рекомендации уже сформированы</h2>
          <p>
            Хотите сформировать заново? Откроется анкета с вашими текущими
            ответами.
          </p>
          <div className="questionnaire-actions">
            <button
              className="button danger-button"
              autoFocus
              onClick={() => setDialog(null)}
            >
              Отмена
            </button>
            <button
              className="button primary"
              onClick={() => setDialog("questionnaire")}
            >
              Да
            </button>
          </div>
        </Dialog>
      )}
      {dialog === "questionnaire" && query.data && (
        <QuestionnaireDialog
          userId={userId}
          initial={query.data}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
