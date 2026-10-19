import {
  OrganizationFailure,
  type OrganizationApplication,
  type OrganizationRepository,
} from "../../../entities/organization/model";
export async function applyOrganization(
  repository: OrganizationRepository,
  input: OrganizationApplication,
  viewerId: string,
) {
  const name = input.name.trim(),
    description = input.description.trim();
  if (
    name.length < 2 ||
    name.length > 160 ||
    description.length < 10 ||
    description.length > 2000
  )
    throw new OrganizationFailure("invalid-input");
  const result = await repository.apply({
    ...input,
    name,
    description,
    sportIds: [...new Set(input.sportIds)],
  });
  if (
    result.status !== "PENDING" ||
    result.representative.id !== viewerId ||
    result.name !== name ||
    result.description !== description
  )
    throw new OrganizationFailure("invalid-response");
  return result;
}
