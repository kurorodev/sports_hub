import path from "node:path";
import { Linter } from "eslint";
import { describe, expect, it } from "vitest";
import { boundaries } from "../../eslint-rules/architecture.js";

const root = path.resolve(import.meta.dirname, "..");
function lint(file: string, code: string) {
  return new Linter().verify(
    code,
    [
      {
        plugins: { architecture: { rules: { boundaries } } },
        rules: { "architecture/boundaries": "error" },
      },
    ],
    { filename: path.join(root, file) },
  );
}

describe("architectural dependency boundaries", () => {
  it("allows a use case to depend on a pure entity model", () => {
    expect(
      lint(
        "features/join-event/model/use-case.js",
        'import { RegistrationFailure } from "../../../entities/registration/model";',
      ),
    ).toEqual([]);
  });
  it("allows composition of pages and concrete adapters in app", () => {
    expect(
      lint(
        "app/composition.js",
        'import { Page } from "../pages/event"; import { createRepository } from "../entities/registration/api/http-registration-repository";',
      ),
    ).toEqual([]);
  });
  it.each([
    [
      "features/join-event/model/use-case.js",
      'import { useQuery } from "@tanstack/react-query";',
      "core",
    ],
    [
      "features/join-event/model/use-case.js",
      'import { request } from "../../../shared/api/client";',
      "core",
    ],
    [
      "entities/registration/model/registration.js",
      'export { Adapter } from "../api/adapter";',
      "core",
    ],
    [
      "features/join-event/ui/view.js",
      'import { Form } from "../../create-event";',
      "slice",
    ],
    [
      "entities/event/ui/card.js",
      'import { Status } from "../../registration";',
      "slice",
    ],
    [
      "shared/ui/widget.js",
      'export { Feature } from "../../features/join-event";',
      "layer",
    ],
    [
      "features/join-event/ui/view.js",
      'import { createRepository } from "../../../entities/registration/api/http-registration-repository";',
      "adapter",
    ],
    [
      "features/join-event/ui/view.js",
      'import("../../../mocks/database");',
      "support",
    ],
    [
      "features/event-discussion/ui/view.js",
      'import { createRepository } from "../../../entities/comment/api/http-comment-repository";',
      "adapter",
    ],
  ])("rejects forbidden dependency from %s", (file, code, message) => {
    expect(lint(file, code).some((item) => item.messageId === message)).toBe(
      true,
    );
  });
});
