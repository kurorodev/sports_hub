import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import { useId, useState } from "react";
import { useCurrentDate } from "../hooks/use-current-date";
import { calendarDate } from "../lib/calendar-date";
import { DatePicker } from "./DatePicker";

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
  useLocale();
  const id = useId();
  const [error, setError] = useState("");
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <DatePicker
        id={id}
        min={min}
        max={max}
        value={value}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(next) => {
          // Вкладка могла остаться открытой после полуночи; проверяем актуальную нижнюю границу даты.
          if (
            next &&
            (next < calendarDate() || next < min || (max && next > max))
          ) {
            setError(
              next < calendarDate()
                ? tr("Выберите сегодняшнюю или будущую дату")
                : tr("Дата окончания не может быть раньше даты начала"),
            );
            return;
          }
          setError("");
          onChange(next);
        }}
      />
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {tr(error)}
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
  useLocale();
  const today = useCurrentDate();
  return (
    <>
      <DateField
        label={tr("Дата от (UTC)")}
        value={from}
        min={today}
        max={to || undefined}
        onChange={(value) => onChange("from", value)}
      />
      <DateField
        label={tr("Дата до (UTC)")}
        value={to}
        min={from > today ? from : today}
        onChange={(value) => onChange("to", value)}
      />
    </>
  );
}
