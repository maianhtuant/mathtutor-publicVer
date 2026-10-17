package com.mathtutor.practice;

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
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class PracticeModels {
    private PracticeModels() {}

    public record CreateSetRequest(@NotNull UUID courseId, @NotBlank @Size(max = 200) String title,
                                   @Pattern(regexp = "practice|test") String kind,
                                   @DecimalMin("0") @DecimalMax("100") BigDecimal passPercent,
                                   @Min(1) Integer timeLimitSeconds, @Min(1) Integer maxAttempts) {}

    /** Header update; null timeLimitSeconds/maxAttempts mean "unlimited" when the clear flags are set. */
    public record UpdateSetRequest(@Size(max = 200) String title,
                                   @DecimalMin("0") @DecimalMax("100") BigDecimal passPercent,
                                   @Min(1) Integer timeLimitSeconds, @Min(1) Integer maxAttempts,
                                   Boolean clearTimeLimit, Boolean clearMaxAttempts) {}

    /** id = an existing row of this set (kept, so past attempts stay linked); null for a new row. */
    public record RuleInput(UUID id, @NotNull UUID templateVersionId, @Min(1) @Max(100) int questionCount,
                            @DecimalMin(value = "0", inclusive = false) BigDecimal pointsPerQuestion,
                            Map<String, Object> variableOverrides,
                            /** null = the template's own mode. */
                            @Pattern(regexp = "numeric|multiple_choice") String answerMode) {}

    public record RulesRequest(@NotNull @Size(max = 50) List<@Valid RuleInput> rules) {}

    public record FixedQuestionInput(@NotNull UUID questionId,
                                     @DecimalMin(value = "0", inclusive = false) BigDecimal points) {}

    public record FixedQuestionsRequest(@NotNull @Size(max = 200) List<@Valid FixedQuestionInput> questions) {}

    public record OptionInput(@NotBlank @Size(max = 1000) String text, boolean isCorrect) {}

    public record CreateQuestionRequest(@Size(max = 80) @Pattern(regexp = "[a-z0-9_]*") String topicCode,
                                        @NotBlank @Size(max = 4000) String prompt, @Size(max = 4000) String explanation,
                                        @NotNull @Size(min = 2, max = 8) List<@Valid OptionInput> options) {}
}
