import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Mention } from "../api/types";

/** Упоминания размечены сервером; остальной текст выводим без интерпретации HTML. */
export function MentionText({
  text,
  mentions = [],
}: {
  text: string;
  mentions?: Mention[];
}) {
  let cursor = 0;
  const pieces: ReactNode[] = [];
  for (const [index, mention] of mentions.entries()) {
    const { start, end, userId, nickname } = mention;
    if (
      !/^[\da-f-]{36}$/i.test(userId) ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < cursor ||
      end > text.length ||
      end <= start ||
      text.slice(start, end) !== `@${nickname}`
    )
      continue;
    const prefix = text.slice(cursor, start);
    cursor = end;
    pieces.push(
      <Fragment key={index}>
        {prefix}
        <Link className="mention-link" to={`/users/${userId}`}>
          {text.slice(start, end)}
        </Link>
      </Fragment>,
    );
  }
  return (
    <>
      {pieces}
      {text.slice(cursor)}
    </>
  );
}
