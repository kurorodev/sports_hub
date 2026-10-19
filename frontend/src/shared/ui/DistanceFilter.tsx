import { Navigation } from "lucide-react";
import { useCurrentLocation } from "../lib/current-location-context";
import { distanceRadii, formatDistance } from "../lib/distance";

export function DistanceFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const location = useCurrentLocation();
  return (
    <fieldset className="distance-filter">
      <legend>
        <Navigation size={16} aria-hidden="true" />
        Рядом со мной
      </legend>
      <button
        type="button"
        className="button secondary"
        disabled={location.status === "locating"}
        onClick={location.request}
      >
        {location.status === "locating"
          ? "Определяем геопозицию…"
          : location.position
            ? "Обновить геопозицию"
            : "Использовать геолокацию"}
      </button>
      <label>
        Расстояние до мероприятия
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!location.position}
        >
          <option value="">Любое расстояние</option>
          {distanceRadii.map((radius) => (
            <option key={radius} value={radius}>
              До {formatDistance(radius)}
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        По прямой до точки встречи. Максимальный радиус — 5 км.
        {location.accuracy !== null &&
          ` Точность геопозиции: ±${formatDistance(location.accuracy)}.`}
      </p>
      {location.error && (
        <p className="field-error" role="alert">
          {location.error}
        </p>
      )}
      {value && !location.position && (
        <p className="field-hint" role="status">
          Для выбранного радиуса нужна ваша геопозиция.
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
            ? "Отменить определение"
            : "Сбросить расстояние"}
        </button>
      )}
    </fieldset>
  );
}
