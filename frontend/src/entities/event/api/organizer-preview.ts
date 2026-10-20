import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { request } from "../../../shared/api/client";
import { isUuid } from "../../../shared/lib/identifiers";
import type { EventCardDto } from "../../../shared/api/types";

export type Organizer = EventCardDto["organizer"];
const contactSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
});
const userSchema = contactSchema.extend({
  bio: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
});
const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  createdBy: contactSchema,
});

export const organizerPreviewQuery = (organizer: Organizer) =>
  queryOptions({
    queryKey: ["organizer-preview", organizer.type, organizer.id],
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!isUuid(organizer.id)) throw new Error("Invalid organizer ID");
      if (organizer.type === "USER") {
        const user = userSchema.parse(
          await request(`/users/${organizer.id}`, { signal }),
        );
        if (user.id !== organizer.id) throw new Error("Unexpected organizer");
        return {
          name: user.displayName,
          about: user.bio,
          city: user.city,
          contact: user,
        };
      }
      const organization = organizationSchema.parse(
        await request(`/organizations/${organizer.id}`, { signal }),
      );
      if (organization.id !== organizer.id)
        throw new Error("Unexpected organizer");
      // У организации нет ника; упоминание адресуем её представителю.
      return {
        name: organization.name,
        about: organization.description,
        city: null,
        contact: organization.createdBy,
      };
    },
  });
