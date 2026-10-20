package ru.dvizh.service;

import java.util.*;
import ru.dvizh.api.Problem;

/** Great-circle radius shared by the catalogue and map; applied before count/pagination. */
public final class EventDistance {
    private static final Set<Integer> RADII=Set.of(100,200,500,1000,2000,3000,5000);
    private static final List<String> KEYS=List.of("originLatitude","originLongitude","radiusMeters");
    private EventDistance() {}
    public static String condition(Map<String,String> filters,Map<String,Object> parameters) {
        if(KEYS.stream().noneMatch(filters::containsKey))return "";
        double latitude,longitude;int radius;
        try {
            latitude=Double.parseDouble(filters.get("originLatitude"));
            longitude=Double.parseDouble(filters.get("originLongitude"));
            radius=Integer.parseInt(filters.get("radiusMeters"));
        } catch(RuntimeException e) {throw Problem.invalid("Для расстояния укажите originLatitude, originLongitude и radiusMeters");}
        MapBounds.coordinates(latitude,longitude);
        if(!RADII.contains(radius))throw Problem.invalid("Радиус: 100, 200, 500, 1000, 2000, 3000 или 5000 метров");
        double degrees=Math.toDegrees(radius/6371000.0);
        parameters.put("distanceLatitude",latitude);parameters.put("distanceLongitude",longitude);
        parameters.put("distanceSouth",Math.max(-90,latitude-degrees));
        parameters.put("distanceNorth",Math.min(90,latitude+degrees));
        parameters.put("distanceLimit",Math.pow(Math.sin(radius/12742000.0),2)+1e-15);
        return " and e.latitude is not null and e.longitude is not null"+
            " and e.latitude between :distanceSouth and :distanceNorth"+
            " and (power(sin((e.latitude - :distanceLatitude)*0.008726646259971648),2)"+
            " + cos(:distanceLatitude*0.017453292519943295)*cos(e.latitude*0.017453292519943295)"+
            " * power(sin((e.longitude - :distanceLongitude)*0.008726646259971648),2)) <= :distanceLimit";
    }
}
