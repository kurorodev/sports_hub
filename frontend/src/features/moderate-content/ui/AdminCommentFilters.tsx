import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock3, ListFilter, SlidersHorizontal } from "lucide-react";
import {
  moderationEventsQuery,
  useModerationRepository,
} from "../../../entities/moderation";
import { request } from "../../../shared/api/client";
import type { EventPreview, UserProfileDto } from "../../../shared/api/types";
import { searchUsers } from "../../../shared/api/user-search";
import { isUuid } from "../../../shared/lib/identifiers";
import { CommentFilterSearch } from "./CommentFilterSearch";

export function AdminCommentFilters({
  viewerId,
  eventId: appliedEventId,
  authorId: appliedAuthorId,
  latest: appliedLatest,
  last24Hours: appliedLast24Hours,
  onChange,
  onRefresh,
  refreshing,
}: {
  viewerId: string;
  eventId: string;
  authorId: string;
  latest: boolean;
  last24Hours: boolean;
  onChange: (changes: Record<string, string>) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const repo = useModerationRepository();
  const [draft, setDraft] = useState({
    eventId: appliedEventId,
    authorId: appliedAuthorId,
    latest: appliedLatest ? "true" : "",
    last24Hours: appliedLast24Hours ? "true" : "",
  });
  const { eventId, authorId } = draft;
  const latest = draft.latest === "true";
  const last24Hours = draft.last24Hours === "true";
  const dirty =
    eventId !== appliedEventId ||
    authorId !== appliedAuthorId ||
    latest !== appliedLatest ||
    last24Hours !== appliedLast24Hours;
  const valid =
    (!eventId || isUuid(eventId)) && (!authorId || isUuid(authorId));
  const edit = (changes: Record<string, string>) =>
    setDraft((current) => ({ ...current, ...changes }));
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [eventPage, setEventPage] = useState(0);
  const prefix = userSearch.trim().replace(/^@/, "");
  const validPrefix = /^[A-Za-z0-9_-]{1,40}$/.test(prefix);
  const users = useQuery({
    queryKey: ["moderation", "user-options", viewerId, prefix],
    queryFn: ({ signal }) => searchUsers(prefix, signal),
    enabled: validPrefix,
    staleTime: 30000,
    retry: false,
  });
  const events = useQuery({
    ...moderationEventsQuery(repo, viewerId, {
      q: eventSearch.trim(),
      page: eventPage,
    }),
    refetchInterval: false,
    staleTime: 30000,
  });
  const selectedUser = useQuery({
    queryKey: ["moderation", "selected-user", viewerId, authorId],
    queryFn: ({ signal }) =>
      request<UserProfileDto>(`/users/${authorId}`, { signal }),
    enabled: isUuid(authorId),
    retry: false,
  });
  const selectedEvent = useQuery({
    queryKey: ["moderation", "selected-event", viewerId, eventId],
    queryFn: ({ signal }) =>
      request<EventPreview>(`/events/${eventId}`, { signal }),
    enabled: isUuid(eventId),
    retry: false,
  });
  const chosenUser =
    selectedUser.data ?? users.data?.find((user) => user.id === authorId);
  const chosenEvent =
    selectedEvent.data ??
    events.data?.items.find((event) => event.id === eventId);
  const activeCount = [authorId, eventId, latest, last24Hours].filter(
    Boolean,
  ).length;
  return (
    <div className="comment-filter-panel">
      <div className="comment-filter-heading">
        <SlidersHorizontal size={19} aria-hidden="true" />
        <h3>Фильтры комментариев</h3>
        {activeCount > 0 && (
          <span className="comment-filter-count">Выбрано: {activeCount}</span>
        )}
      </div>
      <div className="comment-filter-grid">
        <CommentFilterSearch
          label="Пользователь"
          hint="Ищите только по никнейму @user. По имени и фамилии поиск не работает."
          placeholder="@user"
          value={userSearch}
          onSearch={setUserSearch}
          choices={
            validPrefix
              ? (users.data ?? []).map((user) => ({
                  id: user.id,
                  label: user.displayName,
                  detail: `@${user.nickname}`,
                }))
              : []
          }
          selectedId={authorId}
          selectedLabel={
            chosenUser
              ? `${chosenUser.displayName} (@${chosenUser.nickname})`
              : undefined
          }
          allLabel="Все пользователи"
          onSelect={(id) => edit({ authorId: id })}
          loading={validPrefix && users.isFetching}
          emptyMessage={
            !prefix
              ? "Введите хотя бы один символ никнейма после @."
              : !validPrefix
                ? "Никнейм вводится латиницей: @user. По имени поиск недоступен."
                : "Пользователи не найдены. Проверьте никнейм."
          }
          error={validPrefix && users.isError}
          onRetry={() => void users.refetch()}
        />
        <CommentFilterSearch
          label="Мероприятие"
          hint="Начните вводить название — варианты появятся уже с первой буквы."
          placeholder="Название мероприятия"
          value={eventSearch}
          onSearch={(value) => {
            setEventSearch(value);
            setEventPage(0);
          }}
          choices={(events.data?.items ?? []).map((event) => ({
            id: event.id,
            label: event.title,
            detail: `${event.city} · ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(event.startsAt))}`,
          }))}
          selectedId={eventId}
          selectedLabel={chosenEvent?.title}
          allLabel="Все мероприятия"
          onSelect={(id) => edit({ eventId: id })}
          loading={events.isFetching}
          emptyMessage="Мероприятия не найдены. Попробуйте другую часть названия."
          error={events.isError}
          onRetry={() => void events.refetch()}
          footer={
            events.data &&
            (events.data.totalCount > events.data.pageSize || eventPage > 0) ? (
              <div
                className="comment-search-pages"
                aria-label="Выбор мероприятий"
              >
                <button
                  type="button"
                  disabled={eventPage === 0}
                  onClick={() => setEventPage((page) => page - 1)}
                >
                  Назад
                </button>
                <span>Страница {eventPage + 1}</span>
                <button
                  type="button"
                  disabled={
                    (eventPage + 1) * events.data.pageSize >=
                    events.data.totalCount
                  }
                  onClick={() => setEventPage((page) => page + 1)}
                >
                  Далее
                </button>
              </div>
            ) : undefined
          }
        />
      </div>
      <div className="comment-filter-options">
        <label
          className={`comment-filter-toggle ${latest ? "is-checked" : ""}`}
        >
          <input
            type="checkbox"
            checked={latest}
            onChange={(event) =>
              edit({ latest: event.target.checked ? "true" : "" })
            }
          />
          <ListFilter size={18} aria-hidden="true" />
          <span>Последние 10 комментариев</span>
        </label>
        <label
          className={`comment-filter-toggle ${last24Hours ? "is-checked" : ""}`}
        >
          <input
            type="checkbox"
            checked={last24Hours}
            onChange={(event) =>
              edit({ last24Hours: event.target.checked ? "true" : "" })
            }
          />
          <Clock3 size={18} aria-hidden="true" />
          <span>За последние 24 часа</span>
        </label>
      </div>
      <div className="comment-filter-footer">
        <p
          className={dirty ? "comment-filter-pending" : undefined}
          aria-live="polite"
        >
          {dirty
            ? "Есть изменения. Нажмите «Применить фильтры»."
            : "Выберите условия и нажмите «Применить фильтры»."}
        </p>
        <div className="comment-filter-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setUserSearch("");
              setEventSearch("");
              setEventPage(0);
              setDraft({
                eventId: "",
                authorId: "",
                latest: "",
                last24Hours: "",
              });
              onChange({
                eventId: "",
                authorId: "",
                latest: "",
                last24Hours: "",
              });
            }}
          >
            Сбросить фильтры
          </button>
          <button
            type="button"
            className="button primary"
            disabled={refreshing || !valid}
            onClick={() => {
              if (dirty) onChange(draft);
              else onRefresh();
            }}
          >
            <Check size={17} aria-hidden="true" />
            Применить фильтры
          </button>
        </div>
      </div>
    </div>
  );
}
