import { useId, useState } from "react";
import { useCurrentDate } from "../hooks/use-current-date";
import { calendarDate } from "../lib/calendar-date";

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [error, setError] = useState("");
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        min={min}
        max={max}
        value={value}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const next = event.currentTarget.value;
          // Check the live date too when a tab has stayed open across midnight.
          if (
            next &&
            (next < calendarDate() || next < min || (max && next > max))
          ) {
            event.currentTarget.value = value;
            setError(
              next < calendarDate()
                ? "Выберите сегодняшнюю или будущую дату"
                : "Дата окончания не может быть раньше даты начала",
            );
            return;
          }
          setError("");
          onChange(next);
        }}
      />
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function DateRangeFields({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (key: "from" | "to", value: string) => void;
}) {
  const today = useCurrentDate();
  return (
    <>
      <DateField
        label="Дата от (UTC)"
        value={from}
        min={today}
        max={to || undefined}
        onChange={(value) => onChange("from", value)}
      />
      <DateField
        label="Дата до (UTC)"
        value={to}
        min={from > today ? from : today}
        onChange={(value) => onChange("to", value)}
      />
    </>
  );
}
