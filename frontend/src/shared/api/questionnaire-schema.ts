import { z } from "zod";
import type { QuestionnaireAnswers } from "./types";
import { citySchema } from "./city-schema";

export const questionnaireAnswersSchema = z
  .object({
    city: citySchema,
    sportsPreferences: z
      .array(
        z
          .object({
            sportId: z.string().uuid(),
            level: z.enum(["BEGINNER", "AMATEUR", "ADVANCED", "PROFESSIONAL"]),
          })
          .strict(),
      )
      .min(1)
      .max(10)
      .refine(
        (items) =>
          new Set(items.map((item) => item.sportId)).size === items.length,
      ),
    preferredTime: z.enum(["MORNING", "DAY", "EVENING", "ANY"]),
    age: z.number().int().min(1).max(120).nullable().optional(),
    timeZone: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("ru", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
  })
  .strict() satisfies z.ZodType<QuestionnaireAnswers>;
