import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

export async function selectCity(
  user: ReturnType<typeof userEvent.setup>,
  city: string,
) {
  await user.click(screen.getByLabelText("Город", { exact: true }));
  await user.type(
    screen.getByRole("combobox", { name: "Поиск города" }),
    city,
  );
  await user.click(screen.getByRole("option", { name: city }));
}
