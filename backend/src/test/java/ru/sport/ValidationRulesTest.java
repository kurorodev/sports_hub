package ru.sport;

import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import ru.sport.api.*;
import ru.sport.service.*;
import static org.assertj.core.api.Assertions.*;

class ValidationRulesTest {
    final ObjectMapper mapper=new ObjectMapper();
    @Test void patchUsesContractIncludingNullAndUnknownFields() throws Exception {
        var validator=new PatchValidator(mapper);
        for(String input:List.of("{\"bio\":null}","{\"sportsRoles\":[\"ATHLETE\",\"SPORTS_ORGANIZER\"]}","{\"sportsPreferences\":[]}","{\"avatarUrl\":\"https://example.com/a.png\"}"))
            validator.validate("ProfilePatch",mapper.readTree(input));
        for(String input:List.of("{}","[]","null","{\"ratingPoints\":100}","{\"nickname\":null}","{\"sportsRoles\":[\"ATHLETE\",\"ATHLETE\"]}","{\"avatarUrl\":\"relative.png\"}","{\"avatarUrl\":\"javascript:alert(1)\"}","{\"avatarUrl\":\"https://user:password@example.com/a\"}"))
            assertThatThrownBy(()->validator.validate("ProfilePatch",mapper.readTree(input))).isInstanceOf(Problem.class);
        validator.validate("EventPatch",mapper.readTree("{\"startsAt\":\"2026-11-01T15:00:00+04:00\",\"maxParticipants\":null}"));
        for(String input:List.of("{\"joinMode\":\"OPEN\"}","{\"maxParticipants\":1}","{\"maxParticipants\":2.5}","{\"startsAt\":\"2026-11-01T15:00:00\"}","{\"location\":{\"city\":\"a\",\"address\":\"a\",\"latitude\":90.5}}"))
            assertThatThrownBy(()->validator.validate("EventPatch",mapper.readTree(input))).isInstanceOf(Problem.class);
    }
    @Test void retiredRolesAreHiddenAndPaginationStaysValid() {
        var user=new ru.sport.domain.UserEntity();user.sportsRoles.addAll(List.of(Api.SportsRole.values()));
        assertThat(Views.sportsRoles(user)).containsExactly(Api.SportsRole.ATHLETE,Api.SportsRole.SPORTS_ORGANIZER);
        user.admin=true;assertThat(Views.sportsRoles(user)).isEmpty();
        var views=new Views(null,null,mapper);
        assertThat(views.rating(user).points()).isZero();assertThat(views.rating(user).rulesVersion()).isEqualTo("disabled");
        assertThat(PageResult.of(List.of(1,2),0,2,5).totalPages()).isEqualTo(3);
        for(int[] values:new int[][]{{-1,20},{0,0},{0,101},{Integer.MAX_VALUE,100}})
            assertThatThrownBy(()->PageResult.offset(values[0],values[1])).isInstanceOf(Problem.class);
    }
}
