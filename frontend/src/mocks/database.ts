import type {
  DemoAccount,
  EventPreview,
  Session,
  Registration,
} from "../shared/api/provisional";
import { z } from "zod";
import {
  eventDraftSchema,
  eventFieldsSchema,
  type CreateEventInput,
} from "../shared/api/provisional-event-schema";

export const accounts: DemoAccount[] = [
  { id: "user-alex", name: "Александр", description: "Участник · USER" },
  { id: "user-maria", name: "Мария", description: "Участник · USER" },
  {
    id: "org-run",
    name: "Беговой клуб «Темп»",
    description: "Представитель организации",
  },
  { id: "admin", name: "Администратор", description: "Модератор · ADMIN" },
];

export function makeSession(accountId: string): Session | undefined {
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return undefined;
  return {
    user: { id: account.id, name: account.name },
    systemRoles: accountId === "admin" ? ["USER", "ADMIN"] : ["USER"],
    manageableOrganizationIds: accountId === "org-run" ? ["org-temp"] : [],
    csrfToken: `mock-csrf-${accountId}`,
    demo: true,
  };
}

// Fixed future seed; it does not silently shift dates on each page load.
const seedEvents: Omit<EventPreview, "registrationOpen">[] = [
  {
    id: "morning-run",
    title: "Утро. Парк. Лёгкий бег.",
    sport: { id: "running", name: "Бег" },
    description:
      "Начинаем день с движения. Бежим в разговорном темпе, знакомимся и пьём кофе после. Дистанция 5 км, можно перейти на шаг. Возьмите воду и удобные кроссовки.",
    startsAt: "2026-10-24T09:00:00+03:00",
    location: { city: "Москва", address: "Парк Горького, главный вход" },
    skillLevel: "Любой уровень",
    joinMode: "OPEN",
    eventKind: "MEETUP",
    status: "PUBLISHED",
    organizer: { name: "Беговой клуб «Темп»", type: "ORGANIZATION" },
    confirmedCount: 8,
    capacity: 15,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
  {
    id: "basketball-yard",
    title: "Собираемся на баскет",
    sport: { id: "basketball", name: "Баскетбол" },
    description:
      "Дружеская игра 3×3 на открытой площадке. Разомнёмся, поделимся на команды и сыграем несколько матчей. Мяч с нас, хорошее настроение с вас.",
    startsAt: "2026-10-24T17:00:00+03:00",
    location: {
      city: "Москва",
      address: "Парк «Красная Пресня», площадка № 2",
    },
    skillLevel: "Средний",
    joinMode: "APPROVAL",
    eventKind: "MEETUP",
    status: "PUBLISHED",
    organizer: { name: "Александр", type: "USER" },
    confirmedCount: 4,
    capacity: 6,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
  {
    id: "tennis-sunday",
    title: "Теннис без спешки",
    sport: { id: "tennis", name: "Теннис" },
    description:
      "Тренируем подачи и играем в парах. Подойдёт тем, кто уже держал ракетку и хочет больше практики. Ракетки свои, мячи предоставим. Аренда корта оплачивается на месте по тарифу площадки.",
    startsAt: "2026-10-25T12:00:00+03:00",
    location: { city: "Москва", address: "Сокольники, теннисные корты" },
    skillLevel: "Начинающий",
    joinMode: "OPEN",
    eventKind: "TRAINING",
    status: "PUBLISHED",
    organizer: { name: "Мария", type: "USER" },
    confirmedCount: 2,
    capacity: 4,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
  {
    id: "chess-evening",
    title: "Твой ход: шахматный вечер",
    sport: { id: "chess", name: "Шахматы" },
    description:
      "Играем дружеские партии без рейтинга и разбираем интересные позиции. Можно прийти без опыта: объясним правила и найдём партнёра. Доски есть на месте.",
    startsAt: "2026-10-25T18:30:00+03:00",
    location: {
      city: "Москва",
      address: "Библиотека им. Некрасова, зал встреч",
    },
    skillLevel: "Любой уровень",
    joinMode: "OPEN",
    eventKind: "MEETUP",
    status: "PUBLISHED",
    organizer: { name: "Мария", type: "USER" },
    confirmedCount: 10,
    capacity: 10,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
  {
    id: "river-run",
    title: "Пробежка вдоль Невы",
    sport: { id: "running", name: "Бег" },
    description:
      "Пять километров вдоль набережной в спокойном темпе. Встречаемся у входа в парк, вместе разминаемся. Новичкам рады.",
    startsAt: "2026-10-31T10:00:00+03:00",
    location: {
      city: "Санкт-Петербург",
      address: "Парк 300-летия, главный вход",
    },
    skillLevel: "Начинающий",
    joinMode: "OPEN",
    eventKind: "MEETUP",
    status: "PUBLISHED",
    organizer: { name: "Александр", type: "USER" },
    confirmedCount: 3,
    capacity: 12,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
  {
    id: "basketball-training",
    title: "Первый шаг на площадку",
    sport: { id: "basketball", name: "Баскетбол" },
    description:
      "Разбираем основы дриблинга, передачи и броска. Небольшая группа, спокойный темп и много практики. Для тех, кто хочет попробовать баскетбол.",
    startsAt: "2026-11-01T14:00:00+03:00",
    location: { city: "Москва", address: "Спортзал «Старт», ул. Лесная, 8" },
    skillLevel: "Начинающий",
    joinMode: "APPROVAL",
    eventKind: "TRAINING",
    status: "PUBLISHED",
    organizer: { name: "Беговой клуб «Темп»", type: "ORGANIZATION" },
    confirmedCount: 5,
    capacity: 12,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
];

const seedOwners: Record<string, string> = {
  "morning-run": "org-run",
  "basketball-yard": "user-alex",
  "tennis-sunday": "user-maria",
  "chess-evening": "user-maria",
  "river-run": "user-alex",
  "basketball-training": "org-run",
};
const createdEventSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  sport: z.object({ id: z.string(), name: z.string() }),
  input: eventDraftSchema,
});
const storeSchema = z.object({
  version: z.literal(1),
  events: z.array(createdEventSchema),
});
type MockStore = z.infer<typeof storeSchema>;
const storeKey = "dvizh.mock.events.v1";
let memoryStore: MockStore = { version: 1, events: [] };

const registrationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  user: z.object({ id: z.string(), name: z.string() }),
  status: z.literal("CONFIRMED"),
  createdAt: z.iso.datetime({ offset: true }),
});
const registrationStoreSchema = z.object({
  version: z.literal(1),
  items: z.array(registrationSchema),
});
const registrationKey = "dvizh.mock.registrations.v1";
let memoryRegistrations: Registration[] = [];
// Each seeded count corresponds to actual synthetic demo participants, never a separate counter.
const participantNames = [
  "Анастасия",
  "Илья",
  "Виктория",
  "Дмитрий",
  "Анна",
  "Михаил",
  "Елена",
  "Артём",
  "София",
  "Никита",
];
const seedRegistrations: Registration[] = seedEvents.flatMap((event) =>
  Array.from({ length: event.confirmedCount }, (_, index) => ({
    id: `seed-${event.id}-${index}`,
    eventId: event.id,
    user: {
      id: `demo-${event.id}-${index}`,
      name: participantNames[index % participantNames.length],
    },
    status: "CONFIRMED",
    createdAt: "2026-10-01T12:00:00+03:00",
  })),
);

export function getRegistrations(eventId?: string): Registration[] {
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(registrationKey)
      : null;
  const items =
    typeof localStorage === "undefined"
      ? memoryRegistrations
      : saved
        ? registrationStoreSchema.parse(JSON.parse(saved)).items
        : [];
  return [...seedRegistrations, ...items].filter(
    (registration) => !eventId || registration.eventId === eventId,
  );
}

export function saveRegistration(
  eventId: string,
  user: Session["user"],
): Registration {
  const registration: Registration = {
    id: crypto.randomUUID(),
    eventId,
    user,
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
  };
  const items = [
    ...getRegistrations().filter((item) => !item.id.startsWith("seed-")),
    registration,
  ];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(
      registrationKey,
      JSON.stringify({ version: 1, items }),
    );
  memoryRegistrations = items;
  return registration;
}

function readStore(): MockStore {
  if (typeof localStorage === "undefined") return memoryStore;
  const saved = localStorage.getItem(storeKey);
  if (!saved) return { version: 1, events: [] };
  // Fail the request visibly instead of silently discarding a corrupt persisted demo.
  return storeSchema.parse(JSON.parse(saved));
}

function writeStore(store: MockStore) {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(storeKey, JSON.stringify(store));
  memoryStore = store;
}

export function resetMockDatabase() {
  memoryStore = { version: 1, events: [] };
  if (typeof localStorage !== "undefined") localStorage.removeItem(storeKey);
  memoryRegistrations = [];
  if (typeof localStorage !== "undefined")
    localStorage.removeItem(registrationKey);
}

export function getEvents(viewerId?: string): EventPreview[] {
  const created = readStore().events.map(
    (record): Omit<EventPreview, "registrationOpen"> => ({
      ...eventFieldsSchema.parse(record.input),
      startsAt: record.input.startsAt,
      id: record.id,
      sport: record.sport,
      status: "PUBLISHED",
      organizer: {
        name:
          accounts.find((account) => account.id === record.ownerId)?.name ??
          "Участник",
        type: "USER",
      },
      confirmedCount: 0,
      viewerIsOrganizer: record.ownerId === viewerId,
      viewerRegistrationStatus: null,
    }),
  );
  const registrations = getRegistrations();
  return [
    ...seedEvents.map((event) => ({
      ...event,
      viewerIsOrganizer: seedOwners[event.id] === viewerId,
    })),
    ...created,
  ].map((event) => {
    const confirmed = registrations.filter(
      (item) => item.eventId === event.id && item.status === "CONFIRMED",
    );
    return {
      ...event,
      confirmedCount: confirmed.length,
      registrationOpen:
        event.status === "PUBLISHED" && Date.parse(event.startsAt) > Date.now(),
      viewerRegistrationStatus:
        confirmed.find((item) => item.user.id === viewerId)?.status ?? null,
    };
  });
}

export function getSports() {
  const sports = new Map(
    getEvents().map((event) => [event.sport.id, event.sport]),
  );
  return [...sports.values()];
}

function normalizeSport(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}

export function saveEvent(
  input: CreateEventInput,
  ownerId: string,
): EventPreview | undefined {
  const store = readStore();
  const sports = getSports();
  const sport = input.sportId
    ? sports.find((item) => item.id === input.sportId)
    : (sports.find(
        (item) =>
          normalizeSport(item.name) === normalizeSport(input.customSportName!),
      ) ?? {
        id: `custom-${crypto.randomUUID()}`,
        name: input.customSportName!.trim().replace(/\s+/g, " "),
      });
  if (!sport) return undefined;
  const id = crypto.randomUUID();
  // Event and custom sport are persisted together; a failed write publishes neither.
  writeStore({
    version: 1,
    events: [...store.events, { id, ownerId, sport, input }],
  });
  return getEvents(ownerId).find((event) => event.id === id);
}
