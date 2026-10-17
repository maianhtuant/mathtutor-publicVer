package com.mathtutor.auth;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mathtutor.common.ApiException;
import com.mathtutor.security.AppProperties;
import com.mathtutor.security.CurrentUser;
import com.mathtutor.security.LoginThrottle;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api")
public class AuthController {

    public record RegisterRequest(@NotBlank @Email @Size(max = 254) String email,
                                  @NotBlank @Size(min = 8, max = 100) String password,
                                  @NotBlank @Size(max = 150) String fullName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record UserView(UUID id, String email, String fullName, String role, String status) {}

    public record ProfileRequest(@Size(max = 150) String fullName, @Email @Size(max = 254) String email, String currentPassword) {}

    public record PasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 100) String newPassword) {}

    public record TokenResponse(String token, Instant expiresAt, UserView user) {}

    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwtEncoder;
    private final AppProperties props;
    private final CurrentUser currentUser;
    private final LoginThrottle throttle;
    /** Compared against when the email is unknown, so failed logins take the same time either way. */
    private final String dummyHash;

    public AuthController(JdbcClient jdbc, PasswordEncoder encoder, JwtEncoder jwtEncoder, AppProperties props,
                          CurrentUser currentUser, LoginThrottle throttle) {
        this.throttle = throttle;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.jwtEncoder = jwtEncoder;
        this.props = props;
        this.currentUser = currentUser;
    }

    @PostMapping("/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public TokenResponse register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http) {
        throttle.register(http);
        String email = req.email().strip().toLowerCase();
        boolean exists = jdbc.sql("SELECT count(*) FROM users WHERE lower(email) = :e").param("e", email)
                .query(Long.class).single() > 0;
        if (exists) {
            throw ApiException.conflict("email_taken", "An account with this email already exists");
        }
        UUID id = jdbc.sql("""
                INSERT INTO users (email, password_hash, full_name, role) VALUES (:e, :p, :n, 'USER') RETURNING id
                """).param("e", email).param("p", encoder.encode(req.password())).param("n", req.fullName().strip())
                .query(UUID.class).single();
        return issue(new UserView(id, email, req.fullName().strip(), "USER", "active"));
    }

    @PostMapping("/auth/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        String email = req.email().strip().toLowerCase();
        throttle.checkLogin(email, http);
        var row = jdbc.sql("SELECT id, email, full_name, role, status, password_hash FROM users WHERE lower(email) = :e")
                .param("e", email)
                .query((rs, n) -> Map.entry(
                        new UserView(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5)),
                        rs.getString(6)))
                .optional();
        boolean ok = encoder.matches(req.password(), row.map(Map.Entry::getValue).orElse(dummyHash)) && row.isPresent();
        if (!ok) {
            throttle.loginFailed(email, http);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Invalid email or password");
        }
        throttle.loginSucceeded(email);
        UserView user = row.get().getKey();
        if (!"active".equals(user.status())) {
            throw ApiException.forbidden("Account is blocked");
        }
        return issue(user);
    }

    @GetMapping("/me")
    public UserView me() {
        var p = currentUser.require();
        return jdbc.sql("SELECT id, email, full_name, role, status FROM users WHERE id = :id").param("id", p.id())
                .query((rs, n) -> new UserView(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5)))
                .single();
    }

    /** Account details for the "My account" page. */
    @GetMapping("/me/account")
    public Map<String, Object> account() {
        var p = currentUser.require();
        Map<String, Object> out = new java.util.LinkedHashMap<>(jdbc.sql("""
                SELECT id, email, full_name AS "fullName", role, status, created_at AS "createdAt" FROM users WHERE id = :id
                """).param("id", p.id()).query().singleRow());
        out.put("courses", jdbc.sql("""
                SELECT c.id, c.title, e.enrolled_at AS "enrolledAt" FROM enrollments e JOIN courses c ON c.id = e.course_id
                WHERE e.user_id = :id AND e.status = 'active' ORDER BY c.title
                """).param("id", p.id()).query().listOfRows());
        return out;
    }

    /** Update name and/or email. Changing the email requires the current password. */
    @org.springframework.web.bind.annotation.PatchMapping("/me")
    @Transactional
    public UserView updateProfile(@Valid @RequestBody ProfileRequest req) {
        var p = currentUser.require();
        String name = req.fullName() == null ? null : req.fullName().strip();
        if (name != null && name.isEmpty()) {
            throw ApiException.badRequest("name_required", "Your name cannot be empty");
        }
        String email = req.email() == null ? null : req.email().strip().toLowerCase();
        if (email != null && !email.equals(p.email())) {
            requirePassword(p.id(), req.currentPassword(), "Enter your current password to change your email");
            boolean taken = jdbc.sql("SELECT count(*) FROM users WHERE lower(email) = :e AND id <> :id")
                    .param("e", email).param("id", p.id()).query(Long.class).single() > 0;
            if (taken) {
                throw ApiException.conflict("email_taken", "Another account already uses this email");
            }
        }
        jdbc.sql("UPDATE users SET full_name = COALESCE(:n, full_name), email = COALESCE(:e, email) WHERE id = :id")
                .param("n", name).param("e", email).param("id", p.id()).update();
        return me();
    }

    @PostMapping("/me/password")
    @Transactional
    public Map<String, Object> changePassword(@Valid @RequestBody PasswordRequest req) {
        var p = currentUser.require();
        requirePassword(p.id(), req.currentPassword(), "Your current password is not correct");
        if (req.currentPassword().equals(req.newPassword())) {
            throw ApiException.badRequest("same_password", "Choose a password different from your current one");
        }
        jdbc.sql("UPDATE users SET password_hash = :h WHERE id = :id")
                .param("h", encoder.encode(req.newPassword())).param("id", p.id()).update();
        return Map.of("changed", true);
    }

    private void requirePassword(UUID userId, String password, String message) {
        throttle.checkPassword(userId);
        String hash = jdbc.sql("SELECT password_hash FROM users WHERE id = :id").param("id", userId).query(String.class).single();
        if (password == null || password.isEmpty() || !encoder.matches(password, hash)) {
            throttle.passwordFailed(userId);
            throw ApiException.badRequest("wrong_password", message);
        }
    }

    private TokenResponse issue(UserView user) {
        Instant now = Instant.now();
        Instant exp = now.plus(props.jwt().ttlMinutes(), ChronoUnit.MINUTES);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("mathtutor")
                .subject(user.id().toString())
                .issuedAt(now)
                .expiresAt(exp)
                .claim("email", user.email())
                .claim("role", user.role())
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new TokenResponse(token, exp, user);
    }
}
