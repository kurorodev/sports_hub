import { z } from "zod";
import { request } from "./client";

const usersSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      nickname: z.string(),
      displayName: z.string(),
    }),
  )
  .max(8);
export async function searchUsers(prefix: string, signal?: AbortSignal) {
  const value = await request(
    `/users?nicknamePrefix=${encodeURIComponent(prefix)}`,
    { signal },
  );
  return usersSchema.parse(value);
}
