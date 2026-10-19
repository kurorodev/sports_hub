import { z } from "zod";
const key = "dvizh.mock.moderation.v1";
const record = z.object({
  kind: z.enum(["EVENT", "COMMENT"]),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(1000),
  actorId: z.string().uuid(),
  at: z.iso.datetime({ offset: true }),
});
type Record = z.infer<typeof record>;
let memory: Record[] = [];
export function getModerationRecords(): Record[] {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved === null ? memory : z.array(record).parse(JSON.parse(saved));
}
export function saveModeration(
  kind: Record["kind"],
  targetId: string,
  reason: string,
  actorId: string,
) {
  memory = [
    ...getModerationRecords(),
    { kind, targetId, reason, actorId, at: new Date().toISOString() },
  ];
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
}
export function resetMockModeration() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
