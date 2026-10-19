import { createHttpNotificationRepository } from "../entities/notification/api/http-notification-repository";
import { NotificationRepositoryProvider } from "../entities/notification";
import { createHttpProfileRepository } from "../entities/profile/api/http-profile-repository";
import { ProfileRepositoryProvider } from "../entities/profile";
import type { ProfileRepository } from "../entities/profile/model";
import { createHttpModerationRepository } from "../entities/moderation/api/http-moderation-repository";
import { ModerationRepositoryProvider } from "../entities/moderation";
import type { ModerationRepository } from "../entities/moderation/model";
import { createHttpOrganizationRepository } from "../entities/organization/api/http-organization-repository";
import { OrganizationRepositoryProvider } from "../entities/organization";
import type { OrganizationRepository } from "../entities/organization/model";
import { createHttpCommentRepository } from "../entities/comment/api/http-comment-repository";
import { CommentRepositoryProvider } from "../entities/comment";
import type { CommentRepository } from "../entities/comment/model";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHttpRegistrationRepository } from "../entities/registration/api/http-registration-repository";
import { RegistrationRepositoryProvider } from "../entities/registration";
import type { RegistrationRepository } from "../entities/registration/model";
import { request } from "../shared/api/client";

const notificationRepository = createHttpNotificationRepository(request);
const profileRepository = createHttpProfileRepository(request);
export function ProfileServices({
  children,
  repository = profileRepository,
}: {
  children: ReactNode;
  repository?: ProfileRepository;
}) {
  return (
    <ProfileRepositoryProvider repository={repository}>
      {children}
    </ProfileRepositoryProvider>
  );
}

const moderationRepository = createHttpModerationRepository(request);
export function ModerationServices({
  children,
  repository = moderationRepository,
}: {
  children: ReactNode;
  repository?: ModerationRepository;
}) {
  return (
    <ModerationRepositoryProvider repository={repository}>
      {children}
    </ModerationRepositoryProvider>
  );
}

const organizationRepository = createHttpOrganizationRepository(request);
export function OrganizationServices({
  children,
  repository = organizationRepository,
}: {
  children: ReactNode;
  repository?: OrganizationRepository;
}) {
  return (
    <OrganizationRepositoryProvider repository={repository}>
      {children}
    </OrganizationRepositoryProvider>
  );
}

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
    <NotificationRepositoryProvider repository={notificationRepository}>
      <ProfileServices>
        <ModerationServices>
          <OrganizationServices>
            <DiscussionServices>
              <RegistrationServices>
                <QueryClientProvider client={client}>
                  {children}
                </QueryClientProvider>
              </RegistrationServices>
            </DiscussionServices>
          </OrganizationServices>
        </ModerationServices>
      </ProfileServices>
    </NotificationRepositoryProvider>
  );
}
