package ru.dvizh.api;

import java.time.Instant;
import java.util.UUID;
import jakarta.validation.constraints.*;

/** Private support DTOs, separate from public discussions and JPA entities. */
public final class SupportApi {
    private SupportApi() {}
    public enum Category { HELP, BUG, IDEA, VENUE_SUGGESTION, COMMENT_REPORT }
    public enum Status { OPEN, IN_PROGRESS, WAITING_USER, RESOLVED, CLOSED }
    public enum Priority { NORMAL, HIGH, URGENT }
    public enum ReportReason { SPAM, ABUSE, UNSAFE, OTHER }
    public enum MessageKind { MESSAGE, STATUS }
    public record Create(@NotNull Category category, @NotBlank @Size(min=3,max=160) String title,
        @NotBlank @Size(min=10,max=5000) String description, UUID commentId, ReportReason reportReason,
        @Size(min=1,max=120) String venueCity, @Size(min=1,max=300) String venueAddress,
        @DecimalMin("-90") @DecimalMax("90") Double venueLatitude,
        @DecimalMin("-180") @DecimalMax("180") Double venueLongitude) {
        public Create { title=clean(title);description=clean(description);venueCity=clean(venueCity);venueAddress=clean(venueAddress); }
    }
    public record Update(Status status, Priority priority) {}
    public record Reply(@NotBlank @Size(min=1,max=5000) String text) { public Reply {text=clean(text);} }
    public record Ticket(UUID id,Api.PublicUser author,Api.PublicUser assignedTo,Category category,Status status,Priority priority,
        String title,String description,UUID commentId,UUID eventId,String commentText,String commentAuthor,
        ReportReason reportReason,String venueCity,String venueAddress,Double venueLatitude,Double venueLongitude,Instant createdAt,Instant updatedAt) {}
    public record Message(UUID id,UUID ticketId,Api.PublicUser author,boolean fromSupport,MessageKind kind,String text,Instant createdAt) {}
    private static String clean(String text){return text==null?null:text.strip();}
}
