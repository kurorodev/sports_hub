package ru.dvizh.service;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import ru.dvizh.api.*;

@Service
public class GeocodingService {
    private final GeocodingProvider provider;private final Clock clock;
    private record Cached(Object value,Instant expires) {}
    private final Map<String,Cached> cache=new LinkedHashMap<>();
    private Instant window=Instant.EPOCH; private int requests;
    public GeocodingService(GeocodingProvider provider,Clock clock){this.provider=provider;this.clock=clock;}
    public synchronized Api.GeoSuggestions suggest(String q,String city,int limit) {
        q=q.trim().replaceAll("\\s+"," ");city=city==null?"":city.trim().replaceAll("\\s+"," ");
        if(q.length()<3||q.length()>160||city.length()>120||limit<1||limit>10)throw Problem.invalid("Запрос: 3–160 символов; limit: 1–10");
        String query=q,context=city;
        return cached("s:"+q.toLowerCase(Locale.ROOT)+":"+city.toLowerCase(Locale.ROOT)+":"+limit,()->new Api.GeoSuggestions(provider.suggest(query,context,limit)));
    }
    public synchronized Api.GeoReverseResponse reverse(double latitude,double longitude) {
        MapBounds.coordinates(latitude,longitude);
        return cached("r:"+latitude+":"+longitude,()->new Api.GeoReverseResponse(provider.reverse(latitude,longitude)));
    }
    @SuppressWarnings("unchecked")
    private <T> T cached(String key,java.util.function.Supplier<T> fetch) {
        Instant now=clock.instant();var entry=cache.get(key);
        if(entry!=null && entry.expires.isAfter(now))return (T)entry.value;
        if(!window.plusSeconds(60).isAfter(now)){window=now;requests=0;}
        if(++requests>120)throw new Problem(429,Api.ErrorCode.RATE_LIMITED,"Поиск адресов перегружен. Повторите через минуту",60);
        T value=fetch.get();
        cache.entrySet().removeIf(e->!e.getValue().expires.isAfter(now));
        if(cache.size()>=512)cache.remove(cache.keySet().iterator().next());
        cache.put(key,new Cached(value,now.plusSeconds(300)));return value;
    }
}
