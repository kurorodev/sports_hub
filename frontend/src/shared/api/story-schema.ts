import { z } from "zod";

export const storyCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Минимум 3 символа")
      .max(80, "Максимум 80 символов"),
    text: z.string().trim().max(1000, "Максимум 1000 символов"),
    imageData: z.string().max(2_800_000).nullable().optional(),
  })
  .strict();
