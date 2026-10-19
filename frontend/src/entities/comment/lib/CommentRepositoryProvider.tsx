import type { ReactNode } from "react";
import type { CommentRepository } from "../model";
import { CommentRepositoryContext } from "./repository-context";
export function CommentRepositoryProvider({
  repository,
  children,
}: {
  repository: CommentRepository;
  children: ReactNode;
}) {
  return (
    <CommentRepositoryContext.Provider value={repository}>
      {children}
    </CommentRepositoryContext.Provider>
  );
}
