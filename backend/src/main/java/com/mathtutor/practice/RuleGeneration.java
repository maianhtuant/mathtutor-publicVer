package com.mathtutor.practice;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.mathtutor.mathservice.MathModels.GenerateRequest;
import com.mathtutor.mathservice.MathModels.GenerateResponse;
import com.mathtutor.mathservice.MathModels.Item;
import com.mathtutor.templates.TemplateService;

/**
 * Turns practice-set rows into math-service generation groups.
 *
 * Rows that use the same template version (and the same range overrides) are generated as ONE group and
 * then split in row order, so e.g. "5 fill-in + 3 multiple choice" of the same LCM template never repeats
 * a question within an attempt. The group is generated as multiple choice when any of its rows needs
 * options; fill-in rows simply drop them.
 */
public final class RuleGeneration {
    private RuleGeneration() {}

    /** One practice-set row; mode is the effective answer mode ("numeric" or "multiple_choice"). */
    public record Row(UUID versionId, Map<String, Object> overrides, int count, String mode, int position) {}

    record Group(UUID versionId, Map<String, Object> overrides, List<Integer> members) {}

    public record Plan(List<GenerateRequest> requests, List<Group> groups, List<Row> rows) {
        /** Items for each row (same order as rows), after the batch call. */
        public List<List<Item>> split(List<GenerateResponse> responses) {
            List<List<Item>> out = new ArrayList<>();
            rows.forEach(r -> out.add(List.of()));
            for (int g = 0; g < groups.size(); g++) {
                List<Item> items = responses.get(g).items();
                int from = 0;
                for (int idx : groups.get(g).members()) {
                    Row row = rows.get(idx);
                    List<Item> mine = new ArrayList<>();
                    for (Item it : items.subList(from, Math.min(items.size(), from + row.count()))) {
                        mine.add("multiple_choice".equals(row.mode()) ? it
                                : new Item(it.variables(), it.promptLatex(), it.fingerprint(), it.expectedNumerator(),
                                        it.expectedDenominator(), it.answerDisplay(), it.roundedAnswer(), List.of(), it.approximate(),
                                        it.figureSvg()));
                    }
                    from += row.count();
                    out.set(idx, mine);
                }
            }
            return out;
        }
    }

    public static Plan plan(List<Row> rows, String seed, TemplateService templates) {
        Map<String, Group> groups = new LinkedHashMap<>();
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            Map<String, Object> overrides = r.overrides() == null ? Map.of() : r.overrides();
            groups.computeIfAbsent(r.versionId() + "|" + overrides, k -> new Group(r.versionId(), overrides, new ArrayList<>()))
                    .members().add(i);
        }
        List<GenerateRequest> requests = new ArrayList<>();
        for (Group g : groups.values()) {
            var version = templates.version(g.versionId());
            int count = g.members().stream().mapToInt(i -> rows.get(i).count()).sum();
            boolean choice = g.members().stream().anyMatch(i -> "multiple_choice".equals(rows.get(i).mode()));
            int position = rows.get(g.members().getFirst()).position();
            requests.add(new GenerateRequest(templates.toConfig(version, choice ? "multiple_choice" : "numeric"),
                    count, seed + ":" + position, version.id(), g.overrides()));
        }
        return new Plan(requests, new ArrayList<>(groups.values()), rows);
    }

    /** Row mode wins; otherwise the template's own mode. */
    public static String effectiveMode(String rowMode, String templateMode) {
        return rowMode != null ? rowMode : templateMode;
    }
}
