package com.mathtutor.practice;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.practice.PracticeModels.CreateQuestionRequest;
import com.mathtutor.practice.PracticeModels.CreateSetRequest;
import com.mathtutor.practice.PracticeModels.FixedQuestionsRequest;
import com.mathtutor.practice.PracticeModels.RulesRequest;
import com.mathtutor.practice.PracticeModels.UpdateSetRequest;
import com.mathtutor.security.CurrentUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminPracticeSetController {

    private final PracticeSetService sets;
    private final CurrentUser currentUser;

    public AdminPracticeSetController(PracticeSetService sets, CurrentUser currentUser) {
        this.sets = sets;
        this.currentUser = currentUser;
    }

    @GetMapping("/practice-sets")
    public List<Map<String, Object>> list(@RequestParam(required = false) UUID courseId) {
        currentUser.requireStaff();
        return sets.list(courseId);
    }

    @PostMapping("/practice-sets")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody CreateSetRequest req) {
        return sets.create(currentUser.requireAuthor().id(), req);
    }

    @GetMapping("/practice-sets/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        currentUser.requireStaff();
        return sets.get(id);
    }

    @PatchMapping("/practice-sets/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody UpdateSetRequest req) {
        currentUser.requireOwner(sets.creatorOf(id), "practice sets");
        return sets.update(id, req);
    }

    @PutMapping("/practice-sets/{id}/rules")
    public Map<String, Object> rules(@PathVariable UUID id, @Valid @RequestBody RulesRequest req) {
        currentUser.requireOwner(sets.creatorOf(id), "practice sets");
        return sets.putRules(id, req.rules());
    }

    @PutMapping("/practice-sets/{id}/questions")
    public Map<String, Object> questions(@PathVariable UUID id, @Valid @RequestBody FixedQuestionsRequest req) {
        currentUser.requireOwner(sets.creatorOf(id), "practice sets");
        return sets.putQuestions(id, req.questions());
    }

    @PostMapping("/practice-sets/{id}/preview")
    public Map<String, Object> preview(@PathVariable UUID id) {
        currentUser.requireStaff();
        return sets.preview(id);
    }

    @PostMapping("/practice-sets/{id}/publish")
    public Map<String, Object> publish(@PathVariable UUID id) {
        currentUser.requireOwner(sets.creatorOf(id), "practice sets");
        return sets.publish(id);
    }

    @PostMapping("/practice-sets/{id}/archive")
    public Map<String, Object> archive(@PathVariable UUID id) {
        currentUser.requireOwner(sets.creatorOf(id), "practice sets");
        return sets.archive(id);
    }

    @GetMapping("/questions")
    public List<Map<String, Object>> listQuestions() {
        currentUser.requireStaff();
        return sets.listQuestions();
    }

    @PostMapping("/questions")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createQuestion(@Valid @RequestBody CreateQuestionRequest req) {
        return sets.createQuestion(currentUser.requireAuthor().id(), req);
    }
}
