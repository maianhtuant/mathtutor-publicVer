package com.mathtutor.attempts;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.attempts.AttemptService.AnswerRequest;
import com.mathtutor.security.CurrentUser;

@RestController
@RequestMapping("/api")
public class AttemptController {

    private final AttemptService attempts;
    private final CurrentUser currentUser;

    public AttemptController(AttemptService attempts, CurrentUser currentUser) {
        this.attempts = attempts;
        this.currentUser = currentUser;
    }

    /** Start a new attempt, or resume the open one. */
    @PostMapping("/practice-sets/{setId}/attempts")
    public Map<String, Object> start(@PathVariable UUID setId) {
        return attempts.startOrResume(currentUser.require().id(), setId);
    }

    /** Students can always view their own attempts, including after revocation. */
    @GetMapping("/attempts/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return attempts.view(id, currentUser.require().id(), false);
    }

    @PutMapping("/attempts/{id}/answers/{itemId}")
    public Map<String, Object> save(@PathVariable UUID id, @PathVariable UUID itemId, @RequestBody AnswerRequest body) {
        return attempts.saveAnswer(currentUser.require().id(), id, itemId, body);
    }

    @PostMapping("/attempts/{id}/submit")
    public Map<String, Object> submit(@PathVariable UUID id) {
        return attempts.submit(currentUser.require().id(), id);
    }
}
