package com.mathtutor.admin;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
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

import com.mathtutor.common.ApiException;
import com.mathtutor.common.Json;
import com.mathtutor.security.CurrentUser;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    public record CreateUserRequest(@NotBlank @Email @Size(max = 254) String email,
                                    @NotBlank @Size(min = 8, max = 100) String password,
                                    @NotBlank @Size(max = 150) String fullName,
                                    @Pattern(regexp = "USER|TEACHER|SUPERVISOR|EDITOR|ADMIN") String role,
                                    @Size(max = 20) List<String> tags,
                                    /** Courses to enroll the new account in. */
                                    @Size(max = 50) List<@NotNull UUID> courseIds) {}

    /** Null fields are left unchanged; tags, when given, replace the account's tags. */
    public record UpdateUserRequest(@Email @Size(max = 254) String email, @Size(max = 150) String fullName,
                                    @Pattern(regexp = "USER|TEACHER|SUPERVISOR|EDITOR|ADMIN") String role,
                                    @Pattern(regexp = "active|blocked") String status,
                                    @Size(min = 8, max = 100) String password,
                                    @Size(max = 20) List<String> tags) {}

    /** What a teacher teaches: their students are those enrolled in these courses or carrying one of these tags. */
    public record TeachingRequest(@NotNull @Size(max = 200) List<@NotNull UUID> courseIds, @NotNull @Size(max = 20) List<String> tags) {}

    /** One action applied to many accounts at once. */
    public record BulkRequest(@NotNull @Size(min = 1, max = 500) List<UUID> userIds,
                              @NotNull @Pattern(regexp = "assign_set|revoke_set|enroll_course|unenroll_course|add_tag|remove_tag|block|activate") String action,
                              UUID setId, UUID courseId, @Size(max = 40) String tag) {}

    private static final String USER_COLUMNS = """
            u.id, u.email, u.full_name AS "fullName", u.role, u.status, array_to_json(u.tags)::text AS tags,
            COALESCE((SELECT json_agg(c.title ORDER BY c.title) FROM enrollments e JOIN courses c ON c.id = e.course_id
                      WHERE e.user_id = u.id AND e.status = 'active')::text, '[]') AS courses
           """; 
    private static final java.util.regex.Pattern TAG = java.util.regex.Pattern.compile("[\\p{L}0-9][\\p{L}0-9._-]{0,39}");

    private final JdbcClient jdbc;
    private final CurrentUser currentUser;
    private final AssignmentService assignments;
    private final PasswordEncoder encoder;
    private final Json json;

    public AdminUserController(JdbcClient jdbc, CurrentUser currentUser, AssignmentService assignments,
                               PasswordEncoder encoder, Json json) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.assignments = assignments;
        this.encoder = encoder;
        this.json = json;
    }

    /**
     * Search accounts. {@code q} matches email, name or a tag (partial); role, status and tag are exact filters.
     */
    @GetMapping
    public List<Map<String, Object>> search(@RequestParam(required = false, defaultValue = "") String q,
                                            @RequestParam(required = false, defaultValue = "") String role,
                                            @RequestParam(required = false, defaultValue = "") String status,
                                            @RequestParam(required = false, defaultValue = "") String tag) {
        var p = currentUser.requirePeople();
        // A teacher only finds their own students.
        String scope = p.seesAllStudents() ? "TRUE" : "u.role = 'USER' AND " + CurrentUser.teacherStudents("u.id");
        return withTags(jdbc.sql("SELECT " + USER_COLUMNS + " FROM users u WHERE " + scope + """

                  AND (:q = '' OR lower(u.email) LIKE '%' || lower(:q) || '%' OR lower(u.full_name) LIKE '%' || lower(:q) || '%'
                       OR EXISTS (SELECT 1 FROM unnest(u.tags) t WHERE lower(t) LIKE '%' || lower(ltrim(:q, '#')) || '%'))
                  AND (:role = '' OR u.role = :role)
                  AND (:status = '' OR u.status = :status)
                  AND (:tag = '' OR EXISTS (SELECT 1 FROM unnest(u.tags) t WHERE lower(t) = lower(ltrim(:tag, '#'))))
                ORDER BY u.email LIMIT 500
                """).param("scopeTeacher", CurrentUser.scopeParam(p)).param("q", q.strip()).param("role", role.strip().toUpperCase()).param("status", status.strip().toLowerCase())
                .param("tag", tag.strip()).query().listOfRows());
    }

    /** Every tag in use with the number of accounts carrying it. */
    @GetMapping("/tags")
    public List<Map<String, Object>> tags() {
        currentUser.requirePeople();
        return jdbc.sql("""
                SELECT min(t) AS tag, count(*) AS "count" FROM users, unnest(tags) t GROUP BY lower(t) ORDER BY lower(t)
                """).query().listOfRows();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> create(@Valid @RequestBody CreateUserRequest req) {
        var p = currentUser.requireTeacherOrAdmin();
        List<String> tags = normalizeTags(req.tags());
        List<UUID> courses = req.courseIds() == null ? List.of() : req.courseIds().stream().distinct().toList();
        if (p.isTeacher()) {
            // A teacher creates students only, inside their own courses or classes, so the student is theirs.
            if (req.role() != null && !"USER".equals(req.role())) {
                throw ApiException.forbidden("Teachers can only create student accounts");
            }
            var mine = teaching(p.id());
            @SuppressWarnings("unchecked")
            var myCourses = ((List<Map<String, Object>>) mine.get("courses")).stream().map(c -> c.get("id").toString()).toList();
            @SuppressWarnings("unchecked")
            var myTags = ((List<String>) mine.get("tags")).stream().map(t -> t.toLowerCase(java.util.Locale.ROOT)).toList();
            if (courses.stream().anyMatch(c -> !myCourses.contains(c.toString()))) {
                throw ApiException.forbidden("You can only enroll students in courses you teach");
            }
            if (tags.stream().anyMatch(t -> !myTags.contains(t.toLowerCase(java.util.Locale.ROOT)))) {
                throw ApiException.forbidden("You can only use your own class tags");
            }
            if (courses.isEmpty() && tags.isEmpty()) {
                throw ApiException.badRequest("class_required", "Choose one of your courses or classes for the new student");
            }
        }
        if (!courses.isEmpty() && jdbc.sql("SELECT count(*) FROM courses WHERE id IN (:ids)").param("ids", courses)
                .query(Long.class).single() != courses.size()) {
            throw ApiException.notFound("Course");
        }
        UUID id = jdbc.sql("""
                INSERT INTO users (email, password_hash, full_name, role, tags)
                VALUES (:e, :p, :n, :r, ARRAY(SELECT jsonb_array_elements_text(CAST(:tags AS jsonb))))
                RETURNING id
                """).param("e", req.email().strip().toLowerCase()).param("p", encoder.encode(req.password()))
                .param("n", req.fullName().strip()).param("r", req.role() == null ? "USER" : req.role())
                .param("tags", json.write(tags)).query(UUID.class).single();
        for (UUID c : courses) {
            jdbc.sql("INSERT INTO enrollments (user_id, course_id) VALUES (:u, :c)").param("u", id).param("c", c).update();
        }
        return get(id);
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        currentUser.requireStudentVisible(id);
        var rows = withTags(jdbc.sql("SELECT " + USER_COLUMNS + ", u.created_at AS \"createdAt\" FROM users u WHERE u.id = :id")
                .param("id", id).query().listOfRows());
        if (rows.isEmpty()) {
            throw ApiException.notFound("User");
        }
        var user = new java.util.LinkedHashMap<>(rows.getFirst());
        user.put("enrollments", jdbc.sql("""
                SELECT c.id AS "courseId", c.title, e.enrolled_at AS "enrolledAt"
                FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = :id AND e.status = 'active' ORDER BY c.title
                """).param("id", id).query().listOfRows());
        if ("TEACHER".equals(user.get("role"))) {
            user.put("teaching", teaching(id));
        }
        return user;
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest req) {
        var admin = currentUser.requireAdmin();
        if (admin.id().equals(id) && ("blocked".equals(req.status()) || (req.role() != null && !"ADMIN".equals(req.role())))) {
            throw ApiException.badRequest("self_lockout", "You cannot block or demote your own account");
        }
        get(id);
        jdbc.sql("""
                UPDATE users SET email = COALESCE(:e, email), full_name = COALESCE(:n, full_name),
                       role = COALESCE(:r, role), status = COALESCE(:s, status),
                       password_hash = COALESCE(:p, password_hash),
                       tags = CASE WHEN CAST(:tags AS jsonb) IS NULL THEN tags
                                   ELSE ARRAY(SELECT jsonb_array_elements_text(CAST(:tags AS jsonb))) END
                WHERE id = :id
                """).param("e", req.email() == null ? null : req.email().strip().toLowerCase())
                .param("n", req.fullName()).param("r", req.role()).param("s", req.status())
                .param("p", req.password() == null ? null : encoder.encode(req.password()))
                .param("tags", req.tags() == null ? null : json.write(normalizeTags(req.tags())))
                .param("id", id).update();
        return get(id);
    }

    /**
     * Apply one action to many accounts. Each account is handled separately (one failure does not undo the
     * others) and the response lists what was skipped and why.
     */
    @PostMapping("/bulk")
    public Map<String, Object> bulk(@Valid @RequestBody BulkRequest req) {
        // Teachers may assign / revoke practice sets for their own students; every other action is admin only.
        boolean practice = "assign_set".equals(req.action()) || "revoke_set".equals(req.action());
        var admin = practice ? currentUser.requireTeacherOrAdmin() : currentUser.requireAdmin();
        switch (req.action()) {
            case "assign_set", "revoke_set" -> {
                if (req.setId() == null) throw ApiException.badRequest("set_required", "Choose a practice set");
            }
            case "enroll_course", "unenroll_course" -> {
                if (req.courseId() == null) throw ApiException.badRequest("course_required", "Choose a course");
                jdbc.sql("SELECT id FROM courses WHERE id = :c").param("c", req.courseId()).query(UUID.class).optional()
                        .orElseThrow(() -> ApiException.notFound("Course"));
            }
            case "add_tag", "remove_tag" -> {
                if (normalizeTags(req.tag() == null ? List.of() : List.of(req.tag())).isEmpty()) {
                    throw ApiException.badRequest("tag_required", "Enter a tag such as #NOCE (letters, digits, . _ -)");
                }
            }
            default -> { }
        }
        String tag = req.tag() == null ? null : normalizeTags(List.of(req.tag())).stream().findFirst().orElse(null);
        int done = 0;
        List<Map<String, Object>> skipped = new java.util.ArrayList<>();
        for (UUID userId : new java.util.LinkedHashSet<>(req.userIds())) {
            var user = jdbc.sql("SELECT email, role FROM users WHERE id = :id").param("id", userId)
                    .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2)}).optional();
            if (user.isEmpty()) {
                skipped.add(Map.of("userId", userId, "email", "?", "reason", "account not found"));
                continue;
            }
            String email = user.get()[0];
            boolean student = "USER".equals(user.get()[1]);
            if (!currentUser.canSeeStudent(admin, userId)) {
                skipped.add(skip(userId, email, "not one of your students"));
                continue;
            }
            try {
                switch (req.action()) {
                    case "assign_set" -> {
                        if (!student) { skipped.add(skip(userId, email, "only students can be assigned practice sets")); continue; }
                        assignments.grant(admin.id(), userId, req.setId());
                    }
                    case "revoke_set" -> assignments.revoke(admin.id(), userId, req.setId());
                    case "enroll_course" -> jdbc.sql("INSERT INTO enrollments (user_id, course_id) VALUES (:u, :c) ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active', removed_at = NULL, removed_by = NULL")
                            .param("u", userId).param("c", req.courseId()).update();
                    case "unenroll_course" -> {
                        // Keep the row (progress and attempts reference it); the student just loses access.
                        int n = jdbc.sql("""
                                UPDATE enrollments SET status = 'removed', removed_at = now(), removed_by = :a
                                WHERE user_id = :u AND course_id = :c AND status = 'active'
                                """).param("a", admin.id()).param("u", userId).param("c", req.courseId()).update();
                        if (n == 0) { skipped.add(skip(userId, email, "was not enrolled in this course")); continue; }
                    }
                    case "add_tag" -> jdbc.sql("UPDATE users SET tags = array_append(tags, :t) WHERE id = :id "
                            + "AND NOT EXISTS (SELECT 1 FROM unnest(tags) x WHERE lower(x) = lower(:t))")
                            .param("t", tag).param("id", userId).update();
                    case "remove_tag" -> jdbc.sql("UPDATE users SET tags = ARRAY(SELECT x FROM unnest(tags) x WHERE lower(x) <> lower(:t)) WHERE id = :id")
                            .param("t", tag).param("id", userId).update();
                    case "block", "activate" -> {
                        if (admin.id().equals(userId)) { skipped.add(skip(userId, email, "you cannot change your own status")); continue; }
                        jdbc.sql("UPDATE users SET status = :s WHERE id = :id")
                                .param("s", "block".equals(req.action()) ? "blocked" : "active").param("id", userId).update();
                    }
                    default -> throw ApiException.badRequest("bad_action", "Unknown action");
                }
                done++;
            } catch (ApiException e) {
                skipped.add(skip(userId, email, e.getMessage()));
            }
        }
        return Map.of("updated", done, "skipped", skipped);
    }

    private static Map<String, Object> skip(UUID id, String email, String reason) {
        return Map.of("userId", id, "email", email, "reason", reason);
    }

    /** Leading # removed, trimmed, spaces to dashes, case kept, unique ignoring case, valid characters only. */
    private static List<String> normalizeTags(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        return raw.stream().filter(java.util.Objects::nonNull)
                .map(t -> t.strip().replaceFirst("^#+", "").replaceAll("\\s+", "-"))
                .filter(t -> TAG.matcher(t).matches())
                .collect(java.util.stream.Collectors.toMap(t -> t.toLowerCase(java.util.Locale.ROOT), t -> t, (a, b) -> a,
                        java.util.LinkedHashMap::new))
                .values().stream().limit(20).toList();
    }

    /** Turn the tags / enrolled-course JSON text columns into lists for the response. */
    private List<Map<String, Object>> withTags(List<Map<String, Object>> rows) {
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (var r : rows) {
            Map<String, Object> m = new java.util.LinkedHashMap<>(r);
            m.put("tags", json.list(m.get("tags")));
            m.put("courses", json.list(m.get("courses")));
            out.add(m);
        }
        return out;
    }

    @GetMapping("/{id}/practice-assignments")
    public List<Map<String, Object>> assignments(@PathVariable UUID id) {
        currentUser.requireStudentVisible(id);
        return assignments.list(id);
    }

    @PutMapping("/{id}/practice-assignments/{setId}")
    public Map<String, Object> grant(@PathVariable UUID id, @PathVariable UUID setId) {
        return assignments.grant(practiceEditor(id).id(), id, setId);
    }

    @DeleteMapping("/{id}/practice-assignments/{setId}")
    public Map<String, Object> revoke(@PathVariable UUID id, @PathVariable UUID setId) {
        return assignments.revoke(practiceEditor(id).id(), id, setId);
    }

    /** Admin, or a teacher working with one of their own students. */
    private CurrentUser.Principal practiceEditor(UUID studentId) {
        var p = currentUser.requireTeacherOrAdmin();
        currentUser.requireStudentVisible(studentId);
        return p;
    }

    /** Courses and tags a teacher teaches (who their students are). */
    @GetMapping("/{id}/teaching")
    public Map<String, Object> getTeaching(@PathVariable UUID id) {
        currentUser.requirePeople();
        return teaching(id);
    }

    @PutMapping("/{id}/teaching")
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> setTeaching(@PathVariable UUID id, @Valid @RequestBody TeachingRequest req) {
        currentUser.requireAdmin();
        String role = jdbc.sql("SELECT role FROM users WHERE id = :id").param("id", id).query(String.class).optional()
                .orElseThrow(() -> ApiException.notFound("User"));
        if (!"TEACHER".equals(role)) {
            throw ApiException.badRequest("not_teacher", "Only teachers have courses and classes");
        }
        List<UUID> courses = req.courseIds().stream().distinct().toList();
        if (!courses.isEmpty() && jdbc.sql("SELECT count(*) FROM courses WHERE id IN (:ids)").param("ids", courses)
                .query(Long.class).single() != courses.size()) {
            throw ApiException.notFound("Course");
        }
        jdbc.sql("DELETE FROM course_teachers WHERE user_id = :id").param("id", id).update();
        for (UUID c : courses) {
            jdbc.sql("INSERT INTO course_teachers (course_id, user_id) VALUES (:c, :u)").param("c", c).param("u", id).update();
        }
        jdbc.sql("DELETE FROM teacher_tags WHERE user_id = :id").param("id", id).update();
        for (String tag : normalizeTags(req.tags())) {
            jdbc.sql("INSERT INTO teacher_tags (user_id, tag) VALUES (:u, :t)").param("u", id).param("t", tag).update();
        }
        return teaching(id);
    }

    private Map<String, Object> teaching(UUID id) {
        var courses = jdbc.sql("""
                SELECT c.id, c.title FROM course_teachers ct JOIN courses c ON c.id = ct.course_id
                WHERE ct.user_id = :id ORDER BY c.title
                """).param("id", id).query().listOfRows();
        var tags = jdbc.sql("SELECT tag FROM teacher_tags WHERE user_id = :id ORDER BY lower(tag)").param("id", id)
                .query(String.class).list();
        long students = jdbc.sql("SELECT count(*) FROM users u WHERE u.role = 'USER' AND " + CurrentUser.teacherStudents("u.id"))
                .param("scopeTeacher", id).query(Long.class).single();
        return Map.of("courses", courses, "tags", tags, "studentCount", students);
    }
}
