package ru.sport.service;

import java.time.*;
import java.util.*;
import ru.sport.api.Api;
import ru.sport.domain.VenueOccupancyReportEntity;

public final class Occupancy {
    public static final Duration TTL=Duration.ofMinutes(90);
    private Occupancy() {}
    public static Api.VenueOccupancy summarize(List<VenueOccupancyReportEntity> reports, Instant historicalLast, Instant now) {
        Map<UUID,VenueOccupancyReportEntity> latest=new HashMap<>();
        for(var r:reports) {
            if(r.createdAt.isAfter(now) || !r.createdAt.isAfter(now.minus(TTL))) continue;
            latest.merge(r.userId,r,(a,b)->a.createdAt.compareTo(b.createdAt)>0 ? a : b);
        }
        if(latest.isEmpty()) return new Api.VenueOccupancy(Api.OccupancyLevel.UNKNOWN,historicalLast,null,0);
        var sorted=latest.values().stream().map(r->r.level.ordinal()).sorted().toList();
        Instant last=latest.values().stream().map(r->r.createdAt).max(Instant::compareTo).orElseThrow();
        // Earliest expiry triggers a refresh of the aggregate, including a possible median change.
        Instant validUntil=latest.values().stream().map(r->r.createdAt.plus(TTL)).min(Instant::compareTo).orElseThrow();
        return new Api.VenueOccupancy(Api.OccupancyLevel.values()[sorted.get(sorted.size()/2)],last,validUntil,latest.size());
    }
}
