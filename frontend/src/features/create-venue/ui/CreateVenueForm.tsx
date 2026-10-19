import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createVenue } from "../../../entities/venue";
import { sessionQuery } from "../../../entities/session";
import type {
  Session,
  Sport,
  VenueCreate,
  VenueMapItem,
} from "../../../shared/api/types";
import { eventFieldsSchema } from "../../../shared/api/event-schema";
import { LocationPicker } from "../../../shared/ui/LocationPicker";
import { hasPoint } from "../../../shared/lib/map";
import { ApiError, errorMessage } from "../../../shared/api/client";

const schema = z.object({
  name: z.string().trim().min(3, "Название — от 3 символов").max(120),
  sportId: z.string(),
  location: eventFieldsSchema.shape.location.refine(
    (location): boolean => hasPoint(location),
    "Выберите точку площадки на карте или в подсказках",
  ),
});
type Values = z.infer<typeof schema>;
export function CreateVenueForm({
  session,
  sports,
  onSuccess,
}: {
  session: Session;
  sports: Sport[];
  onSuccess: (venue: VenueMapItem) => void;
}) {
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sportId: "",
      location: { city: "", address: "" },
    },
  });
  const errors = form.formState.errors;
  const mutation = useMutation({
    mutationFn: (input: VenueCreate) => createVenue(input),
    onSuccess: async (venue) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== session.user.id
      )
        return;
      await client.invalidateQueries({ queryKey: ["map", "venues"] });
      onSuccess(venue);
    },
  });
  return (
    <form
      className="venue-form"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (!hasPoint(values.location)) return;
        mutation.mutate({
          name: values.name,
          sportId: values.sportId || null,
          location: {
            ...values.location,
            latitude: values.location.latitude,
            longitude: values.location.longitude,
          },
        });
      })}
    >
      <fieldset disabled={mutation.isPending}>
        <legend>Новая спортивная площадка</legend>
        <label className="form-field">
          Название площадки
          <input
            {...form.register("name")}
            maxLength={120}
            aria-invalid={Boolean(errors.name)}
          />
        </label>
        {errors.name && (
          <p role="alert" className="field-error">
            {errors.name.message}
          </p>
        )}
        <div className="form-field">
          <label htmlFor="venue-sport">Вид спорта площадки</label>
          <select id="venue-sport" {...form.register("sportId")}>
            <option value="">Любой спорт</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </div>
        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <LocationPicker
              idPrefix="venue"
              addressLabel="Адрес площадки"
              unmappedHint="Для площадки выберите точку на карте или в подсказках."
              value={field.value}
              onChange={field.onChange}
              errors={{
                city: errors.location?.city?.message,
                address: errors.location?.address?.message,
              }}
            />
          )}
        />
        {errors.location?.message && (
          <p role="alert" className="field-error">
            {errors.location.message}
          </p>
        )}
        {mutation.isError && (
          <p role="alert" className="field-error">
            {mutation.error instanceof ApiError &&
            [409, 429].includes(mutation.error.status)
              ? (mutation.error.body?.message ?? errorMessage(mutation.error))
              : errorMessage(mutation.error)}
          </p>
        )}
        <button
          type="submit"
          className="button primary"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Сохраняем…" : "Сохранить площадку"}
        </button>
      </fieldset>
    </form>
  );
}
