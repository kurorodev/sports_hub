import { createContext } from "react";
import type { RegistrationRepository } from "../model";

export const RegistrationRepositoryContext =
  createContext<RegistrationRepository | null>(null);
