package ru.sport.service;

import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sport.api.*;
import ru.sport.domain.*;
import ru.sport.persistence.Store;

@Service
@Transactional(readOnly=true)
public class QuestionnaireService {
    private final Store db;
    private final Access access;
    private final SportsCatalog catalog;
    private final Clock clock;

    public QuestionnaireService(Store db, Access access, SportsCatalog catalog, Clock clock) {
        this.db=db; this.access=access; this.catalog=catalog; this.clock=clock;
    }

    public Api.Questionnaire get() { return dto(access.user()); }

    @Transactional
    public Api.Questionnaire save(Api.QuestionnaireAnswers answers) {
        try { ZoneId.of(answers.timeZone()); }
        catch (DateTimeException ex) { throw Problem.invalid("Неизвестный часовой пояс"); }
        var user=db.lock(UserEntity.class,access.user().id);
        var seen=new HashSet<UUID>();
        var preferences=new ArrayList<SportPreference>();
        for (var answer:answers.sportsPreferences()) {
            UUID sport=catalog.resolve(answer.sportId()).id;
            if (!seen.add(sport)) throw Problem.invalid("Вид спорта указан дважды");
            preferences.add(new SportPreference(sport,answer.level()));
        }
        user.city=answers.city().strip();
        user.preferredTime=answers.preferredTime().name();
        user.recommendationTimeZone=answers.timeZone();
        user.sportsPreferences.clear();
        user.sportsPreferences.addAll(preferences);
        user.questionnaireStatus="COMPLETED";
        user.questionnaireCompletedAt=clock.instant();
        user.updatedAt=clock.instant();
        db.flush();
        return dto(user);
    }

    @Transactional
    public Api.Questionnaire skip() {
        var user=db.lock(UserEntity.class,access.user().id);
        // Cancelling a repeated questionnaire never destroys existing answers.
        if (!user.questionnaireStatus.equals("COMPLETED")) {
            user.questionnaireStatus="SKIPPED";
            user.updatedAt=clock.instant();
        }
        db.flush();
        return dto(user);
    }

    private Api.Questionnaire dto(UserEntity user) {
        return new Api.Questionnaire(Api.QuestionnaireStatus.valueOf(user.questionnaireStatus),
            user.questionnaireCompletedAt,user.city,
            user.sportsPreferences.stream().map(p -> new Api.SportsPreference(p.sportId,p.level)).toList(),
            user.preferredTime,user.recommendationTimeZone);
    }
}
