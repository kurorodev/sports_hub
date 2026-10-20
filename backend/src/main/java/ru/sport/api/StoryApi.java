package ru.sport.api;

import java.time.Instant;
import java.util.*;

public final class StoryApi {
    private StoryApi() {}
    public record Story(UUID id,String title,String text,String imageUrl,Instant createdAt,Instant expiresAt,Instant readAt) {}
    public record Feed(List<Story> items,Instant asOf) {}
}
