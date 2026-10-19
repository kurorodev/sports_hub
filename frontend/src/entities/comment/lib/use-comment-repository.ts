import { useContext } from "react";
import { CommentRepositoryContext } from "./repository-context";
export function useCommentRepository() {
  const repository = useContext(CommentRepositoryContext);
  if (!repository) throw new Error("CommentRepositoryProvider is required");
  return repository;
}
