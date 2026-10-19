import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSupportRepository } from "../../../entities/support";
import type {
  SupportTicket,
  SupportVenueCreate,
} from "../../../entities/support/model";
import { sportsQuery } from "../../../entities/event";
import { sessionQuery } from "../../../entities/session";
import type { Location } from "../../../shared/api/types";
import { hasPoint } from "../../../shared/lib/map";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { LocationPicker } from "../../../shared/ui/LocationPicker";

export function ApproveVenueForm({
  ticket,
  viewerId,
  onPublished,
}: {
  ticket: SupportTicket;
  viewerId: string;
  onPublished: () => Promise<void>;
}) {
  const repo = useSupportRepository();
  const client = useQueryClient();
  const sports = useQuery(sportsQuery);
  const [name, setName] = useState(ticket.title.slice(0, 120));
  const [sportId, setSportId] = useState("");
  const [location, setLocation] = useState<Location>({
    city: ticket.venueCity ?? "",
    address: ticket.venueAddress ?? "",
    latitude: ticket.venueLatitude,
    longitude: ticket.venueLongitude,
  });
  const mutation = useMutation({
    mutationFn: (input: SupportVenueCreate) =>
      repo.publishVenue(ticket.id, input),
    onSuccess: async (result) => {
      if (client.getQueryData(sessionQuery.queryKey)?.user.id !== viewerId)
        return;
      client.setQueryData(["support", viewerId, "ticket", ticket.id], result);
      await client.invalidateQueries({ queryKey: ["map", "venues"] });
      await onPublished();
    },
  });
  return (
    <form
      className="support-venue-approval"
      onSubmit={(e) => {
        e.preventDefault();
        if (mutation.isPending || !hasPoint(location)) return;
        mutation.mutate({
          name: name.trim(),
          ...(sportId ? { sportId } : {}),
          location: {
            ...location,
            city: location.city.trim(),
            address: location.address.trim(),
          },
        });
      }}
    >
      <h3>Добавить предложенную площадку</h3>
      <p>
        Проверьте название, адрес и точку. После добавления площадка появится на
        общей карте, а обращение получит статус «Решено».
      </p>
      <fieldset className="support-location" disabled={mutation.isPending}>
        <legend className="sr-only">Публикация площадки</legend>
        <label className="form-field">
          Название для карты
          <input
            required
            minLength={3}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="form-field">
          Вид спорта площадки
          <select value={sportId} onChange={(e) => setSportId(e.target.value)}>
            <option value="">Без привязки к виду спорта</option>
            {sports.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <LocationPicker
          value={location}
          onChange={(value) => {
            if (!mutation.isPending) setLocation(value);
          }}
          idPrefix="approve-venue"
          cityLabel="Город площадки для карты"
          addressLabel="Адрес площадки для карты"
          preserveAddressOnPoint
          unmappedHint="Для добавления площадки выберите точку на карте."
        />
      </fieldset>
      {!hasPoint(location) && (
        <p className="field-hint">
          В предложении нет координат. Нажмите «Указать на карте» и выберите
          место.
        </p>
      )}
      {mutation.isError && (
        <p className="notice error" role="alert">
          {mutation.error instanceof ApiError
            ? mutation.error.message
            : errorMessage(mutation.error)}
        </p>
      )}
      <button
        className="button primary"
        type="submit"
        disabled={mutation.isPending || !hasPoint(location)}
      >
        {mutation.isPending
          ? "Добавляем площадку…"
          : "Добавить площадку и решить обращение"}
      </button>
    </form>
  );
}
