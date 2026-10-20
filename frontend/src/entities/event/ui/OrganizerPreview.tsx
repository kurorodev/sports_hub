import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Copy, MapPin } from "lucide-react";
import { HoverCard } from "../../../shared/ui/HoverCard";
import { Avatar } from "../../../shared/ui/Avatar";
import { copyText } from "../../../shared/lib/clipboard";
import {
  organizerPreviewQuery,
  type Organizer,
} from "../api/organizer-preview";

export function OrganizerPreview({ organizer }: { organizer: Organizer }) {
  const href =
    organizer.type === "USER"
      ? `/users/${organizer.id}`
      : `/organizations/${organizer.id}`;
  return (
    <HoverCard
      label={`Организатор: ${organizer.name}`}
      triggerLabel={`Краткая информация: ${organizer.name}`}
      trigger={
        <Link className="person-link" to={href}>
          <Avatar
            id={organizer.id}
            name={organizer.name}
            url={organizer.avatarUrl}
            tone="organizer"
            size={28}
          />
          {organizer.name}
        </Link>
      }
    >
      <OrganizerDetails
        key={`${organizer.type}:${organizer.id}`}
        organizer={organizer}
        href={href}
      />
    </HoverCard>
  );
}

function OrganizerDetails({
  organizer,
  href,
}: {
  organizer: Organizer;
  href: string;
}) {
  const query = useQuery(organizerPreviewQuery(organizer));
  const [copyState, setCopyState] = useState<
    "idle" | "pending" | "copied" | "error"
  >("idle");
  if (query.isPending || query.isFetching)
    return (
      <p className="organizer-preview-loading" role="status">
        Загружаем организатора…
      </p>
    );
  if (query.isError)
    return (
      <div className="organizer-preview-error">
        <p role="alert">Не удалось загрузить информацию об организаторе.</p>
        <button
          className="button secondary"
          type="button"
          onClick={() => void query.refetch()}
        >
          Повторить
        </button>
        <Link to={href}>Открыть страницу организатора</Link>
      </div>
    );
  const { name, about, city, contact } = query.data;
  const handle = `@${contact.nickname.replace(/^@+/, "")}`;
  return (
    <>
      <span className="eyebrow muted">
        {organizer.type === "USER" ? "Организатор встречи" : "Организация"}
      </span>
      <h3 className="organizer-preview-name">{name}</h3>
      <Avatar
        id={organizer.id}
        name={name}
        url={organizer.avatarUrl}
        tone="organizer"
        size={72}
      />
      {city && (
        <p className="organizer-preview-city">
          <MapPin size={15} aria-hidden="true" />
          {city}
        </p>
      )}
      <p className="organizer-preview-about">
        {about?.trim() || "Организатор пока не добавил описание."}
      </p>
      {organizer.type === "ORGANIZATION" && (
        <p className="organizer-preview-contact">
          Представитель:{" "}
          <Link to={`/users/${contact.id}`}>{contact.displayName}</Link>
        </p>
      )}
      <button
        type="button"
        className="organizer-preview-copy"
        aria-label={`Скопировать ${handle}`}
        disabled={copyState === "pending"}
        onClick={async (event) => {
          const container =
            event.currentTarget.closest<HTMLElement>('[role="dialog"]') ??
            document.body;
          setCopyState("pending");
          try {
            await copyText(handle, container);
            setCopyState("copied");
          } catch {
            setCopyState("error");
          }
        }}
      >
        <span>{handle}</span>
        {copyState === "copied" ? (
          <Check size={17} aria-hidden="true" />
        ) : (
          <Copy size={17} aria-hidden="true" />
        )}
      </button>
      <p className="organizer-preview-copy-status" role="status">
        {copyState === "copied"
          ? "Никнейм скопирован"
          : copyState === "pending"
            ? "Копируем…"
            : copyState === "error"
              ? "Не удалось скопировать. Выделите никнейм вручную."
              : "Нажмите на @никнейм, чтобы скопировать для обсуждения."}
      </p>
      {copyState === "error" && (
        <input
          className="organizer-preview-manual-copy"
          aria-label="Никнейм для ручного копирования"
          readOnly
          value={handle}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      <Link className="organizer-preview-profile" to={href}>
        {organizer.type === "USER"
          ? "Открыть профиль"
          : "Открыть страницу организации"}
      </Link>
    </>
  );
}
