import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Textarea } from "../../../shared/ui/Textarea";
import { Select } from "../../../shared/ui/Select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Lightbulb } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { ApiError, errorMessage } from "../../../shared/api/client";
import type { Session, Sport } from "../../../shared/api/types";
import { LocationPicker } from "../../../shared/ui/LocationPicker";
import { FormField } from "../../../shared/ui/FormField";
import { SearchableSelect } from "../../../shared/ui/SearchableSelect";
import { DatePicker } from "../../../shared/ui/DatePicker";
import { useCurrentDate } from "../../../shared/hooks/use-current-date";
import { createEvent, sportIcon, sportsQuery } from "../../../entities/event";
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
  organizations = [],
  initialOrganizationId,
}: {
  sports: Sport[];
  session: Session;
  organizations?: { id: string; name: string }[];
  initialOrganizationId?: string;
}) {
  useLocale();
  const navigate = useNavigate();
  const client = useQueryClient();
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      organizerChoice: initialOrganizationId ?? "__personal__",
      title: "",
      description: "",
      requirements: "",
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
  const timezoneOffset = useWatch({
    control: form.control,
    name: "timezoneOffset",
  });
  const today = useCurrentDate(timezoneOffset);
  const mutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      if (
        values.organizerChoice !== "__personal__" &&
        (!session.manageableOrganizationIds.includes(values.organizerChoice) ||
          !organizations.some((item) => item.id === values.organizerChoice))
      )
        throw new ApiError(403);
      return createEvent(toEventInput(values, session.user.id));
    },
    onSuccess: async (event) => {
      // A late response must not open a previous account's result after switching sessions.
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== session.user.id
      )
        return;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["events"] }),
        client.invalidateQueries({ queryKey: ["notifications"] }),
        client.invalidateQueries({ queryKey: ["map", "events"] }),
        client.invalidateQueries({ queryKey: sportsQuery.queryKey }),
      ]);
      navigate(`/events/${event.id}`, { state: { created: true } });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        [400, 422].includes(error.status) &&
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
        <ArrowLeft size={18} />
        {tr("К активностям")}
      </Link>
      <div className="create-heading">
        <span className="eyebrow muted">{tr("От идеи — к встрече")}</span>
        <h1>
          {tr("Давай соберёмся")}
          <span className="brand-dot">.</span>
        </h1>
        <p>{tr("Выбери спорт, место и время. Компания найдётся.")}</p>
      </div>
      <div className="create-layout">
        <form
          className="event-form"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <fieldset disabled={mutation.isPending}>
            <legend>
              <span>01</span>
              {tr("Что за встреча?")}
            </legend>
            <FormField
              id="event-title"
              label={tr("Название встречи")}
              error={errors.title?.message}
            >
              <input
                {...accessibility("event-title", errors.title?.message)}
                {...form.register("title")}
                placeholder={tr("Например, волейбол после работы")}
                maxLength={160}
                required
              />
            </FormField>
            <FormField
              id="event-sport"
              label={tr("Вид спорта")}
              error={errors.sportChoice?.message}
            >
              <Controller
                control={form.control}
                name="sportChoice"
                render={({ field }) => (
                  <SearchableSelect
                    {...accessibility(
                      "event-sport",
                      errors.sportChoice?.message,
                    )}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={mutation.isPending}
                    aria-required="true"
                    options={[
                      { id: "", name: tr("Выберите спорт") },
                      ...sports
                        .filter((sport) => !sport.isCustom)
                        .map((sport) => ({
                          id: sport.id,
                          name: sport.name,
                          imageUrl: sport.imageUrl || sportIcon(sport.name),
                        })),
                      {
                        id: customSportValue,
                        name: tr("Другое"),
                        imageUrl: sportIcon(tr("Другое")),
                      },
                    ]}
                  />
                )}
              />
            </FormField>
            {sportChoice === customSportValue && (
              <FormField
                id="custom-sport"
                label={tr("Название активности")}
                hint={tr(
                  "Опишите свой вариант. Встреча останется в категории «Другое» и не создаст новую категорию.",
                )}
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
                  placeholder={tr("Например, петанк в парке")}
                  required
                />
              </FormField>
            )}
            <FormField
              id="event-description"
              label={tr("О встрече")}
              hint={tr(
                "Как всё пройдёт, что взять с собой, есть ли расходы? От 10 до 5000 символов.",
              )}
              error={errors.description?.message}
            >
              <Textarea
                {...accessibility(
                  "event-description",
                  errors.description?.message,
                  true,
                )}
                {...form.register("description")}
                rows={5}
                maxLength={5000}
                placeholder={tr("Расскажите, что ждёт участников…")}
                required
              />
            </FormField>
            <FormField
              id="event-requirements"
              label={tr("Условия участия")}
              hint={tr(
                "Что взять с собой, какая подготовка нужна? Необязательно, до 2000 символов.",
              )}
              error={errors.requirements?.message}
            >
              <Textarea
                {...accessibility(
                  "event-requirements",
                  errors.requirements?.message,
                  true,
                )}
                {...form.register("requirements")}
                placeholder={tr(
                  "Например, удобная обувь, вода и базовая подготовка",
                )}
                rows={3}
                maxLength={2000}
              />
            </FormField>
          </fieldset>
          <fieldset disabled={mutation.isPending}>
            <legend>
              <span>02</span>
              {tr("Где и когда")}
            </legend>
            <Controller
              control={form.control}
              name="location"
              render={({ field }) => (
                <LocationPicker
                  value={field.value}
                  onChange={field.onChange}
                  errors={{
                    city: errors.location?.city?.message,
                    address: errors.location?.address?.message,
                    latitude: errors.location?.latitude?.message,
                    longitude: errors.location?.longitude?.message,
                  }}
                />
              )}
            />
            <div className="form-two-columns">
              <FormField
                id="event-date"
                label={tr("Дата")}
                error={errors.date?.message}
              >
                <Controller
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <DatePicker
                      {...accessibility("event-date", errors.date?.message)}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(value) => {
                        field.onChange(value);
                        void form.trigger("date");
                      }}
                      min={today}
                      today={today}
                      disabled={mutation.isPending}
                      required
                    />
                  )}
                />
              </FormField>
              <FormField
                id="event-time"
                label={tr("Время")}
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
              label={tr("Часовой пояс места встречи")}
              hint={tr("Часовой пояс будет указан рядом со временем встречи.")}
              error={errors.timezoneOffset?.message}
            >
              <Select
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
                      ? tr(" · Москва")
                      : offset === "+07:00"
                        ? tr(" · Красноярск")
                        : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          </fieldset>
          <fieldset disabled={mutation.isPending}>
            <legend>
              <span>03</span>
              {tr("Кого ждём")}
            </legend>
            <div className="form-two-columns">
              <FormField
                id="event-level"
                label={tr("Уровень участников")}
                error={errors.skillLevel?.message}
              >
                <Select
                  {...accessibility("event-level", errors.skillLevel?.message)}
                  {...form.register("skillLevel")}
                >
                  <option value="ANY">{tr("Любой уровень")}</option>
                  <option value="BEGINNER">{tr("Начинающий")}</option>
                  <option value="AMATEUR">{tr("Любитель")}</option>
                  <option value="ADVANCED">{tr("Продвинутый")}</option>
                  <option value="PROFESSIONAL">{tr("Профессиональный")}</option>
                </Select>
              </FormField>
              <FormField
                id="event-capacity"
                label={tr("Количество участников")}
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
              label={tr("Как присоединиться")}
              error={errors.joinMode?.message}
              hint={
                joinMode === "OPEN"
                  ? tr("Запись будет подтверждаться сразу.")
                  : tr("Каждую заявку нужно будет одобрить организатору.")
              }
            >
              <Select
                {...accessibility("event-join", errors.joinMode?.message, true)}
                {...form.register("joinMode")}
              >
                <option value="OPEN">{tr("Свободная запись")}</option>
                <option value="APPROVAL">{tr("По заявке")}</option>
              </Select>
            </FormField>
          </fieldset>
          <div className="publish-panel">
            <FormField
              id="event-organizer"
              label={tr("Организатор встречи")}
              error={errors.organizerChoice?.message}
            >
              <Select
                id="event-organizer"
                {...form.register("organizerChoice")}
                disabled={mutation.isPending}
                aria-invalid={Boolean(errors.organizerChoice)}
              >
                <option value="__personal__">
                  {tr("Лично: ")}
                  {session.user.displayName}
                </option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {tr("Организация: ")}
                    {organization.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <p>
              {tr(
                "После публикации встречу увидят другие пользователи. Организации публикуют встречи после допуска, без повторного согласования.",
              )}
            </p>
            {mutation.isError && (
              <p className="field-error" role="alert">
                {tr(errorMessage(mutation.error))}
                {tr(" Данные формы сохранены, можно повторить отправку.")}
              </p>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? tr("Публикуем…")
                : tr("Опубликовать встречу")}
              <ArrowUpRight size={18} />
            </button>
          </div>
        </form>
        <aside className="create-aside">
          <div className="notice">
            <Lightbulb size={24} />
            <h2>{tr("Хорошая встреча начинается с ясности")}</h2>
            <p>
              {tr(
                "Назови точку сбора, удобный темп и всё, что нужно взять. Так проще решиться прийти впервые.",
              )}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
