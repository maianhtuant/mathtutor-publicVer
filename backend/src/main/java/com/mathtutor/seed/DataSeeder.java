package com.mathtutor.seed;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.mathtutor.common.Json;
import com.mathtutor.security.AppProperties;
import com.mathtutor.videos.VideoUrlParser;

/**
 * Creates the first administrator on an empty database and, optionally, the demo content from the design
 * document: the "LCM and Decimal Multiplication" set (5 + 5 questions) assigned to tmai@cccd.edu.
 */
@Component
public class DataSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String ENGINE = "mathengine-1.0";

    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final AppProperties props;
    private final Json json;
    private final TransactionTemplate tx;

    public DataSeeder(JdbcClient jdbc, PasswordEncoder encoder, AppProperties props, Json json, TransactionTemplate tx) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.props = props;
        this.json = json;
        this.tx = tx;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (props.seed() == null || !props.seed().enabled()) {
            return;
        }
        long users = jdbc.sql("SELECT count(*) FROM users").query(Long.class).single();
        if (users == 0) {
            tx.executeWithoutResult(s -> seed());
        }
        long subjects = jdbc.sql("SELECT count(*) FROM subjects").query(Long.class).single();
        if (subjects == 0 && props.seed().demoData()) {
            tx.executeWithoutResult(s -> seedVideos());
        }
        long sections = jdbc.sql("SELECT count(*) FROM lesson_sections").query(Long.class).single();
        if (sections == 0 && props.seed().demoData()) {
            tx.executeWithoutResult(s -> seedLessonSections());
        }
    }

    /** Readiness, goals, a free-preview lesson and sectioned lessons for the demo course (runs once). */
    private void seedLessonSections() {
        var course = jdbc.sql("SELECT id FROM courses WHERE title = 'Arithmetic Foundations'").query(UUID.class).optional();
        if (course.isEmpty()) {
            return;
        }
        jdbc.sql("UPDATE courses SET readiness = 'Whole-number multiplication and division' WHERE id = :c AND readiness IS NULL")
                .param("c", course.get()).update();
        UUID lcm = lessonId(course.get(), "Least Common Multiple");
        UUID gcd = lessonId(course.get(), "Greatest Common Divisor");
        UUID dec = lessonId(course.get(), "Multiplying Decimals");
        if (lcm != null) {
            jdbc.sql("UPDATE lessons SET goal = 'Find the smallest number that two numbers both divide into.', free_preview = true WHERE id = :l")
                    .param("l", lcm).update();
            section(lcm, 1, "Listing multiples", "https://www.youtube.com/watch?v=znmPfDfsir8",
                    "List the multiples of each number until you find the first one they share.\n\n"
                    + "Multiples of 4: 4, 8, **12**, 16 … and multiples of 6: 6, **12**, 18 … so $\\operatorname{lcm}(4, 6) = 12$.",
                    "List multiples of the larger number and stop at the first one the smaller number divides.",
                    "$\\operatorname{lcm}(8, 12)$: multiples of 12 are 12, 24, 36 … 12 is not a multiple of 8, but 24 is. Answer: **24**.",
                    "lcm", "Start with the larger number and count up in steps of it.");
            section(lcm, 2, "Using prime factors", "https://www.youtube.com/watch?v=QUem_2dkB9I",
                    "Write both numbers as prime factors and take every prime the highest number of times it appears.\n\n"
                    + "Shortcut: $\\operatorname{lcm}(a, b) = \\dfrac{a \\times b}{\\gcd(a, b)}$.",
                    null,
                    "$12 = 2^2 \\cdot 3$ and $18 = 2 \\cdot 3^2$, so $\\operatorname{lcm} = 2^2 \\cdot 3^2 = 36$.",
                    "lcm", "Multiply the numbers, then divide by their greatest common divisor.");
        }
        if (gcd != null) {
            jdbc.sql("UPDATE lessons SET goal = 'Find the largest number that divides two numbers exactly.' WHERE id = :l AND goal IS NULL")
                    .param("l", gcd).update();
            section(gcd, 1, "Common divisors", null,
                    "List the divisors of each number and pick the largest one they share.\n\nExample: $\\gcd(12, 18) = 6$.",
                    null, "Divisors of 12: 1, 2, 3, 4, **6**, 12. Divisors of 18: 1, 2, 3, **6**, 9, 18. The largest shared one is 6.",
                    null, null);
        }
        if (dec != null) {
            jdbc.sql("UPDATE lessons SET goal = 'Multiply decimals and place the decimal point correctly.' WHERE id = :l AND goal IS NULL")
                    .param("l", dec).update();
            section(dec, 1, "Where the decimal point goes", "https://www.youtube.com/watch?v=STyoP3rCmb0",
                    "Multiply as if there were no decimal points, then count the decimal places in both factors.",
                    null, "$2.4 \\times 1.5$: $24 \\times 15 = 360$; two decimal places in total, so $3.60 = 3.6$.",
                    "decimal_multiplication", "Count the digits after the decimal point in both numbers and add them.");
            section(dec, 2, "Place value and reordering", "https://www.youtube.com/watch?v=4IWfJ7-CYfE",
                    "Rewrite each decimal as a whole number times a power of ten, multiply the whole numbers, then the powers of ten.",
                    null, "$0.3 \\times 0.2 = (3 \\times 2) \\times (0.1 \\times 0.1) = 6 \\times 0.01 = 0.06$.",
                    "decimal_multiplication", null);
        }
        log.info("Seeded lesson sections, goals and readiness for the demo course");
    }

    private UUID lessonId(UUID course, String title) {
        return jdbc.sql("SELECT id FROM lessons WHERE course_id = :c AND title = :t").param("c", course).param("t", title)
                .query(UUID.class).optional().orElse(null);
    }

    private void section(UUID lesson, int position, String title, String videoUrl, String explanation, String transcript,
                         String workedExample, String topic, String hint) {
        UUID template = topic == null ? null
                : jdbc.sql("SELECT id FROM math_templates WHERE topic_code = :t ORDER BY created_at LIMIT 1")
                        .param("t", topic).query(UUID.class).optional().orElse(null);
        UUID section = jdbc.sql("""
                INSERT INTO lesson_sections (lesson_id, position, title, video_url, explanation, transcript, worked_example,
                    practice_hint)
                VALUES (:l, :p, :t, :v, :e, :tr, :w, :h) RETURNING id
                """).param("l", lesson).param("p", position).param("t", title).param("v", videoUrl).param("e", explanation)
                .param("tr", transcript).param("w", workedExample).param("h", hint).query(UUID.class).single();
        if (template != null) {
            jdbc.sql("""
                    INSERT INTO lesson_section_templates (section_id, position, math_template_id, question_count)
                    VALUES (:s, 1, :m, 2)
                    """).param("s", section).param("m", template).update();
        }
    }

    /** Subjects (GED-Tutor style) and a few verified Khan Academy lessons, linked to the demo templates. */
    private void seedVideos() {
        UUID math = subject("Math", "Arithmetic, algebra, geometry and data", 1, null);
        UUID preAlgebra = subject("Pre-Algebra", "Factors, multiples, fractions and decimals", 1, math);
        subject("Algebra", "Expressions, equations and functions", 2, math);
        subject("Science", "Life, physical and earth science", 2, null);
        subject("Social Studies", "US history, civics, economics and geography", 3, null);
        subject("Language Arts", "Reading, writing and grammar", 4, null);
        jdbc.sql("UPDATE courses SET subject_id = :s WHERE title = 'Arithmetic Foundations' AND subject_id IS NULL")
                .param("s", math).update();

        video("Least common multiple exercise", "https://www.youtube.com/watch?v=znmPfDfsir8", preAlgebra,
                "Factors and multiples", "PUBLIC", "lcm",
                "Find the least common multiple by listing multiples or by prime factorization.\n\n"
                + "Tip: $\\operatorname{lcm}(a, b) = \\dfrac{a \\times b}{\\gcd(a, b)}$.");
        video("Least common multiple exercise 2", "https://www.youtube.com/watch?v=QUem_2dkB9I", preAlgebra,
                "Factors and multiples", "PUBLIC", "lcm", "A harder least common multiple example.");
        video("Introduction to multiplying decimals", "https://www.youtube.com/watch?v=STyoP3rCmb0", preAlgebra,
                "Decimals", "PUBLIC", "decimal_multiplication",
                "Multiply as whole numbers, then count the decimal places in both factors to place the decimal point.");
        video("Multiplying decimals: place value and reordering", "https://www.youtube.com/watch?v=4IWfJ7-CYfE", preAlgebra,
                "Decimals", "PRIVATE", "decimal_multiplication",
                "Rewrite decimals using place value to build intuition for where the decimal point goes.");
        video("Finding common denominators", "https://www.youtube.com/watch?v=lxjmR4pYIVU", preAlgebra,
                "Fractions", "PUBLIC", "fraction_addition",
                "Use the least common multiple of the denominators to add fractions.");
        log.info("Seeded subjects and demo video lessons");
    }

    private UUID subject(String name, String description, int order, UUID parent) {
        return jdbc.sql("""
                INSERT INTO subjects (name, description, display_order, parent_id) VALUES (:n, :d, :o, :p) RETURNING id
                """).param("n", name).param("d", description).param("o", order).param("p", parent)
                .query(UUID.class).single();
    }

    private void video(String title, String url, UUID subject, String category, String visibility, String topic,
                       String description) {
        var parsed = VideoUrlParser.parse(url);
        UUID template = jdbc.sql("SELECT id FROM math_templates WHERE topic_code = :t ORDER BY created_at LIMIT 1")
                .param("t", topic).query(UUID.class).optional().orElse(null);
        jdbc.sql("""
                INSERT INTO videos (title, description, video_url, provider, embed_id, category, subject_id, visibility,
                    math_template_id)
                VALUES (:t, :d, :u, :p, :e, :c, :s, :v, :m)
                """).param("t", title).param("d", description).param("u", url).param("p", parsed.provider())
                .param("e", parsed.embedId()).param("c", category).param("s", subject).param("v", visibility)
                .param("m", template).update();
    }

    private void seed() {
        UUID admin = user(props.seed().adminEmail(), props.seed().adminPassword(), "Administrator", "ADMIN");
        log.info("Created administrator {}", props.seed().adminEmail());
        if (!props.seed().demoData()) {
            return;
        }
        UUID student = user("tmai@cccd.edu", "Student@123", "Tam Mai", "USER");
        user("student2@cccd.edu", "Student@123", "Second Student", "USER");

        UUID course = jdbc.sql("""
                INSERT INTO courses (title, description, status, created_by)
                VALUES ('Arithmetic Foundations', 'Multiples, factors and decimal operations.', 'published', :a) RETURNING id
                """).param("a", admin).query(UUID.class).single();
        UUID ch1 = chapter(course, "Multiples and Factors", 1);
        UUID ch2 = chapter(course, "Decimals", 2);
        lesson(ch1, course, 1, "Least Common Multiple",
                "The least common multiple (LCM) of two whole numbers is the smallest positive number that is a multiple of both.\n\n"
                + "Example: $\\operatorname{lcm}(4, 6) = 12$ because the multiples of 4 are 4, 8, 12, ... and the multiples of 6 are 6, 12, ...\n\n"
                + "Shortcut: $\\operatorname{lcm}(a, b) = \\dfrac{a \\times b}{\\gcd(a, b)}$.");
        lesson(ch1, course, 2, "Greatest Common Divisor",
                "The greatest common divisor (GCD) is the largest number that divides both numbers.\n\nExample: $\\gcd(12, 18) = 6$.");
        lesson(ch2, course, 1, "Multiplying Decimals",
                "Multiply as whole numbers, then place the decimal point.\n\n"
                + "Example: $2.4 \\times 1.5$: $24 \\times 15 = 360$, and there are two decimal places in total, so the answer is $3.60 = 3.6$.");

        UUID lcm = template(admin, "Least Common Multiple", "lcm",
                "Find the least common multiple of {a:2–20} and {b:2–20}.", "lcm(a, b)", Map.of(), List.of("a != b"));
        UUID dec = template(admin, "Decimal Multiplication", "decimal_multiplication",
                "Calculate {a} \\times {b}.", "a * b",
                Map.of("a", Map.of("type", "decimal", "min", 1.1, "max", 9.9, "scale", 1),
                       "b", Map.of("type", "decimal", "min", 1.1, "max", 9.9, "scale", 1)), List.of());
        template(admin, "Adding Fractions", "fraction_addition",
                "\\frac{{a}}{{b}} + \\frac{{c}}{{d}}", "a / b + c / d",
                Map.of("a", Map.of("min", 1, "max", 9), "b", Map.of("min", 2, "max", 9),
                       "c", Map.of("min", 1, "max", 9), "d", Map.of("min", 2, "max", 9)), List.of("b != d"));

        UUID set = jdbc.sql("""
                INSERT INTO assessments (course_id, title, kind, status, pass_percent, max_attempts, created_by)
                VALUES (:c, 'LCM and Decimal Multiplication', 'practice', 'published', 60, 5, :a) RETURNING id
                """).param("c", course).param("a", admin).query(UUID.class).single();
        rule(set, lcm, 1);
        rule(set, dec, 2);
        jdbc.sql("""
                INSERT INTO assessments (course_id, title, kind, status, pass_percent, time_limit_seconds, created_by)
                VALUES (:c, 'Decimal Speed Drill (10 min)', 'practice', 'draft', 70, 600, :a)
                """).param("c", course).param("a", admin).update();

        jdbc.sql("INSERT INTO enrollments (user_id, course_id) VALUES (:u, :c)").param("u", student).param("c", course).update();
        jdbc.sql("""
                INSERT INTO practice_assignments (user_id, assessment_id, course_id, granted_by) VALUES (:u, :s, :c, :a)
                """).param("u", student).param("s", set).param("c", course).param("a", admin).update();
        log.info("Seeded demo course, templates and practice set (student tmai@cccd.edu / Student@123)");
    }

    private UUID user(String email, String password, String name, String role) {
        return jdbc.sql("INSERT INTO users (email, password_hash, full_name, role) VALUES (:e, :p, :n, :r) RETURNING id")
                .param("e", email.toLowerCase()).param("p", encoder.encode(password)).param("n", name).param("r", role)
                .query(UUID.class).single();
    }

    private UUID chapter(UUID course, String title, int pos) {
        return jdbc.sql("INSERT INTO chapters (course_id, title, position) VALUES (:c, :t, :p) RETURNING id")
                .param("c", course).param("t", title).param("p", pos).query(UUID.class).single();
    }

    private void lesson(UUID chapter, UUID course, int pos, String title, String content) {
        jdbc.sql("""
                INSERT INTO lessons (chapter_id, course_id, title, content, position, status)
                VALUES (:ch, :c, :t, :content, :p, 'published')
                """).param("ch", chapter).param("c", course).param("t", title).param("content", content).param("p", pos)
                .update();
    }

    /** Returns the id of published version 1. */
    private UUID template(UUID admin, String label, String topic, String prompt, String formula,
                          Map<String, Object> vars, List<String> constraints) {
        UUID t = jdbc.sql("INSERT INTO math_templates (label, topic_code, created_by) VALUES (:l, :t, :a) RETURNING id")
                .param("l", label).param("t", topic).param("a", admin).query(UUID.class).single();
        return jdbc.sql("""
                INSERT INTO math_template_versions (template_id, version_no, status, prompt_template, answer_formula,
                    answer_mode, default_min, default_max, variables, constraints, engine_version)
                VALUES (:t, 1, 'published', :p, :f, 'numeric', 1, 10, CAST(:v AS jsonb), CAST(:c AS jsonb), :e)
                RETURNING id
                """).param("t", t).param("p", prompt).param("f", formula).param("v", json.write(vars))
                .param("c", json.write(constraints)).param("e", ENGINE).query(UUID.class).single();
    }

    private void rule(UUID set, UUID version, int pos) {
        jdbc.sql("""
                INSERT INTO practice_set_rules (assessment_id, template_version_id, position, question_count, points_per_question)
                VALUES (:s, :v, :p, 5, 1)
                """).param("s", set).param("v", version).param("p", pos).update();
    }
}
