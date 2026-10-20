import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { suggestionsQuery } from "../../../shared/api/geo";
import type { Point } from "../../../shared/lib/map";

export function MapSearch({ onSelect }: { onSelect: (point: Point) => void }) {
  useLocale();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 350);
    return () => clearTimeout(timer);
  }, [text]);
  const result = useQuery({
    ...suggestionsQuery(query, ""),
    enabled: open && query.length >= 3 && query === text.trim(),
  });
  return (
    <div className="map-search">
      <label className="form-field">
        {tr("Найти город или адрес")}
        <input
          type="search"
          placeholder={tr("Например, Самара или улица, дом")}
          maxLength={160}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {open && query === text.trim() && query.length >= 3 && (
        <div className="map-search-results">
          {result.isFetching && <p role="status">{tr("Ищем адрес…")}</p>}
          {result.isError && (
            <p role="status">
              {tr(
                "Поиск адресов недоступен. Переместите карту или используйте «Моё местоположение».",
              )}
            </p>
          )}
          {result.data?.items.length === 0 && (
            <p role="status">{tr("Ничего не найдено")}</p>
          )}
          {result.data?.items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                onSelect(item);
                setText(item.label);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
