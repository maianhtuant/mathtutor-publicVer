package com.mathtutor.templates;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.mathservice.MathModels.ValidateResponse;
import com.mathtutor.security.CurrentUser;
import com.mathtutor.templates.TemplateModels.ArchiveTemplatesRequest;
import com.mathtutor.templates.TemplateModels.CreateTemplateRequest;
import com.mathtutor.templates.TemplateModels.DeleteTemplatesRequest;
import com.mathtutor.templates.TemplateModels.MoveTemplatesRequest;
import com.mathtutor.templates.TemplateModels.PreviewRequest;
import com.mathtutor.templates.TemplateModels.TemplateView;
import com.mathtutor.templates.TemplateModels.UpdateTemplateRequest;
import com.mathtutor.templates.TemplateModels.VersionContent;
import com.mathtutor.templates.TemplateModels.VersionView;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminTemplateController {

    private final TemplateService templates;
    private final TemplateImportService importer;
    private final CurrentUser currentUser;

    public AdminTemplateController(TemplateService templates, TemplateImportService importer, CurrentUser currentUser) {
        this.templates = templates;
        this.importer = importer;
        this.currentUser = currentUser;
    }

    @GetMapping("/math-templates")
    public List<Map<String, Object>> list() {
        currentUser.requireStaff();
        return templates.list();
    }

    @GetMapping("/template-versions/published")
    public List<Map<String, Object>> published() {
        currentUser.requireStaff();
        return templates.publishedVersions();
    }

    @PostMapping("/math-templates")
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateView create(@Valid @RequestBody CreateTemplateRequest req) {
        return templates.create(currentUser.requireAuthor().id(), req);
    }

    @PostMapping("/math-templates/validate")
    public ValidateResponse validate(@Valid @RequestBody VersionContent content) {
        currentUser.requireAuthor();
        return templates.validateContent(content);
    }

    /** Import a template bank file (JSON with a "templates" list), e.g. math-templates/ged-math-templates.json. */
    @PostMapping("/math-templates/import")
    public Map<String, Object> importBank(@RequestBody Map<String, Object> bank,
                                          @org.springframework.web.bind.annotation.RequestParam(defaultValue = "GED") String subject,
                                          @org.springframework.web.bind.annotation.RequestParam(defaultValue = "true") boolean publish) {
        return importer.importBank(currentUser.requireAuthor().id(), bank, subject, publish);
    }

    /** Bulk move to another subject / sub-subject (Math templates page). */
    @PostMapping("/math-templates/move")
    public Map<String, Object> move(@Valid @RequestBody MoveTemplatesRequest req) {
        ownAll(req.ids());
        return Map.of("moved", templates.move(req));
    }

    /** Bulk archive / restore (Math templates page). */
    @PostMapping("/math-templates/archive")
    public Map<String, Object> archive(@Valid @RequestBody ArchiveTemplatesRequest req) {
        ownAll(req.ids());
        return Map.of("changed", templates.archive(req));
    }

    /** Bulk delete; templates still in use are kept and listed with the reason. */
    @PostMapping("/math-templates/delete")
    public Map<String, Object> delete(@Valid @RequestBody DeleteTemplatesRequest req) {
        ownAll(req.ids());
        return templates.delete(req);
    }

    @GetMapping("/math-templates/{id}")
    public TemplateView get(@PathVariable UUID id) {
        currentUser.requireStaff();
        return templates.get(id);
    }

    @PatchMapping("/math-templates/{id}")
    public TemplateView update(@PathVariable UUID id, @Valid @RequestBody UpdateTemplateRequest req) {
        currentUser.requireOwner(templates.creatorOf(id), "templates");
        return templates.update(id, req);
    }

    @PostMapping("/math-templates/{id}/versions")
    @ResponseStatus(HttpStatus.CREATED)
    public VersionView createVersion(@PathVariable UUID id, @Valid @RequestBody(required = false) VersionContent content) {
        currentUser.requireOwner(templates.creatorOf(id), "templates");
        return templates.createVersion(id, content);
    }

    @GetMapping("/template-versions/{id}")
    public VersionView version(@PathVariable UUID id) {
        currentUser.requireStaff();
        return templates.version(id);
    }

    @PatchMapping("/template-versions/{id}")
    public VersionView updateDraft(@PathVariable UUID id, @Valid @RequestBody VersionContent content) {
        currentUser.requireOwner(templates.creatorOfVersion(id), "templates");
        return templates.updateDraft(id, content);
    }

    @PostMapping("/template-versions/{id}/preview")
    public Map<String, Object> preview(@PathVariable UUID id, @Valid @RequestBody(required = false) PreviewRequest req) {
        currentUser.requireStaff();
        return templates.preview(id, req);
    }

    @PostMapping("/template-versions/{id}/publish")
    public VersionView publish(@PathVariable UUID id) {
        currentUser.requireOwner(templates.creatorOfVersion(id), "templates");
        return templates.publish(id);
    }

    @PostMapping("/template-versions/{id}/archive")
    public VersionView archive(@PathVariable UUID id) {
        currentUser.requireOwner(templates.creatorOfVersion(id), "templates");
        return templates.archive(id);
    }

    /** Bulk actions: a teacher must have created every template in the list. */
    private void ownAll(List<UUID> ids) {
        var p = currentUser.requireAuthor();
        if (!p.editsAllContent()) {
            templates.creators(ids).forEach(c -> currentUser.requireOwner(c, "templates"));
        }
    }
}
