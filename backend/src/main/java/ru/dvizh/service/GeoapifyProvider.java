package ru.dvizh.service;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import ru.dvizh.api.*;

@Component
public class GeoapifyProvider implements GeocodingProvider {
    private final String key; private final ObjectMapper mapper;
    private final HttpClient client;
    @org.springframework.beans.factory.annotation.Autowired
    public GeoapifyProvider(@Value("${app.geoapify-api-key:}") String key,ObjectMapper mapper){this(key,mapper,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());}
    GeoapifyProvider(String key,ObjectMapper mapper,HttpClient client){this.key=key;this.mapper=mapper;this.client=client;}
    static Problem unavailable(){return new Problem(503,Api.ErrorCode.SERVICE_UNAVAILABLE,"Поиск адресов временно недоступен. Укажите адрес вручную или выберите точку на карте");}
    private JsonNode fetch(String path,String parameters) {
        if(key.isBlank())throw unavailable();
        try {
            var uri=URI.create("https://api.geoapify.com/v1/geocode/"+path+"?format=json&lang=ru&"+parameters+"&apiKey="+encode(key));
            var response=client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(4)).GET().build(),HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200 || response.body().length()>1_000_000)throw unavailable();
            JsonNode results=mapper.readTree(response.body()).path("results");
            if(!results.isArray())throw unavailable();
            return results;
        } catch(InterruptedException e) {Thread.currentThread().interrupt();throw unavailable();}
        catch(Exception e) {throw unavailable();} // Never expose URLs or API keys in errors/logs.
    }
    public List<Api.GeoSuggestion> suggest(String query,String city,int limit) {
        String text=city==null||city.isBlank()?query:city+", "+query;
        List<Api.GeoSuggestion> result=new ArrayList<>();
        for(var row:fetch("autocomplete","text="+encode(text)+"&limit="+limit)) {
            var loc=location(row,null,null);
            if(loc!=null)result.add(new Api.GeoSuggestion(row.path("place_id").asText(loc.latitude()+","+loc.longitude()),row.path("formatted").asText(loc.city()+", "+loc.address()),loc.city(),loc.address(),loc.latitude(),loc.longitude()));
        }
        return List.copyOf(result);
    }
    public Api.Location reverse(double latitude,double longitude) {
        var rows=fetch("reverse","lat="+latitude+"&lon="+longitude+"&limit=1");
        return rows.isEmpty()?null:location(rows.get(0),latitude,longitude);
    }
    private static Api.Location location(JsonNode row,Double latitude,Double longitude) {
        String city=row.path("city").asText(row.path("town").asText(row.path("village").asText("")));
        String address=row.path("address_line1").asText(row.path("formatted").asText(""));
        if(city.isBlank()||address.isBlank()||city.length()>120||address.length()>300||!row.path("lat").isNumber()||!row.path("lon").isNumber())return null;
        double lat=latitude==null?row.path("lat").asDouble():latitude,lon=longitude==null?row.path("lon").asDouble():longitude;
        MapBounds.coordinates(lat,lon);
        return new Api.Location(city,address,lat,lon);
    }
    private static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
}
