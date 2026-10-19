import { expect, it } from "vitest";
import { getSports, saveEvent, getEvents, mockId } from "../mocks/database";
import { request } from "../shared/api/client";
import type {
  Sport,
  Page,
  EventCardDto,
  EventCreate,
} from "../shared/api/types";

const input: EventCreate = {
  title: "Необычная тренировка",
  description: "Пробуем новую спортивную активность вместе",
  sport: { customName: "Новая активность вне реестра" },
  startsAt: "2099-11-07T15:00:00Z",
  location: { city: "Самара", address: "Парк" },
  joinMode: "OPEN",
  skillLevel: "ANY",
  eventKind: "ACTIVITY",
  maxParticipants: 10,
  organizer: { type: "USER", id: mockId("user-alex") },
};

it("serves the complete registry snapshot and exactly one Other category", async () => {
  const sports = await request<Sport[]>("/sports");
  expect(sports).toHaveLength(201);
  expect(sports.filter((sport) => sport.isCustom)).toEqual([
    expect.objectContaining({ name: "Другое", registryCode: null }),
  ]);
  expect(
    new Set(
      sports
        .filter((sport) => !sport.isCustom)
        .map((sport) => sport.registryCode),
    ).size,
  ).toBe(200);
  expect(sports).toContainEqual(
    expect.objectContaining({ name: "Спорт глухих" }),
  );
  expect(sports).not.toContainEqual(expect.objectContaining({ name: "Бег" }));
  expect(await request<Sport[]>("/sports?q=шахматы")).toEqual([
    expect.objectContaining({ name: "Шахматы" }),
  ]);
});

it("keeps arbitrary activity names on events and never adds global categories", async () => {
  const before = getSports();
  const first = saveEvent(input, mockId("user-alex"))!;
  const second = saveEvent(
    { ...input, sport: { customName: "Другая новая активность" } },
    mockId("user-alex"),
  )!;
  expect(first.sport).toEqual(second.sport);
  expect(first.sport.name).toBe("Другое");
  expect(first.customSportName).toBe("Новая активность вне реестра");
  expect(
    getEvents().find((event) => event.id === first.id)?.customSportName,
  ).toBe(first.customSportName);
  expect(getSports()).toEqual(before);
  const results = await request<Page<EventCardDto>>(
    "/events?q=Новая%20активность%20вне%20реестра",
  );
  expect(results.items.map((event) => event.id)).toContain(first.id);
  expect(await request<Sport[]>("/sports?q=Новая%20активность")).toEqual([]);
});

it("uses registered categories directly and rejects an invented category ID", () => {
  const chess = getSports().find((sport) => sport.name === "Шахматы")!;
  const event = saveEvent(
    { ...input, sport: { sportId: chess.id } },
    mockId("user-alex"),
  )!;
  expect(event.sport).toEqual(chess);
  expect(event.customSportName).toBeNull();
  expect(
    saveEvent(
      { ...input, sport: { sportId: mockId("invented") } },
      mockId("user-alex"),
    ),
  ).toBeUndefined();
});
