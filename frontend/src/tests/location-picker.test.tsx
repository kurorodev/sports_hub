import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { LocationPicker } from "../shared/ui/LocationPicker";
import type { Location } from "../shared/api/types";
import { demoSuggestion } from "../mocks/maps";
import { server } from "./setup";
import { selectCity } from "./select-city";
import {
  eventFormSchema,
  toEventInput,
} from "../features/create-event/ui/create-event-form";

vi.mock("../shared/ui/GeoMap", () => ({
  GeoMap: ({
    onPoint,
  }: {
    onPoint?: (point: { latitude: number; longitude: number }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onPoint?.({ latitude: 53.195561, longitude: 50.101022 })}
    >
      Выбрать точку тестовой карты
    </button>
  ),
}));
function Harness({
  initial = { city: "", address: "" },
}: {
  initial?: Location;
}) {
  const [location, setLocation] = useState<Location>(initial);
  return (
    <>
      <LocationPicker value={location} onChange={setLocation} />
      <output data-testid="location">{JSON.stringify(location)}</output>
    </>
  );
}
function setup(initial?: Location) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}
describe("location picker", () => {
  it("keeps the entered address and selected point when reverse geocoding is unavailable", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/geo/reverse", () =>
        HttpResponse.json({ code: "SERVICE_UNAVAILABLE" }, { status: 503 }),
      ),
    );
    setup({ city: "Самара", address: "Парк, спортивная площадка" });
    await user.click(screen.getByRole("button", { name: "Указать на карте" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Выбрать точку тестовой карты",
      }),
    );
    await screen.findByText(/Поиск адресов недоступен/);
    expect(screen.getByLabelText("Город")).toHaveTextContent("Самара");
    expect(screen.getByRole("combobox")).toHaveValue(
      "Парк, спортивная площадка",
    );
    await user.click(
      screen.getByRole("button", { name: "Подтвердить адрес точки" }),
    );
    expect(JSON.parse(screen.getByTestId("location").textContent!)).toEqual({
      city: "Самара",
      address: "Парк, спортивная площадка",
      latitude: 53.195561,
      longitude: 50.101022,
    });
  });
  it("fills the address from reverse geocoding while keeping the exact selected coordinates", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/geo/reverse", () =>
        HttpResponse.json({
          location: {
            city: "Самара",
            address: "площадь Куйбышева",
            latitude: 53.19,
            longitude: 50.1,
          },
        }),
      ),
    );
    setup({ city: "Старый город", address: "Старый адрес" });
    await user.click(screen.getByRole("button", { name: "Указать на карте" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Выбрать точку тестовой карты",
      }),
    );
    await screen.findByText("Адрес точки найден");
    expect(JSON.parse(screen.getByTestId("location").textContent!)).toEqual({
      city: "Самара",
      address: "площадь Куйбышева",
      latitude: 53.195561,
      longitude: 50.101022,
    });
  });
  it("debounces suggestions, selects with keyboard, preserves coordinates, clears them after text edits", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get("/api/v1/geo/suggest", () => {
        calls++;
        return HttpResponse.json({ items: [demoSuggestion] });
      }),
    );
    setup();
    await selectCity(user, "Самара");
    await user.type(screen.getByRole("combobox"), "площадь");
    expect(calls).toBe(0);
    await screen.findByRole("option", { name: demoSuggestion.label });
    expect(calls).toBe(1);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"latitude":53.195561',
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"longitude":50.101022',
    );
    await selectCity(user, "Казань");
    expect(screen.getByTestId("location")).toHaveTextContent('"latitude":null');
    expect(screen.getByText(/Место не привязано к карте/)).toBeVisible();
  });
  it("Escape dismisses suggestions; unavailable geocoder leaves manual input available", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/geo/suggest", () =>
        HttpResponse.json({ code: "SERVICE_UNAVAILABLE" }, { status: 503 }),
      ),
    );
    setup();
    await user.type(screen.getByRole("combobox"), "Несуществующий адрес");
    await screen.findByText(/Поиск адресов недоступен/);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("combobox")).toHaveValue("Несуществующий адрес");
  });
  it("reverse failure preserves the selected coordinates and stale reverse cannot overwrite edited text", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/v1/geo/reverse", async () => {
        await delay(150);
        return HttpResponse.json({
          location: {
            city: "Старый город",
            address: "Старый адрес",
            latitude: 53.195561,
            longitude: 50.101022,
          },
        });
      }),
    );
    setup();
    await user.click(screen.getByRole("button", { name: "Указать на карте" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Выбрать точку тестовой карты",
      }),
    );
    fireEvent.click(screen.getByLabelText("Город"));
    fireEvent.click(screen.getByRole("option", { name: "Москва" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Город")).toHaveTextContent("Москва"),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(screen.getByLabelText("Город")).toHaveTextContent("Москва");
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"latitude":53.195561',
    );
    server.use(
      http.get("/api/v1/geo/reverse", () =>
        HttpResponse.json({ location: null }),
      ),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Выбрать точку тестовой карты",
      }),
    );
    await screen.findByText(/Адрес не найден/);
    expect(screen.getByTestId("location")).toHaveTextContent(
      '"longitude":50.101022',
    );
  });
  it("event mapping retains both axes and the supplied timezone offset", () => {
    const values = eventFormSchema.parse({
      title: "На карте",
      description: "Новая спортивная встреча",
      location: demoSuggestion,
      skillLevel: "ANY",
      eventKind: "ACTIVITY",
      joinMode: "OPEN",
      organizerChoice: "__personal__",
      capacity: 10,
      sportChoice: "__custom__",
      customSportName: "Геоспорт",
      date: "2099-01-01",
      time: "18:30",
      timezoneOffset: "+04:00",
    });
    const result = toEventInput(values, "11111111-1111-4111-8111-111111111111");
    expect(result.location.latitude).toBe(53.195561);
    expect(result.location.longitude).toBe(50.101022);
    expect(result.startsAt).toBe("2099-01-01T18:30:00+04:00");
  });
});
