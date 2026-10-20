import { localeTag } from "../../../shared/i18n/preferences";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { sessionQuery } from "../../../entities/session";
import { useNotificationRepository } from "../../../entities/notification";
import type { Notification } from "../../../entities/notification/model";
import { Dialog } from "../../../shared/ui/Dialog";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { relativeTime } from "../../../shared/lib/relative-time";

export function NotificationBell({ viewerId }: { viewerId: string }) {
  useLocale();
  const repository = useNotificationRepository();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const opening = useRef(0);
  const close = () => {
    opening.current++;
    setOpen(false);
  };
  useEffect(
    () => () => {
      opening.current++;
    },
    [],
  );
  const [now, setNow] = useState(Date.now);
  const titleId = useId();
  const key = ["notifications", viewerId];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => repository.list(pageParam, signal),
    getNextPageParam: (page) =>
      page.page + 1 < page.totalPages ? page.page + 1 : undefined,
    refetchInterval: 30_000,
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 403].includes(error.status)) &&
      count < 1,
  });
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open]);
  const read = useMutation({
    mutationFn: async ({ item }: { item: Notification; follow: boolean }) => {
      if (!item.readAt) await repository.read(item.id);
    },
    onSuccess: async (_, { item, follow }) => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      if (follow && item.href) {
        close();
        navigate(item.href);
      }
      await client.invalidateQueries({ queryKey: key });
    },
  });
  const readAll = useMutation({
    mutationFn: (through: string) => repository.readAll(through),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const accessLost =
    query.error instanceof ApiError && [401, 403].includes(query.error.status);
  const pages = accessLost ? undefined : query.data?.pages;
  const first = pages?.[0];
  const count = first?.unreadCount ?? 0;
  // Refetching a page while new items arrive can shift pagination; never show duplicate cards.
  const items = [
    ...new Map(
      pages?.flatMap((p) => p.items).map((item) => [item.id, item]),
    ).values(),
  ];
  const pending = read.isPending || readAll.isPending;
  return (
    <>
      <button
        className="notification-bell"
        aria-label={
          query.isError
            ? tr("Уведомления: не удалось обновить")
            : tr("Уведомления{0}", [
                count ? tr(": {0} непрочитанных", [count]) : "",
              ])
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={async () => {
          const currentOpening = ++opening.current;
          setNow(Date.now());
          setOpen(true);
          read.reset();
          readAll.reset();
          // Read only a successful, fresh snapshot, never cached data after a failed load.
          const result = await query.refetch();
          const snapshot = result.data?.pages[0];
          if (
            currentOpening === opening.current &&
            client.getQueryData(sessionQuery.queryKey)?.user.id === viewerId &&
            result.isSuccess &&
            snapshot?.unreadCount
          )
            readAll.mutate(snapshot.asOf);
        }}
      >
        <Bell size={21} aria-hidden="true" />
        {count > 0 && (
          <span className="notification-count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
        {query.isError && (
          <span className="notification-alert" aria-hidden="true">
            !
          </span>
        )}
      </button>
      {open && (
        <Dialog
          labelledBy={titleId}
          onClose={close}
          className="notification-dialog"
        >
          <div className="notification-heading">
            <div>
              <h2 id={titleId}>{tr("Уведомления")}</h2>
              <p>{tr("За последние 30 дней")}</p>
            </div>
            <button
              className="button secondary icon-button"
              aria-label={tr("Закрыть уведомления")}
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
          {first && (
            <div className="notification-toolbar">
              <span>
                {count
                  ? tr("Непрочитанных: {0}", [count])
                  : tr("Всё прочитано")}
              </span>
              <button
                className="button secondary"
                disabled={!count || pending || accessLost}
                onClick={() => readAll.mutate(first.asOf)}
              >
                <CheckCheck size={17} />
                {tr("Прочитать все")}
              </button>
            </div>
          )}
          <div
            className="notification-scroll"
            role="region"
            aria-label={tr("Список уведомлений")}
            tabIndex={0}
          >
            {query.isPending && (
              <p role="status">{tr("Загружаем уведомления…")}</p>
            )}
            {query.isError && (
              <div role="alert" className="notification-error">
                <p>{tr(errorMessage(query.error))}</p>
                <button
                  className="button secondary"
                  onClick={() => void query.refetch()}
                >
                  {tr("Повторить загрузку")}
                </button>
              </div>
            )}
            {(read.isError || readAll.isError) && (
              <p role="alert" className="field-error">
                {tr(errorMessage(read.error ?? readAll.error))}
              </p>
            )}
            {first && !items.length && (
              <div className="notification-empty">
                <Bell size={32} aria-hidden="true" />
                <h3>{tr("Пока тихо")}</h3>
                <p>
                  {tr(
                    "Здесь появятся решения по заявкам, изменения встреч и напоминания.",
                  )}
                </p>
              </div>
            )}
            <ul className="notification-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`notification-item${item.readAt ? "" : " unread"}`}
                >
                  <div className="notification-item-heading">
                    <h3>{item.title}</h3>
                    {!item.readAt && (
                      <span className="notification-unread">{tr("Новое")}</span>
                    )}
                  </div>
                  <p>{item.text}</p>
                  {item.type === "COMMENT_HIDDEN" && item.commentText && (
                    <blockquote
                      className="notification-comment"
                      aria-label={tr("Скрытый комментарий")}
                    >
                      <strong>{tr("Ваш комментарий")}</strong>
                      <p>{item.commentText}</p>
                    </blockquote>
                  )}
                  {item.reason && (
                    <p className="notification-reason">
                      <strong>{tr("Причина: ")}</strong>
                      {item.reason}
                    </p>
                  )}
                  <time
                    dateTime={item.createdAt}
                    title={new Date(item.createdAt).toLocaleString(localeTag())}
                  >
                    {relativeTime(item.createdAt, now)}
                  </time>
                  <div className="notification-actions">
                    {item.href && (
                      <Link
                        to={item.href}
                        aria-disabled={pending}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!pending) read.mutate({ item, follow: true });
                        }}
                      >
                        {tr("Открыть")}
                      </Link>
                    )}
                    {!item.readAt && (
                      <button
                        className="notification-read"
                        disabled={pending}
                        onClick={() => read.mutate({ item, follow: false })}
                      >
                        <Check size={16} />
                        {tr("Прочитано")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {query.hasNextPage && !accessLost && (
              <button
                className="button secondary notification-more"
                disabled={query.isFetching || pending}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage
                  ? tr("Загружаем…")
                  : tr("Показать ещё")}
              </button>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
