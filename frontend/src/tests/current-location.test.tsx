import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrentLocationProvider } from "../app/CurrentLocationProvider";
import { DistanceFilter } from "../shared/ui/DistanceFilter";
import { EventDistance } from "../shared/ui/EventDistance";

afterEach(() => vi.unstubAllGlobals());
function Harness() {
  const [radius, setRadius] = useState("");
  return (
    <CurrentLocationProvider>
      <DistanceFilter value={radius} onChange={setRadius} />
      <EventDistance
        location={{
          city: "Самара",
          address: "Парк",
          latitude: 0.0009,
          longitude: 0,
        }}
      />
    </CurrentLocationProvider>
  );
}
function gps() {
  let success: PositionCallback;
  let failure: PositionErrorCallback;
  const watchPosition = vi.fn(
    (ok: PositionCallback, error: PositionErrorCallback) => {
      success = ok;
      failure = error;
      return 7;
    },
  );
  const clearWatch = vi.fn();
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition, clearWatch },
  });
  return {
    watchPosition,
    clearWatch,
    update: (latitude: number) =>
      act(() =>
        success({
          coords: { latitude, longitude: 0, accuracy: 10 },
        } as GeolocationPosition),
      ),
    deny: () => act(() => failure({ code: 1 } as GeolocationPositionError)),
    loseSignal: () =>
      act(() => failure({ code: 2 } as GeolocationPositionError)),
  };
}
describe("current geolocation", () => {
  it("resumes after a temporary signal loss without retaining stale coordinates", () => {
    const location = gps();
    const view = render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Использовать геолокацию" }),
    );
    location.update(0);
    location.loseSignal();
    expect(screen.queryByText(/от вас/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(location.clearWatch).not.toHaveBeenCalled();
    location.update(0.0004);
    expect(screen.getByText("≈ 56 м от вас")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    view.unmount();
    expect(location.clearWatch).toHaveBeenCalledWith(7);
  });
  it("starts only on request, updates card distance and cancels tracking on reset", () => {
    const location = gps();
    render(<Harness />);
    expect(location.watchPosition).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Использовать геолокацию" }),
    );
    location.update(0);
    expect(screen.getByText("≈ 100 м от вас")).toBeVisible();
    expect(screen.getByRole("combobox")).toBeEnabled();
    expect(screen.getAllByRole("option")).toHaveLength(8);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "200" },
    });
    location.update(0.0004);
    expect(screen.getByText("≈ 56 м от вас")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Сбросить расстояние" }),
    );
    expect(location.clearWatch).toHaveBeenCalledWith(7);
    location.update(0);
    expect(screen.queryByText(/от вас/)).not.toBeInTheDocument();
  });
  it("handles permission revocation and clears stale position", () => {
    const location = gps();
    const view = render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Использовать геолокацию" }),
    );
    location.update(0);
    location.deny();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Доступ к геолокации запрещён",
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.queryByText(/от вас/)).not.toBeInTheDocument();
    view.unmount();
    expect(location.clearWatch).toHaveBeenCalledWith(7);
  });
  it("explains HTTPS on a LAN HTTP page", () => {
    const location = gps();
    vi.stubGlobal("isSecureContext", false);
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Использовать геолокацию" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("HTTPS");
    expect(location.watchPosition).not.toHaveBeenCalled();
  });
});
