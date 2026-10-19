import { createContext } from "react";
import type { ModerationRepository } from "../model";
export const ModerationRepositoryContext =
  createContext<ModerationRepository | null>(null);
