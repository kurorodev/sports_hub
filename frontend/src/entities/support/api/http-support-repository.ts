import { z } from "zod";
import {
  categories,
  statuses,
  priorities,
  reportReasons,
  type SupportRepository,
} from "../model";
import type { HttpClient } from "../../../shared/api/client";
const person = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  nickname: z.string(),
});
const ticket = z.object({
  id: z.string().uuid(),
  author: person,
  assignedTo: person.nullable(),
  category: z.enum(categories),
  status: z.enum(statuses),
  priority: z.enum(priorities),
  title: z.string(),
  description: z.string(),
  commentId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  commentText: z.string().nullable(),
  commentAuthor: z.string().nullable(),
  reportReason: z.enum(reportReasons).nullable(),
  venueCity: z.string().nullable(),
  venueAddress: z.string().nullable(),
  venueLatitude: z.number().min(-90).max(90).nullish(),
  venueLongitude: z.number().min(-180).max(180).nullish(),
  publishedVenueId: z.string().uuid().nullish(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
const message = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  author: person,
  fromSupport: z.boolean(),
  kind: z.enum(["MESSAGE", "STATUS"]),
  text: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});
const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });
function path(id: string) {
  return `/support/tickets/${z.uuid().parse(id)}`;
}
export function createHttpSupportRepository(
  http: HttpClient,
): SupportRepository {
  return {
    async publishVenue(id, input) {
      const result = ticket.parse(
        await http(`${path(id)}/venue`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
      if (result.id !== id || !result.publishedVenueId)
        throw new Error("Unexpected published venue");
      return result;
    },
    async list(queue, filters, signal) {
      const params = new URLSearchParams({
        page: String(filters.page),
        size: "20",
      });
      if (filters.q) params.set("q", filters.q);
      if (filters.status) params.set("status", filters.status);
      if (filters.category) params.set("category", filters.category);
      return page(ticket).parse(
        await http(`${queue ? "/admin" : ""}/support/tickets?${params}`, {
          signal,
        }),
      );
    },
    async get(id, signal) {
      const result = ticket.parse(await http(path(id), { signal }));
      if (result.id !== id) throw new Error("Unexpected support ticket");
      return result;
    },
    async create(input) {
      return ticket.parse(
        await http("/support/tickets", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
    },
    async messages(id, index, signal) {
      const result = page(message).parse(
        await http(`${path(id)}/messages?page=${index}&size=20`, { signal }),
      );
      if (result.items.some((item) => item.ticketId !== id))
        throw new Error("Unexpected support thread");
      return result;
    },
    async reply(id, text) {
      const result = message.parse(
        await http(`${path(id)}/messages`, {
          method: "POST",
          body: JSON.stringify({ text }),
        }),
      );
      if (result.ticketId !== id) throw new Error("Unexpected support thread");
      return result;
    },
    async update(id, input) {
      const result = ticket.parse(
        await http(path(id), { method: "PATCH", body: JSON.stringify(input) }),
      );
      if (result.id !== id) throw new Error("Unexpected support ticket");
      return result;
    },
  };
}
