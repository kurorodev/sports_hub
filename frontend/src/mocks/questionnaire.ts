import { rankRecommendations } from "./recommendation-ranking";
import { http, HttpResponse } from "msw";
import type {
  Session,
  Questionnaire,
  RecommendedEvents,
} from "../shared/api/types";
import { questionnaireAnswersSchema } from "../shared/api/questionnaire-schema";
import { getEvents, getSports } from "./database";
import { saveProfile } from "./profiles";

const key = "sport.mock.questionnaires.v1";
let memory: Record<string, Questionnaire> = {};
function read(): typeof memory {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved ? (JSON.parse(saved) as typeof memory) : memory;
}
function store(userId: string, value: Questionnaire) {
  memory = { ...read(), [userId]: value };
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
  return value;
}
export function resetMockQuestionnaires() {
  memory = {};
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
function state(session: Session): Questionnaire {
  const previous = read()[session.user.id];
  return {
    status:
      previous?.status ??
      (session.csrfToken.startsWith("mock-csrf-signup-")
        ? "PENDING"
        : "SKIPPED"),
    completedAt: previous?.completedAt ?? null,
    age: previous?.age ?? null,
    city: session.user.city ?? null,
    sportsPreferences: session.user.sportsPreferences,
    preferredTime: session.user.preferredTime ?? null,
    timeZone: previous?.timeZone ?? "UTC",
  };
}
const failure = (status: number, code: string, message: string) =>
  HttpResponse.json(
    { code, message, details: [], requestId: crypto.randomUUID() },
    { status },
  );

export function questionnaireHandlers(
  api: string,
  session: () => Session | undefined,
) {
  return [
    http.get(`${api}/me/questionnaire`, () => {
      const user = session();
      return user
        ? HttpResponse.json(state(user))
        : failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
    }),
    http.post(`${api}/me/questionnaire`, async ({ request }) => {
      const user = session();
      if (!user) return failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      if (user.systemRoles.includes("ADMIN"))
        return failure(403, "FORBIDDEN", "Действие недоступно администратору");
      if (request.headers.get("X-CSRF-Token") !== user.csrfToken)
        return failure(403, "FORBIDDEN", "Неверный CSRF токен");
      const parsed = questionnaireAnswersSchema.safeParse(await request.json());
      if (!parsed.success)
        return failure(400, "VALIDATION_ERROR", "Проверьте ответы анкеты");
      const answers = parsed.data;
      if (
        answers.sportsPreferences.some(
          (item) => !getSports().some((sport) => sport.id === item.sportId),
        )
      )
        return failure(404, "NOT_FOUND", "Вид спорта не найден");
      saveProfile({
        ...user.user,
        city: answers.city,
        sportsPreferences: answers.sportsPreferences,
        preferredTime: answers.preferredTime,
      });
      return HttpResponse.json(
        store(user.user.id, {
          ...answers,
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
        }),
      );
    }),
    http.post(`${api}/me/questionnaire/skip`, ({ request }) => {
      const user = session();
      if (!user) return failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      if (request.headers.get("X-CSRF-Token") !== user.csrfToken)
        return failure(403, "FORBIDDEN", "Неверный CSRF токен");
      const current = state(user);
      return HttpResponse.json(
        store(user.user.id, {
          ...current,
          status: current.status === "COMPLETED" ? "COMPLETED" : "SKIPPED",
        }),
      );
    }),
    http.get(`${api}/events/recommended`, ({ request }) => {
      const user = session();
      if (!user) return failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      const params = new URL(request.url).searchParams;
      const city = params.get("city") ?? user.user.city;
      const questionnaire = state(user);
      if (user.systemRoles.includes("ADMIN"))
        return failure(403, "FORBIDDEN", "Действие недоступно администратору");
      const items = rankRecommendations(
        getEvents(user.user.id),
        getSports(),
        questionnaire,
        {
          city: city ?? "",
          includeOtherCities: params.get("includeOtherCities") === "true",
          includeOtherSports: params.get("includeOtherSports") === "true",
          now: Date.now(),
        },
      );
      const page = Math.max(0, Number(params.get("page")) || 0);
      const size = Math.min(100, Math.max(1, Number(params.get("size")) || 20));
      return HttpResponse.json({
        items: items.slice(page * size, (page + 1) * size),
        page,
        size,
        total: items.length,
        totalPages: Math.ceil(items.length / size),
      } satisfies RecommendedEvents);
    }),
  ];
}
