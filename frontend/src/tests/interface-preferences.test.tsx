import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterfacePreferences } from "../features/interface-preferences/ui/InterfacePreferences";
import {
  getPreferences,
  initializePreferences,
  preferencesKey,
  setPreferences,
} from "../shared/i18n/preferences";
import { tr } from "../shared/i18n/translate";
import {
  eventDate,
  participantCount,
} from "../entities/event/lib/presentation";
import { relativeTime } from "../shared/lib/relative-time";
import { formatDistance } from "../shared/lib/distance";

afterEach(() => {
  act(() => setPreferences({ locale: "ru", theme: "light" }));
  vi.restoreAllMocks();
});
describe("interface preferences", () => {
  it("switches both controls immediately and persists their independent choices", async () => {
    render(<InterfacePreferences />);
    await userEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(
      screen.getByRole("heading", { name: "Interface settings" }),
    ).toBeVisible();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    await userEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(JSON.parse(localStorage.getItem(preferencesKey)!)).toEqual({
      locale: "en",
      theme: "dark",
    });
    await userEvent.click(screen.getByRole("button", { name: "RU" }));
    expect(
      screen.getByRole("heading", { name: "Настройки интерфейса" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Тёмная" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("localizes formatters while keeping interpolated user text unchanged", () => {
    act(() => setPreferences({ locale: "en" }));
    expect(formatDistance(1500)).toBe("1.5 km");
    expect(participantCount(2, 8)).toBe("2 of 8 participants");
    expect(eventDate("2026-11-03T17:30:00+04:00")).toBe("3 November · 17:30");
    expect(
      relativeTime("2026-11-03T17:00:00Z", Date.parse("2026-11-03T17:05:00Z")),
    ).toMatch(/5 minutes ago/);
    expect(tr("Организатор: {0}", ["Создать"])).toBe("Organizer: Создать");
    expect(tr("Мой профиль пользователя")).toBe("Мой профиль пользователя");
    expect(tr("constructor")).toBe("constructor");
  });
  it("works when storage is blocked and responds to another tab", async () => {
    const stop = initializePreferences();
    try {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      render(<InterfacePreferences />);
      await userEvent.click(screen.getByRole("button", { name: "EN" }));
      expect(getPreferences().locale).toBe("en");
      act(() =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: preferencesKey,
            newValue: JSON.stringify({ locale: "ru", theme: "dark" }),
          }),
        ),
      );
      expect(
        screen.getByRole("heading", { name: "Настройки интерфейса" }),
      ).toBeVisible();
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
      act(() =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: preferencesKey,
            newValue: "invalid",
          }),
        ),
      );
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
    } finally {
      stop();
    }
  });
});
