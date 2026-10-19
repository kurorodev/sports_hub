import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  moderationEventsQuery,
  useModerationRepository,
} from "../../../entities/moderation";
import { request } from "../../../shared/api/client";
import type { EventPreview, UserProfileDto } from "../../../shared/api/types";
import { searchUsers } from "../../../shared/api/user-search";
import { isUuid } from "../../../shared/lib/identifiers";
import { ErrorState } from "../../../shared/ui/Feedback";

export function AdminCommentFilters({
  viewerId,
  eventId,
  authorId,
  latest,
  last24Hours,
  onChange,
}: {
  viewerId: string;
  eventId: string;
  authorId: string;
  latest: boolean;
  last24Hours: boolean;
  onChange: (changes: Record<string, string>) => void;
}) {
  const repo = useModerationRepository();
  const [userSearch, setUserSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [eventPage, setEventPage] = useState(0);
  const prefix = userSearch.trim().replace(/^@/, "");
  const users = useQuery({
    queryKey: ["moderation", "user-options", viewerId, prefix],
    queryFn: ({ signal }) => searchUsers(prefix, signal),
    enabled: /^[A-Za-z0-9_-]{1,40}$/.test(prefix),
    retry: false,
  });
  const events = useQuery(
    moderationEventsQuery(repo, viewerId, {
      q: eventSearch.trim(),
      page: eventPage,
    }),
  );
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
  return (
    <div className="comment-filters">
      <div className="form-field">
        <label htmlFor="comment-user-search">
          Поиск пользователя по никнейму
        </label>
        <input
          id="comment-user-search"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Начните вводить @никнейм"
        />
        <label htmlFor="comment-author">Пользователь</label>
        <select
          id="comment-author"
          value={authorId}
          onChange={(e) => onChange({ authorId: e.target.value })}
        >
          <option value="">Все пользователи</option>
          {authorId && !users.data?.some((u) => u.id === authorId) && (
            <option value={authorId}>
              {selectedUser.data
                ? `${selectedUser.data.displayName} (@${selectedUser.data.nickname})`
                : "Выбранный пользователь"}
            </option>
          )}
          {users.data?.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName} (@{user.nickname})
            </option>
          ))}
        </select>
        {users.isFetching && <p role="status">Ищем пользователей…</p>}
        {users.isSuccess && users.data.length === 0 && (
          <p className="field-hint">Пользователи не найдены.</p>
        )}
        {users.isError && (
          <ErrorState error={users.error} retry={() => void users.refetch()} />
        )}
      </div>
      <div className="form-field">
        <label htmlFor="comment-event-search">
          Поиск мероприятия по названию
        </label>
        <input
          id="comment-event-search"
          value={eventSearch}
          onChange={(e) => {
            setEventSearch(e.target.value);
            setEventPage(0);
          }}
          placeholder="Введите название мероприятия"
        />
        <label htmlFor="comment-event">Мероприятие</label>
        <select
          id="comment-event"
          value={eventId}
          onChange={(e) => onChange({ eventId: e.target.value })}
        >
          <option value="">Все мероприятия</option>
          {eventId && !events.data?.items.some((e) => e.id === eventId) && (
            <option value={eventId}>
              {selectedEvent.data?.title ?? "Выбранное мероприятие"}
            </option>
          )}
          {events.data?.items.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
        {events.isFetching && <p role="status">Ищем мероприятия…</p>}
        {events.isSuccess && events.data.items.length === 0 && (
          <p className="field-hint">Мероприятия не найдены.</p>
        )}
        {events.data &&
          (events.data.totalCount > events.data.pageSize || eventPage > 0) && (
            <div className="pagination" aria-label="Выбор мероприятий">
              <button
                type="button"
                className="button secondary"
                disabled={eventPage === 0 || events.isFetching}
                onClick={() => setEventPage((page) => page - 1)}
              >
                Предыдущие мероприятия
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={
                  events.isFetching ||
                  (eventPage + 1) * events.data.pageSize >=
                    events.data.totalCount
                }
                onClick={() => setEventPage((page) => page + 1)}
              >
                Следующие мероприятия
              </button>
            </div>
          )}
        {events.isError && (
          <ErrorState
            error={events.error}
            retry={() => void events.refetch()}
          />
        )}
      </div>
      <label className="comment-filter-toggle">
        <input
          type="checkbox"
          checked={latest}
          onChange={(e) => onChange({ latest: e.target.checked ? "true" : "" })}
        />
        Последние 10 комментариев
      </label>
      <label className="comment-filter-toggle">
        <input
          type="checkbox"
          checked={last24Hours}
          onChange={(e) =>
            onChange({ last24Hours: e.target.checked ? "true" : "" })
          }
        />
        За последние 24 часа
      </label>
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          setUserSearch("");
          setEventSearch("");
          setEventPage(0);
          onChange({ eventId: "", authorId: "", latest: "", last24Hours: "" });
        }}
      >
        Сбросить фильтры
      </button>
    </div>
  );
}
