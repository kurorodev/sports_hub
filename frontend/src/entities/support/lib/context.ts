import { createContext } from "react";
import type { SupportRepository } from "../model";
export const SupportContext = createContext<SupportRepository | null>(null);
