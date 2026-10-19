import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./setup";
import { request } from "../shared/api/client";
import { mockId, mockUser } from "../mocks/database";
import type { OrganizationDto } from "../shared/api/types";
import { createHttpOrganizationRepository } from "../entities/organization/api/http-organization-repository";
import { myOrganizationsQuery } from "../entities/organization";
import type {
  Organization,
  OrganizationRepository,
} from "../entities/organization/model";
import { applyOrganization } from "../features/organization-application/model/apply-organization";
import { reviewOrganization } from "../features/review-organizations/model/review-organization";
import { QueryClient } from "@tanstack/react-query";
const input = {
  name: "Новый клуб",
  description: "Занимаемся спортом вместе с новичками",
  sportIds: [mockId("running")],
};
const dto: OrganizationDto = {
  id: mockId("new-org"),
  name: input.name,
  description: input.description,
  sports: [],
  status: "PENDING",
  createdBy: mockUser("user-alex", "Александр"),
  createdAt: "2026-10-19T12:00:00Z",
};
const model: Organization = {
  id: dto.id,
  name: dto.name,
  description: dto.description,
  sports: [],
  status: "PENDING",
  representative: {
    id: dto.createdBy.id,
    displayName: dto.createdBy.displayName,
  },
  submittedAt: dto.createdAt,
};
function repository(result = model): OrganizationRepository {
  return {
    list: vi.fn(),
    mine: vi.fn(),
    find: vi.fn(),
    apply: vi.fn(async () => result),
    decide: vi.fn(async () => result),
  };
}
const adapter = createHttpOrganizationRepository(request);
describe("organization application core", () => {
  it("normalizes input and requires a server PENDING response for this representative", async () => {
    const repo = repository();
    expect(
      await applyOrganization(
        repo,
        {
          ...input,
          name: `  ${input.name}  `,
          sportIds: [...input.sportIds, ...input.sportIds],
        },
        model.representative.id,
      ),
    ).toEqual(model);
    expect(repo.apply).toHaveBeenCalledExactlyOnceWith(input);
  });
  it.each([
    { ...model, status: "APPROVED" as const },
    { ...model, name: "Wrong" },
    { ...model, representative: { id: "other", displayName: "Другой" } },
  ])("rejects a mismatched application response", async (result) => {
    await expect(
      applyOrganization(repository(result), input, model.representative.id),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });
  it.each([
    { ...input, name: "a" },
    { ...input, name: "a".repeat(161) },
    { ...input, description: "short" },
    { ...input, description: "a".repeat(2001) },
  ])("rejects invalid application limits without sending", async (value) => {
    const repo = repository();
    await expect(
      applyOrganization(repo, value, model.representative.id),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(repo.apply).not.toHaveBeenCalled();
  });
  it("accepts both matching decisions and rejects an absent reason", async () => {
    expect(
      (
        await reviewOrganization(
          repository({ ...model, status: "APPROVED" }),
          model.id,
          { outcome: "approve" },
        )
      ).status,
    ).toBe("APPROVED");
    const rejected = {
      ...model,
      status: "REJECTED" as const,
      decisionReason: "Неполное описание",
    };
    expect(
      await reviewOrganization(repository(rejected), model.id, {
        outcome: "reject",
        reason: " Неполное описание ",
      }),
    ).toEqual(rejected);
    const repo = repository();
    await expect(
      reviewOrganization(repo, model.id, { outcome: "reject", reason: "  " }),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(repo.decide).not.toHaveBeenCalled();
  });
  it.each([
    { ...model, id: "other", status: "APPROVED" as const },
    model,
    { ...model, status: "REJECTED" as const },
  ])(
    "does not invent approval from another/unchanged decision",
    async (result) => {
      await expect(
        reviewOrganization(repository(result), model.id, {
          outcome: "approve",
        }),
      ).rejects.toMatchObject({ code: "invalid-response" });
    },
  );
});
describe("organization HTTP boundary", () => {
  it("maps generated DTOs to an independent model", async () => {
    server.use(
      http.get(`/api/v1/organizations/${dto.id}`, () => HttpResponse.json(dto)),
    );
    expect(await adapter.find(dto.id)).toEqual(model);
    expect(await adapter.find(dto.id)).not.toHaveProperty("createdBy");
  });
  it.each([
    {},
    { ...dto, status: "UNKNOWN" },
    { ...dto, createdBy: null },
    { ...dto, createdAt: "2026-10-19T12:00:00" },
  ])("rejects malformed DTOs", async (value) => {
    server.use(
      http.post("/api/v1/organizations", () => HttpResponse.json(value)),
    );
    await expect(adapter.apply(input)).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [422, "invalid-input"],
    [503, "unavailable"],
  ])("translates HTTP %s", async (status, code) => {
    server.use(
      http.post("/api/v1/organizations", () =>
        HttpResponse.json({ code: "ERROR" }, { status: Number(status) }),
      ),
    );
    await expect(adapter.apply(input)).rejects.toMatchObject({ code });
  });
  it("does not expose another account's applications and preserves Abort", async () => {
    server.use(
      http.get("/api/v1/me/organizations", () => HttpResponse.json([dto])),
    );
    await expect(
      new QueryClient().fetchQuery(
        myOrganizationsQuery(adapter, mockId("user-maria")),
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.mine(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
