import { createContext } from "react";
import type { OrganizationRepository } from "../model";
export const OrganizationRepositoryContext =
  createContext<OrganizationRepository | null>(null);
