import { z } from "zod";
import { ApiError, type HttpClient } from "../../../shared/api/client";
import type {
  OrganizationDto,
  OrganizationCreate,
  OrganizationDecisionRequest,
  PagedOrganizationsDto,
} from "../../../shared/api/types";
import {
  OrganizationFailure,
  type OrganizationRepository,
  type Organization,
  type OrganizationFailureCode,
} from "../model";
export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  sports: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      isCustom: z.boolean(),
    }),
  ),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  createdBy: z.object({
    id: z.string().uuid(),
    displayName: z.string().min(1),
    nickname: z.string(),
    sportsRoles: z.array(
      z.enum(["ATHLETE", "COACH", "REFEREE", "SPORTS_ORGANIZER"]),
    ),
    rank: z.enum(["ROOKIE", "ACTIVE", "EXPERIENCED", "ELITE"]),
    ratingPoints: z.number().int().nonnegative(),
  }),
  decisionReason: z.string().nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable().optional(),
}) satisfies z.ZodType<OrganizationDto>;
const pageSchema = z.object({
  items: z.array(organizationSchema),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
}) satisfies z.ZodType<PagedOrganizationsDto>;
function model(dto: z.infer<typeof organizationSchema>): Organization {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    sports: dto.sports.map(({ id, name }) => ({ id, name })),
    status: dto.status,
    representative: {
      id: dto.createdBy.id,
      displayName: dto.createdBy.displayName,
    },
    decisionReason: dto.decisionReason,
    submittedAt: dto.createdAt,
    decidedAt: dto.decidedAt,
  };
}
function read(value: unknown) {
  const parsed = organizationSchema.safeParse(value);
  if (!parsed.success)
    throw new OrganizationFailure("invalid-response", { cause: parsed.error });
  return model(parsed.data);
}
async function translate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      throw error;
    if (error instanceof OrganizationFailure) throw error;
    const codes: Record<number, OrganizationFailureCode> = {
      0: "network",
      400: "invalid-input",
      401: "unauthenticated",
      403: "forbidden",
      404: "not-found",
      409: "conflict",
      422: "invalid-input",
    };
    throw new OrganizationFailure(
      error instanceof ApiError
        ? (codes[error.status] ??
            (error.status >= 500 ? "unavailable" : "unknown"))
        : "unknown",
      { cause: error },
    );
  }
}
export function createHttpOrganizationRepository(
  http: HttpClient,
): OrganizationRepository {
  return {
    list: (filter, signal) =>
      translate(async () => {
        const params = new URLSearchParams({
          q: filter.q,
          page: String(filter.page),
          size: "6",
        });
        if (filter.admin && filter.status) params.set("status", filter.status);
        const parsed = pageSchema.safeParse(
          await http(
            `${filter.admin ? "/admin" : ""}/organizations?${params}`,
            { signal },
          ),
        );
        if (!parsed.success || parsed.data.page !== filter.page)
          throw new OrganizationFailure("invalid-response");
        return {
          organizations: parsed.data.items.map(model),
          pageIndex: parsed.data.page,
          pageSize: parsed.data.size,
          totalCount: parsed.data.total,
        };
      }),
    mine: (signal) =>
      translate(async () => {
        const parsed = z
          .array(organizationSchema)
          .safeParse(await http("/me/organizations", { signal }));
        if (!parsed.success) throw new OrganizationFailure("invalid-response");
        return parsed.data.map(model);
      }),
    find: (id, signal) =>
      translate(async () => {
        const result = read(
          await http(`/organizations/${encodeURIComponent(id)}`, { signal }),
        );
        if (result.id !== id) throw new OrganizationFailure("invalid-response");
        return result;
      }),
    apply: (input) =>
      translate(async () => {
        const body: OrganizationCreate = {
          name: input.name,
          description: input.description,
          sports: input.sportIds,
        };
        return read(
          await http("/organizations", {
            method: "POST",
            body: JSON.stringify(body),
          }),
        );
      }),
    decide: (id, decision) =>
      translate(async () => {
        const body: OrganizationDecisionRequest =
          decision.outcome === "approve"
            ? { decision: "APPROVE" }
            : { decision: "REJECT", reason: decision.reason };
        return read(
          await http(
            `/admin/organizations/${encodeURIComponent(id)}/decision`,
            { method: "POST", body: JSON.stringify(body) },
          ),
        );
      }),
  };
}
