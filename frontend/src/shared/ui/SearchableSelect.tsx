import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  onBlur,
  ref,
  disabled = false,
  searchable = true,
  matchFromStart = false,
  maxOptions,
  placeholder = "Выберите вид спорта",
  searchLabel = "Поиск вида спорта",
  searchPlaceholder = "Найти вид спорта…",
  listLabel = "Виды спорта",
  hint = "Выберите спорт или начните вводить название",
  ...accessibility
}: Pick<
  ComponentPropsWithRef<"button">,
  | "ref"
  | "aria-invalid"
  | "aria-describedby"
  | "aria-required"
  | "aria-label"
  | "aria-labelledby"
> & {
  id: string;
  value: string;
  options: {
    id: string;
    name: string;
    imageUrl?: string;
    disabled?: boolean;
  }[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  searchable?: boolean;
  matchFromStart?: boolean;
  maxOptions?: number;
  placeholder?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  listLabel?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => trigger.current!, []);
  const input = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.id === value);
  const term = search.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  const matching = options.filter((option) => {
    if (matchFromStart && term && !option.id) return false;
    const name = option.name.toLocaleLowerCase("ru").replaceAll("ё", "е");
    return matchFromStart ? name.startsWith(term) : name.includes(term);
  });
  const filtered = matching.slice(0, maxOptions);
  const activeIndex = Math.min(active, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    if (searchable) input.current?.focus();
    else trigger.current?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const list = root.current?.querySelector(".sport-select-options");
    const option = list?.querySelector('[data-active="true"]');
    if (!list || !option) return;
    const bounds = list.getBoundingClientRect();
    const item = option.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom)
      list.scrollTop += item.bottom - bounds.bottom;
  }, [open, activeIndex, search]);

  function show() {
    setSearch("");
    setActive(
      Math.max(
        0,
        options.slice(0, maxOptions).findIndex((option) => option.id === value),
      ),
    );
    setOpen(true);
  }
  function choose(next: string) {
    const option = options.find((item) => item.id === next);
    if (disabled || !option || option.disabled) return;
    setOpen(false);
    trigger.current?.focus();
    onChange(next);
  }

  return (
    <div
      className={`sport-select ${open ? "is-open" : ""}`}
      ref={root}
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
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) show();
          else if (filtered.length) {
            const direction = event.key === "ArrowDown" ? 1 : -1;
            for (let step = 1; step <= filtered.length; step++) {
              const next =
                (activeIndex + direction * step + filtered.length) %
                filtered.length;
              if (!filtered[next].disabled) {
                setActive(next);
                break;
              }
            }
          }
        } else if (
          (event.key === "Enter" || (!searchable && event.key === " ")) &&
          open &&
          (event.target === input.current || event.target === trigger.current)
        ) {
          event.preventDefault();
          if (filtered[activeIndex]) choose(filtered[activeIndex].id);
        }
      }}
    >
      <button
        {...accessibility}
        ref={trigger}
        id={id}
        type="button"
        role={searchable ? undefined : "combobox"}
        className="sport-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={
          !searchable && open && activeIndex >= 0
            ? `${id}-option-${activeIndex}`
            : undefined
        }
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
      >
        {selected?.imageUrl && (
          <img
            className="sport-option-icon"
            src={selected.imageUrl}
            alt=""
            width="28"
            height="28"
          />
        )}
        <span>{selected?.name ?? placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="sport-select-menu">
          {searchable && (
            <div className="sport-select-search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={input}
                role="combobox"
                aria-label={searchLabel}
                aria-expanded="true"
                aria-controls={`${id}-options`}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
                }
                placeholder={searchPlaceholder}
                autoComplete="off"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActive(0);
                }}
              />
            </div>
          )}
          <div
            className="sport-select-options"
            id={`${id}-options`}
            role="listbox"
            aria-label={listLabel}
          >
            {filtered.map((option, index) => (
              <button
                key={option.id}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={option.id === value}
                disabled={option.disabled}
                data-active={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.id)}
              >
                {option.imageUrl && (
                  <img
                    className="sport-option-icon"
                    src={option.imageUrl}
                    alt=""
                    width="28"
                    height="28"
                    loading="lazy"
                  />
                )}
                <span>{option.name}</span>
                {option.id === value && <Check size={17} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="sport-select-empty" role="status">
              Ничего не найдено. Попробуйте другое название.
            </p>
          )}
          {searchable && (
            <div className="sport-select-footer">
              {search && maxOptions === undefined
                ? `Найдено: ${filtered.length}`
                : hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
