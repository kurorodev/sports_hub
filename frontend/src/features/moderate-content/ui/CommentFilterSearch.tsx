import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";

export interface FilterChoice {
  id: string;
  label: string;
  detail?: string;
}

export function CommentFilterSearch({
  label,
  hint,
  placeholder,
  value,
  onSearch,
  choices,
  selectedId,
  selectedLabel,
  allLabel,
  onSelect,
  loading,
  emptyMessage,
  error,
  onRetry,
  footer,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onSearch: (value: string) => void;
  choices: FilterChoice[];
  selectedId: string;
  selectedLabel?: string;
  allLabel: string;
  onSelect: (id: string) => void;
  loading: boolean;
  emptyMessage: string;
  error: boolean;
  onRetry: () => void;
  footer?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  function choose(choiceId: string) {
    onSelect(choiceId);
    onSearch("");
    setOpen(false);
    setActive(-1);
  }
  const activeIndex =
    active >= 0 && choices.length ? Math.min(active, choices.length - 1) : -1;
  return (
    <div
      className="comment-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className="comment-search-label" htmlFor={id}>
        {label}
      </label>
      <p className="comment-search-hint" id={`${id}-hint`}>
        {hint}
      </p>
      <div className={`comment-search-control ${open ? "is-open" : ""}`}>
        <Search size={18} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-options` : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onSearch(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (choices.length)
                setActive(
                  event.key === "ArrowDown"
                    ? (activeIndex + 1) % choices.length
                    : activeIndex < 0
                      ? choices.length - 1
                      : (activeIndex - 1 + choices.length) % choices.length,
                );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (!loading && !error && choices.length)
                choose(choices[Math.max(0, activeIndex)].id);
            }
          }}
        />
        {loading ? (
          <LoaderCircle
            size={17}
            className="comment-search-spinner"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown size={17} aria-hidden="true" />
        )}
        {open && (
          <div className="comment-search-popup">
            <div
              id={`${id}-options`}
              role="listbox"
              aria-label={`${label}: варианты`}
              aria-busy={loading}
            >
              {loading ? (
                <p className="comment-search-message" role="status">
                  Ищем…
                </p>
              ) : error ? (
                <div className="comment-search-message" role="alert">
                  Не удалось загрузить варианты.{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={onRetry}
                  >
                    Повторить поиск
                  </button>
                </div>
              ) : choices.length ? (
                choices.map((choice, index) => (
                  <button
                    key={choice.id}
                    id={`${id}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={selectedId === choice.id}
                    className={`comment-search-option ${index === activeIndex ? "is-active" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(choice.id)}
                  >
                    <span>
                      <strong>{choice.label}</strong>
                      {choice.detail && <small>{choice.detail}</small>}
                    </span>
                    {selectedId === choice.id && (
                      <Check size={17} aria-hidden="true" />
                    )}
                  </button>
                ))
              ) : (
                <p className="comment-search-message" role="status">
                  {emptyMessage}
                </p>
              )}
            </div>
            {!loading && !error && footer}
          </div>
        )}
      </div>
      <div
        className={`comment-search-selection ${selectedId ? "has-selection" : ""}`}
      >
        <span>
          {selectedId
            ? (selectedLabel ?? "Загружаем выбранный фильтр…")
            : allLabel}
        </span>
        {selectedId && (
          <button
            type="button"
            aria-label={`Сбросить: ${label}`}
            onClick={() => choose("")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
