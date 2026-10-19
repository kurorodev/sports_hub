import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeoSuggestion, Location } from "../api/types";
import { suggestionsQuery, reverseLocation } from "../api/geo";
import { hasPoint, unpin, type Point } from "../lib/map";
import { FormField } from "./FormField";
const GeoMap = lazy(() =>
  import("./GeoMap").then((module) => ({ default: module.GeoMap })),
);

export function LocationPicker({
  value,
  onChange,
  errors = {},
  idPrefix = "event",
  addressLabel = "Место встречи",
  unmappedHint = "Без точки событие пока не появится на карте.",
}: {
  value: Location;
  onChange: (value: Location) => void;
  errors?: {
    city?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
  };
  idPrefix?: string;
  addressLabel?: string;
  unmappedHint?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [contextCity, setContextCity] = useState(value.city);
  const [search, setSearch] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [mapOpen, setMapOpen] = useState(hasPoint(value));
  const [reverseStatus, setReverseStatus] = useState("");
  const [manualPin, setManualPin] = useState(false);
  const revision = useRef(0);
  const reverseAbort = useRef<AbortController | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(value.address.trim());
      setContextCity(value.city);
    }, 350);
    return () => clearTimeout(timer);
  }, [value.address, value.city]);
  useEffect(() => () => reverseAbort.current?.abort(), []);
  const suggestions = useQuery({
    ...suggestionsQuery(query, contextCity),
    enabled:
      search &&
      query === value.address.trim() &&
      contextCity === value.city &&
      query.length >= 3 &&
      query.length <= 160,
  });
  const items = suggestions.data?.items ?? [];
  function invalidateReverse() {
    revision.current++;
    reverseAbort.current?.abort();
    setReverseStatus("");
  }
  function edit(field: "city" | "address", text: string) {
    invalidateReverse();
    onChange(
      manualPin ? { ...value, [field]: text } : unpin(value, field, text),
    );
    setSearch(!manualPin);
    setOpen(!manualPin);
    setActive(-1);
  }
  function select(item: GeoSuggestion) {
    invalidateReverse();
    setManualPin(false);
    onChange({
      city: item.city,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setSearch(false);
    setOpen(false);
    setMapOpen(true);
    setActive(-1);
    addressRef.current?.focus();
  }
  async function choosePoint(point: Point) {
    invalidateReverse();
    const current = revision.current;
    const controller = new AbortController();
    reverseAbort.current = controller;
    onChange({ city: "", address: "", ...point });
    setManualPin(true);
    setSearch(false);
    setOpen(false);
    setReverseStatus("Определяем адрес точки…");
    try {
      const result = await reverseLocation(
        point.latitude,
        point.longitude,
        controller.signal,
      );
      if (current !== revision.current) return;
      if (result.location) {
        onChange({ ...result.location, ...point });
        setManualPin(false);
        setReverseStatus("Адрес точки найден");
      } else
        setReverseStatus(
          "Адрес не найден. Заполните город и место встречи для выбранной точки.",
        );
    } catch {
      if (current === revision.current && !controller.signal.aborted)
        setReverseStatus(
          "Поиск адресов недоступен. Заполните город и место встречи для выбранной точки.",
        );
    }
  }
  const listVisible =
    open && search && query === value.address.trim() && query.length >= 3;
  return (
    <div className="location-picker">
      <div className="form-two-columns">
        <FormField id={`${idPrefix}-city`} label="Город" error={errors.city}>
          <input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(e) => edit("city", e.target.value)}
            maxLength={120}
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={
              errors.city ? `${idPrefix}-city-error` : undefined
            }
            required
          />
        </FormField>
        <div className="location-autocomplete">
          <FormField
            id={`${idPrefix}-address`}
            label={addressLabel}
            error={errors.address}
          >
            <input
              ref={addressRef}
              id={`${idPrefix}-address`}
              value={value.address}
              onChange={(e) => edit("address", e.target.value)}
              onFocus={() => setOpen(search)}
              onBlur={() => setOpen(false)}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={listVisible}
              aria-activedescendant={
                listVisible && active >= 0 && items[active]
                  ? `${listId}-${active}`
                  : undefined
              }
              aria-invalid={Boolean(errors.address)}
              aria-describedby={
                errors.address ? `${idPrefix}-address-error` : undefined
              }
              maxLength={300}
              autoComplete="off"
              required
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setSearch(false);
                  return;
                }
                if (!listVisible || items.length === 0) return;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive(
                    (index) =>
                      (index +
                        (e.key === "ArrowDown" ? 1 : items.length - 1) +
                        items.length) %
                      items.length,
                  );
                }
                if (e.key === "Enter" && active >= 0) {
                  e.preventDefault();
                  select(items[active]);
                }
              }}
            />
          </FormField>
          {listVisible && (
            <div className="location-suggestions">
              {suggestions.isFetching && <p role="status">Ищем адреса…</p>}
              {suggestions.isError ? (
                <p role="status">
                  Поиск адресов недоступен. Можно ввести адрес вручную.{" "}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void suggestions.refetch()}
                  >
                    Повторить
                  </button>
                </p>
              ) : (
                !suggestions.isFetching &&
                suggestions.data &&
                items.length === 0 && <p role="status">Ничего не найдено</p>
              )}
              <ul id={listId} role="listbox" aria-label="Подсказки адресов">
                {items.map((item, index) => (
                  <li
                    id={`${listId}-${index}`}
                    key={item.id}
                    role="option"
                    aria-selected={active === index}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="location-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => setMapOpen((v) => !v)}
        >
          {mapOpen ? "Скрыть карту" : "Указать на карте"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setSearch(true);
            setOpen(true);
            addressRef.current?.focus();
          }}
          disabled={value.address.trim().length < 3}
        >
          Найти на карте
        </button>
      </div>
      <p className="field-hint" role="status">
        {hasPoint(value)
          ? `Точка: ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
          : `Место не привязано к карте. ${unmappedHint}`}
      </p>
      {(errors.latitude || errors.longitude) && (
        <p role="alert" className="field-error">
          {errors.latitude ?? errors.longitude}
        </p>
      )}
      {reverseStatus && <p role="status">{reverseStatus}</p>}
      {manualPin && (
        <button
          type="button"
          className="button secondary"
          disabled={!value.city.trim() || !value.address.trim()}
          onClick={() => {
            setManualPin(false);
            setReverseStatus("Адрес выбранной точки подтверждён");
          }}
        >
          Подтвердить адрес точки
        </button>
      )}
      {mapOpen && (
        <>
          <p className="field-hint">
            Нажмите на карту или перетащите метку. Начальная область — Самара
            (демо-регион).
          </p>
          <Suspense fallback={<p role="status">Загружаем карту…</p>}>
            <GeoMap
              compact
              center={hasPoint(value) ? value : undefined}
              point={hasPoint(value) ? value : undefined}
              onPoint={(point) => void choosePoint(point)}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
