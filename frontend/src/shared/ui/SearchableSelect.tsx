import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.id === value);
  const filtered = options.filter((option) =>
    option.name
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .includes(search.trim().toLocaleLowerCase("ru").replaceAll("ё", "е")),
  );
  const activeIndex = Math.min(active, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

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
        options.findIndex((option) => option.id === value),
      ),
    );
    setOpen(true);
  }
  function choose(next: string) {
    setOpen(false);
    trigger.current?.focus();
    onChange(next);
  }

  return (
    <div
      className={`sport-select ${open ? "is-open" : ""}`}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
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
          else if (filtered.length)
            setActive(
              (activeIndex +
                (event.key === "ArrowDown" ? 1 : -1) +
                filtered.length) %
                filtered.length,
            );
        } else if (
          event.key === "Enter" &&
          open &&
          event.target === input.current
        ) {
          event.preventDefault();
          if (filtered[activeIndex]) choose(filtered[activeIndex].id);
        }
      }}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        className="sport-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span>{selected?.name ?? "Выберите вид спорта"}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="sport-select-menu">
          <div className="sport-select-search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={input}
              role="combobox"
              aria-label="Поиск вида спорта"
              aria-expanded="true"
              aria-controls={`${id}-options`}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
              }
              placeholder="Найти вид спорта…"
              autoComplete="off"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActive(0);
              }}
            />
          </div>
          <div
            className="sport-select-options"
            id={`${id}-options`}
            role="listbox"
            aria-label="Виды спорта"
          >
            {filtered.map((option, index) => (
              <button
                key={option.id}
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={option.id === value}
                data-active={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.id)}
              >
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
          <div className="sport-select-footer">
            {search
              ? `Найдено: ${filtered.length}`
              : "Выберите спорт или начните вводить название"}
          </div>
        </div>
      )}
    </div>
  );
}
