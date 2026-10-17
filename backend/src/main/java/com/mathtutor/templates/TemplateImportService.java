package com.mathtutor.templates;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.mathtutor.common.ApiException;
import com.mathtutor.mathservice.MathServiceClient;
import com.mathtutor.templates.TemplateModels.VersionContent;

/**
 * Imports a template bank file (e.g. math-templates/ged-math-templates.json) into math templates.
 *
 * <ul>
 *   <li>Each source template becomes a template + version 1, validated by the math-service and published when valid.</li>
 *   <li>Templates go under a root subject (default "GED") with one sub-subject per source category, or, when the template
 *       or the file has a {@code subject_path} such as "Math-Template/Basic-Math/Area-and-Perimeter", under that path
 *       (missing folders are created).</li>
 *   <li>{@code derived_variables} become variables of type "derived".</li>
 *   <li>Only numeric answers are supported by the grader today; other answer modes and diagram-based templates are
 *       reported as skipped. Already-imported templates (same source id) are skipped, so the import can be re-run.</li>
 * </ul>
 */
@Service
public class TemplateImportService {
    private static final Logger log = LoggerFactory.getLogger(TemplateImportService.class);
    private static final int MAX_TEMPLATES = 1000;

    private final JdbcClient jdbc;
    private final TemplateService templates;
    private final MathServiceClient math;
    private final TransactionTemplate tx;

    public TemplateImportService(JdbcClient jdbc, TemplateService templates, MathServiceClient math, TransactionTemplate tx) {
        this.jdbc = jdbc;
        this.templates = templates;
        this.math = math;
        this.tx = tx;
    }

    public Map<String, Object> importBank(UUID adminId, Map<String, Object> bank, String rootSubjectName, boolean publish) {
        Object raw = bank.get("templates");
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            throw ApiException.badRequest("invalid_file", "The file has no \"templates\" list");
        }
        if (list.size() > MAX_TEMPLATES) {
            throw ApiException.badRequest("too_many", "At most " + MAX_TEMPLATES + " templates per file");
        }
        String rootName = rootSubjectName == null || rootSubjectName.isBlank() ? "GED" : rootSubjectName.strip();
        String filePath = str(bank.get("subject_path"));

        List<Map<String, Object>> published = new ArrayList<>();
        List<Map<String, Object>> drafts = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        Map<String, UUID> categorySubjects = new LinkedHashMap<>();
        // Where templates went, e.g. "GED › Fractions" -> subject id.
        Map<String, UUID> locations = new LinkedHashMap<>();

