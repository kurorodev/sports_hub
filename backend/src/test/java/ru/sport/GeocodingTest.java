package ru.sport;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import ru.sport.api.*;
import ru.sport.service.*;

class GeocodingTest {
    @Test void cachesNormalizedQueriesAndNullReverseAndAppliesProviderBudget() {
        var count=new AtomicInteger();
        GeocodingProvider provider=new GeocodingProvider() {
            public List<Api.GeoSuggestion> suggest(String q,String city,int limit){count.incrementAndGet();return List.of(new Api.GeoSuggestion("p","Самара, площадь Куйбышева","Самара","площадь Куйбышева",53.195561,50.101022));}
            public Api.Location reverse(double lat,double lon){count.incrementAndGet();return null;}
        };
        var service=new GeocodingService(provider,Clock.fixed(Instant.parse("2030-01-01T12:00:00Z"),ZoneOffset.UTC));
        var result=service.suggest("  площадь   Куйбышева "," Самара ",5);
        assertThat(result.items().getFirst().latitude()).isEqualTo(53.195561);
        service.suggest("площадь куйбышева","самара",5);assertThat(count.get()).isEqualTo(1);
        assertThat(service.reverse(53.2,50.1).location()).isNull();service.reverse(53.2,50.1);assertThat(count.get()).isEqualTo(2);
        for(int i=0;i<118;i++)service.suggest("адрес "+i,null,5);
        assertThatThrownBy(()->service.suggest("следующий адрес",null,5)).isInstanceOfSatisfying(Problem.class,e->assertThat(e.status).isEqualTo(429));
        assertThatThrownBy(()->service.reverse(Double.NaN,50)).isInstanceOfSatisfying(Problem.class,e->assertThat(e.status).isEqualTo(400));
    }
    @Test void missingKeyIsStructured503() {
        var provider=new GeoapifyProvider("",new com.fasterxml.jackson.databind.ObjectMapper());
        assertThatThrownBy(()->provider.suggest("Самара",null,5)).isInstanceOfSatisfying(Problem.class,e->{assertThat(e.status).isEqualTo(503);assertThat(e.code).isEqualTo(Api.ErrorCode.SERVICE_UNAVAILABLE);});
    }
}
