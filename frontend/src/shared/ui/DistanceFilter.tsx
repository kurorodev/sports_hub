import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
import { Navigation } from "lucide-react";
import { useCurrentLocation } from "../lib/current-location-context";
import { distanceRadii, formatDistance } from "../lib/distance";
import { Select } from "./Select";

export function DistanceFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  useLocale();
  const location = useCurrentLocation();
  return (
    <fieldset className="distance-filter">
      <legend>
        <Navigation size={16} aria-hidden="true" />
        {tr("Рядом со мной")}
      </legend>
      <button
        type="button"
        className="button secondary"
        disabled={location.status === "locating"}
        onClick={location.request}
      >
        {location.status === "locating"
          ? tr("Определяем геопозицию…")
          : location.position
            ? tr("Обновить геопозицию")
            : tr("Использовать геолокацию")}
      </button>
      <label>
        {tr("Расстояние до мероприятия")}
        <Select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!location.position}
        >
          <option value="">{tr("Любое расстояние")}</option>
          {distanceRadii.map((radius) => (
            <option key={radius} value={radius}>
              {tr("До ")}
              {formatDistance(radius)}
            </option>
          ))}
        </Select>
      </label>
      <p className="field-hint">
        {tr("По прямой до точки встречи. Максимальный радиус — 5 км.")}
        {location.accuracy !== null &&
          tr(" Точность геопозиции: ±{0}.", [
            formatDistance(location.accuracy),
          ])}
      </p>
      {location.error && (
        <p className="field-error" role="alert">
          {tr(location.error)}
        </p>
      )}
      {value && !location.position && (
        <p className="field-hint" role="status">
          {tr("Для выбранного радиуса нужна ваша геопозиция.")}
        </p>
      )}
      {(value ||
        location.position ||
        location.status === "locating" ||
        location.status === "error") && (
        <button
          type="button"
          className="reset-button"
          onClick={() => {
            onChange("");
            location.stop();
          }}
        >
          {location.status === "locating"
            ? tr("Отменить определение")
            : tr("Сбросить расстояние")}
        </button>
      )}
    </fieldset>
  );
}
