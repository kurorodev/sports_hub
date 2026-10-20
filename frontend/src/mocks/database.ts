import registry from "./generated/sports-registry.json";
import { savedProfile, refreshMockUser, mockAvatar } from "./profiles";
import { avatarSource } from "../shared/model/avatars";
import { profileSchema } from "../entities/profile/api/mappers";
import { getModerationRecords } from "./moderation";
import { getOrganizations } from "./organizations";
import type {
  DemoAccount,
  EventPreview,
  Session,
  Registration,
  PublicUser,
  Sport,
  UserProfileDto,
} from "../shared/api/types";
import { z } from "zod";
import {
  eventDraftSchema,
  type CreateEventInput,
} from "../shared/api/event-schema";

// Deterministic UUIDs keep mock requests valid under the same contract as Java.
export function mockId(key: string) {
  let hash = 2166136261;
  for (const char of key)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const hex = hash.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
}
export function mockUser(accountId: string, displayName: string): PublicUser {
  return {
    id: mockId(accountId),
    nickname: accountId,
    displayName,
    avatarUrl: avatarSource(
      mockId(accountId),
      undefined,
      accountId === "admin" ? "admin" : "user",
    ),
    sportsRoles: ["ATHLETE"],
    rank: "ROOKIE",
    ratingPoints: 0,
  };
}
export const accounts: DemoAccount[] = [
  {
    id: "user-alex",
    label: "Александр",
    systemRoles: ["USER"],
    sportsRoles: ["ATHLETE"],
  },
  {
    id: "user-maria",
    label: "Мария",
    systemRoles: ["USER"],
    sportsRoles: ["ATHLETE"],
  },
  {
    id: "org-run",
    label: "Беговой клуб «Темп»",
    systemRoles: ["USER", "ORGANIZATION"],
    sportsRoles: ["SPORTS_ORGANIZER"],
  },
  {
    id: "admin",
    label: "Администратор",
    systemRoles: ["USER", "ADMIN"],
    sportsRoles: [],
  },
];
const signupKey = "sport.mock.accounts.v1";
const signupRecordSchema = z.object({
  account: z.object({
    id: z.string(),
    label: z.string(),
    systemRoles: z.array(z.enum(["USER", "ORGANIZATION", "ADMIN"])),
    sportsRoles: z.array(
      z.enum(["ATHLETE", "COACH", "REFEREE", "SPORTS_ORGANIZER"]),
    ),
  }),
  profile: profileSchema,
  passwordHash: z.string().optional(),
});
type SignupRecord = z.infer<typeof signupRecordSchema>;
let memorySignups: SignupRecord[] = [];
function signups(): SignupRecord[] {
  const saved =
    typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(signupKey);
  return saved === null
    ? memorySignups
    : z.array(signupRecordSchema).parse(JSON.parse(saved));
}
function allAccounts(): DemoAccount[] {
  return [...accounts, ...signups().map((item) => item.account)].map(
    (account) => {
      const profile = savedProfile(mockId(account.id));
      return {
        ...account,
        label: profile?.displayName ?? account.label,
        sportsRoles: profile?.sportsRoles ?? account.sportsRoles,
      };
    },
  );
}
export function getAccounts(): DemoAccount[] {
  const protectedIds = new Set(
    signups()
      .filter((item) => item.passwordHash)
      .map((item) => item.account.id),
  );
  return allAccounts().filter((account) => !protectedIds.has(account.id));
}
export function passwordAccount(nickname: string) {
  return signups().find(
    (record) =>
      record.passwordHash &&
      (
        savedProfile(record.profile.id) ?? record.profile
      ).nickname.toLowerCase() === nickname.toLowerCase(),
  );
}
export function createMockAccount(
  nickname: string,
  displayName: string,
  passwordHash?: string,
): string {
  const id = `signup-${crypto.randomUUID()}`;
  const record: SignupRecord = {
    ...(passwordHash ? { passwordHash } : {}),
    account: { id, label: displayName, systemRoles: ["USER"], sportsRoles: [] },
    profile: {
      id: mockId(id),
      nickname,
      displayName,
      sportsRoles: [],
      sportsPreferences: [],
      rank: "ROOKIE",
      ratingPoints: 0,
      createdAt: new Date().toISOString(),
    },
  };
  const next = [...signups(), signupRecordSchema.parse(record)];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(signupKey, JSON.stringify(next));
  memorySignups = next;
  return id;
}
export function makeSession(accountId: string): Session | undefined {
  const account = allAccounts().find((item) => item.id === accountId);
  if (!account) return undefined;
  const manageable = getOrganizations()
    .filter(
      (item) =>
        item.createdBy.id === mockId(accountId) && item.status === "APPROVED",
    )
    .map((item) => item.id);
  const profile = savedProfile(mockId(account.id)) ??
    signups().find((item) => item.account.id === account.id)?.profile ?? {
      ...mockUser(account.id, account.label),
      sportsRoles: account.sportsRoles,
      sportsPreferences: [],
      createdAt: "2026-10-01T12:00:00Z",
    };
  return {
    user: {
      ...profile,
      avatarUrl: mockAvatar(profile, manageable.length ? "organizer" : "user"),
    },
    systemRoles: [
      ...account.systemRoles.filter((role) => role !== "ORGANIZATION"),
      ...(manageable.length ? ["ORGANIZATION" as const] : []),
    ],
    manageableOrganizationIds: manageable,
    csrfToken: `mock-csrf-${accountId}`,
    demo: true,
  };
}
type SeedEvent = Omit<
  EventPreview,
  | "pendingCount"
  | "spotsLeft"
  | "createdAt"
  | "updatedAt"
  | "sport"
  | "organizer"
