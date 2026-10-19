import { z } from "zod";
import {
  eventFieldsSchema,
  createEventSchema,
  type CreateEventInput,
} from "../../shared/api/provisional-event-schema";

export const customSportValue = "__custom__";
export const timezoneOffsets = Array.from(
  { length: 11 },
  (_, index) => `+${String(index + 2).padStart(2, "0")}:00`,
);

export const eventFormSchema = eventFieldsSchema
  .extend({
    sportChoice: z.string().min(1, "Выберите вид спорта"),
    customSportName: z.string(),
    date: z.iso.date({ error: "Укажите корректную дату" }),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Укажите время"),
    timezoneOffset: z.enum(timezoneOffsets as [string, ...string[]]),
  })
  .superRefine((values, context) => {
    if (values.sportChoice === customSportValue) {
      const result = createEventSchema.shape.customSportName.safeParse(
        values.customSportName,
      );
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

export function toEventInput(values: EventFormValues): CreateEventInput {
  return createEventSchema.parse({
    title: values.title,
    description: values.description,
    location: values.location,
    skillLevel: values.skillLevel,
    eventKind: values.eventKind,
    joinMode: values.joinMode,
    capacity: values.capacity,
    startsAt: `${values.date}T${values.time}:00${values.timezoneOffset}`,
    ...(values.sportChoice === customSportValue
      ? { customSportName: values.customSportName }
      : { sportId: values.sportChoice }),
  });
}

export const serverFieldNames: Record<
  string,
  keyof EventFormValues | "location.city" | "location.address"
> = {
  title: "title",
  description: "description",
  sportId: "sportChoice",
  customSportName: "customSportName",
  startsAt: "date",
  "location.city": "location.city",
  "location.address": "location.address",
  skillLevel: "skillLevel",
  eventKind: "eventKind",
  joinMode: "joinMode",
  capacity: "capacity",
};
