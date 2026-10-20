import { useRef, useState, type ComponentPropsWithRef } from "react";
import { canonicalCityName, russianCities } from "../lib/cities";
import { tr } from "../i18n/translate";
import { SearchableSelect } from "./SearchableSelect";

export function CitySelect({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  required = false,
  emptyLabel = "Не указан",
  maxOptions = 10,
  ...accessibility
}: Pick<
  ComponentPropsWithRef<"button">,
  "disabled" | "aria-label" | "aria-invalid" | "aria-describedby"
> & {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  emptyLabel?: string;
  maxOptions?: number;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [invalid, setInvalid] = useState(false);
  const city = canonicalCityName(value) ?? "";
  const cities = city
    ? [city, ...russianCities.filter((name) => name !== city)]
    : russianCities;
  return (
    <div className="native-select city-select">
      <SearchableSelect
        {...accessibility}
        ref={trigger}
        id={id}
        value={city}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-required={required}
        aria-invalid={accessibility["aria-invalid"] || (invalid && !city)}
        options={[
          ...(!required ? [{ id: "", name: tr(emptyLabel) }] : []),
          ...cities.map((name) => ({ id: name, name })),
        ]}
        matchFromStart
        maxOptions={maxOptions}
        searchLabel={tr("Поиск города")}
        searchPlaceholder={tr("Введите город…")}
        listLabel={tr("Города")}
        placeholder={tr("Выберите город")}
        hint={tr("Начните вводить название и выберите город из подсказок")}
      />
      <input
        className="select-native-input"
        aria-hidden="true"
        tabIndex={-1}
        value={city}
        onChange={() => {}}
        disabled={disabled}
        required={required}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
        }}
      />
      {invalid && !city && (
        <p className="field-error" role="alert">
          {tr("Выберите город из подсказок")}
        </p>
      )}
    </div>
  );
}
