import { createContext } from "react";
import type { ProfileRepository } from "../model";
export const ProfileRepositoryContext = createContext<ProfileRepository | null>(
  null,
);
