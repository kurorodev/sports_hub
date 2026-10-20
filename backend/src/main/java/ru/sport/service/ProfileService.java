package ru.sport.service;

import java.util.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service @Transactional(readOnly=true)
public class ProfileService {
    private final Store db;private final Access access;private final Views view;private final PatchValidator validator;private final SportsCatalog catalog;
    public ProfileService(Store db,Access access,Views view,PatchValidator validator,SportsCatalog catalog) {this.db=db;this.access=access;this.view=view;this.validator=validator;this.catalog=catalog;}
    public List<Api.PublicUser> search(String prefix) {
        prefix=prefix.strip();if(prefix.startsWith("@"))prefix=prefix.substring(1);
        if(!prefix.matches("[A-Za-z0-9_-]{1,40}"))throw Problem.invalid("Введите от 1 до 40 символов никнейма");
        return db.list(UserEntity.class,"locate(:prefix,e.normalizedNickname)=1",Map.of("prefix",prefix.toLowerCase(Locale.ROOT)),"e.normalizedNickname asc",0,8).stream().map(u -> view.user(u.id)).toList();
    }
    public Api.UserProfile me() { return view.profile(access.user()); }
    public Api.UserProfile get(UUID id) { return view.profile(db.get(UserEntity.class,id)); }
    public Api.Rating rating(UUID id) { return view.rating(db.get(UserEntity.class,id)); }
    public PageResult<Api.RatingLedgerEntry> history(UUID id,int page,int size) {
        db.get(UserEntity.class,id);PageResult.offset(page,size);
        return PageResult.of(List.of(),page,size,0);
    }
    @Transactional public Api.UserProfile patch(JsonNode patch) {
        validator.validate("ProfilePatch",patch);
        var u=db.lock(UserEntity.class,access.user().id);
        if(u.admin && ((patch.has("sportsRoles") && !patch.path("sportsRoles").isEmpty()) ||
            (patch.has("sportsPreferences") && !patch.path("sportsPreferences").isEmpty()) ||
            (patch.hasNonNull("preferredTime") && !patch.path("preferredTime").asText().isBlank())))throw Problem.forbidden();
        if(patch.has("sportsRoles")) {
            var requested=new HashSet<Api.SportsRole>();
            for(var role:patch.path("sportsRoles"))requested.add(Api.SportsRole.valueOf(role.asText()));
            if(!requested.equals(u.sportsRoles) && db.count(OrganizationEntity.class,
                "e.createdBy=:user and e.status=:status",Map.of("user",u.id,"status",Api.OrganizationStatus.APPROVED))==0)
                throw Problem.forbidden();
        }
        if(patch.has("nickname")) {
            String nickname=patch.path("nickname").asText().strip();
            if(nickname.startsWith("@"))nickname=nickname.substring(1);
            if(!nickname.matches("[A-Za-z0-9_-]{3,40}")) throw Problem.invalid("Никнейм: 3–40 латинских букв, цифр, _ или -");
            String normalized=nickname.toLowerCase(Locale.ROOT);
            if(db.count(UserEntity.class,"e.normalizedNickname=:name and e.id<>:id",Map.of("name",normalized,"id",u.id))>0)
                throw Problem.conflict(Api.ErrorCode.CONFLICT,"Никнейм уже занят");
            u.nickname=nickname;u.normalizedNickname=normalized;
        }
        if(patch.has("displayName"))u.displayName=patch.path("displayName").asText().strip();
        if(patch.has("firstName"))u.firstName=text(patch,"firstName");
        if(patch.has("lastName"))u.lastName=text(patch,"lastName");
        if(patch.has("bio"))u.bio=text(patch,"bio");
        if(patch.has("city"))u.city=CityNames.optional(text(patch,"city"));
        if(patch.has("preferredTime"))u.preferredTime=text(patch,"preferredTime");
        if(patch.has("avatarUrl"))u.avatarUrl=AvatarImages.normalize(text(patch,"avatarUrl"));
        if(patch.has("sportsRoles")) {
            u.sportsRoles.clear(); for(var role:patch.path("sportsRoles"))u.sportsRoles.add(Api.SportsRole.valueOf(role.asText()));
        }
        if(patch.has("sportsPreferences")) {
            var seen=new HashSet<UUID>(); var prefs=new ArrayList<SportPreference>();
            for(var pref:patch.path("sportsPreferences")) {
                UUID sport=catalog.resolve(UUID.fromString(pref.path("sportId").asText())).id;
                if(!seen.add(sport))throw Problem.invalid("Вид спорта указан дважды");
                prefs.add(new SportPreference(sport,Api.ExperienceLevel.valueOf(pref.path("level").asText())));
            }
            u.sportsPreferences.clear();u.sportsPreferences.addAll(prefs);
        }
        u.updatedAt=java.time.Instant.now();db.flush();return view.profile(u);
    }
    static String text(JsonNode node,String field) { return node.path(field).isNull()?null:node.path(field).asText().strip(); }
}
