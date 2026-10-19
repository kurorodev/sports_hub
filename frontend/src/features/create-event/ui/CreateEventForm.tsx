import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Lightbulb } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { ApiError, errorMessage } from "../../../shared/api/client";
import type { Session, Sport } from "../../../shared/api/types";
import { FormField } from "../../../shared/ui/FormField";
import { createEvent, sportsQuery } from "../../../entities/event";
import {
  customSportValue,
  eventFormSchema,
  serverFieldNames,
  timezoneOffsets,
  toEventInput,
  type EventFormValues,
} from "./create-event-form";

export function CreateEventForm({
  sports,
  session,
}: {
  sports: Sport[];
  session: Session;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      sportChoice: "",
      customSportName: "",
      date: "",
      time: "",
      timezoneOffset: "+03:00",
      location: { city: "", address: "" },
      skillLevel: "ANY",
      eventKind: "ACTIVITY",
      joinMode: "OPEN",
      capacity: 10,
    },
  });
  const sportChoice = useWatch({ control: form.control, name: "sportChoice" });
  const joinMode = useWatch({ control: form.control, name: "joinMode" });
  const mutation = useMutation({
    mutationFn: (values: EventFormValues) =>
      createEvent(toEventInput(values, session.user.id)),
    onSuccess: async (event) => {
      // A late response must not open a previous account's result after switching sessions.
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== session.user.id
      )
        return;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["events"] }),
        client.invalidateQueries({ queryKey: sportsQuery.queryKey }),
      ]);
      navigate(`/events/${event.id}`, { state: { created: true } });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status === 422 &&
        error.body?.details
      ) {
        const entries = error.body.details.map(
          ({ field, message }) => [field, message] as const,
        );
        let focused = false;
        for (const [field, message] of entries) {
          const name = serverFieldNames[field];
          if (name) {
            form.setError(
              name,
              { type: "server", message },
              { shouldFocus: !focused },
            );
            focused = true;
          }
        }
      }
    },
  });
  const errors = form.formState.errors;
  function accessibility(id: string, error?: string, hint = false) {
    return {
      id,
      "aria-invalid": Boolean(error),
      "aria-describedby":
        [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
          .filter(Boolean)
          .join(" ") || undefined,
    };
  }
  return (
    <section className="create-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} />К активностям
      </Link>
      <div className="create-heading">
        <span className="eyebrow muted">От идеи — к встрече</span>
        <h1>
          Давай соберёмся<span className="brand-dot">.</span>
        </h1>
        <p>Выбери спорт, место и время. Компания найдётся.</p>
      </div>
      <div className="create-layout">
        <form
          className="event-form"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <fieldset disabled={mutation.isPending}>
            <legend>
              <span>01</span>Что за движ?
            </legend>
            <FormField
              id="event-title"
              label="Название встречи"
              error={errors.title?.message}
            >
              <input
                {...accessibility("event-title", errors.title?.message)}
                {...form.register("title")}
                placeholder="Например, волейбол после работы"
                maxLength={160}
                required
              />
            </FormField>
            <div className="form-two-columns">
              <FormField
                id="event-sport"
                label="Вид спорта"
                error={errors.sportChoice?.message}
              >
                <select
                  {...accessibility("event-sport", errors.sportChoice?.message)}
                  {...form.register("sportChoice")}
                  required
                >
                  <option value="">Выберите спорт</option>
                  {sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                  <option value={customSportValue}>Свой вид спорта</option>
                </select>
              </FormField>
              <FormField
                id="event-kind"
                label="Формат встречи"
                error={errors.eventKind?.message}
              >
                <select
                  {...accessibility("event-kind", errors.eventKind?.message)}
                  {...form.register("eventKind")}
                >
                  <option value="ACTIVITY">Совместная активность</option>
                </select>
              </FormField>
            </div>
            {sportChoice === customSportValue && (
              <FormField
                id="custom-sport"
                label="Название нового вида спорта"
                hint="Любая дисциплина: от петанка до алтимата."
                error={errors.customSportName?.message}
              >
                <input
                  {...accessibility(
                    "custom-sport",
                    errors.customSportName?.message,
                    true,
                  )}
                  {...form.register("customSportName")}
                  maxLength={80}
                  placeholder="Например, алтимат"
                  required
                />
              </FormField>
            )}
            <FormField
              id="event-description"
              label="О встрече"
              hint="Как всё пройдёт, что взять с собой, есть ли расходы? От 10 до 5000 символов."
              error={errors.description?.message}
            >
              <textarea
                {...accessibility(
                  "event-description",
                  errors.description?.message,
                  true,
                )}
                {...form.register("description")}
                rows={5}
                maxLength={5000}
                placeholder="Расскажите, что ждёт участников…"
                required
              />
            </FormField>
          </fieldset>
          <fieldset disabled={mutation.isPending}>
            <legend>
              <span>02</span>Где и когда
            </legend>
            <div className="form-two-columns">
              <FormField
                id="event-city"
                label="Город"
                error={errors.location?.city?.message}
              >
                <input
                  {...accessibility(
                    "event-city",
                    errors.location?.city?.message,
                  )}
                  {...form.register("location.city")}
                  autoComplete="address-level2"
                  placeholder="Ваш город"
                  maxLength={120}
                  required
                />
              </FormField>
              <FormField
                id="event-address"
                label="Место встречи"
                error={errors.location?.address?.message}
              >
                <input
                  {...accessibility(
                    "event-address",
                    errors.location?.address?.message,
                  )}
                  {...form.register("location.address")}
                  placeholder="Адрес и точка сбора"
                  maxLength={300}
                  required
                />
              </FormField>
            </div>
            <div className="form-two-columns">
              <FormField
                id="event-date"
                label="Дата"
                error={errors.date?.message}
              >
                <input
                  {...accessibility("event-date", errors.date?.message)}
                  {...form.register("date")}
                  type="date"
                  required
                />
              </FormField>
              <FormField
                id="event-time"
                label="Время"
                error={errors.time?.message}
              >
                <input
                  {...accessibility("event-time", errors.time?.message)}
                  {...form.register("time")}
                  type="time"
                  required
                />
              </FormField>
            </div>
            <FormField
              id="event-timezone"
              label="Часовой пояс места встречи"
              hint="Часовой пояс будет указан рядом со временем встречи."
              error={errors.timezoneOffset?.message}
            >
              <select
                {...accessibility(
                  "event-timezone",
                  errors.timezoneOffset?.message,
                  true,
                )}
                {...form.register("timezoneOffset")}
              >
                {timezoneOffsets.map((offset) => (
                  <option key={offset} value={offset}>
                    UTC{offset}
                    {offset === "+03:00"
                      ? " · Москва"
                      : offset === "+07:00"
                        ? " · Красноярск"
                        : ""}
                  </option>
                ))}
              </select>
            </FormField>
          </fieldset>
          <fieldset disabled={mutation.isPending}>
            <legend>
              <span>03</span>Кого ждём
            </legend>
            <div className="form-two-columns">
              <FormField
                id="event-level"
                label="Уровень участников"
                error={errors.skillLevel?.message}
              >
                <select
                  {...accessibility("event-level", errors.skillLevel?.message)}
                  {...form.register("skillLevel")}
                >
                  <option value="ANY">Любой уровень</option>
                  <option value="BEGINNER">Начинающий</option>
                  <option value="AMATEUR">Любитель</option>
                  <option value="ADVANCED">Продвинутый</option>
                  <option value="PROFESSIONAL">Профессиональный</option>
                </select>
              </FormField>
              <FormField
                id="event-capacity"
                label="Количество мест"
                error={errors.capacity?.message}
              >
                <input
                  {...accessibility("event-capacity", errors.capacity?.message)}
                  {...form.register("capacity", { valueAsNumber: true })}
                  type="number"
                  min={2}
                  max={10000}
                  inputMode="numeric"
                  required
                />
              </FormField>
            </div>
            <FormField
              id="event-join"
              label="Как присоединиться"
              error={errors.joinMode?.message}
              hint={
                joinMode === "OPEN"
                  ? "Запись будет подтверждаться сразу."
                  : "Каждую заявку нужно будет одобрить организатору."
              }
            >
              <select
                {...accessibility("event-join", errors.joinMode?.message, true)}
                {...form.register("joinMode")}
              >
                <option value="OPEN">Свободная запись</option>
                <option value="APPROVAL">По заявке</option>
              </select>
            </FormField>
          </fieldset>
          <div className="publish-panel">
            <p>
              Личная встреча от имени{" "}
              <strong>{session.user.displayName}</strong>. После публикации её
              увидят другие пользователи.
            </p>
            {session.manageableOrganizationIds.length > 0 && (
              <p className="field-hint">
                Публикация от имени организации пока недоступна.
              </p>
            )}
            {mutation.isError && (
              <p className="field-error" role="alert">
                {errorMessage(mutation.error)} Данные формы сохранены, можно
                повторить отправку.
              </p>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Публикуем…" : "Опубликовать встречу"}
              <ArrowUpRight size={18} />
            </button>
          </div>
        </form>
        <aside className="create-aside">
          <div className="notice">
            <Lightbulb size={24} />
            <h2>Хорошая встреча начинается с ясности</h2>
            <p>
              Назови точку сбора, удобный темп и всё, что нужно взять. Так проще
              решиться прийти впервые.
            </p>
          </div>
          <div className="create-aside-note">
            <span className="eyebrow muted">
              Твоя идея — чей-то план на вечер
            </span>
            <p>
              Не нашёл свой спорт?
              <br />
              <strong>Добавь его сам.</strong>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
