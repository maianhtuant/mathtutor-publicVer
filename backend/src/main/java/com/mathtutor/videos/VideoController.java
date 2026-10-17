package com.mathtutor.videos;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.security.CurrentUser;
import com.mathtutor.practice.QuickPracticeService.CheckRequest;
import com.mathtutor.videos.VideoService.ReorderRequest;
import com.mathtutor.videos.VideoService.SubjectRequest;
import com.mathtutor.videos.VideoService.VideoRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class VideoController {

    private final VideoService videos;
    private final CurrentUser currentUser;

    public VideoController(VideoService videos, CurrentUser currentUser) {
        this.videos = videos;
        this.currentUser = currentUser;
    }

    // Public (PUBLIC videos without login; PRIVATE ones once signed in).

    @GetMapping("/subjects")
    public List<Map<String, Object>> subjects() {
        return videos.subjects(currentUser.optional(), false);
    }

    @GetMapping("/videos")
    public List<Map<String, Object>> list(@RequestParam(required = false) UUID subjectId,
                                          @RequestParam(required = false) String q) {
        return videos.list(currentUser.optional(), subjectId, q);
    }

    @GetMapping("/videos/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return videos.get(currentUser.optional(), id);
    }

    @PostMapping("/videos/{id}/practice")
    public Map<String, Object> practice(@PathVariable UUID id) {
        return videos.practiceQuestion(currentUser.require(), id);
    }

    @PostMapping("/videos/{id}/practice/check")
    public Map<String, Object> check(@PathVariable UUID id, @Valid @RequestBody CheckRequest req) {
        return videos.checkPractice(currentUser.require(), id, req);
    }

    // Admin

    @GetMapping("/admin/videos")
    public List<Map<String, Object>> adminList() {
        currentUser.requireStaff();
        return videos.adminList();
    }

    @PostMapping("/admin/videos")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody VideoRequest req) {
        return videos.create(currentUser.requireContent(), req);
    }

    @PatchMapping("/admin/videos/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody VideoRequest req) {
        return videos.update(currentUser.requireContent(), id, req);
    }

    @DeleteMapping("/admin/videos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        currentUser.requireContent();
        videos.delete(id);
    }

    @GetMapping("/admin/subjects")
    public List<Map<String, Object>> adminSubjects() {
        return videos.subjects(currentUser.requireStaff(), true);
    }

    @PostMapping("/admin/subjects")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createSubject(@Valid @RequestBody SubjectRequest req) {
        currentUser.requireContent();
        return videos.createSubject(req);
    }

    @PostMapping("/admin/subjects/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderSubjects(@Valid @RequestBody ReorderRequest req) {
        currentUser.requireContent();
        videos.reorderSubjects(req);
    }

    @PatchMapping("/admin/subjects/{id}")
    public Map<String, Object> updateSubject(@PathVariable UUID id, @Valid @RequestBody SubjectRequest req) {
        currentUser.requireContent();
        return videos.updateSubject(id, req);
    }

    @PostMapping("/admin/subjects/{id}/to-chapter")
    public Map<String, Object> toChapter(@PathVariable UUID id) {
        return videos.convertSubjectToChapter(currentUser.requireContent().id(), id);
    }

    @DeleteMapping("/admin/subjects/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubject(@PathVariable UUID id) {
        currentUser.requireContent();
        videos.deleteSubject(id);
    }
}
