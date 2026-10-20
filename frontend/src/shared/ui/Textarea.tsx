import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";

export function Textarea({
  ref,
  maxLength,
  value,
  defaultValue,
  onChange,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  ...props
}: ComponentPropsWithRef<"textarea">) {
  useLocale();
  const input = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();
  const statusId = useId();
  const [length, setLength] = useState(
    String(value ?? defaultValue ?? "").length,
  );
  const exceeded = maxLength !== undefined && length > maxLength;
  const reached = maxLength !== undefined && length === maxLength;
  const message = exceeded
    ? tr("Превышен лимит: максимум {0} символов", [maxLength ?? 0])
    : reached
      ? tr("Достигнут лимит символов")
      : "";
  useImperativeHandle(ref, () => input.current!, []);

  // Read the actual field after register/reset, including uncontrolled forms.
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const count = element.value.length;
    setLength(count);
    element.setCustomValidity(
      maxLength !== undefined && count > maxLength
        ? tr("Максимум {0} символов", [maxLength])
        : "",
    );
  });

  return (
    <span className={`textarea-control ${exceeded ? "is-over-limit" : ""}`}>
      <textarea
        {...props}
        ref={input}
        value={value}
        defaultValue={defaultValue}
        aria-invalid={exceeded || invalid}
        aria-describedby={
          [
            describedBy,
            maxLength !== undefined ? counterId : "",
            message ? statusId : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(event) => {
          const count = event.currentTarget.value.length;
          setLength(count);
          event.currentTarget.setCustomValidity(
            maxLength !== undefined && count > maxLength
              ? tr("Максимум {0} символов", [maxLength])
              : "",
          );
          onChange?.(event);
        }}
      />
      {maxLength !== undefined && (
        <span className="textarea-meta">
          <span id={statusId} role="status">
            {tr(message)}
          </span>
          <span
            id={counterId}
            className="textarea-counter"
            aria-label={tr("{0} из {1} символов", [length, maxLength])}
          >
            {length} / {maxLength}
          </span>
        </span>
      )}
    </span>
  );
}
