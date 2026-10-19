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

export const handleSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(
    z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{3,40}$/,
        "Никнейм: 3–40 латинских букв, цифр, _ или -",
      ),
  );
export const passwordSignupSchema = z
  .object({
    nickname: handleSchema,
    displayName: signupSchema.shape.displayName,
    password: z
      .string()
      .min(8, "Пароль — от 8 символов")
      .max(128, "Пароль — до 128 символов")
      .refine((v) => v.trim().length > 0, "Укажите пароль"),
  })
  .strict();
