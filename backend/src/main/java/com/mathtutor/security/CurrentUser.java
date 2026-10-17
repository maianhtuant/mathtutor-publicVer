package com.mathtutor.security;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import com.mathtutor.common.ApiException;

/**
 * Resolves the caller from the JWT and re-checks the account in the database, so a
 * blocked account or a role change takes effect immediately, not when the token expires.
 * Personal endpoints use this id and never trust a user id sent by the client.
 */
@Component
public class CurrentUser {

    /**
     * Roles: USER (student), TEACHER (templates, practice sets, their own students), SUPERVISOR (sees everything,
     * changes nothing), EDITOR (all content like an admin, but no users or student data) and ADMIN (everything).
     */
    public record Principal(UUID id, String email, String role) {
        public boolean isAdmin() {
            return "ADMIN".equals(role);
        }

        public boolean isTeacher() {
            return "TEACHER".equals(role);
        }

        public boolean isSupervisor() {
            return "SUPERVISOR".equals(role);
        }

        public boolean isContentEditor() {
            return "EDITOR".equals(role);
        }

        /** Admin, teacher, supervisor or editor: may open the admin area. */
        public boolean isStaff() {
            return isAdmin() || isTeacher() || isSupervisor() || isContentEditor();
        }

        /** Admins and editors change any content, whoever created it. */
        public boolean editsAllContent() {
            return isAdmin() || isContentEditor();
        }

        /** Who may see user accounts and student data (editors may not). */
        public boolean seesPeople() {
            return isAdmin() || isTeacher() || isSupervisor();
        }

        /** Admins and supervisors see every student; a teacher only their own. */
        public boolean seesAllStudents() {
            return isAdmin() || isSupervisor();
        }
    }

    /**
     * SQL condition: the user id in {@code column} is one of teacher {@code :scopeTeacher}'s students (enrolled in a
     * course they teach, or carrying one of their tags). Bind {@code scopeTeacher}; see {@link #studentScope}.
     */
    public static String teacherStudents(String column) {
        return """
                (%1$s IN (SELECT e.user_id FROM enrollments e JOIN course_teachers ct ON ct.course_id = e.course_id
                          WHERE ct.user_id = :scopeTeacher AND e.status = 'active')
                 OR %1$s IN (SELECT su.id FROM users su JOIN teacher_tags tt ON lower(tt.tag) = ANY (
                               SELECT lower(x) FROM unnest(su.tags) x) WHERE tt.user_id = :scopeTeacher))""".formatted(column);
    }

    /**
     * Condition limiting {@code column} (a user id) to the students this caller may see: everyone for admins and
     * supervisors, their own students for a teacher. Always bind {@code scopeTeacher} to {@link #scopeParam}.
     */
    public static String studentScope(Principal p, String column) {
        return p.seesAllStudents() ? "(TRUE)" : teacherStudents(column);
    }

    /** Value for the {@code scopeTeacher} parameter of {@link #studentScope}. */
    public static UUID scopeParam(Principal p) {
        return p.seesAllStudents() ? null : p.id();
    }

    private final JdbcClient jdbc;

    public CurrentUser(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Principal require() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken token)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Login required");
        }
        UUID id = UUID.fromString(token.getToken().getSubject());
        var row = jdbc.sql("SELECT email, role, status FROM users WHERE id = :id")
                .param("id", id)
                .query((rs, n) -> new String[] {rs.getString(1), rs.getString(2), rs.getString(3)})
                .optional()
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Account no longer exists"));
        if (!"active".equals(row[2])) {
            throw ApiException.forbidden("Account is blocked");
        }
        return new Principal(id, row[0], row[1]);
    }

    /** The caller when a valid token was sent, otherwise null (public endpoints). */
    public Principal optional() {
        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken)) {
            return null;
        }
        return require();
    }

    public Principal requireAdmin() {
        Principal p = require();
        if (!p.isAdmin()) {
            throw ApiException.forbidden("Administrator role required");
        }
        return p;
    }

    /** Admin, teacher or supervisor: reading in the admin area. */
    public Principal requireStaff() {
        Principal p = require();
        if (!p.isStaff()) {
            throw ApiException.forbidden("Staff role required");
        }
        return p;
    }

    /** Admin, editor or teacher: creating templates, practice sets and bank questions. */
    public Principal requireAuthor() {
        Principal p = require();
        if (!p.editsAllContent() && !p.isTeacher()) {
            throw ApiException.forbidden(p.isSupervisor() ? "Supervisors can view but not change anything"
                    : "Teacher, editor or administrator role required");
        }
        return p;
    }

    /** Admin or editor: changing the content tree, lessons, subjects and videos. */
    public Principal requireContent() {
        Principal p = require();
        if (!p.editsAllContent()) {
            throw ApiException.forbidden(p.isSupervisor() ? "Supervisors can view but not change anything"
                    : "Editor or administrator role required");
        }
        return p;
    }

    /** Admin, teacher or supervisor: user accounts and student data (editors have no access to people). */
    public Principal requirePeople() {
        Principal p = requireStaff();
        if (!p.seesPeople()) {
            throw ApiException.forbidden("Editors don't have access to users or student data");
        }
        return p;
    }

    /** Admin or teacher: creating students and assigning practice (teachers only for their own students). */
    public Principal requireTeacherOrAdmin() {
        Principal p = require();
        if (!p.isAdmin() && !p.isTeacher()) {
            throw ApiException.forbidden(p.isSupervisor() ? "Supervisors can view but not change anything"
                    : "Teacher or administrator role required");
        }
        return p;
    }

    /** Author who may change it: admins and editors change anything, teachers only what they created. */
    public Principal requireOwner(UUID createdBy, String what) {
        Principal p = requireAuthor();
        if (!p.editsAllContent() && !p.id().equals(createdBy)) {
            throw ApiException.forbidden("You can only change " + what + " you created");
        }
        return p;
    }

    /** Staff who may see this student: everyone but a teacher, who only sees their own students. */
    public Principal requireStudentVisible(UUID studentId) {
        Principal p = requirePeople();
        if (!p.seesAllStudents() && !canSeeStudent(p, studentId)) {
            throw ApiException.forbidden("This student is not in your courses or classes");
        }
        return p;
    }

    public boolean canSeeStudent(Principal p, UUID studentId) {
        return p.seesAllStudents() || jdbc.sql("SELECT count(*) FROM users u WHERE u.id = :id AND " + teacherStudents("u.id"))
                .param("id", studentId).param("scopeTeacher", p.id()).query(Long.class).single() > 0;
    }
}
