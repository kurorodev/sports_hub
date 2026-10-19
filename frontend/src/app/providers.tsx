import { createHttpCommentRepository } from "../entities/comment/api/http-comment-repository";
import { CommentRepositoryProvider } from "../entities/comment";
import type { CommentRepository } from "../entities/comment/model";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHttpRegistrationRepository } from "../entities/registration/api/http-registration-repository";
import { RegistrationRepositoryProvider } from "../entities/registration";
import type { RegistrationRepository } from "../entities/registration/model";
import { request } from "../shared/api/client";

const commentRepository = createHttpCommentRepository(request);

export function DiscussionServices({
  children,
  repository = commentRepository,
}: {
  children: ReactNode;
  repository?: CommentRepository;
}) {
  return (
    <CommentRepositoryProvider repository={repository}>
      {children}
    </CommentRepositoryProvider>
  );
}

const registrationRepository = createHttpRegistrationRepository(request);

/** Composition root: only this layer chooses a concrete repository for the React tree. */
export function RegistrationServices({
  children,
  repository = registrationRepository,
}: {
  children: ReactNode;
  repository?: RegistrationRepository;
}) {
  return (
    <RegistrationRepositoryProvider repository={repository}>
      {children}
    </RegistrationRepositoryProvider>
  );
}

export function ApplicationProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <DiscussionServices>
      <RegistrationServices>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </RegistrationServices>
    </DiscussionServices>
  );
}
