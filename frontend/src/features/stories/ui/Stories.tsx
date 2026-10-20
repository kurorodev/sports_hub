import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { sessionQuery } from "../../../entities/session";
import { storiesQuery } from "../../../entities/story";
import type { Story, StoryFeed } from "../../../shared/api/types";
import { errorMessage } from "../../../shared/api/client";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { StoryEditor } from "./StoryEditor";
import { StoryViewer } from "./StoryViewer";
import { useStoryImages } from "../lib/use-story-images";

const noStories: Story[] = [];

export function Stories({ management = false }: { management?: boolean }) {
  useLocale();
  const session = useQuery(sessionQuery);
  if (!session.data || session.isError) return null;
  return (
    <StoriesFeed
      key={session.data.user.id}
      viewerId={session.data.user.id}
      admin={session.data.systemRoles.includes("ADMIN")}
      management={management}
    />
  );
}

function StoriesFeed({
  viewerId,
  admin,
  management,
}: {
  viewerId: string;
  admin: boolean;
  management: boolean;
}) {
  const query = useQuery(storiesQuery(viewerId));
  const media = useStoryImages(query.data?.items ?? noStories);
  const client = useQueryClient();
  const [editor, setEditor] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  // Use the server clock plus elapsed client time, not the device's calendar clock.
  const serverNow = query.data
    ? Date.parse(query.data.asOf) + Math.max(0, now - query.dataUpdatedAt)
    : now;
  const items = (query.data?.items ?? []).filter(
    (story) => Date.parse(story.expiresAt) > serverNow,
  );
  const index = items.findIndex((story) => story.id === selected);
  const active = items[index];
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["stories", viewerId] });
  };
  const onRemoved = async () => {
    setSelected(null);
    await refresh();
  };
  const onViewed = (story: Story) => {
    const key = storiesQuery(viewerId).queryKey;
    // Updating readAt must not reset the server-clock reference used for expiration.
    const updatedAt = client.getQueryState(key)?.dataUpdatedAt;
    client.setQueryData<StoryFeed>(
      key,
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === story.id ? story : item,
              ),
            }
          : current,
      { updatedAt },
    );
  };
  if (query.isPending && !admin)
    return (
      <div className="stories-loading" role="status">
        {tr("Загружаем сторис…")}
      </div>
    );
  if (!query.isError && !query.isPending && !items.length && !admin)
    return null;
  return (
    <section
      className={`stories-section${management ? " stories-management" : ""}`}
      aria-label={tr("Новости Стечения")}
    >
      <div className="stories-heading">
        {management ? (
          <div>
            <span className="eyebrow muted">{tr("От команды Стечения")}</span>
            <h2>{tr("Сторис")}</h2>
          </div>
        ) : (
          <h2 className="stories-label">
            {tr("Новости ")}
            <strong>{tr("Стечения")}</strong>
          </h2>
        )}
        {management && (
          <p className="field-hint">
            {tr("Все публикации доступны пользователям ровно 24 часа.")}
          </p>
        )}
      </div>
      {query.isPending && (
        <p className="stories-loading" role="status">
          {tr("Загружаем сторис…")}
        </p>
      )}
      {query.isError && (
        <p className="stories-error" role="alert">
          {errorMessage(query.error)}{" "}
          <button
            type="button"
            className="reset-button"
            onClick={() => void query.refetch()}
          >
            {tr("Повторить")}
          </button>
        </p>
      )}
      <div className="stories-strip">
        {admin && (
          <button
            className="story-bubble story-add"
            type="button"
            onClick={() => setEditor(true)}
          >
            <span className="story-bubble-ring">
              <Plus size={28} aria-hidden="true" />
            </span>
            <span>{tr("Добавить")}</span>
          </button>
        )}
        {items.map((story) => (
          <button
            className={`story-bubble${story.readAt ? " is-viewed" : ""}`}
            type="button"
            key={story.id}
            onClick={() => setSelected(story.id)}
            aria-label={`${story.title}. ${story.readAt ? tr("Просмотрено") : tr("Не просмотрено")}`}
          >
            <span className="story-bubble-ring">
              {media.images[story.id] ? (
                <img src={media.images[story.id]} alt="" />
              ) : (
                <img src="/images/brand/stechenie-mark-on-light.png" alt="" />
              )}
            </span>
            <span>{story.title}</span>
          </button>
        ))}
      </div>
      {admin && !items.length && !query.isError && !query.isPending && (
        <p className="field-hint">
          {tr("Пока нет активных сторис. Опубликуйте первую новость для всех.")}
        </p>
      )}
      {editor && (
        <StoryEditor onClose={() => setEditor(false)} onPublished={refresh} />
      )}
      {active && (
        <StoryViewer
          story={active}
          cachedImage={media.images[active.id]}
          loadImage={media.load}
          index={index}
          count={items.length}
          admin={admin}
          onClose={() => setSelected(null)}
          onPrevious={() => setSelected(items[index - 1]?.id ?? null)}
          onNext={() => setSelected(items[index + 1]?.id ?? null)}
          onViewed={onViewed}
          onRemoved={onRemoved}
        />
      )}
    </section>
  );
}
