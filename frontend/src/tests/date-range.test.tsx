import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { calendarDate } from "../shared/lib/calendar-date";
import { DateRangeFields } from "../shared/ui/DateRangeFields";

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-19T22:30:00Z"));
});
afterEach(() => vi.restoreAllMocks());

function mount() {
  const changed = vi.fn();
  function Harness() {
    const [dates, setDates] = useState({ from: "", to: "" });
    return (
      <DateRangeFields
        {...dates}
        onChange={(key, value) => {
          changed(key, value);
          setDates((current) => ({ ...current, [key]: value }));
        }}
      />
    );
  }
  render(<Harness />);
  return changed;
}

it("uses the selected offset across UTC, month and year boundaries", () => {
  expect(calendarDate()).toBe("2026-10-19");
  expect(calendarDate("+03:00")).toBe("2026-10-20");
  expect(calendarDate("+02:00", Date.parse("2026-12-31T23:30:00Z"))).toBe(
    "2027-01-01",
  );
  expect(calendarDate("-05:00", Date.parse("2026-03-01T02:30:00Z"))).toBe(
    "2026-02-28",
  );
});

it("blocks past manual input without changing the active filter", () => {
  const changed = mount();
  for (const label of ["Дата от (UTC)", "Дата до (UTC)"]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("min", "2026-10-19");
    fireEvent.change(input, { target: { value: "2026-10-18" } });
    expect(input).toHaveValue("");
  }
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getAllByRole("alert")).toHaveLength(2);
});

it("accepts today and equal boundaries, rejects reversed ranges, and allows clearing", () => {
  const changed = mount();
  const from = screen.getByLabelText("Дата от (UTC)");
  const to = screen.getByLabelText("Дата до (UTC)");
  fireEvent.change(from, { target: { value: "2026-10-20" } });
  expect(to).toHaveAttribute("min", "2026-10-20");
  fireEvent.change(to, { target: { value: "2026-10-19" } });
  expect(changed).toHaveBeenCalledTimes(1);
  fireEvent.change(to, { target: { value: "2026-10-20" } });
  expect(from).toHaveAttribute("max", "2026-10-20");
  fireEvent.change(from, { target: { value: "2026-10-21" } });
  expect(from).toHaveValue("2026-10-20");
  expect(changed).toHaveBeenCalledTimes(2);
  fireEvent.change(from, { target: { value: "" } });
  expect(to).toHaveAttribute("min", "2026-10-19");
  fireEvent.change(to, { target: { value: "2026-10-19" } });
  expect(to).toHaveValue("2026-10-19");
  fireEvent.change(to, { target: { value: "" } });
  expect(from).not.toHaveAttribute("max");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("updates limits after midnight when returning to the tab", () => {
  const changed = mount();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-20T00:00:01Z"));
  const from = screen.getByLabelText("Дата от (UTC)");
  fireEvent.change(from, { target: { value: "2026-10-19" } });
  expect(changed).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("focus")));
  expect(from).toHaveAttribute("min", "2026-10-20");
});
