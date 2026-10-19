package ru.dvizh.service;

import java.util.List;
import ru.dvizh.api.Api;

public interface GeocodingProvider {
    List<Api.GeoSuggestion> suggest(String query,String city,int limit);
    Api.Location reverse(double latitude,double longitude);
}
