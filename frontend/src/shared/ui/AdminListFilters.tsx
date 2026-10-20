import { useId, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Select } from "./Select";

export function AdminListFilters({
  statusLabel = "Статус",
  title,
  label,
  placeholder,
  query,
  status,
  options,
  refreshing,
  onApply,
  onRefresh,
}: {
  statusLabel?: string;
  title: string;
  label: string;
  placeholder: string;
  query: string;
  status: string;
  options: { value: string; label: string }[];
  refreshing: boolean;
  onApply: (query: string, status: string) => void;
  onRefresh: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(query);
  const [selection, setSelection] = useState(status);
  return (
    <form
      className="comment-filter-panel admin-list-filters"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim() === query && selection === status) onRefresh();
        else onApply(draft.trim(), selection);
      }}
    >
      <div className="comment-filter-heading">
        <SlidersHorizontal size={19} aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <div className="comment-filter-grid">
        <div className="form-field">
          <label htmlFor={`${id}-search`}>{label}</label>
          <input
            id={`${id}-search`}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor={`${id}-status`}>{statusLabel}</label>
          <Select
            id={`${id}-status`}
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            {options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="comment-filter-footer">
        <p>Условия применяются после нажатия кнопки.</p>
        <div className="comment-filter-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setDraft("");
              setSelection("");
              onApply("", "");
            }}
          >
            Сбросить фильтры
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={refreshing}
          >
            Применить фильтры
          </button>
        </div>
      </div>
    </form>
  );
}
