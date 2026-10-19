import { useLayoutEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { useMapParams } from "../pages/map/ui/use-map-params";

afterEach(() => window.history.replaceState({}, "", "/"));

function setup() {
  let update!: ReturnType<typeof useMapParams>[1];
  function MapHarness() {
    const [, setParams] = useMapParams();
    const location = useLocation();
    useLayoutEffect(() => {
      update = setParams;
    }, [setParams]);
    return (
      <>
        <output>{location.key}</output>
        <Link to="/events/one">Открыть встречу</Link>
      </>
    );
  }
  window.history.replaceState({}, "", "/map?city=Samara");
  render(
    <BrowserRouter>
      <Routes>
        <Route path="/map" element={<MapHarness />} />
        <Route path="/events/one" element={<p>Встреча открыта</p>} />
      </Routes>
    </BrowserRouter>,
  );
  return () => update;
}

it("ignores unchanged view updates and merges independent changes from the same tick", () => {
  const getUpdate = setup();
  const key = screen.getByRole("status").textContent;
  act(() =>
    getUpdate()((current) => new URLSearchParams(current), { replace: true }),
  );
  expect(screen.getByRole("status").textContent).toBe(key);
  const update = getUpdate();
  act(() => {
    update((current) => {
      const next = new URLSearchParams(current);
      next.set("venues", "off");
      return next;
    });
    update(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("lat", "53.2");
        return next;
      },
      { replace: true },
    );
  });
  expect(new URLSearchParams(window.location.search).get("city")).toBe(
    "Samara",
  );
  expect(new URLSearchParams(window.location.search).get("venues")).toBe("off");
  expect(new URLSearchParams(window.location.search).get("lat")).toBe("53.2");
});

it("cannot apply a late viewport update to the event opened from the map", async () => {
  const getUpdate = setup();
  const late = getUpdate();
  await userEvent
    .setup()
    .click(screen.getByRole("link", { name: "Открыть встречу" }));
  await screen.findByText("Встреча открыта");
  act(() =>
    late(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("lat", "53.2");
        return next;
      },
      { replace: true },
    ),
  );
  expect(window.location.pathname).toBe("/events/one");
  expect(window.location.search).toBe("");
});
