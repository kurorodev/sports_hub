package ru.sport.service;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.domain.SportEntity;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly = true)
public class SportsCatalog {
    private final Store db;
    public SportsCatalog(Store db) { this.db = db; }
    public SportEntity resolve(UUID id) {
        var sport = db.get(SportEntity.class, id);
        return sport.canonicalId == null ? sport : db.get(SportEntity.class, sport.canonicalId);
    }
    public SportEntity other() {
        return db.first(SportEntity.class, "e.canonicalId is null and e.isCustom=true", Map.of()).orElseThrow();
    }
}
