package com.mathtutor.templates;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class TemplateModels {
    private TemplateModels() {}

    /** Editable content of a template version (all fields shown on the admin form). */
    public record VersionContent(
            @NotBlank @Size(max = 4000) String promptTemplate,
            @Size(max = 500) String answerFormula,
            @NotNull @Pattern(regexp = "numeric|multiple_choice|display_only") String answerMode,
            BigDecimal defaultMin,
            BigDecimal defaultMax,
            Map<String, Object> variables,
            @Size(max = 20) List<@Size(max = 200) String> constraints,
            @DecimalMin("0") @DecimalMax("100") BigDecimal relativeTolerancePercent,
            @DecimalMin("0") BigDecimal absoluteTolerance,
            @Min(0) @Max(12) Integer decimalPlaces,
            Boolean acceptRoundedDecimal,
            /** Multiple choice only: formulas for wrong answers, e.g. "a+b". */
            @Size(max = 6) List<@Size(max = 200) String> wrongAnswerFormulas,
            /** Optional labelled shape, e.g. {"shape": "rectangle", "labels": {"width": "{l} cm"}}. */
            Map<String, Object> figure) {}

    public record CreateTemplateRequest(
            @NotBlank @Size(max = 200) String label,
            @NotBlank @Size(max = 80) @Pattern(regexp = "[a-z0-9_]+", message = "use lowercase letters, digits and _") String topicCode,
            @Size(max = 80) String subject,
            Boolean active,
            @NotNull @Valid VersionContent version,
            UUID subjectId,
            /** Place instead of subjectId: "subject", "course", "chapter", "lesson" or "none", with placeId. */
            @Pattern(regexp = "subject|course|chapter|lesson|none") String placeType, UUID placeId) {}

    /** Move several templates to one place (placeType + placeId), or to subjectId when placeType is null. */
    public record MoveTemplatesRequest(@NotEmpty @Size(max = 1000) List<@NotNull UUID> ids, UUID subjectId,
                                       @Pattern(regexp = "subject|course|chapter|lesson|none") String placeType, UUID placeId) {}

    /** Templates to delete (Math templates page, multiple selection). */
    public record DeleteTemplatesRequest(@NotEmpty @Size(max = 1000) List<@NotNull UUID> ids) {}

    /** Archive (archived = true: inactive, shown only under Archive) or restore several templates. */
    public record ArchiveTemplatesRequest(@NotEmpty @Size(max = 1000) List<@NotNull UUID> ids, @NotNull Boolean archived) {}

    public record UpdateTemplateRequest(
            @Size(max = 200) String label,
            @Size(max = 80) @Pattern(regexp = "[a-z0-9_]+") String topicCode,
            @Size(max = 80) String subject,
            Boolean active,
            UUID subjectId, Boolean clearSubject,
            /** Sets the place (subject, course, chapter or lesson; "none" clears it); wins over subjectId. */
            @Pattern(regexp = "subject|course|chapter|lesson|none") String placeType, UUID placeId) {}

    public record PreviewRequest(@Min(1) @Max(50) Integer count, String seed, Map<String, Object> overrides) {}

    public record VersionView(String id, String templateId, int versionNo, String status, String promptTemplate,
                              String answerFormula, String answerMode, BigDecimal defaultMin, BigDecimal defaultMax,
                              Map<String, Object> variables, List<Object> constraints,
                              BigDecimal relativeTolerancePercent, BigDecimal absoluteTolerance, int decimalPlaces,
                              boolean acceptRoundedDecimal, String engineVersion, String createdAt,
                              List<String> wrongAnswerFormulas, Map<String, Object> figure) {}

    /**
     * subject = the subject's name (or legacy free text when there is none). placeType/placeId = where the template
     * sits (subject, course, chapter or lesson); subjectId, courseId and chapterId include what is above that place.
     */
    public record TemplateView(String id, String label, String topicCode, String subject, String subjectId, boolean active,
                               String createdAt, List<VersionView> versions, String notes, String externalId,
                               String placeType, String placeId, String courseId, String chapterId, String lessonId,
                               String createdBy, String createdByName) {}
}
