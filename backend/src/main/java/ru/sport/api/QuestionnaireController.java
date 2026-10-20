package ru.sport.api;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import ru.sport.service.QuestionnaireService;

@RestController
@RequestMapping("/api/v1")
public class QuestionnaireController {
    private final QuestionnaireService questionnaires;
    public QuestionnaireController(QuestionnaireService questionnaires) { this.questionnaires=questionnaires; }
    @GetMapping("/me/questionnaire") public Api.Questionnaire get() { return questionnaires.get(); }
    @PostMapping("/me/questionnaire") public Api.Questionnaire save(@Valid @RequestBody Api.QuestionnaireAnswers answers) { return questionnaires.save(answers); }
    @PostMapping("/me/questionnaire/skip") public Api.Questionnaire skip() { return questionnaires.skip(); }
}
