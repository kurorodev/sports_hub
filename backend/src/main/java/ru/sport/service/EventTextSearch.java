package ru.sport.service;

import java.util.*;

/** Bounded one-edit search using portable, parameterized SQL LIKE patterns. */
final class EventTextSearch {
    private EventTextSearch() {}

    static String condition(String query, Map<String,Object> params) {
        String text=normalize(query);
        String exact=matches(List.of(literal(text)),params);
        String[] words=text.split("\\s+");
        // Keep unusually long or punctuation-heavy queries on the literal path.
        // This also bounds the SQL size independently of the number of events.
        if(text.length()>64 || words.length>4 || !text.matches("[\\p{L}\\p{N}]+(?:\\s+[\\p{L}\\p{N}]+)*"))return exact;
        var conditions=new ArrayList<String>();
        for(String word:words)conditions.add(matches(patterns(word),params));
        return "("+exact+" or ("+String.join(" and ",conditions)+"))";
    }

    private static Set<String> patterns(String word) {
        var patterns=new LinkedHashSet<String>();patterns.add(word);
        // Fuzzy matching short fragments would produce too many unrelated events.
        if(word.length()<5 || word.length()>24)return patterns;
        for(int i=0;i<word.length();i++) {
            patterns.add(word.substring(0,i)+"_"+word.substring(i+1)); // wrong letter
            patterns.add(word.substring(0,i)+word.substring(i+1)); // extra letter
            if(i+1<word.length())patterns.add(word.substring(0,i)+word.charAt(i+1)+word.charAt(i)+word.substring(i+2));
        }
        for(int i=0;i<=word.length();i++)patterns.add(word.substring(0,i)+"_"+word.substring(i)); // missing letter
        return patterns;
    }

    private static String matches(Collection<String> patterns, Map<String,Object> params) {
        var alternatives=new ArrayList<String>();
        for(String pattern:patterns) {
            String name="eventText"+params.size();params.put(name,"%"+pattern+"%");
            for(String field:List.of("title","description","customSportName"))
                alternatives.add("replace(lower(e."+field+"),'ё','е') like :"+name+" escape '!' ");
        }
        return "("+String.join(" or ",alternatives)+")";
    }

    private static String literal(String value) {
        return value.replace("!","!!").replace("%","!%").replace("_","!_");
    }
    private static String normalize(String value) {
        return value.strip().toLowerCase(Locale.ROOT).replace('ё','е');
    }
}
