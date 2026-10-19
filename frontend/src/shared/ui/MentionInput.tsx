import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../api/user-search";

type Props = Omit<ComponentProps<"textarea">, "value" | "onChange" | "ref"> & {
  value: string;
  onChange: (value: string) => void;
};
export function MentionInput({ value, onChange, onKeyDown, ...props }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      input.current?.focus();
      input.current?.setSelectionRange(
        pendingCaret.current,
        pendingCaret.current,
      );
      pendingCaret.current = null;
    }
  }, [value]);
  const listId = useId();
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const match = /(?:^|[^\p{L}\p{N}_@.-])@([A-Za-z0-9_-]{1,40})$/u.exec(
    value.slice(0, cursor),
  );
  const prefix = match?.[1] ?? "";
  const users = useQuery({
    queryKey: ["mention-users", prefix.toLowerCase()],
    queryFn: ({ signal }) => searchUsers(prefix, signal),
    enabled: Boolean(prefix) && !dismissed,
    staleTime: 30_000,
    retry: false,
  });
  const choices = !dismissed && prefix ? (users.data ?? []) : [];
  function choose(user: { nickname: string }) {
    const start = cursor - prefix.length - 1;
    const insertion = `@${user.nickname} `;
    const next = start + insertion.length;
    pendingCaret.current = next;
    onChange(value.slice(0, start) + insertion + value.slice(cursor));
    setCursor(next);
    setDismissed(true);
  }
  return (
    <div className="mention-input">
      <textarea
        {...props}
        ref={input}
        value={value}
        aria-controls={choices.length ? listId : undefined}
        aria-activedescendant={
          choices.length
            ? `${listId}-${Math.min(active, choices.length - 1)}`
            : undefined
        }
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart);
          setDismissed(false);
          setActive(0);
        }}
        onClick={(event) => {
          setCursor(event.currentTarget.selectionStart);
          setDismissed(false);
        }}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            setCursor(event.currentTarget.selectionStart);
            setDismissed(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDismissed(true);
            return;
          }
          if (
            choices.length &&
            ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "Enter")
              choose(choices[Math.min(active, choices.length - 1)]);
            else
              setActive(
                (index) =>
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    choices.length) %
                  choices.length,
              );
          } else onKeyDown?.(event);
        }}
      />
      {choices.length > 0 && (
        <ul
          className="mention-options"
          id={listId}
          role="listbox"
          aria-label="Упомянуть пользователя"
        >
          {choices.map((user, index) => (
            <li
              key={user.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === Math.min(active, choices.length - 1)}
            >
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(user)}
              >
                <strong>@{user.nickname}</strong>
                <span>{user.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {prefix && !dismissed && users.isError && (
        <p className="field-hint" role="status">
          Подсказки недоступны. Можно написать @никнейм вручную.
        </p>
      )}
    </div>
  );
}
