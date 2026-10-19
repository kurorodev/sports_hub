import { z } from "zod";
import {
  eventFieldsSchema,
  sportNameSchema,
  type CreateEventInput,
} from "../../../shared/api/event-schema";

export const customSportValue = "__custom__";
export const timezoneOffsets = Array.from(
  { length: 11 },
  (_, index) => `+${String(index + 2).padStart(2, "0")}:00`,
);

export const eventFormSchema = eventFieldsSchema
  .omit({ maxParticipants: true })
  .extend({
    organizerChoice: z.string().min(1, "Выберите организатора"),
    capacity: eventFieldsSchema.shape.maxParticipants,
    sportChoice: z.string().min(1, "Выберите вид спорта"),
    customSportName: z.string(),
    date: z.iso.date({ error: "Укажите корректную дату" }),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Укажите время"),
    timezoneOffset: z.enum(timezoneOffsets as [string, ...string[]]),
  })
  .superRefine((values, context) => {
    if (values.sportChoice === customSportValue) {
      const result = sportNameSchema.safeParse(values.customSportName);
      if (!result.success)
        context.addIssue({
          code: "custom",
          path: ["customSportName"],
          message: result.error.issues[0].message,
        });
    }
    const startsAt = `${values.date}T${values.time}:00${values.timezoneOffset}`;
    if (
      Number.isFinite(Date.parse(startsAt)) &&
      Date.parse(startsAt) <= Date.now()
    ) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Выберите будущую дату и время",
      });
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export function toEventInput(
  values: EventFormValues,
  organizerId: string,
): CreateEventInput {
  return {
    title: values.title,
    description: values.description,
    requirements: values.requirements?.trim() || null,
    location: values.location,
    skillLevel: values.skillLevel,
    eventKind: values.eventKind,
    joinMode: values.joinMode,
    maxParticipants: values.capacity,
    organizer:
      values.organizerChoice === "__personal__"
        ? { type: "USER", id: organizerId }
        : { type: "ORGANIZATION", id: values.organizerChoice },
    publishNow: true,
    startsAt: `${values.date}T${values.time}:00${values.timezoneOffset}`,
    sport:
      values.sportChoice === customSportValue
        ? { customName: values.customSportName.trim() }
        : { sportId: values.sportChoice },
  };
}

export const serverFieldNames: Record<
  string,
  | keyof EventFormValues
  | "location.city"
  | "location.address"
  | "location.latitude"
  | "location.longitude"
> = {
  title: "title",
  description: "description",
  requirements: "requirements",
  "sport.sportId": "sportChoice",
  "sport.customName": "customSportName",
  sport: "sportChoice",
  customSportName: "customSportName",
  startsAt: "date",
  "location.city": "location.city",
  "location.address": "location.address",
  "location.latitude": "location.latitude",
  "location.longitude": "location.longitude",
  skillLevel: "skillLevel",
  eventKind: "eventKind",
  joinMode: "joinMode",
  maxParticipants: "capacity",
};