> & {
  sport: Pick<Sport, "id" | "name">;
  organizer: Pick<EventPreview["organizer"], "name" | "type">;
};
const seedData = [
  {
    id: "morning-run",
    title: "Утро. Парк. Лёгкий бег.",
    sport: { id: "running", name: "Бег" },
    description:
      "Начинаем день с пробежки. Бежим в разговорном темпе, знакомимся и пьём кофе после. Дистанция 5 км, можно перейти на шаг. Возьмите воду и удобные кроссовки.",
    startsAt: "2026-10-24T09:00:00+03:00",
    location: { city: "Москва", address: "Парк Горького, главный вход" },
    skillLevel: "ANY",
    joinMode: "OPEN",
    eventKind: "ACTIVITY",
    status: "PUBLISHED",
    organizer: { name: "Беговой клуб «Темп»", type: "ORGANIZATION" },
    confirmedCount: 8,
    maxParticipants: 15,
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
    skillLevel: "AMATEUR",
    joinMode: "APPROVAL",
    eventKind: "ACTIVITY",
    status: "PUBLISHED",
    organizer: { name: "Александр", type: "USER" },
    confirmedCount: 4,
    maxParticipants: 6,
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
    skillLevel: "BEGINNER",
    joinMode: "OPEN",
    eventKind: "ACTIVITY",
    status: "PUBLISHED",
    organizer: { name: "Мария", type: "USER" },
    confirmedCount: 2,
    maxParticipants: 4,
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
    skillLevel: "ANY",
    joinMode: "OPEN",
    eventKind: "ACTIVITY",
    status: "PUBLISHED",
    organizer: { name: "Мария", type: "USER" },
    confirmedCount: 10,
    maxParticipants: 10,
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
    skillLevel: "BEGINNER",
    joinMode: "OPEN",
    eventKind: "ACTIVITY",
    status: "PUBLISHED",
    organizer: { name: "Александр", type: "USER" },
    confirmedCount: 3,
    maxParticipants: 12,
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
    skillLevel: "BEGINNER",
    joinMode: "APPROVAL",
    eventKind: "ACTIVITY",
    status: "PUBLISHED",
    organizer: { name: "Беговой клуб «Темп»", type: "ORGANIZATION" },
    confirmedCount: 5,
    maxParticipants: 12,
    viewerIsOrganizer: false,
    viewerRegistrationStatus: null,
  },
] satisfies SeedEvent[];
const seedOwners: Record<string, string> = {
  "morning-run": "org-run",
  "basketball-yard": "user-alex",
  "tennis-sunday": "user-maria",
  "chess-evening": "user-maria",
  "river-run": "user-alex",
  "basketball-training": "org-run",
};
const seedEvents: EventPreview[] = seedData.map((event) => ({
  ...event,
  id: mockId(event.id),
  sport: { ...event.sport, id: mockId(event.sport.id), isCustom: false },
  organizer: {
    ...event.organizer,
    id:
      event.organizer.type === "ORGANIZATION"
        ? mockId("org-temp")
        : mockId(seedOwners[event.id]),
  },
  pendingCount: 0,
  spotsLeft: event.maxParticipants - event.confirmedCount,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
}));
const eventKey = "sport.mock.events.v2";
const registrationKey = "sport.mock.registrations.v2";
const recordSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  sport: z.object({ id: z.string(), name: z.string(), isCustom: z.boolean() }),
  input: eventDraftSchema,
});
const storeSchema = z.object({
  version: z.literal(2),
  events: z.array(recordSchema),
});
type MockStore = z.infer<typeof storeSchema>;
let memoryStore: MockStore = { version: 2, events: [] };
let memoryRegistrations: Registration[] = [];
const userSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  displayName: z.string(),
  sportsRoles: z.array(
    z.enum(["ATHLETE", "COACH", "REFEREE", "SPORTS_ORGANIZER"]),
  ),
  rank: z.enum(["ROOKIE", "ACTIVE", "EXPERIENCED", "ELITE"]),
  ratingPoints: z.number(),
});
const registrationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  user: userSchema,
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "REJECTED",
    "CANCELLED",
    "WAITLISTED",
  ]),
  message: z.string().nullable().optional(),
  decisionReason: z.string().nullable().optional(),
  decidedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}) satisfies z.ZodType<Registration>;