        for (Object o : list) {
            if (!(o instanceof Map<?, ?> m)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> t = (Map<String, Object>) m;
            String sourceId = str(t.get("id"));
            String label = str(t.get("label"));
            String ref = sourceId + " " + label;
            String mode = str(t.get("answer_mode"));
            if (sourceId.isBlank() || label.isBlank()) {
                skipped.add(entry(ref, "missing id or label"));
                continue;
            }
            if (!"numeric".equals(mode)) {
                skipped.add(entry(ref, "answer type “" + mode + "” needs grading that is not supported yet (numeric only)"));
                continue;
            }
            if (t.get("diagram") != null) {
                skipped.add(entry(ref, "needs a diagram, which is not supported yet"));
                continue;
            }
            String externalId = "bank:" + sourceId;
            boolean exists = jdbc.sql("SELECT count(*) FROM math_templates WHERE external_id = :x").param("x", externalId)
                    .query(Long.class).single() > 0;
            if (exists) {
                skipped.add(entry(ref, "already imported"));
                continue;
            }
            String category = str(t.get("category"));
            String path = str(t.get("subject_path")).isBlank() ? filePath : str(t.get("subject_path"));
            List<String> segments = !path.isBlank() ? splitPath(path)
                    : category.isBlank() ? List.of(rootName) : List.of(rootName, category);
            String where = String.join(" › ", segments);
            UUID subjectId = locations.computeIfAbsent(where, w -> tx.execute(s -> subjectPath(segments)));
            if (path.isBlank() && !category.isBlank()) {
                categorySubjects.putIfAbsent(category, subjectId);
            }
            try {
                VersionContent content = content(t);
                UUID templateId = tx.execute(s -> create(adminId, t, content, subjectId, externalId));
                var version = templates.get(templateId).versions().getFirst();
                var check = math.validate(templates.toConfig(version), 5);
                if (check.valid() && publish) {
                    templates.publish(UUID.fromString(version.id()));
                    published.add(entry(ref, where));
                } else {
                    drafts.add(entry(ref, check.valid() ? "left as draft"
                            : check.errors().stream().map(e -> e.message()).reduce((a, b) -> a + "; " + b).orElse("invalid")));
                }
            } catch (ApiException e) {
                skipped.add(entry(ref, e.getMessage()));
            } catch (RuntimeException e) {
                log.warn("Import of {} failed", ref, e);
                skipped.add(entry(ref, "could not be imported: " + e.getMessage()));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("title", str(bank.get("title")));
        out.put("total", list.size());
        out.put("published", published);
        out.put("drafts", drafts);
        out.put("skipped", skipped);
        out.put("subject", rootName);
        out.put("categories", new ArrayList<>(categorySubjects.keySet()));
        out.put("locations", new ArrayList<>(locations.keySet()));
        return out;
    }

    private UUID create(UUID adminId, Map<String, Object> t, VersionContent content, UUID subjectId, String externalId) {
        String subjectName = jdbc.sql("SELECT name FROM subjects WHERE id = :id").param("id", subjectId).query(String.class).single();
        UUID id = jdbc.sql("""
                INSERT INTO math_templates (label, topic_code, subject, subject_id, active, created_by, external_id, notes)
                VALUES (:label, :topic, :subject, :sid, :active, :by, :x, :notes) RETURNING id
                """).param("label", truncate(str(t.get("label")), 200)).param("topic", topicCode(t))
                .param("subject", subjectName).param("sid", subjectId)
                .param("active", !Boolean.FALSE.equals(t.get("active"))).param("by", adminId)
                .param("x", externalId).param("notes", notes(t)).query(UUID.class).single();
        templates.createVersion(id, content);
        return id;
    }

    /** Map the bank's fields onto our template version content. */
    @SuppressWarnings("unchecked")
    private VersionContent content(Map<String, Object> t) {
        Map<String, Object> variables = new LinkedHashMap<>();
        if (t.get("variables") instanceof Map<?, ?> vars) {
            vars.forEach((k, v) -> variables.put(String.valueOf(k), v));
        }
        if (t.get("derived_variables") instanceof Map<?, ?> derived) {
            derived.forEach((k, f) -> variables.put(String.valueOf(k), Map.of("type", "derived", "formula", String.valueOf(f))));
        }
        List<String> constraints = t.get("constraints") instanceof List<?> c ? c.stream().map(String::valueOf).toList() : List.of();
        return new VersionContent(str(t.get("template")), str(t.get("answer_formula")), "numeric",
                num(t.get("min_value"), BigDecimal.ONE), num(t.get("max_value"), BigDecimal.TEN), variables, constraints,
                num(t.get("grading_tolerance_percent"), BigDecimal.ZERO), num(t.get("absolute_tolerance"), BigDecimal.ZERO),
                num(t.get("decimal_places"), BigDecimal.valueOf(2)).intValue(), Boolean.TRUE.equals(t.get("accept_rounded_decimal")), List.of(),
                figure(t.get("figure")));
    }

    /** "Math-Template/Basic-Math/Area-and-Perimeter" (or "A › B") -> its folder names. */
    private static List<String> splitPath(String path) {
        return java.util.Arrays.stream(path.split("/|›")).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }

    /** The subject at the end of a folder path, creating the folders that don't exist yet. */
    private UUID subjectPath(List<String> segments) {
        UUID parent = null;
        for (String name : segments) {
            parent = subject(name, parent);
        }
        return parent;
    }

    /** Find a subject by name (case-insensitive) or create it under the given parent. */
    private UUID subject(String name, UUID parentId) {
        return jdbc.sql("SELECT id FROM subjects WHERE lower(name) = lower(:n)").param("n", name).query(UUID.class).optional()
                .orElseGet(() -> jdbc.sql("""
                        INSERT INTO subjects (name, parent_id, display_order) VALUES (:n, :p,
                            (SELECT COALESCE(max(display_order), 0) + 1 FROM subjects WHERE parent_id IS NOT DISTINCT FROM :p))
                        RETURNING id
                        """).param("n", truncate(name, 60)).param("p", parentId).query(UUID.class).single());
    }

    private static String topicCode(Map<String, Object> t) {
        String slug = str(t.get("label")).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        return truncate(slug.isEmpty() ? "topic_" + str(t.get("id")).toLowerCase(Locale.ROOT) : slug, 80);
    }

    private String notes(Map<String, Object> t) {
        List<String> parts = new ArrayList<>();
        parts.add("Source: " + str(t.get("id")) + (str(t.get("category")).isBlank() ? "" : " · " + str(t.get("category"))));
        if (t.get("ged_targets") instanceof List<?> targets && !targets.isEmpty()) {
            parts.add("GED targets: " + String.join(", ", targets.stream().map(String::valueOf).toList()));
        }
        if (!str(t.get("explanation")).isBlank()) {
            parts.add("Explanation: " + str(t.get("explanation")));
        }
        if (!str(t.get("grading_requirements")).isBlank()) {
            parts.add("Grading: " + str(t.get("grading_requirements")));
        }
        return String.join("\n", parts);
    }

    private static Map<String, Object> entry(String ref, String detail) {
        return Map.of("template", ref, "detail", detail == null ? "" : detail);
    }

    /** Optional "figure" object, passed to the math-service as is (it checks the shape and labels). */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> figure(Object o) {
        return o instanceof Map<?, ?> m && !m.isEmpty() ? (Map<String, Object>) m : null;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).strip();
    }

    private static BigDecimal num(Object o, BigDecimal fallback) {
        if (o instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        try {
            return o == null ? fallback : new BigDecimal(o.toString());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

}
