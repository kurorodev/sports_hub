import {
  OrganizationFailure,
  type OrganizationDecision,
  type OrganizationRepository,
} from "../../../entities/organization/model";
export async function reviewOrganization(
  repository: OrganizationRepository,
  id: string,
  decision: OrganizationDecision,
) {
  if (
    decision.outcome === "reject" &&
    (decision.reason.trim().length < 3 || decision.reason.trim().length > 1000)
  )
    throw new OrganizationFailure("invalid-input");
  const normalized: OrganizationDecision =
    decision.outcome === "reject"
      ? { outcome: "reject", reason: decision.reason.trim() }
      : decision;
  const result = await repository.decide(id, normalized);
  if (
    result.id !== id ||
    result.status !==
      (decision.outcome === "approve" ? "APPROVED" : "REJECTED") ||
    (normalized.outcome === "reject" &&
      result.decisionReason !== normalized.reason)
  )
    throw new OrganizationFailure("invalid-response");
  return result;
}
