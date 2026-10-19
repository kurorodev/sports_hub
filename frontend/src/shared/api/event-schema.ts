import { z } from "zod";
import type { EventCreate } from "./types";

/** UI/mock validation aligned with EventCreate in the generated contract. Java validates independently. */
export const eventFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Название — от 3 символов")
    .max(160, "Название — до 160 символов"),
  description: z
    .string()
    .trim()
    .min(10, "Расскажите о встрече: минимум 10 символов")
    .max(5000, "Описание — до 5000 символов"),
  location: z.object({
    city: z.string().trim().min(1, "Укажите город").max(120),
    address: z.string().trim().min(1, "Укажите место встречи").max(300),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  }),
  skillLevel: z.enum([
    "ANY",
    "BEGINNER",
    "AMATEUR",
    "ADVANCED",
    "PROFESSIONAL",
  ]),
  eventKind: z.enum(["ACTIVITY", "COMPETITION"]),
  requirements: z
    .string()
    .max(2000, "Условия — до 2000 символов")
    .nullable()
    .optional(),
  joinMode: z.enum(["OPEN", "APPROVAL"]),
  maxParticipants: z
    .number({ error: "Укажите число участников" })
    .int("Нужно целое число")
    .min(2, "Минимум 2 участника")
    .max(10000, "Максимум 10000 участников"),
});
export const sportNameSchema = z
  .string()
  .trim()
  .min(2, "Название спорта — от 2 символов")
  .max(80, "Название спорта — до 80 символов");
export const eventDraftSchema = eventFieldsSchema
  .extend({
    sport: z.union([
      z.object({ sportId: z.uuid() }).strict(),
      z.object({ customName: sportNameSchema }).strict(),
    ]),
    startsAt: z.iso.datetime({
      offset: true,
      error: "Укажите дату, время и часовой пояс",
    }),
    endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    organizer: z.object({
      type: z.enum(["USER", "ORGANIZATION"]),
      id: z.uuid(),
    }),
    publishNow: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<EventCreate>;
export const createEventSchema = eventDraftSchema.superRefine(
  (value, context) => {
    if (Date.parse(value.startsAt) <= Date.now())
      context.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "Выберите будущую дату и время",
      });
    if (value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt))
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Окончание должно быть позже начала",
      });
    if (value.eventKind === "COMPETITION" && !value.endsAt)
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Для соревнования укажите время окончания",
      });
  },
);
export type CreateEventInput = EventCreate;
