import { createContext } from "react";
import type { CommentRepository } from "../model";
export const CommentRepositoryContext = createContext<CommentRepository | null>(
  null,
);
