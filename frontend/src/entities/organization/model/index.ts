export type OrganizationStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface Organization {
  id: string;
  name: string;
  description: string;
  sports: { id: string; name: string }[];
  status: OrganizationStatus;
  representative: { id: string; displayName: string };
  decisionReason?: string | null;
  submittedAt: string;
  decidedAt?: string | null;
}
export interface OrganizationPage {
  organizations: Organization[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
}
export interface OrganizationApplication {
  name: string;
  description: string;
  sportIds: string[];
}
export type OrganizationDecision =
  { outcome: "approve" } | { outcome: "reject"; reason: string };
export interface OrganizationRepository {
  list(
    filter: {
      q: string;
      page: number;
      admin?: boolean;
      status?: OrganizationStatus;
    },
    signal?: AbortSignal,
  ): Promise<OrganizationPage>;
  mine(signal?: AbortSignal): Promise<Organization[]>;
  find(id: string, signal?: AbortSignal): Promise<Organization>;
  apply(input: OrganizationApplication): Promise<Organization>;
  decide(id: string, decision: OrganizationDecision): Promise<Organization>;
}
export type OrganizationFailureCode =
  | "network"
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "invalid-input"
  | "invalid-response"
  | "unavailable"
  | "unknown";
export class OrganizationFailure extends Error {
  constructor(
    public readonly code: OrganizationFailureCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "OrganizationFailure";
  }
}
