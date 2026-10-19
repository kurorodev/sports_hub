package ru.dvizh;

import java.util.*;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.*;

class SportsCatalogMigrationTest {
    protected DataSource database() {
        return new DriverManagerDataSource("jdbc:h2:mem:catalog_migration_"+UUID.randomUUID()+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", "");
    }
    @Test void migratesExistingReferencesAndPreservesCustomLabels() {
        var source=database();
        Flyway.configure().dataSource(source).target("2").load().migrate();
        var db=new JdbcTemplate(source);
        UUID user=UUID.randomUUID(), org=UUID.randomUUID(), running=UUID.randomUUID(), athletics=UUID.randomUUID(), custom=UUID.randomUUID();
        db.update("insert into users(id,created_at,updated_at,nickname,normalized_nickname,display_name) values(?,current_timestamp,current_timestamp,'migration','migration','Migration')",user);
        for(var row:List.of(new Object[]{running,"Бег"},new Object[]{athletics,"Легкая атлетика"},new Object[]{custom,"Моя новая активность"}))
            db.update("insert into sports(id,created_at,updated_at,name,normalized_name,is_custom) values(?,current_timestamp,current_timestamp,?,?,?)",row[0],row[1],row[1].toString().toLowerCase(Locale.ROOT),row[0].equals(custom));
        db.update("insert into organizations(id,created_at,updated_at,name,description,created_by,status) values(?,current_timestamp,current_timestamp,'Migration','Migration organization',?,'PENDING')",org,user);
        for(UUID sport:List.of(running,athletics,custom)) {
            db.update("insert into organization_sports(organization_id,sport_id) values(?,?)",org,sport);
            db.update("insert into user_sport_preferences(user_id,sport_id,level) values(?,?,'BEGINNER')",user,sport);
        }
        UUID event=UUID.randomUUID();
        db.update("insert into events(id,created_at,updated_at,title,description,sport_id,event_kind,starts_at,city,address,skill_level,join_mode,organizer_user_id,status) values(?,current_timestamp,current_timestamp,'Migration event','Keep this event',?,'ACTIVITY',current_timestamp,'City','Park','ANY','OPEN',?,'PUBLISHED')",event,custom,user);
        UUID venue=UUID.randomUUID();
        db.update("insert into sport_venues(id,created_at,updated_at,name,normalized_name,sport_id,city,address,latitude,longitude,created_by) values(?,current_timestamp,current_timestamp,'Migration venue','migration venue',?,'City','Park',53,50,?)",venue,custom,user);
        Flyway.configure().dataSource(source).load().migrate();
        assertThat(db.queryForObject("select count(*) from sports where canonical_id is null",Integer.class)).isEqualTo(201);
        assertThat(db.queryForObject("select count(*) from sports where registry_code is not null",Integer.class)).isEqualTo(200);
        UUID other=db.queryForObject("select id from sports where canonical_id is null and is_custom=true",UUID.class);
        assertThat(db.queryForObject("select sport_id from events where id=?",UUID.class,event)).isEqualTo(other);
        assertThat(db.queryForObject("select custom_sport_name from events where id=?",String.class,event)).isEqualTo("Моя новая активность");
        assertThat(db.queryForObject("select sport_id from sport_venues where id=?",UUID.class,venue)).isEqualTo(other);
        assertThat(db.queryForObject("select count(*) from user_sport_preferences where user_id=?",Integer.class,user)).isEqualTo(2);
        assertThat(db.queryForObject("select count(*) from organization_sports where organization_id=?",Integer.class,org)).isEqualTo(2);
        assertThat(db.queryForObject("select canonical_id from sports where id=?",UUID.class,custom)).isEqualTo(other);
        assertThat(Flyway.configure().dataSource(source).load().migrate().migrationsExecuted).isZero();
    }
}
