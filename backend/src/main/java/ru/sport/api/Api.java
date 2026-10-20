package ru.sport.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

/** DTO следуют OpenAPI-контракту; JPA-сущности не передаются в ответы API. */
public final class Api {
    private Api() {}
    public enum SystemRole { USER, ORGANIZATION, ADMIN }
    public enum SportsRole { ATHLETE, COACH, REFEREE, SPORTS_ORGANIZER }
    public enum ExperienceLevel { BEGINNER, AMATEUR, ADVANCED, PROFESSIONAL }
    public enum EventSkillLevel { ANY, BEGINNER, AMATEUR, ADVANCED, PROFESSIONAL }
    public enum EventKind { ACTIVITY, COMPETITION }
    public enum JoinMode { OPEN, APPROVAL }
    public enum EventStatus { DRAFT, PUBLISHED, UNPUBLISHED, DELETED }
    public enum RegistrationView { UPCOMING, HISTORY }
    public enum RegistrationStatus { PENDING, CONFIRMED, REJECTED, CANCELLED, WAITLISTED }
    public enum OrganizationStatus { PENDING, APPROVED, REJECTED }
    public enum OrganizerType { USER, ORGANIZATION }
    public enum CommentStatus { VISIBLE, HIDDEN }
    public enum Decision { APPROVE, REJECT }
    public enum Rank { ROOKIE, ACTIVE, EXPERIENCED, ELITE }
    public enum ConversationType { DIRECT, COMMUNITY }
    public enum MembershipStatus { ACTIVE, LEFT }
    public enum MatchReason { FAVORITE_SPORT, SUITABLE_LEVEL, PREFERRED_TIME, AVAILABLE_SPOTS, SUITABLE_AGE }
    public enum ErrorCode { VALIDATION_ERROR, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, ALREADY_REGISTERED, EVENT_NOT_AVAILABLE, EVENT_FULL, INVALID_STATUS_TRANSITION, ORGANIZATION_NOT_APPROVED, NOT_EVENT_ORGANIZER, NOT_CONVERSATION_MEMBER, NOT_A_REFEREE, ALREADY_VERIFIED, RATE_LIMITED, INTERNAL_ERROR, SERVICE_UNAVAILABLE }
    public enum OccupancyLevel { LOW, MEDIUM, HIGH, UNKNOWN }
    public enum ReportedOccupancyLevel { LOW, MEDIUM, HIGH }
    public record GeoSuggestion(String id, String label, String city, String address, double latitude, double longitude) {}
    public record GeoSuggestions(List<GeoSuggestion> items) {}
    public record GeoReverseResponse(Location location) {}
    public record VenueLocation(@NotBlank @Size(max=120) String city, @NotBlank @Size(max=300) String address,
        @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public record VenueOccupancy(OccupancyLevel level, Instant lastReportedAt, Instant validUntil, int reportsCount) {}
    public record VenueMapItem(UUID id, String name, UUID sportId, String sportName, VenueLocation location, VenueOccupancy occupancy) {}
    public record VenueCreate(@NotBlank @Size(min=3,max=120) String name, UUID sportId, @NotNull @Valid VenueLocation location) {}
    public record OccupancyReportCreate(@NotNull ReportedOccupancyLevel level, @Min(0) @Max(1000) Integer peopleCount) {}
    public record MapEventsResponse(List<EventCard> items, boolean truncated) {}
    public record MapVenuesResponse(List<VenueMapItem> items, boolean truncated) {}
    public record ErrorField(@NotNull String field, @NotNull String message) {}
    public record ApiError(@NotNull @Valid ErrorCode code, @NotNull String message, @Valid List<ErrorField> details, @NotNull String requestId) {}
    public record PublicUser(@NotNull UUID id, @NotNull String nickname, @NotNull String displayName, String avatarUrl, @NotNull @Valid List<SportsRole> sportsRoles, @NotNull @Valid Rank rank, @NotNull @Min(0) Integer ratingPoints) {}
    public record SportsPreference(@NotNull UUID sportId, @NotNull @Valid ExperienceLevel level) {}
    public enum QuestionnaireStatus { PENDING, SKIPPED, COMPLETED }
    public enum PreferredTime { MORNING, DAY, EVENING, ANY }
    public record QuestionnaireAnswers(@NotBlank @Size(max=100) String city,
        @NotNull @Size(min=1,max=10) List<@NotNull @Valid SportsPreference> sportsPreferences,
        @NotNull PreferredTime preferredTime, @NotBlank @Size(max=64) String timeZone, @Min(1) @Max(120) Integer age) {}
    public record Questionnaire(QuestionnaireStatus status, Instant completedAt, String city,
        List<SportsPreference> sportsPreferences, String preferredTime, String timeZone, Integer age) {}
    public record UserProfile(@NotNull UUID id, @NotNull String nickname, @NotNull String displayName, String avatarUrl, @NotNull @Valid List<SportsRole> sportsRoles, @NotNull @Valid Rank rank, @NotNull @Min(0) Integer ratingPoints, @Size(max = 80) String firstName, @Size(max = 80) String lastName, @Size(max = 1000) String bio, String city, @NotNull @Valid List<SportsPreference> sportsPreferences, String preferredTime, @NotNull Instant createdAt) {}
    public record ProfilePatch(@NotBlank @Size(min = 3, max = 41) @Pattern(regexp="@?[A-Za-z0-9_-]{3,40}") String nickname, @NotBlank @Size(min = 1, max = 100) String displayName, @Size(max = 80) String firstName, @Size(max = 80) String lastName, @Size(max = 1000) String bio, String avatarUrl, @Size(max = 100) String city, @Valid List<SportsRole> sportsRoles, @Valid List<SportsPreference> sportsPreferences, String preferredTime) {}
    public record DemoAccount(@NotNull String id, @NotNull String label, @NotNull @Valid List<SystemRole> systemRoles, @NotNull @Valid List<SportsRole> sportsRoles) {}
    public record DemoLoginRequest(@NotNull String accountId) {}
    public record DemoRegistrationRequest(
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Size(min=3,max=40) String nickname,
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Size(min=1,max=100) String displayName) {
        public DemoRegistrationRequest {
            nickname=nickname==null?null:nickname.strip();
            displayName=displayName==null?null:displayName.strip();
        }
    }
    public record AuthRegistrationRequest(
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{3,40}") String nickname,
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Size(min=1,max=100) String displayName,
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Size(min=8,max=128) String password) {
        public AuthRegistrationRequest {nickname=handle(nickname);displayName=displayName==null?null:displayName.strip();}
    }
    public record AuthLoginRequest(
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Size(max=41) String nickname,
        @JsonDeserialize(using=StrictStringDeserializer.class) @NotBlank @Size(max=128) String password) {
        public AuthLoginRequest {nickname=handle(nickname);}
    }
    private static String handle(String value) {
        if(value==null)return null;
        value=value.strip();return value.startsWith("@")?value.substring(1):value;
    }
    public enum NotificationType { REGISTRATION_STATUS, NEW_REGISTRATION, ORGANIZATION_STATUS, EVENT_STATUS, EVENT_UNPUBLISHED, COMMENT_HIDDEN, EVENT_UPDATED, EVENT_STARTING, MENTION, SUPPORT_NEW, SUPPORT_REPLY, SUPPORT_STATUS }
    public record Notification(UUID id,NotificationType type,String title,String text,String reason,String href,Instant createdAt,Instant readAt,String commentText) {}
    public record NotificationPage(List<Notification> items,int page,int size,long total,int totalPages,long unreadCount,Instant asOf) {}
    public record NotificationsReadRequest(@NotNull Instant through) {}
    public record Mention(UUID userId,String nickname,int start,int end) {}
    public record Session(@NotNull @Valid UserProfile user, @NotNull @Valid List<SystemRole> systemRoles, @NotNull @Valid List<UUID> manageableOrganizationIds, @NotNull String csrfToken, @NotNull Boolean demo) {}
    public record Sport(@NotNull UUID id, @NotNull String name, @NotNull Boolean isCustom, String registryCode, String imageUrl) {
        public Sport(UUID id,String name,Boolean isCustom,String registryCode){this(id,name,isCustom,registryCode,null);}
    }
    public record Location(@NotNull @NotBlank @Size(min = 1, max = 120) String city, @NotNull @NotBlank @Size(min = 1, max = 300) String address, @DecimalMin("-90") @DecimalMax("90") Double latitude, @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public record OrganizerRef(@NotNull @Valid OrganizerType type, @NotNull UUID id) {}
    public record OrganizerSummary(@NotNull @Valid OrganizerType type, @NotNull UUID id, @NotNull String name, String avatarUrl) {}
    public record OrganizationCreate(@NotNull @NotBlank @Size(min = 2, max = 160) String name, @NotNull @NotBlank @Size(min = 10, max = 2000) String description, @Valid List<UUID> sports, String avatarUrl) {}
    public record Organization(@NotNull UUID id, @NotNull String name, @NotNull String description, @NotNull @Valid List<Sport> sports, String avatarUrl, @NotNull @Valid OrganizationStatus status, @NotNull @Valid PublicUser createdBy, String decisionReason, @NotNull Instant createdAt, Instant decidedAt) {}
    public record OrganizationDecisionRequest(@NotNull @Valid Decision decision, @Size(min = 3, max = 1000) String reason) {}
    public record EventCreate(@NotNull @NotBlank @Size(min = 3, max = 160) String title, @NotNull @NotBlank @Size(min = 10, max = 5000) String description, @Valid EventKind eventKind, @NotNull @Valid SportInput sport, @NotNull Instant startsAt, Instant endsAt, @NotNull @Valid Location location, @Valid EventSkillLevel skillLevel, @Size(max = 2000) String requirements, @NotNull @Valid JoinMode joinMode, @Min(2) @Max(10000) Integer maxParticipants, @NotNull @Valid OrganizerRef organizer, Boolean publishNow, @Min(1) @Max(120) Integer recommendedMinAge, @Min(1) @Max(120) Integer recommendedMaxAge) {}
    public record EventPatch(@NotBlank @Size(min = 3, max = 160) String title, @NotBlank @Size(min = 10, max = 5000) String description, Instant startsAt, Instant endsAt, @Valid Location location, @Valid EventSkillLevel skillLevel, @Size(max = 2000) String requirements, @Min(2) @Max(10000) Integer maxParticipants, @Min(1) @Max(120) Integer recommendedMinAge, @Min(1) @Max(120) Integer recommendedMaxAge) {}
    public record Event(@NotNull UUID id, @NotNull String title, @NotNull String description, @NotNull @Valid EventKind eventKind, @NotNull @Valid Sport sport, @NotNull Instant startsAt, Instant endsAt, @NotNull @Valid Location location, @NotNull @Valid EventSkillLevel skillLevel, String requirements, @NotNull @Valid JoinMode joinMode, Integer maxParticipants, @NotNull @Min(0) Integer confirmedCount, @NotNull @Min(0) Integer pendingCount, @Min(0) Integer spotsLeft, @NotNull @Valid OrganizerSummary organizer, @NotNull @Valid EventStatus status, String moderationReason, String viewerRegistrationStatus, @NotNull Boolean viewerIsOrganizer, @NotNull Instant createdAt, @NotNull Instant updatedAt, String customSportName, Instant cancelledAt, Integer recommendedMinAge, Integer recommendedMaxAge) {}
    public record EventCard(@NotNull UUID id, @NotNull String title, @NotNull @Valid EventKind eventKind, @NotNull @Valid Sport sport, @NotNull Instant startsAt, @NotNull @Valid Location location, @NotNull @Valid EventSkillLevel skillLevel, @NotNull @Valid JoinMode joinMode, @NotNull @Valid OrganizerSummary organizer, Integer maxParticipants, @NotNull Integer confirmedCount, Integer spotsLeft, String viewerRegistrationStatus, String customSportName, Integer recommendedMinAge, Integer recommendedMaxAge) {}
    public record RegistrationCreate(@Size(max = 1000) String message) {}
    public record Registration(@NotNull UUID id, @NotNull UUID eventId, @NotNull @Valid PublicUser user, @NotNull @Valid RegistrationStatus status, String message, String decisionReason, @NotNull Instant createdAt, @NotNull Instant updatedAt, Instant decidedAt, Event event) {}
    public record RegistrationDecisionRequest(@NotNull @Valid Decision decision, @Size(max = 1000) String reason) {}
    public record CommentCreate(@NotNull @NotBlank @Size(min = 1, max = 2000) String text) {}
    public record Comment(@NotNull UUID id, @NotNull UUID eventId, @NotNull @Valid PublicUser author, @NotNull String text, @NotNull @Valid CommentStatus status, @NotNull Instant createdAt, @NotNull Instant updatedAt, List<Mention> mentions) {}
    public record ModerationRequest(@NotNull @NotBlank @Size(min = 3, max = 1000) String reason) {}
    public record TeamStatus(@NotNull UUID eventId, Integer maxParticipants, @NotNull Integer confirmedCount, @NotNull Integer pendingCount, @NotNull Integer waitlistedCount, Integer spotsLeft, String viewerStatus, @NotNull Boolean joinAvailable, @NotNull Boolean waitlistAvailable) {}
    public record RecommendedEvent(@NotNull @Valid EventCard event, @NotNull @Min(0) @Max(100) Integer score, @NotNull @Valid List<MatchReason> matchReasons) {}
    public record Rating(@NotNull UUID userId, @NotNull @Min(0) Integer points, @NotNull @Valid Rank rank, @NotNull @Min(0) Integer confirmedCompetitions, @NotNull String rulesVersion) {}
    public record RatingLedgerEntry(@NotNull UUID id, @NotNull UUID userId, @NotNull UUID eventId, @NotNull UUID registrationId, @NotNull Integer points, @NotNull String reason, @NotNull UUID verifiedBy, @NotNull Instant createdAt) {}
    public record VerifyParticipationRequest(@Size(max = 300) String note) {}
    public record AssignRefereeRequest(@NotNull UUID userId) {}
    public record Conversation(@NotNull UUID id, @NotNull @Valid ConversationType type, String title, UUID organizationId, @NotNull @Valid List<PublicUser> participants, Instant lastMessageAt, @NotNull Instant createdAt) {}
    public record MessageCreate(@NotNull @NotBlank @Size(min = 1, max = 3000) String text) {}
    public record Message(@NotNull UUID id, @NotNull UUID conversationId, @NotNull @Valid PublicUser author, @NotNull String text, @NotNull Instant createdAt, List<Mention> mentions) {}
    public record Membership(@NotNull UUID organizationId, @NotNull @Valid PublicUser user, @NotNull @Valid MembershipStatus status, @NotNull Instant joinedAt) {}
    public record Health(@NotNull String status, @NotNull String service, @NotNull String version) {}
    public record PagedEvents(@NotNull @Valid List<EventCard> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedEventDetails(@NotNull @Valid List<Event> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedRecommendedEvents(@NotNull @Valid List<RecommendedEvent> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedRegistrations(@NotNull @Valid List<Registration> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedComments(@NotNull @Valid List<Comment> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedOrganizations(@NotNull @Valid List<Organization> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedUsers(@NotNull @Valid List<PublicUser> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedConversations(@NotNull @Valid List<Conversation> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedMessages(@NotNull @Valid List<Message> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedRatingLedger(@NotNull @Valid List<RatingLedgerEntry> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record PagedMemberships(@NotNull @Valid List<Membership> items, @NotNull @Min(0) Integer page, @NotNull @Min(1) Integer size, @NotNull @Min(0) Integer total, @NotNull @Min(0) Integer totalPages) {}
    public record SportInput(UUID sportId, @Size(min=2,max=80) String customName) {}
    public record ConversationCreate(@NotNull ConversationType type, UUID peerUserId, UUID organizationId, @Size(min=2,max=120) String title) {}
}
