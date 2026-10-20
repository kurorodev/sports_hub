import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { sportsQuery } from "../../../entities/event";
import {
  levelLabels,
  timeLabels,
} from "../../../entities/profile/ui/presentation";
import {
  experienceLevels,
  preferredTimes,
} from "../../../entities/profile/model";
import type {
  Questionnaire,
  QuestionnaireAnswers,
} from "../../../shared/api/types";
import { errorMessage } from "../../../shared/api/client";
import { Dialog } from "../../../shared/ui/Dialog";
import { Select } from "../../../shared/ui/Select";
import { ErrorState } from "../../../shared/ui/Feedback";
import { useQuestionnaireMutation } from "../api";

export function QuestionnaireDialog({
  userId,
  initial,
  onboarding = false,
  onClose,
}: {
  userId: string;
  initial: Questionnaire;
  onboarding?: boolean;
  onClose?: () => void;
}) {
  const id = useId();
  const sports = useQuery(sportsQuery);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(initial.city ?? "");
  const [preferences, setPreferences] = useState(
    initial.sportsPreferences.slice(0, 10),
  );
  const [time, setTime] = useState<QuestionnaireAnswers["preferredTime"]>(
    initial.preferredTime ?? "ANY",
  );
  const mutation = useQuestionnaireMutation(userId, onClose);
  const close = () => {
    if (mutation.isPending) return;
    if (onboarding) mutation.mutate(null);
    else onClose?.();
  };
  const names = new Map(sports.data?.map((sport) => [sport.id, sport.name]));
  const term = search.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const matching = (sports.data ?? []).filter((sport) =>
    sport.name.toLocaleLowerCase("ru").replaceAll("ё", "е").includes(term),
  );
  const visible = matching.slice(0, 12);
  function toggle(sportId: string) {
    setPreferences((current) =>
      current.some((item) => item.sportId === sportId)
        ? current.filter((item) => item.sportId !== sportId)
        : current.length < 10
          ? [...current, { sportId, level: "BEGINNER" }]
          : current,
    );
  }
  return (
    <Dialog
      labelledBy={`${id}-title`}
      onClose={close}
      className="questionnaire-dialog"
    >
      <div className="questionnaire-heading">
        <span className="questionnaire-symbol">
          <Sparkles size={26} aria-hidden="true" />
        </span>
        <span className="eyebrow muted">Твои интересы · Шаг {step} из 2</span>
        <button
          type="button"
          className={`questionnaire-close${onboarding ? " questionnaire-later" : ""}`}
          aria-label={onboarding ? "Пропустить анкету" : "Закрыть анкету"}
          onClick={close}
          disabled={mutation.isPending}
        >
          {onboarding ? "Позже" : <X size={22} />}
        </button>
      </div>
      <h2 id={`${id}-title`}>
        {step === 1 ? "Найдём спорт по душе" : "Подстроим подборку под тебя"}
      </h2>
      <p className="questionnaire-intro">
        {step === 1
          ? "Расскажи, что тебе интересно. Подберём мероприятия и компанию для занятий."
          : "Укажи свой уровень и удобное время. Ответы можно изменить в профиле."}
      </p>
      <div className="questionnaire-progress" aria-hidden="true">
        <span />
        <span className={step === 2 ? "is-active" : ""} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            mutation.isPending ||
            sports.isPending ||
            sports.isError ||
            !city.trim() ||
            !preferences.length
          )
            return;
          if (step === 1) {
            if (city.trim() && preferences.length) setStep(2);
            return;
          }
          mutation.mutate({
            city: city.trim(),
            sportsPreferences: preferences,
            preferredTime: time,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          });
        }}
      >
        <fieldset
          className="questionnaire-fields"
          disabled={mutation.isPending}
        >
          <legend className="sr-only">Спортивные предпочтения</legend>
          {step === 1 ? (
            <>
              <label htmlFor={`${id}-city`}>
                В каком городе планируешь заниматься?
              </label>
              <input
                id={`${id}-city`}
                type="text"
                autoComplete="address-level2"
                placeholder="Например, Красноярск"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
                maxLength={100}
              />
              <div className="questionnaire-label">
                <label htmlFor={`${id}-search`}>
                  Какие виды спорта тебе интересны?
                </label>
                <span>{preferences.length} / 10</span>
              </div>
              <p className="field-hint">
                Выбери от 1 до 10. Можно попробовать что-то новое.
              </p>
              <div className="questionnaire-search">
                <Search size={18} aria-hidden="true" />
                <input
                  id={`${id}-search`}
                  type="search"
                  placeholder="Найти вид спорта"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              {preferences.length > 0 && (
                <div
                  className="questionnaire-chips"
                  aria-label="Выбранные виды спорта"
                >
                  {preferences.map((item) => (
                    <button
                      key={item.sportId}
                      type="button"
                      onClick={() => toggle(item.sportId)}
                      aria-label={`Убрать ${names.get(item.sportId) ?? "вид спорта"}`}
                    >
                      {names.get(item.sportId) ?? "Вид спорта"}
                      <X size={14} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
              {sports.isPending ? (
                <p role="status">Загружаем виды спорта…</p>
              ) : sports.isError ? (
                <ErrorState
                  error={sports.error}
                  retry={() => void sports.refetch()}
                />
              ) : (
                <>
                  <div className="questionnaire-sports">
                    {visible.map((sport) => {
                      const selected = preferences.some(
                        (item) => item.sportId === sport.id,
                      );
                      return (
                        <label
                          className={selected ? "is-selected" : ""}
                          key={sport.id}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(sport.id)}
                            disabled={!selected && preferences.length >= 10}
                          />
                          <span>{sport.name}</span>
                          {selected && <Check size={17} aria-hidden="true" />}
                        </label>
                      );
                    })}
                  </div>
                  {!matching.length && (
                    <p role="status">
                      Ничего не нашли. Попробуй другое название.
                    </p>
                  )}
                  {matching.length > 12 && (
                    <p className="field-hint">
                      Показаны первые 12 видов спорта. Используй поиск, чтобы
                      найти нужный.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <h3>Твой уровень в выбранных видах спорта</h3>
              {preferences.map((item) => (
                <div className="questionnaire-level" key={item.sportId}>
                  <label htmlFor={`${id}-${item.sportId}`}>
                    {names.get(item.sportId) ?? "Вид спорта"}
                  </label>
                  <Select
                    id={`${id}-${item.sportId}`}
                    value={item.level}
                    onChange={(event) =>
                      setPreferences((current) =>
                        current.map((pref) =>
                          pref.sportId === item.sportId
                            ? {
                                ...pref,
                                level: event.target.value as typeof item.level,
                              }
                            : pref,
                        ),
                      )
                    }
                  >
                    {experienceLevels.map((level) => (
                      <option key={level} value={level}>
                        {levelLabels[level]}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
              <fieldset className="questionnaire-time">
                <legend>Когда удобнее заниматься?</legend>
                {preferredTimes.map((value) => (
                  <label
                    key={value}
                    className={time === value ? "is-selected" : ""}
                  >
                    <input
                      type="radio"
                      name={`${id}-time`}
                      value={value}
                      checked={time === value}
                      onChange={() => setTime(value)}
                    />
                    {timeLabels[value]}
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </fieldset>
        {mutation.isError && (
          <p className="field-error" role="alert">
            {errorMessage(mutation.error)} Ответы остались в форме.
          </p>
        )}
        <div className="questionnaire-actions">
          {step === 2 && (
            <button
              className="button secondary"
              type="button"
              disabled={mutation.isPending}
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={17} />
              Назад
            </button>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={
              mutation.isPending ||
              !city.trim() ||
              !preferences.length ||
              sports.isPending ||
              sports.isError
            }
          >
            {mutation.isPending
              ? "Сохраняем…"
              : step === 1
                ? "Продолжить"
                : "Сформировать рекомендации"}
            {step === 1 ? <ArrowRight size={18} /> : <Sparkles size={18} />}
          </button>
        </div>
        <button
          type="button"
          className="questionnaire-skip"
          disabled={mutation.isPending}
          onClick={close}
        >
          {onboarding ? "Пропустить, заполню позже" : "Отмена"}
        </button>
      </form>
      <p className="questionnaire-footnote">
        {onboarding
          ? "Анкета необязательна. Вернуться к ней можно в своём профиле."
          : "Новые ответы заменят предыдущие только после сохранения."}
      </p>
    </Dialog>
  );
}
