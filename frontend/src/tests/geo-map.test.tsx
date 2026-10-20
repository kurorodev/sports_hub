import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeoMap } from "../shared/ui/GeoMap";
import { CurrentLocationProvider } from "../app/CurrentLocationProvider";
import { useCurrentLocation } from "../shared/lib/current-location-context";
import { DistanceFilter } from "../shared/ui/DistanceFilter";

function LocatedMap() {
  const location = useCurrentLocation();
  return (
    <>
      <DistanceFilter value="" onChange={() => {}} />
      <GeoMap location={location} />
    </>
  );
}

const sdk = vi.hoisted(() => {
  class Emitter {
    listeners: Record<string, ((event?: unknown) => void)[]> = {};
    on(name: string, listener: (event?: unknown) => void) {
      (this.listeners[name] ??= []).push(listener);
      return this;
    }
    emit(name: string, event?: unknown) {
      this.listeners[name]?.forEach((listener) => listener(event));
    }
  }
  const state = { fail: false };
  class Map extends Emitter {
    static instances: Map[] = [];
    center: [number, number];
    zoom: number;
    container: HTMLElement;
    remove = vi.fn();
    addControl = vi.fn();
    setMaxBounds = vi.fn();
    getStyle = vi.fn(() => undefined);
    setStyle = vi.fn();
    dragRotate = { disable: vi.fn() };
    touchZoomRotate = { disableRotation: vi.fn() };
    scrollZoom = { disable: vi.fn() };
    constructor(options: {
      center: [number, number];
      zoom: number;
      container: HTMLElement;
    }) {
      super();
      if (state.fail) throw new Error("WebGL unavailable");
      this.center = options.center;
      this.zoom = options.zoom;
      this.container = options.container;
      Map.instances.push(this);
    }
    getCenter() {
      return { lng: this.center[0], lat: this.center[1] };
    }
    getZoom() {
      return this.zoom;
    }
    getBounds() {
      return {
        getWest: () => 49,
        getSouth: () => 52,
        getEast: () => 51,
        getNorth: () => 54,
      };
    }
    jumpTo = vi.fn((options: { center: [number, number]; zoom: number }) => {
      this.center = options.center;
      this.zoom = options.zoom;
    });
  }
  class Marker extends Emitter {
    static instances: Marker[] = [];
    coordinates: [number, number] = [0, 0];
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) {
      super();
      this.element = options.element;
      Marker.instances.push(this);
    }
    setLngLat(point: [number, number]) {
      this.coordinates = point;
      return this;
    }
    getLngLat() {
      return { lng: this.coordinates[0], lat: this.coordinates[1] };
    }
    addTo(map: Map) {
      map.container.append(this.element);
      return this;
    }
    remove() {
      this.element.remove();
    }
  }
  return { Map, Marker, state };
});
vi.mock("maplibre-gl", () => ({
  Map: sdk.Map,
  Marker: sdk.Marker,
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
  Popup: class {},
}));
afterEach(() => {
  sdk.state.fail = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MapLibre integration", () => {
  it("shares live GPS with the distance filter, moves one arrow without following the camera, and clears stale positions", () => {
    let success!: PositionCallback, failure!: PositionErrorCallback;
    const watchPosition = vi.fn(
      (ok: PositionCallback, fail: PositionErrorCallback) => {
        success = ok;
        failure = fail;
        return 42;
      },
    );
    const clearWatch = vi.fn(),
      getCurrentPosition = vi.fn();
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      geolocation: { watchPosition, clearWatch, getCurrentPosition },
    });
    render(
      <CurrentLocationProvider>
        <LocatedMap />
      </CurrentLocationProvider>,
    );
    const map = sdk.Map.instances.at(-1)!;
    expect(watchPosition).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("img", { name: "Ваше текущее местоположение" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Моё местоположение" }));
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    act(() =>
      success({
        coords: { latitude: 0, longitude: 0, accuracy: 10 },
      } as GeolocationPosition),
    );
    const arrow = sdk.Marker.instances.at(-1)!;
    const count = sdk.Marker.instances.length;
    expect(arrow.coordinates).toEqual([0, 0]);
    expect(
      screen.getByRole("img", { name: "Ваше текущее местоположение" }),
    ).toHaveClass("map-current-location");
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [0, 0], zoom: 14 });
    map.jumpTo.mockClear();
    act(() =>
      success({
        coords: { latitude: 0.1, longitude: 0.2, accuracy: 10 },
      } as GeolocationPosition),
    );
    expect(arrow.coordinates).toEqual([0.2, 0.1]);
    expect(sdk.Marker.instances).toHaveLength(count);
    expect(map.jumpTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Моё местоположение" }));
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(map.jumpTo).toHaveBeenLastCalledWith({
      center: [0.2, 0.1],
      zoom: 14,
    });
    act(() => failure({ code: 2 } as GeolocationPositionError));
    expect(
      screen.queryByRole("img", { name: "Ваше текущее местоположение" }),
    ).not.toBeInTheDocument();
    act(() =>
      success({
        coords: { latitude: 0.3, longitude: 0.4, accuracy: 10 },
      } as GeolocationPosition),
    );
    expect(
      screen.getByRole("img", { name: "Ваше текущее местоположение" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Сбросить расстояние" }),
    );
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(
      screen.queryByRole("img", { name: "Ваше текущее местоположение" }),
    ).not.toBeInTheDocument();
    act(() =>
      success({
        coords: { latitude: 1, longitude: 1, accuracy: 10 },
      } as GeolocationPosition),
    );
    expect(
      screen.queryByRole("img", { name: "Ваше текущее местоположение" }),
    ).not.toBeInTheDocument();
  });
  it("shows an arrow for a standalone map location fix and removes it on failure", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    render(<GeoMap />);
    fireEvent.click(screen.getByRole("button", { name: "Моё местоположение" }));
    act(() =>
      getCurrentPosition.mock.calls[0][0]({
        coords: { latitude: 54, longitude: 51 },
      }),
    );
    expect(sdk.Marker.instances.at(-1)!.coordinates).toEqual([51, 54]);
    expect(
      screen.getByRole("img", { name: "Ваше текущее местоположение" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Моё местоположение" }));
    act(() => getCurrentPosition.mock.calls[1][1]({ code: 1 }));
    expect(
      screen.queryByRole("img", { name: "Ваше текущее местоположение" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Не удалось определить местоположение/),
    ).toBeVisible();
  });
  it("keeps longitude/latitude in SDK order and translates clicks and marker drags to API order", () => {
    const onPoint = vi.fn();
    render(
      <GeoMap
        center={{ latitude: 53.2, longitude: 50.1 }}
        point={{ latitude: 53.3, longitude: 50.2 }}
        onPoint={onPoint}
      />,
    );
    const map = sdk.Map.instances.at(-1)!;
    const marker = sdk.Marker.instances.at(-1)!;
    expect(map.center).toEqual([50.1, 53.2]);
    expect(marker.coordinates).toEqual([50.2, 53.3]);
    act(() =>
      map.emit("click", {
        lngLat: { lat: 53.4, lng: 50.3 },
        originalEvent: { target: map.container },
      }),
    );
    expect(onPoint).toHaveBeenLastCalledWith({
      latitude: 53.4,
      longitude: 50.3,
    });
    marker.coordinates = [50.4, 53.5];
    act(() => marker.emit("dragend"));
    expect(onPoint).toHaveBeenLastCalledWith({
      latitude: 53.5,
      longitude: 50.4,
    });
    const count = onPoint.mock.calls.length;
    act(() =>
      map.emit("click", {
        lngLat: { lat: 0, lng: 0 },
        originalEvent: { target: screen.getByTitle("Выбранная точка") },
      }),
    );
    expect(onPoint).toHaveBeenCalledTimes(count);
  });
  it("debounces viewport updates with current callbacks, repositions without recreating and cancels on unmount", () => {
    vi.useFakeTimers();
    const oldView = vi.fn(),
      onView = vi.fn(),
      onBounds = vi.fn();
    const initial = sdk.Map.instances.length;
    const view = render(
      <GeoMap
        center={{ latitude: 53.2, longitude: 50.1 }}
        onView={oldView}
        onBounds={onBounds}
      />,
    );
    const map = sdk.Map.instances.at(-1)!;
    expect(onBounds).toHaveBeenCalledWith(
      "49.00000,52.00000,51.00000,54.00000",
    );
    act(() => {
      map.emit("moveend");
      vi.advanceTimersByTime(200);
      map.emit("moveend");
    });
    view.rerender(
      <GeoMap
        center={{ latitude: 54, longitude: 51 }}
        zoom={15}
        onView={onView}
        onBounds={onBounds}
      />,
    );
    expect(sdk.Map.instances).toHaveLength(initial + 1);
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [51, 54], zoom: 15 });
    act(() => vi.advanceTimersByTime(300));
    expect(oldView).not.toHaveBeenCalled();
    expect(onView).toHaveBeenCalledExactlyOnceWith({
      latitude: 54,
      longitude: 51,
      zoom: 15,
    });
    act(() => map.emit("moveend"));
    view.unmount();
    act(() => vi.advanceTimersByTime(300));
    expect(map.remove).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledOnce();
  });
  it("keeps camera interaction available with an empty style when the initial style fails", () => {
    render(<GeoMap />);
    const map = sdk.Map.instances.at(-1)!;
    act(() => map.emit("error"));
    expect(map.setStyle).toHaveBeenCalledExactlyOnceWith({
      version: 8,
      sources: {},
      layers: [],
    });
    act(() => {
      map.emit("load");
      map.emit("error");
    });
    expect(map.setStyle).toHaveBeenCalledOnce();
    expect(screen.getByText(/Подложка карты недоступна/)).toBeVisible();
    expect(
      screen.queryByText(/Проверьте поддержку WebGL/),
    ).not.toBeInTheDocument();
  });
  it("retains a list query area without WebGL and allows retry", () => {
    sdk.state.fail = true;
    const onBounds = vi.fn();
    const view = render(
      <GeoMap
        center={{ latitude: 53.2, longitude: 50.1 }}
        onBounds={onBounds}
      />,
    );
    expect(screen.getByText(/Проверьте поддержку WebGL/)).toBeVisible();
    expect(onBounds).toHaveBeenCalledWith(
      "50.08000,53.19000,50.12000,53.21000",
    );
    sdk.state.fail = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Повторить загрузку карты" }),
    );
    expect(
      screen.queryByText(/Проверьте поддержку WebGL/),
    ).not.toBeInTheDocument();
    const map = sdk.Map.instances.at(-1)!;
    view.unmount();
    expect(map.remove).toHaveBeenCalledOnce();
  });
  it("never requests geolocation until clicked and ignores a late position after unmount", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    const view = render(<GeoMap />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Моё местоположение" }));
    const map = sdk.Map.instances.at(-1)!;
    view.unmount();
    act(() =>
      getCurrentPosition.mock.calls[0][0]({
        coords: { latitude: 54, longitude: 51 },
      }),
    );
    expect(map.jumpTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
