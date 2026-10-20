import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  readProfile,
  profilePatch,
  profilePatchSchema,
} from "../entities/profile/api/mappers";
import { createHttpProfileRepository } from "../entities/profile/api/http-profile-repository";
import { ownProfileQuery } from "../entities/profile";
import {
  ProfileFailure,
  profileDraft,
  type Profile,
  type ProfileRepository,
} from "../entities/profile/model";
import {
  normalizeProfile,
  updateProfile,
} from "../features/edit-profile/model/update-profile";
import { makeSession, mockId } from "../mocks/database";
import { ApiError } from "../shared/api/client";
const wire = () => makeSession("user-alex")!.user;
const profile = () => readProfile(wire());
const repository = (result: Profile = profile()): ProfileRepository => ({
  own: vi.fn(async () => result),
  find: vi.fn(async () => result),
  update: vi.fn(async () => result),
});

describe("profile use case and API boundary", () => {
  it("reads legacy roles without displaying or accepting them for editing", () => {
    const old = readProfile({
      ...wire(),
      sportsRoles: ["COACH", "REFEREE", "ATHLETE"],
      rank: "ELITE",
      ratingPoints: 9999,
    });
    expect(old.roles).toEqual(["ATHLETE"]);
    expect(old).not.toHaveProperty("points");
    expect(old).not.toHaveProperty("rank");
    for (const role of ["COACH", "REFEREE"])
      expect(
        profilePatchSchema.safeParse({ sportsRoles: [role] }).success,
      ).toBe(false);
  });
  it("accepts the server uniform and reset default while rejecting a different chosen character", async () => {
    const base = profile();
    const draft = {
      ...profileDraft(base),
      avatarUrl: "/avatars/user/female-02.svg",
    };
    const result = { ...base, avatarUrl: "/avatars/admin/female-02.svg" };
    expect(
      (await updateProfile(repository(result), base.id, draft)).avatarUrl,
    ).toBe(result.avatarUrl);
    await expect(
      updateProfile(
        repository({ ...result, avatarUrl: "/avatars/user/female-03.svg" }),
        base.id,
        draft,
      ),
    ).rejects.toMatchObject({ code: "invalid-response" });
    expect(
      (
        await updateProfile(repository(result), base.id, {
          ...draft,
          avatarUrl: "",
        })
      ).avatarUrl,
    ).toBe(result.avatarUrl);
  });
  it("normalizes nullable fields and sends only editable wire fields", async () => {
    const draft = {
      ...profileDraft(profile()),
      name: "  Новое имя  ",
      handle: " new-handle ",
      about: "  Люблю бег  ",
      avatarUrl: "   ",
    };
    const changes = normalizeProfile(draft);
    const repo = repository({
      ...profile(),
      ...changes,
      roles: [...changes.roles].reverse(),
    });
    const updated = await updateProfile(repo, profile().id, draft);
    expect(updated).not.toHaveProperty("points");
    expect(updated).not.toHaveProperty("rank");
    const patch = profilePatch(changes);
    expect(patch).toMatchObject({
      displayName: "Новое имя",
      nickname: "new-handle",
      bio: "Люблю бег",
      firstName: null,
      avatarUrl: null,
    });
    for (const key of [
      "id",
      "rank",
      "ratingPoints",
      "systemRoles",
      "createdAt",
    ])
      expect(patch).not.toHaveProperty(key);
  });
  it.each([
    { handle: "aa" },
    { handle: "a".repeat(41) },
    { name: "  " },
    { name: "а".repeat(101) },
    { firstName: "а".repeat(81) },
    { about: "а".repeat(1001) },
    { city: "а".repeat(101) },
    { avatarUrl: "javascript:alert(1)" },
    { avatarUrl: "https://user:password@example.com/photo.png" },
    { roles: ["ATHLETE", "ATHLETE"] as const },
    {
      preferences: [
        { sportId: mockId("running"), level: "BEGINNER" as const },
        { sportId: mockId("running"), level: "AMATEUR" as const },
      ],
    },
  ])("rejects invalid input before HTTP", async (override) => {
    const repo = repository();
    const draft = {
      ...profileDraft(profile()),
      ...override,
      roles: [...(override.roles ?? profile().roles)],
    };
    await expect(
      updateProfile(repo, profile().id, draft),
    ).rejects.toMatchObject({ code: "invalid-input" });
    expect(repo.update).not.toHaveBeenCalled();
  });
  it("accepts maximum lengths, empty roles/preferences and clears optional fields", async () => {
    const draft = {
      ...profileDraft(profile()),
      handle: "a".repeat(40),
      name: "а".repeat(100),
      about: "а".repeat(1000),
      firstName: "а".repeat(80),
      city: "Комсомольск-на-Амуре",
      roles: [],
      preferences: [],
    };
    const repo = repository({ ...profile(), ...normalizeProfile(draft) });
    expect((await updateProfile(repo, profile().id, draft)).about).toHaveLength(
      1000,
    );
    await expect(updateProfile(repo, "", draft)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });
  it.each([
    { id: mockId("other") },
    { name: "Неверный ответ" },
    { about: "Другой текст" },
    { roles: [] },
    {
      preferences: [{ sportId: mockId("running"), level: "ADVANCED" as const }],
    },
  ])(
    "does not announce success for a wrong user or unsaved editable data",
    async (override) => {
      await expect(
        updateProfile(
          repository({ ...profile(), ...override }),
          profile().id,
          profileDraft(profile()),
        ),
      ).rejects.toMatchObject({ code: "invalid-response" });
    },
  );
  it.each([
    { id: "invalid" },
    { ratingPoints: -1 },
    { rank: "UNKNOWN" },
    { createdAt: "2026-10-01T12:00:00" },
    { sportsRoles: ["ADMIN"] },
    { sportsPreferences: [{ sportId: mockId("running"), level: "ANY" }] },
  ])("rejects malformed DTO", (override) => {
    expect(() => readProfile({ ...wire(), ...override })).toThrow(
      ProfileFailure,
    );
  });
  it("does not expose unsafe legacy avatar URLs for rendering", () => {
    expect(
      readProfile({ ...wire(), avatarUrl: "data:text/html,script" }).avatarUrl,
    ).toBeNull();
  });
  it.each([
    [0, "network"],
    [400, "invalid-input"],
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [422, "invalid-input"],
    [503, "unavailable"],
  ])("translates HTTP %s", async (status, code) => {
    const repo = createHttpProfileRepository(() =>
      Promise.reject(new ApiError(Number(status))),
    );
    await expect(repo.own()).rejects.toMatchObject({ code });
  });
  it("preserves Abort and never accepts a private response for another viewer", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    await expect(
      createHttpProfileRepository(() => Promise.reject(abort)).find(
        profile().id,
      ),
    ).rejects.toBe(abort);
    const client = new QueryClient();
    await expect(
      client.fetchQuery(ownProfileQuery(repository(), mockId("other"))),
    ).rejects.toMatchObject({ code: "invalid-response" });
    client.clear();
  });
});
