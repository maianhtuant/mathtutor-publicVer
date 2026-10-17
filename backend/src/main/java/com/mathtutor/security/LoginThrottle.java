package com.mathtutor.security;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.mathtutor.common.ApiException;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Slows down password guessing and sign-up spam (in memory, per server instance).
 *
 * - Login: at most 10 failed attempts per email and 30 per client address in 15 minutes.
 *   A successful login clears the email's failures.
 * - Register: at most 10 new accounts per client address per hour.
 * - Password checks of signed-in users (change password / email): 10 failures per user in 15 minutes.
 */
@Component
public class LoginThrottle {

    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_PER_EMAIL = 10;
    private static final int MAX_PER_CLIENT = 30;
    private static final Duration REGISTER_WINDOW = Duration.ofHours(1);
    private static final int MAX_REGISTER_PER_CLIENT = 10;
    private static final int MAX_KEYS = 100_000;

    private final Map<String, Deque<Instant>> events = new ConcurrentHashMap<>();

    /** Throws 429 when this email or client already has too many recent failures. */
    public void checkLogin(String email, HttpServletRequest request) {
        check("login-email:" + email, MAX_PER_EMAIL, WINDOW);
        String client = client(request);
        if (client != null) {
            check("login-client:" + client, MAX_PER_CLIENT, WINDOW);
        }
    }

    public void loginFailed(String email, HttpServletRequest request) {
        record("login-email:" + email, WINDOW);
        String client = client(request);
        if (client != null) {
            record("login-client:" + client, WINDOW);
        }
    }

    public void loginSucceeded(String email) {
        events.remove("login-email:" + email);
    }

    /** Counts the attempt and throws 429 when the client created too many accounts recently. */
    public void register(HttpServletRequest request) {
        String client = client(request);
        if (client == null) {
            return;
        }
        String key = "register:" + client;
        check(key, MAX_REGISTER_PER_CLIENT, REGISTER_WINDOW);
        record(key, REGISTER_WINDOW);
    }

    public void checkPassword(Object userId) {
        check("password:" + userId, MAX_PER_EMAIL, WINDOW);
    }

    public void passwordFailed(Object userId) {
        record("password:" + userId, WINDOW);
    }

    private void check(String key, int max, Duration window) {
        Deque<Instant> q = events.get(key);
        if (q == null) {
            return;
        }
        synchronized (q) {
            prune(q, window);
            if (q.size() >= max) {
                long wait = Math.max(1, Duration.between(Instant.now(), q.peekFirst().plus(window)).toMinutes() + 1);
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "too_many_attempts",
                        "Too many attempts. Please wait about " + wait + " minute" + (wait == 1 ? "" : "s") + " and try again.");
            }
        }
    }

    private void record(String key, Duration window) {
        if (events.size() > MAX_KEYS) {
            events.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    prune(e.getValue(), REGISTER_WINDOW);
                    return e.getValue().isEmpty();
                }
            });
        }
        Deque<Instant> q = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q, window);
            q.addLast(Instant.now());
        }
    }

    private static void prune(Deque<Instant> q, Duration window) {
        Instant cutoff = Instant.now().minus(window);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) {
            q.pollFirst();
        }
    }

    /**
     * The visitor's public address (first X-Forwarded-For entry, else the socket address), or null when only a
     * private/proxy address is visible. Then per-address limits are skipped: otherwise every visitor would share
     * the proxy's address and 30 failures anywhere would lock everyone out. Per-email limits still apply.
     */
    private static String client(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        String ip = xff != null && !xff.isBlank() ? xff.split(",")[0].strip() : request.getRemoteAddr();
        return isPublic(ip) ? ip : null;
    }

    private static boolean isPublic(String ip) {
        // Literal addresses only (never trigger a DNS lookup on header input).
        if (ip == null || !ip.matches("[0-9a-fA-F:.]{2,45}")) {
            return false;
        }
        try {
            InetAddress a = InetAddress.getByName(ip);
            return !(a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress() || a.isAnyLocalAddress()
                    || (a.getAddress().length == 16 && (a.getAddress()[0] & 0xfe) == 0xfc)); // IPv6 unique-local fc00::/7
        } catch (UnknownHostException e) {
            return false;
        }
    }
}
