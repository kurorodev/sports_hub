import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import { MentionInput } from "../shared/ui/MentionInput";
import { MentionText } from "../shared/ui/MentionText";
import { mockId, makeSession } from "../mocks/database";
import { saveComment, getComments } from "../mocks/comments";
import { saveProfile } from "../mocks/profiles";

function Input() {
  const [value, setValue] = useState("");
  return (
    <MentionInput aria-label="Сообщение" value={value} onChange={setValue} />
  );
}
describe("mentions", () => {
  it("supports keyboard selection and cancellation without sending the message", async () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <Input />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const field = screen.getByRole("textbox");
    await user.type(field, "Привет @user-mar");
    await screen.findByRole("option");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(field).toHaveValue("Привет @user-maria "));
    await user.type(field, "@user-al");
    await screen.findByRole("option");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("links stable IDs after rename, leaves unknown handles and emails as text, and escapes HTML", () => {
    const author = makeSession("user-alex")!.user;
    const text = "🏃 @user-maria, x@user-maria @unknown <script>текст</script>";
    const comment = saveComment(mockId("basketball-yard"), author, text);
    expect(comment.mentions).toHaveLength(1);
    saveProfile({
      ...makeSession("user-maria")!.user,
      nickname: "renamed-maria",
    });
    const stored = getComments()[0];
    expect(stored.mentions?.[0].userId).toBe(mockId("user-maria"));
    render(
      <MemoryRouter>
        <MentionText text={stored.text} mentions={stored.mentions} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "@user-maria" })).toHaveAttribute(
      "href",
      `/users/${mockId("user-maria")}`,
    );
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("ignores invalid or overlapping ranges", () => {
    render(
      <MemoryRouter>
        <MentionText
          text="@user-alex"
          mentions={[
            {
              userId: mockId("user-alex"),
              nickname: "user-alex",
              start: 0,
              end: 10,
            },
            {
              userId: mockId("user-maria"),
              nickname: "user-alex",
              start: 0,
              end: 10,
            },
            {
              userId: "https://evil.example",
              nickname: "user-alex",
              start: 0,
              end: 10,
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