const names = [
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
    id: mockId(`reg-${event.id}-${index}`),
    eventId: event.id,
    user: mockUser(
      `participant-${event.id}-${index}`,
      names[index % names.length],
    ),
    status: "CONFIRMED",
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-01T12:00:00Z",
  })),
);
function readStore(): MockStore {
  if (typeof localStorage === "undefined") return memoryStore;
  const saved = localStorage.getItem(eventKey);
  return saved
    ? storeSchema.parse(JSON.parse(saved))
    : { version: 2, events: [] };
}
export function getRegistrations(eventId?: string): Registration[] {
  const saved =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(registrationKey)
      : null;
  const records =
    typeof localStorage === "undefined"
      ? memoryRegistrations
      : saved
        ? z.array(registrationSchema).parse(JSON.parse(saved))
        : [];
  return [
    ...new Map(
      [...seedRegistrations, ...records].map((item) => [item.id, item]),
    ).values(),
  ]
    .filter((item) => !eventId || item.eventId === eventId)
    .map((item) => ({ ...item, user: refreshMockUser(item.user) }));
}
export function saveRegistration(
  eventId: string,
  user: PublicUser,
  status: Registration["status"],
  message?: string | null,
): Registration {
  const publicUser: PublicUser = {
    avatarUrl: user.avatarUrl,
    id: user.id,
    nickname: user.nickname,
    displayName: user.displayName,
    sportsRoles: user.sportsRoles,
    rank: user.rank,
    ratingPoints: user.ratingPoints,
  };
  const registration: Registration = {
    id: crypto.randomUUID(),
    eventId,
    user: publicUser,
    status,
    message,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const seedIds = new Set(seedRegistrations.map((item) => item.id));
  const records = [
    ...getRegistrations().filter((item) => !seedIds.has(item.id)),
    registration,
  ];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(registrationKey, JSON.stringify(records));
  memoryRegistrations = records;
  return registration;
}
export function getEvents(viewerId?: string): EventPreview[] {
  const created: EventPreview[] = readStore().events.map((record) => ({
    ...record.input,
    customSportName:
      "customName" in record.input.sport
        ? record.input.sport.customName.trim().replace(/\s+/g, " ")
        : null,
    id: record.id,
    sport: record.sport,
    skillLevel: record.input.skillLevel ?? "ANY",
    eventKind: record.input.eventKind ?? "ACTIVITY",
    status: record.input.publishNow === false ? "DRAFT" : "PUBLISHED",
    organizer: {
      id: record.input.organizer.id,
      type: record.input.organizer.type,
      name:
        record.input.organizer.type === "ORGANIZATION"
          ? (getOrganizations().find(
              (item) => item.id === record.input.organizer.id,
            )?.name ?? "Организация")
          : (allAccounts().find(
              (account) => mockId(account.id) === record.ownerId,
            )?.label ?? "Участник"),
    },
    confirmedCount: 0,
    pendingCount: 0,
    viewerIsOrganizer: record.ownerId === viewerId,
    viewerRegistrationStatus: null,
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
  }));
  return [
    ...seedEvents.map((event) => ({
      ...event,
      viewerIsOrganizer:
        event.organizer.type === "ORGANIZATION"
          ? getOrganizations().some(
              (item) =>
                item.id === event.organizer.id &&
                item.createdBy.id === viewerId &&
                item.status === "APPROVED",
            )
          : event.organizer.id === viewerId,
    })),
    ...created,
  ].map((event) => {
    const moderation = getModerationRecords().find(
      (item) => item.kind === "EVENT" && item.targetId === event.id,
    );
    const records = getRegistrations(event.id);
    const confirmedCount = records.filter(
      (item) => item.status === "CONFIRMED",
    ).length;
    return {
      ...event,
      sport: canonicalSport(event.sport),
      customSportName: canonicalSport(event.sport).isCustom
        ? "customSportName" in event &&
          typeof event.customSportName === "string"
          ? event.customSportName
          : event.sport.name !== "Другое"
            ? event.sport.name
            : null
        : null,
      organizer:
        event.organizer.type === "USER"
          ? {
              ...event.organizer,
              name:
                savedProfile(event.organizer.id)?.displayName ??
                event.organizer.name,
              avatarUrl: mockAvatar(
                {
                  id: event.organizer.id,
                  nickname:
                    allAccounts().find(
                      (u) => mockId(u.id) === event.organizer.id,
                    )?.id ?? "",
                  avatarUrl:
                    savedProfile(event.organizer.id)?.avatarUrl ??
                    event.organizer.avatarUrl,
                },
                "organizer",
              ),
            }
          : event.organizer,
      ...(moderation
        ? {
            status: "UNPUBLISHED" as const,
            moderationReason: null,
            updatedAt: moderation.at,
          }
        : {}),
      confirmedCount,
      pendingCount: records.filter((item) => item.status === "PENDING").length,
      spotsLeft:
        event.maxParticipants == null
          ? null
          : Math.max(0, event.maxParticipants - confirmedCount),
      viewerRegistrationStatus:
        records.find((item) => item.user.id === viewerId)?.status ?? null,
    };
  });
}
const legacySportKeys: Record<string, string> = {
  "Легкая атлетика": "running",
  Баскетбол: "basketball",
  Теннис: "tennis",
  Шахматы: "chess",
};
const catalog: Sport[] = [
  ...registry.sports.map((sport) => ({
    id: mockId(
      legacySportKeys[sport.name] ?? `vrvs:${sport.registryCode.slice(0, 3)}`,
    ),
    name: sport.name,
    registryCode: sport.registryCode,
    isCustom: false,
  })),
  {
    id: mockId("sport-other"),
    name: "Другое",
    isCustom: true,
    registryCode: null,
  },
];
export function getSports(): Sport[] {
  return catalog;
}
function canonicalSport(sport: Sport): Sport {
  const name = sport.name === "Бег" ? "Легкая атлетика" : sport.name;
  return (
    catalog.find(
      (item) =>
        item.id === sport.id || normalize(item.name) === normalize(name),
    ) ?? catalog[catalog.length - 1]
  );
}

function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}
export function saveEvent(
  input: CreateEventInput,
  ownerId: string,
): EventPreview | undefined {
  const store = readStore();
  const selection = input.sport;
  const sport =
    "sportId" in selection
      ? getSports().find((item) => item.id === selection.sportId)
      : catalog[catalog.length - 1];
  if (!sport) return undefined;
  const id = crypto.randomUUID();
  const next = {
    version: 2 as const,
    events: [...store.events, { id, ownerId, sport, input }],
  };
  if (typeof localStorage !== "undefined")
    localStorage.setItem(eventKey, JSON.stringify(next));
  memoryStore = storeSchema.parse(next);
  return getEvents(ownerId).find((event) => event.id === id);
}
export function resetMockDatabase() {
  memoryStore = { version: 2, events: [] };
  memoryRegistrations = [];
  memorySignups = [];
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(eventKey);
    localStorage.removeItem(registrationKey);
    localStorage.removeItem(signupKey);
  }
}

export function decideRegistration(
  registration: Registration,
  decision: "APPROVE" | "REJECT",
  reason?: string | null,
): Registration {
  const updated: Registration = {
    ...registration,
    status: decision === "APPROVE" ? "CONFIRMED" : "REJECTED",
    decisionReason: reason ?? null,
    decidedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const seedIds = new Set(seedRegistrations.map((item) => item.id));
  const records = [
    ...getRegistrations().filter(
      (item) => item.id !== updated.id && !seedIds.has(item.id),
    ),
    updated,
  ];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(registrationKey, JSON.stringify(records));
  memoryRegistrations = records;
  return updated;
}

export function mockProfiles(): UserProfileDto[] {
  const users = [
    ...allAccounts().map((account) => ({
      ...mockUser(account.id, account.label),
      sportsRoles: account.sportsRoles,
    })),
    ...getRegistrations().map((item) => item.user),
  ];
  return [
    ...new Map(
      users.map((user) => [
        user.id,
        savedProfile(user.id) ??
          signups().find((item) => item.profile.id === user.id)?.profile ?? {
            ...user,
            sportsPreferences: [],
            createdAt: "2026-10-01T12:00:00Z",
          },
      ]),
    ).values(),
  ];
}
