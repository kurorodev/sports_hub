import { http, HttpResponse } from "msw";
import type { Session, Story, StoryFeed } from "../shared/api/types";
import { storyCreateSchema } from "../shared/api/story-schema";

type SavedStory = {
  story: Omit<Story, "readAt">;
  imageData: string | null;
  deleted: boolean;
  views: Record<string, string>;
};
const key = "sport.mock.stories.v1";
let memory: SavedStory[] = [];
function read(): SavedStory[] {
  try {
    return typeof localStorage !== "undefined"
      ? (JSON.parse(localStorage.getItem(key) ?? "[]") as SavedStory[])
      : memory;
  } catch {
    return memory;
  }
}
function save(records: SavedStory[]) {
  for (const item of records) if (!active(item)) item.imageData = null;
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(records));
  memory = records;
}
export function resetMockStories() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
const failure = (status: number, code: string, message: string) =>
  HttpResponse.json(
    { code, message, details: [], requestId: crypto.randomUUID() },
    { status },
  );
const active = (item: SavedStory) =>
  !item.deleted &&
  Date.parse(item.story.createdAt) <= Date.now() &&
  Date.parse(item.story.expiresAt) > Date.now();
const dto = (item: SavedStory, user: string): Story => ({
  ...item.story,
  readAt: item.views[user] ?? null,
});

export function storyHandlers(api: string, session: () => Session | undefined) {
  function authorize(request: Request, admin: boolean) {
    const user = session();
    if (!user) return failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
    if (admin && !user.systemRoles.includes("ADMIN"))
      return failure(403, "FORBIDDEN", "Нет доступа");
    if (request.headers.get("X-CSRF-Token") !== user.csrfToken)
      return failure(403, "FORBIDDEN", "Неверный CSRF токен");
    return user;
  }
  return [
    http.get(`${api}/stories`, () => {
      const user = session();
      if (!user) return failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      return HttpResponse.json(
        {
          items: read()
            .filter(active)
            .sort(
              (a, b) =>
                b.story.createdAt.localeCompare(a.story.createdAt) ||
                b.story.id.localeCompare(a.story.id),
            )
            .map((item) => dto(item, user.user.id)),
          asOf: new Date().toISOString(),
        } satisfies StoryFeed,
        { headers: { "Cache-Control": "no-store" } },
      );
    }),
    http.post(`${api}/admin/stories`, async ({ request }) => {
      const user = authorize(request, true);
      if (user instanceof Response) return user;
      const parsed = storyCreateSchema.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success)
        return failure(
          400,
          "VALIDATION_ERROR",
          "Проверьте заголовок, текст и изображение",
        );
      const input = parsed.data;
      if (input.imageData != null) {
        try {
          const match =
            /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
              input.imageData,
            );
          if (!match) throw new Error();
          const bytes = atob(match[2]);
          if (
            !bytes.length ||
            bytes.length > 2 * 1024 * 1024 ||
            !(
              bytes.startsWith("\x89PNG\r\n\x1a\n") ||
              bytes.startsWith("\xff\xd8\xff")
            )
          )
            throw new Error();
        } catch {
          return failure(
            400,
            "VALIDATION_ERROR",
            "Выберите PNG или JPEG до 2 МБ",
          );
        }
      }
      const now = Date.now();
      const id = crypto.randomUUID();
      const item: SavedStory = {
        story: {
          id,
          title: input.title,
          text: input.text,
          imageUrl: input.imageData ? `/api/v1/stories/${id}/image` : null,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        },
        imageData: input.imageData ?? null,
        deleted: false,
        views: {},
      };
      try {
        save([...read(), item]);
      } catch {
        return failure(
          400,
          "VALIDATION_ERROR",
          "Хранилище браузера заполнено. Удалите старые сторис или выберите меньшее изображение.",
        );
      }
      return HttpResponse.json(dto(item, user.user.id), { status: 201 });
    }),
    http.delete(`${api}/admin/stories/:storyId`, ({ request, params }) => {
      const user = authorize(request, true);
      if (user instanceof Response) return user;
      const records = read();
      const item = records.find((entry) => entry.story.id === params.storyId);
      if (!item) return failure(404, "NOT_FOUND", "Сторис не найдена");
      item.deleted = true;
      item.imageData = null;
      try {
        save(records);
      } catch {
        return failure(
          400,
          "VALIDATION_ERROR",
          "Не удалось сохранить изменения",
        );
      }
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${api}/stories/:storyId/view`, ({ request, params }) => {
      const user = authorize(request, false);
      if (user instanceof Response) return user;
      const records = read();
      const item = records.find((entry) => entry.story.id === params.storyId);
      if (!item || !active(item))
        return failure(404, "NOT_FOUND", "Сторис недоступна");
      item.views[user.user.id] ??= new Date().toISOString();
      try {
        save(records);
      } catch {
        return failure(
          400,
          "VALIDATION_ERROR",
          "Не удалось сохранить просмотр",
        );
      }
      return HttpResponse.json(dto(item, user.user.id));
    }),
    http.get(`${api}/stories/:storyId/image`, ({ params }) => {
      if (!session())
        return failure(401, "UNAUTHENTICATED", "Войдите в аккаунт");
      const item = read().find((entry) => entry.story.id === params.storyId);
      if (!item || !active(item) || !item.imageData)
        return failure(404, "NOT_FOUND", "Сторис недоступна");
      const [header, body] = item.imageData.split(",");
      const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
      return new HttpResponse(bytes, {
        headers: {
          "Content-Type": header.includes("png") ? "image/png" : "image/jpeg",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }),
  ];
}
