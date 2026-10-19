import { refreshMockUser } from "./profiles";
import { z } from "zod";
import type {
  OrganizationDto,
  OrganizationCreate,
  PublicUser,
} from "../shared/api/types";
import { organizationSchema } from "../entities/organization/api/http-organization-repository";
import { mockId, mockUser, getSports } from "./database";
const key = "dvizh.mock.organizations.v1";
let memory: OrganizationDto[] = [];
function seed(): OrganizationDto {
  return {
    id: mockId("org-temp"),
    name: "Беговой клуб «Темп»",
    description:
      "Открытый клуб для совместных пробежек и знакомства со спортом.",
    sports: [{ id: mockId("running"), name: "Легкая атлетика", isCustom: false }],
    status: "APPROVED",
    createdBy: mockUser("org-run", "Беговой клуб «Темп»"),
    createdAt: "2026-10-01T12:00:00Z",
    decidedAt: "2026-10-02T12:00:00Z",
  };
}
export function getOrganizations(): OrganizationDto[] {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return [
    seed(),
    ...(saved === null
      ? memory
      : z.array(organizationSchema).parse(JSON.parse(saved))),
  ].map((item) => ({ ...item, createdBy: refreshMockUser(item.createdBy) }));
}
function persist(items: OrganizationDto[]) {
  memory = items.filter((item) => item.id !== mockId("org-temp"));
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
}
export function saveOrganization(
  input: OrganizationCreate,
  author: PublicUser,
): OrganizationDto {
  const result: OrganizationDto = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description.trim(),
    sports: getSports().filter((item) => input.sports?.includes(item.id)),
    createdBy: author,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  persist([...getOrganizations(), result]);
  return result;
}
export function decideOrganization(
  organization: OrganizationDto,
  decision: "APPROVE" | "REJECT",
  reason?: string | null,
): OrganizationDto {
  const updated: OrganizationDto = {
    ...organization,
    status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
    decisionReason: reason ?? null,
    decidedAt: new Date().toISOString(),
  };
  persist([
    ...getOrganizations().filter((item) => item.id !== updated.id),
    updated,
  ]);
  return updated;
}
export function resetMockOrganizations() {
  memory = [];
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
