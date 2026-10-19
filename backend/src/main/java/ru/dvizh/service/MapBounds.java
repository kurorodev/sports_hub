package ru.dvizh.service;

import java.util.Map;
import ru.dvizh.api.Problem;

public record MapBounds(double west, double south, double east, double north) {
    public static MapBounds parse(String value) {
        try {
            String[] parts=value.split(",",-1);
            if(parts.length!=4) throw new IllegalArgumentException();
            double w=Double.parseDouble(parts[0]),s=Double.parseDouble(parts[1]),e=Double.parseDouble(parts[2]),n=Double.parseDouble(parts[3]);
            coordinates(s,w); coordinates(n,e);
            if(w>=e || s>=n || e-w>10 || n-s>10) throw new IllegalArgumentException();
            return new MapBounds(w,s,e,n);
        } catch (IllegalArgumentException ex) { throw Problem.invalid("bbox: запад,юг,восток,север; охват до 10°; приблизьте карту"); }
    }
    public static void coordinates(double latitude,double longitude) {
        if(!Double.isFinite(latitude)||!Double.isFinite(longitude)||latitude < -90||latitude>90||longitude < -180||longitude>180)
            throw Problem.invalid("Недопустимые координаты");
    }
    public static void limit(int limit) { if(limit<1||limit>500) throw Problem.invalid("limit: от 1 до 500"); }
    public Map<String,Object> parameters() { return new java.util.HashMap<>(Map.of("west",west,"south",south,"east",east,"north",north)); }
    public static final String CONDITION="e.longitude between :west and :east and e.latitude between :south and :north";
}
