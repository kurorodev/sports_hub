import type {
  DemoAccount,
  EventPreview,
  Session,
} from "../shared/api/provisional";

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
export const events: EventPreview[] = [
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
