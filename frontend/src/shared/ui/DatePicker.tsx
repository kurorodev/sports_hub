import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarDate } from "../lib/calendar-date";

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const daySteps: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};
const monthLabel = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});
const dayLabel = new Intl.DateTimeFormat("ru-RU", { dateStyle: "full" });

function dateParts(value: string) {
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : calendarDate();
  const [year, month, day] = safeValue.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  ref,
  min,
  max,
  today = calendarDate(),
  disabled = false,
  required = false,
  ...accessibility
}: Pick<
  ComponentPropsWithRef<"button">,
  "ref" | "aria-invalid" | "aria-describedby" | "aria-label"
> & {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min: string;
  max?: string;
  today?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const initial = value || today;
  const bounded = initial < min ? min : max && initial > max ? max : initial;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(dateParts(bounded)));
  const [active, setActive] = useState(bounded);
  const [left, setLeft] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => trigger.current!, []);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!root.current || !panel.current) return;
      const anchor = root.current.getBoundingClientRect();
      const width = panel.current.getBoundingClientRect().width;
      setLeft(
        Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16)) -
          anchor.left,
      );
    }
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open]);

  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${active}"]`)
        ?.focus();
  }, [open, active]);

  function allowed(day: string) {
    return day >= min && (!max || day <= max);
  }
  function choose(day: string) {
    if (disabled || (day && !allowed(day))) return;
    onChange(day);
    setOpen(false);
    trigger.current?.focus();
  }
  function moveMonth(direction: number) {
    const next = new Date(
      month.getFullYear(),
      month.getMonth() + direction,
      1,
      12,
    );
    const first = dateValue(next);
    setMonth(next);
    setActive(first < min ? min : max && first > max ? max : first);
  }
  const previousEnd = dateValue(
    new Date(month.getFullYear(), month.getMonth(), 0, 12),
  );
  const nextStart = dateValue(
    new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
  );
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, value: dateValue(date) };
  });

  return (
    <div
      ref={root}
      className={`sport-select date-picker ${open ? "is-open" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          onBlur?.();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        {...accessibility}
        id={id}
        ref={trigger}
        type="button"
        className="sport-select-trigger date-picker-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-calendar` : undefined}
        aria-required={required}
        onClick={() => {
          if (!open) {
            setMonth(monthStart(dateParts(bounded)));
            setActive(bounded);
          }
          setOpen(!open);
        }}
      >
        <span>
          {value ? value.split("-").reverse().join(".") : "дд.мм.гггг"}
        </span>
        <CalendarDays size={17} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={panel}
          id={`${id}-calendar`}
          role="dialog"
          aria-label="Выбор даты"
          className="sport-select-menu date-picker-panel"
          style={{ left }}
        >
          <div className="date-picker-heading">
            <span aria-live="polite">{monthLabel.format(month)}</span>
            <div>
              <button
                type="button"
                aria-label="Предыдущий месяц"
                disabled={previousEnd < min}
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Следующий месяц"
                disabled={Boolean(max && nextStart > max)}
                onClick={() => moveMonth(1)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="date-picker-weekdays" aria-hidden="true">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            className="date-picker-days"
            role="group"
            aria-label="Дни месяца"
          >
            {days.map((day) => (
              <button
                key={day.value}
                type="button"
                data-date={day.value}
                className={`date-picker-day ${day.date.getMonth() !== month.getMonth() ? "is-outside" : ""} ${day.date.getDay() === 0 || day.date.getDay() === 6 ? "is-weekend" : ""}`}
                aria-label={dayLabel.format(day.date)}
                aria-pressed={day.value === value}
                aria-current={day.value === today ? "date" : undefined}
                disabled={!allowed(day.value)}
                tabIndex={day.value === active ? 0 : -1}
                onClick={() => choose(day.value)}
                onKeyDown={(event) => {
                  const step = daySteps[event.key];
                  if (step === undefined) return;
                  event.preventDefault();
                  const next = new Date(day.date);
                  next.setDate(next.getDate() + step);
                  const nextValue = dateValue(next);
                  if (!allowed(nextValue)) return;
                  setMonth(monthStart(next));
                  setActive(nextValue);
                }}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>
          <div className="date-picker-footer">
            <button type="button" disabled={!value} onClick={() => choose("")}>
              Очистить
            </button>
            <button
              type="button"
              disabled={!allowed(today)}
              onClick={() => choose(today)}
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
