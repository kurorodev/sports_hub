import { http, HttpResponse } from "msw";
import { z } from "zod";
import type { Session, Sport } from "../shared/api/types";

const key = "sport.mock.sports.v1";
const schema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(80),
    isCustom: z.boolean(),
    registryCode: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    imageData: z.string().nullable().optional(),
  }),
);
let memory: z.infer<typeof schema> = [];
function read() {
  const saved = localStorage.getItem(key);
  return saved ? schema.parse(JSON.parse(saved)) : memory;
}
export function resetMockSports() {
  memory = [];
  localStorage.removeItem(key);
}
export function sportOverrides(base: Sport[]): Sport[] {
  const records = new Map(base.map((s) => [s.id, s]));
  for (const s of read())
    records.set(s.id, {
      id: s.id,
      name: s.name,
      isCustom: s.isCustom,
      registryCode: s.registryCode,
      imageUrl: s.imageUrl,
    });
  return [...records.values()].sort(
    (a, b) =>
      Number(a.isCustom) - Number(b.isCustom) ||
      a.name.localeCompare(b.name, "ru"),
  );
}
export function sportHandlers(
  api: string,
  session: () => Session | undefined,
  sports: () => Sport[],
) {
  const write = async (request: Request, id?: string) => {
    const user = session();
    if (!user)
      return HttpResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    if (
      !user.systemRoles.includes("ADMIN") ||
      request.headers.get("X-CSRF-Token") !== user.csrfToken
    )
      return HttpResponse.json({ code: "FORBIDDEN" }, { status: 403 });
    const input = (await request.json()) as {
      name?: string;
      imageData?: string | null;
    };
    const existing = id ? sports().find((s) => s.id === id) : undefined;
    if (id && !existing)
      return HttpResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    const name = (existing?.name ?? input.name ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80)
      return HttpResponse.json({ code: "VALIDATION_ERROR" }, { status: 400 });
    if (
      !id &&
      sports().some(
        (s) =>
          s.name.toLocaleLowerCase("ru").replaceAll("ё", "е") ===
          name.toLocaleLowerCase("ru").replaceAll("ё", "е"),
      )
    )
      return HttpResponse.json(
        { code: "CONFLICT", message: "Такой вид спорта уже существует" },
        { status: 409 },
      );
    const image = input.imageData ?? null;
    try {
      if (
        image &&
        (!/^data:image\/(png|jpeg);base64,/.test(image) ||
          atob(image.split(",")[1]).length > 2 * 1024 * 1024)
      )
        throw new Error();
    } catch {
      return HttpResponse.json({ code: "VALIDATION_ERROR" }, { status: 400 });
    }
    const sportId = id ?? crypto.randomUUID();
    const sport: Sport = {
      ...existing,
      id: sportId,
      name,
      isCustom: existing?.isCustom ?? false,
      registryCode: existing?.registryCode ?? null,
      imageUrl: image ? `${api}/sports/${sportId}/image?v=${Date.now()}` : null,
    };
    memory = [
      ...read().filter((s) => s.id !== sportId),
      { ...sport, imageData: image },
    ];
    localStorage.setItem(key, JSON.stringify(memory));
    return HttpResponse.json(sport, { status: id ? 200 : 201 });
  };
  return [
    http.post(`${api}/admin/sports`, ({ request }) => write(request)),
    http.put(`${api}/admin/sports/:sportId/image`, ({ request, params }) =>
      write(request, String(params.sportId)),
    ),
    http.get(`${api}/sports/:sportId/image`, ({ params }) => {
      const image = read().find((s) => s.id === params.sportId)?.imageData;
      if (!image) return new HttpResponse(null, { status: 404 });
      const bytes = Uint8Array.from(atob(image.split(",")[1]), (s) =>
        s.charCodeAt(0),
      );
      return new HttpResponse(bytes, {
        headers: {
          "Content-Type": image.startsWith("data:image/png")
            ? "image/png"
            : "image/jpeg",
        },
      });
    }),
  ];
}
