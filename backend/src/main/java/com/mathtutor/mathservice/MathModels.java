package com.mathtutor.mathservice;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Request/response shapes of the Python math-service (camelCase JSON). */
public final class MathModels {
    private MathModels() {}

    public record TemplateConfig(String promptTemplate, String answerFormula, String answerMode,
                                 BigDecimal defaultMin, BigDecimal defaultMax, Map<String, Object> variables,
                                 List<String> constraints, BigDecimal relativeTolerancePercent,
                                 BigDecimal absoluteTolerance, int decimalPlaces, boolean acceptRoundedDecimal,
                                 List<String> wrongAnswerFormulas, Map<String, Object> figure) {}

    public record GenerateRequest(TemplateConfig template, int count, String seed, String salt,
                                  Map<String, Object> overrides) {}

    public record BatchRequest(List<GenerateRequest> groups) {}

    public record ValidateRequest(TemplateConfig template, int sampleCount) {}

    public record Option(String latex, String value, boolean isCorrect) {}

    public record Item(Map<String, String> variables, String promptLatex, String fingerprint,
                       String expectedNumerator, String expectedDenominator, String answerDisplay,
                       String roundedAnswer, List<Option> options, Boolean approximate, String figureSvg) {}

    public record GenerateResponse(String engineVersion, List<Item> items, List<String> warnings,
                                   List<List<String>> interchangeableGroups, String answerFormulaLatex) {}

    public record BatchResponse(String engineVersion, List<GenerateResponse> groups) {}

    public record ValidationError(String code, String message) {}

    public record ValidateResponse(boolean valid, List<ValidationError> errors, List<String> warnings,
                                   Map<String, Object> variables, String answerFormulaLatex, List<Item> samples,
                                   String engineVersion) {}
}
