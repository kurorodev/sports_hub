import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  reportOccupancy,
  occupancyPresentation,
} from "../../../entities/venue";
import { sessionQuery } from "../../../entities/session";
import type { OccupancyReportCreate, Session } from "../../../shared/api/types";
import { ApiError, errorMessage } from "../../../shared/api/client";

export function ReportOccupancyForm({
  venueId,
  session,
  onSuccess,
}: {
  venueId: string;
  session: Session;
  onSuccess: () => void;
}) {
  const client = useQueryClient();
  const [level, setLevel] = useState<OccupancyReportCreate["level"] | null>(
    null,
  );
  const [people, setPeople] = useState("");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: (input: OccupancyReportCreate) =>
      reportOccupancy(venueId, input),
    onSuccess: async () => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== session.user.id
      )
        return;
      await client.invalidateQueries({ queryKey: ["map", "venues"] });
      onSuccess();
    },
  });
  return (
    <form
      className="occupancy-form"
      aria-label="Оценка загруженности площадки"
      onSubmit={(event) => {
        event.preventDefault();
        setValidation("");
        if (!level) {
          setValidation("Выберите загруженность");
          return;
        }
        const count = people.trim() ? Number(people) : null;
        if (
          count !== null &&
          (!Number.isInteger(count) || count < 0 || count > 1000)
        ) {
          setValidation("Количество людей: целое число от 0 до 1000");
          return;
        }
        mutation.mutate({ level, peopleCount: count });
      }}
    >
      <fieldset disabled={mutation.isPending}>
        <legend>Как сейчас на площадке?</legend>
        <div className="occupancy-options">
          {(["LOW", "MEDIUM", "HIGH"] as const).map((value) => (
            <label
              className={`occupancy-option occupancy-${occupancyPresentation[value].tone}`}
              key={value}
            >
              <input
                type="radio"
                name={`occupancy-${venueId}`}
                checked={level === value}
                onChange={() => setLevel(value)}
              />
              {occupancyPresentation[value].label}
            </label>
          ))}
        </div>
        <label className="form-field">
          Сколько людей вы видите (необязательно)
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={people}
            onChange={(event) => setPeople(event.target.value)}
          />
        </label>
        <p className="field-hint">
          Это ваша субъективная оценка. Число людей не определяет цвет. Оценка
          действует 90 минут.
        </p>
        {validation && (
          <p className="field-error" role="alert">
            {validation}
          </p>
        )}
        {mutation.isError && (
          <p className="field-error" role="alert">
            {mutation.error instanceof ApiError && mutation.error.status === 429
              ? "Повторную оценку можно оставить через 10 минут. Ваш выбор сохранён."
              : errorMessage(mutation.error)}
          </p>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Отправляем…" : "Отправить оценку"}
        </button>
      </fieldset>
    </form>
  );
}
