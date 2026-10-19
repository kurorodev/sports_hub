import { z } from "zod";
import type { DemoRegistrationRequest } from "./types";

export const signupSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(3, "Никнейм — от 3 символов")
      .max(40, "Никнейм — до 40 символов"),
    displayName: z
      .string()
      .trim()
      .min(1, "Укажите имя")
      .max(100, "Имя — до 100 символов"),
  })
  .strict() satisfies z.ZodType<DemoRegistrationRequest>;
