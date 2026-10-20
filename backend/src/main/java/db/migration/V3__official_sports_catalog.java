package db.migration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;

/** A versioned, offline registry snapshot. Legacy IDs remain aliases; no events are deleted. */
public class V3__official_sports_catalog extends BaseJavaMigration {
    @Override public Integer getChecksum() {
        try (var in = getClass().getResourceAsStream("/sports-registry.json")) {
            var checksum = new java.util.zip.CRC32();
            checksum.update(Objects.requireNonNull(in).readAllBytes());
            return (int) checksum.getValue();
        } catch (java.io.IOException e) { throw new IllegalStateException("Cannot read the versioned sports registry", e); }
    }
    private record Legacy(UUID id, String name) {}
    private static String normalize(String name) {
        return name.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT).replace('ё', 'е');
    }
    private static String officialName(String name) {
        return switch (normalize(name)) {
            case "бег" -> "легкая атлетика";
            default -> normalize(name);
        };
    }
    @Override public void migrate(Context context) throws Exception {
        var c = context.getConnection();
        try (var s = c.createStatement()) {
            s.execute("alter table sports add column registry_code varchar(11)");
            s.execute("alter table sports add column canonical_id uuid references sports(id)");
            s.execute("alter table events add column custom_sport_name varchar(80)");
        }
        var legacy = new ArrayList<Legacy>();
        try (var s = c.createStatement(); var rows = s.executeQuery("select id,name from sports order by id")) {
            while (rows.next()) legacy.add(new Legacy(rows.getObject(1, UUID.class), rows.getString(2)));
        }
        // Free unique names before merging aliases and variants such as «Бег».
        for (var sport : legacy) execute(c, "update sports set normalized_name=? where id=?", "legacy:" + sport.id, sport.id);
        var canonical = new HashMap<String, UUID>();
        try (var in = getClass().getResourceAsStream("/sports-registry.json")) {
            var sports = new ObjectMapper().readTree(Objects.requireNonNull(in)).path("sports");
            for (var item : sports) {
                String name = item.path("name").asText(), code = item.path("registryCode").asText();
                UUID id = legacy.stream().filter(s -> officialName(s.name).equals(normalize(name)))
                    .map(Legacy::id).findFirst().orElseGet(() -> stableId(code.substring(0, 3)));
                save(c, legacy, id, name, code, false);
                canonical.put(normalize(name), id);
            }
        }
        UUID other = legacy.stream().filter(s -> normalize(s.name).equals("другое"))
            .map(Legacy::id).findFirst().orElseGet(() -> stableId("other"));
        save(c, legacy, other, "Другое", null, true);
        canonical.put("другое", other);
        var activeIds = new HashSet<>(canonical.values());
        for (var sport : legacy) {
            if (activeIds.contains(sport.id)) continue;
            UUID target = canonical.getOrDefault(officialName(sport.name), other);
            execute(c, "update sports set canonical_id=? where id=?", target, sport.id);
            if (target.equals(other))
                execute(c, "update events set custom_sport_name=? where sport_id=?", sport.name, sport.id);
            execute(c, "update events set sport_id=? where sport_id=?", target, sport.id);
            execute(c, "update sport_venues set sport_id=? where sport_id=?", target, sport.id);
            mergeReferences(c, "organization_sports", "organization_id", sport.id, target, false);
            mergeReferences(c, "user_sport_preferences", "user_id", sport.id, target, true);
        }
        try (var s = c.createStatement()) {
            s.execute("create unique index sports_registry_code_unique on sports(registry_code)");
            s.execute("alter table sports add constraint sports_fixed_catalog check (canonical_id is not null or (registry_code is not null and is_custom=false) or (registry_code is null and is_custom=true and normalized_name='другое'))");
        }
    }
    private static UUID stableId(String key) {
        return UUID.nameUUIDFromBytes(("sport:vrvs:" + key).getBytes(StandardCharsets.UTF_8));
    }
    private static void save(Connection c, List<Legacy> legacy, UUID id, String name, String code, boolean other) throws SQLException {
        if (legacy.stream().anyMatch(s -> s.id.equals(id))) {
            execute(c, "update sports set name=?,normalized_name=?,registry_code=?,is_custom=? where id=?", name, normalize(name), code, other, id);
        } else {
            execute(c, "insert into sports(id,created_at,updated_at,version,name,normalized_name,is_custom,registry_code) values (?,current_timestamp,current_timestamp,0,?,?,?,?)", id, name, normalize(name), other, code);
        }
    }
    private static void mergeReferences(Connection c, String table, String owner, UUID old, UUID target, boolean level) throws SQLException {
        // A user/organization may already have both categories. Keep the existing canonical preference.
        execute(c, "insert into " + table + " (" + owner + ",sport_id" + (level ? ",level" : "") + ") select a." + owner + ",?" + (level ? ",a.level" : "") + " from " + table + " a where a.sport_id=? and not exists (select 1 from " + table + " b where b." + owner + "=a." + owner + " and b.sport_id=?)", target, old, target);
        execute(c, "delete from " + table + " where sport_id=?", old);
    }
    private static void execute(Connection c, String sql, Object... args) throws SQLException {
        try (var s = c.prepareStatement(sql)) {
            for (int i = 0; i < args.length; i++) s.setObject(i + 1, args[i]);
            s.executeUpdate();
        }
    }
}
