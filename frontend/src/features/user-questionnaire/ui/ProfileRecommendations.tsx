import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { EventCard } from "../../../entities/event";
import { Dialog } from "../../../shared/ui/Dialog";
import { ErrorState } from "../../../shared/ui/Feedback";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { questionnaireQuery, recommendationsQuery } from "../api";
import { QuestionnaireDialog } from "./QuestionnaireDialog";

const reasonLabels = {
  FAVORITE_SPORT: "Любимый вид спорта",
  SUITABLE_LEVEL: "Подходит по уровню",
  PREFERRED_TIME: "Удобное время",
  AVAILABLE_SPOTS: "Есть свободные места",
  SUITABLE_AGE: "Совпадает возрастной ориентир",
};

export function ProfileRecommendations({ userId }: { userId: string }) {
  useLocale();
  const id = useId();
  const query = useQuery(questionnaireQuery(userId));
  const [dialog, setDialog] = useState<"confirm" | "questionnaire" | null>(
    null,
  );
  const [page, setPage] = useState(0);
  const [otherCities, setOtherCities] = useState(false);
  const [otherSports, setOtherSports] = useState(false);
  const completed = query.data?.status === "COMPLETED";
  const events = useQuery({
    ...recommendationsQuery(userId, page, otherCities, otherSports),
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
            <Sparkles size={16} aria-hidden="true" />{" "}
            {tr("Персональная подборка")}
          </span>
          <h2 id={`${id}-title`}>{tr("Твой спорт — твои встречи")}</h2>
          <p>
            {completed
              ? otherCities
                ? tr("Новые встречи по вашим предпочтениям во всех городах.")
                : tr("Новые встречи по вашим предпочтениям в городе {0}.", [
                    query.data?.city || tr("из профиля"),
                  ])
              : tr(
                  "Ответь на несколько вопросов, и мы подберём мероприятия по твоим интересам.",
                )}
          </p>
        </div>
        <button
          className="button primary"
          disabled={!query.data || query.isError}
          onClick={() => setDialog(completed ? "confirm" : "questionnaire")}
        >
          <Sparkles size={18} />
          {tr("Сформировать рекомендации")}
        </button>
      </div>
      {query.isPending && <p role="status">{tr("Загружаем предпочтения…")}</p>}
      {query.isError && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {completed && (
        <>
          <fieldset className="recommendations-options">
            <legend className="sr-only">{tr("Настройки подборки")}</legend>
            <label>
              <input
                type="checkbox"
                checked={otherCities}
                onChange={(event) => {
                  setOtherCities(event.target.checked);
                  setPage(0);
                }}
              />
              {tr("Искать во всех городах")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={otherSports}
                onChange={(event) => {
                  setOtherSports(event.target.checked);
                  setPage(0);
                }}
              />
              {tr("Предлагать другие виды спорта")}
            </label>
          </fieldset>
          <p className="field-hint">
            {tr(
              "Любимые виды спорта идут первыми. Встречи без мест и ваши текущие или отменённые записи не предлагаем: они доступны в «Моих мероприятиях».",
            )}
          </p>
          {query.data?.age != null && (
            <p className="field-hint">
              {tr(
                "Возраст: {0}. Учитываем его, только если организатор указал возрастной ориентир.",
                [query.data.age],
              )}
            </p>
          )}
          {events.isPending ? (
            <p role="status">{tr("Подбираем мероприятия…")}</p>
          ) : events.isError ? (
            <ErrorState
              error={events.error}
              retry={() => void events.refetch()}
            />
          ) : (
            events.data && (
              <>
                {events.data.items.length ? (
                  <div className="event-grid">
                    {events.data.items.map((item) => (
                      <div className="recommended-event" key={item.event.id}>
                        <div className="recommendation-reasons">
                          {item.matchReasons.map((reason) => (
                            <span key={reason}>{tr(reasonLabels[reason])}</span>
                          ))}
                        </div>
                        <EventCard event={item.event} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="recommendations-empty">
                    <h3>{tr("Предпочтения сохранены")}</h3>
                    <p>
                      {tr(
                        "Сейчас нет новых встреч с этими условиями. Можно расширить поиск на другие города или виды спорта. Возрастной ориентир и выбранный город могут сужать подборку.",
                      )}
                    </p>
                    <Link className="button secondary" to="/">
                      {tr("Посмотреть все мероприятия")}
                    </Link>
                  </div>
                )}
                {(page > 0 || events.data.totalPages > 1) && (
                  <nav
                    className="pagination"
                    aria-label={tr("Страницы рекомендаций")}
                  >
                    <button
                      className="button secondary"
                      disabled={page === 0}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      {tr("Назад")}
                    </button>
                    <span>
                      {tr("Страница {0} из {1}", [
                        page + 1,
                        Math.max(page + 1, events.data.totalPages),
                      ])}
                    </span>
                    <button
                      className="button secondary"
                      disabled={page + 1 >= events.data.totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      {tr("Далее")}
                    </button>
                  </nav>
                )}
              </>
            )
          )}
        </>
      )}
      {dialog === "confirm" && (
        <Dialog
          labelledBy={`${id}-confirm`}
          className="questionnaire-confirm"
          onClose={() => setDialog(null)}
        >
          <Sparkles size={30} aria-hidden="true" />
          <h2 id={`${id}-confirm`}>
            {tr("Ваши рекомендации уже сформированы")}
          </h2>
          <p>
            {tr(
              "Хотите сформировать заново? Откроется анкета с вашими текущими ответами.",
            )}
          </p>
          <div className="questionnaire-actions">
            <button
              className="button danger-button"
              autoFocus
              onClick={() => setDialog(null)}
            >
              {tr("Отмена")}
            </button>
            <button
              className="button primary"
              onClick={() => setDialog("questionnaire")}
            >
              {tr("Да")}
            </button>
          </div>
        </Dialog>
      )}
      {dialog === "questionnaire" && query.data && (
        <QuestionnaireDialog
          userId={userId}
          initial={query.data}
          onClose={() => {
            setDialog(null);
            setPage(0);
          }}
        />
      )}
    </section>
  );
}
