import { z } from "zod";

/** Temporary S1 mock payload/constraints, pending shared OpenAPI review. */
export const eventFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Название — от 3 символов")
    .max(120, "Название — до 120 символов"),
  description: z
    .string()
    .trim()
    .min(20, "Расскажите о встрече: минимум 20 символов")
    .max(3000, "Описание — до 3000 символов"),
  location: z.object({
    city: z
      .string()
      .trim()
      .min(2, "Укажите город")
      .max(80, "Город — до 80 символов"),
    address: z
      .string()
      .trim()
      .min(3, "Укажите место встречи")
      .max(200, "Место — до 200 символов"),
  }),
  skillLevel: z.enum(["Любой уровень", "Начинающий", "Средний"]),
  eventKind: z.enum(["MEETUP", "TRAINING"]),
  joinMode: z.enum(["OPEN", "APPROVAL"]),
  capacity: z
    .number({ error: "Укажите число участников" })
    .int("Нужно целое число")
    .min(2, "Минимум 2 участника")
    .max(1000, "Максимум 1000 участников"),
});

// This schema also validates persisted mock records, including events that are now in the past.
export const eventDraftSchema = eventFieldsSchema
  .extend({
    sportId: z.string().min(1).optional(),
    customSportName: z
      .string()
      .trim()
      .min(2, "Название спорта — от 2 символов")
      .max(60, "Название спорта — до 60 символов")
      .optional(),
    startsAt: z.iso.datetime({
      offset: true,
      error: "Укажите дату, время и часовой пояс",
    }),
  })
  .superRefine((value, context) => {
    if (Boolean(value.sportId) === Boolean(value.customSportName)) {
      context.addIssue({
        code: "custom",
        path: ["sportId"],
        message: "Выберите спорт или укажите новый",
      });
    }
  });

export const createEventSchema = eventDraftSchema.refine(
  (value) => Date.parse(value.startsAt) > Date.now(),
  { path: ["startsAt"], message: "Выберите будущую дату и время" },
);

export type CreateEventInput = z.infer<typeof createEventSchema>;
