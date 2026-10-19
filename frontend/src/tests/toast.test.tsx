import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Toast } from "../shared/ui/Toast";

afterEach(() => vi.useRealTimers());

it("dismisses after four seconds and restarts the timer for the next message", () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  const view = render(
    <Toast key="first" message="Готово" onDismiss={dismiss} />,
  );
  act(() => vi.advanceTimersByTime(3000));
  expect(dismiss).not.toHaveBeenCalled();
  view.rerender(<Toast key="second" message="Готово" onDismiss={dismiss} />);
  act(() => vi.advanceTimersByTime(1000));
  expect(dismiss).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(3000));
  expect(dismiss).toHaveBeenCalledOnce();
});

it("can be closed manually and cancels its timer on unmount", () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  const view = render(<Toast message="Готово" onDismiss={dismiss} />);
  fireEvent.click(screen.getByRole("button", { name: "Закрыть уведомление" }));
  expect(dismiss).toHaveBeenCalledOnce();
  view.unmount();
  act(() => vi.advanceTimersByTime(4000));
  expect(dismiss).toHaveBeenCalledOnce();
});
