package ru.dvizh;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import ru.dvizh.api.Api;
import ru.dvizh.domain.VenueOccupancyReportEntity;
import ru.dvizh.service.Occupancy;

class OccupancyTest {
    final Instant now=Instant.parse("2030-01-01T12:00:00Z");
    VenueOccupancyReportEntity report(UUID user,Api.ReportedOccupancyLevel level,long ageSeconds){var r=new VenueOccupancyReportEntity();r.userId=user;r.level=level;r.createdAt=now.minusSeconds(ageSeconds);return r;}
    @Test void upperMedianForOneThroughFourUsers() {
        var low=report(UUID.randomUUID(),Api.ReportedOccupancyLevel.LOW,1);
        var high=report(UUID.randomUUID(),Api.ReportedOccupancyLevel.HIGH,2);
        var medium=report(UUID.randomUUID(),Api.ReportedOccupancyLevel.MEDIUM,3);
        var high2=report(UUID.randomUUID(),Api.ReportedOccupancyLevel.HIGH,4);
        assertThat(Occupancy.summarize(List.of(low),null,now).level()).isEqualTo(Api.OccupancyLevel.LOW);
        assertThat(Occupancy.summarize(List.of(low,high),null,now).level()).isEqualTo(Api.OccupancyLevel.HIGH);
        assertThat(Occupancy.summarize(List.of(low,high,medium),null,now).level()).isEqualTo(Api.OccupancyLevel.MEDIUM);
        var result=Occupancy.summarize(List.of(low,high,medium,high2),null,now);
        assertThat(result.level()).isEqualTo(Api.OccupancyLevel.HIGH);assertThat(result.reportsCount()).isEqualTo(4);
    }
    @Test void onlyLatestReportPerUserAndStrictExpiry() {
        UUID user=UUID.randomUUID();var latest=report(user,Api.ReportedOccupancyLevel.LOW,0);
        var old=report(user,Api.ReportedOccupancyLevel.HIGH,601);
        assertThat(Occupancy.summarize(List.of(latest,old),latest.createdAt,now).reportsCount()).isEqualTo(1);
        assertThat(Occupancy.summarize(List.of(latest,old),latest.createdAt,now).level()).isEqualTo(Api.OccupancyLevel.LOW);
        assertThat(Occupancy.summarize(List.of(latest),latest.createdAt,now.plusSeconds(5399)).level()).isEqualTo(Api.OccupancyLevel.LOW);
        var expired=Occupancy.summarize(List.of(latest),latest.createdAt,now.plusSeconds(5400));
        assertThat(expired.level()).isEqualTo(Api.OccupancyLevel.UNKNOWN);assertThat(expired.validUntil()).isNull();assertThat(expired.reportsCount()).isZero();assertThat(expired.lastReportedAt()).isEqualTo(now);
        assertThat(Occupancy.summarize(List.of(report(user,Api.ReportedOccupancyLevel.HIGH,-10)),null,now).level()).isEqualTo(Api.OccupancyLevel.UNKNOWN);
    }
}
