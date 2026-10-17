package com.mathtutor.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import com.mathtutor.common.ApiException;

class LoginThrottleTest {

    private static MockHttpServletRequest from(String forwardedFor) {
        MockHttpServletRequest r = new MockHttpServletRequest();
        r.setRemoteAddr("172.18.0.5"); // the proxy container
        if (forwardedFor != null) {
            r.addHeader("X-Forwarded-For", forwardedFor);
        }
        return r;
    }

    @Test
    void blocksAnEmailAfterTenFailures() {
        var t = new LoginThrottle();
        var req = from("203.0.113.7");
        for (int i = 0; i < 10; i++) {
            t.checkLogin("a@x.org", req);
            t.loginFailed("a@x.org", req);
        }
        var e = assertThrows(ApiException.class, () -> t.checkLogin("a@x.org", req));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.status());
        assertDoesNotThrow(() -> t.checkLogin("b@x.org", req)); // other accounts are unaffected
    }

    @Test
    void successClearsTheEmailCounter() {
        var t = new LoginThrottle();
        var req = from("203.0.113.7");
        for (int i = 0; i < 9; i++) {
            t.loginFailed("a@x.org", req);
        }
        t.loginSucceeded("a@x.org");
        for (int i = 0; i < 9; i++) {
            t.loginFailed("a@x.org", req);
        }
        assertDoesNotThrow(() -> t.checkLogin("a@x.org", req));
    }

    @Test
    void blocksOnePublicAddressTryingManyEmails() {
        var t = new LoginThrottle();
        var req = from("203.0.113.7, 172.18.0.1");
        for (int i = 0; i < 30; i++) {
            t.loginFailed("user" + i + "@x.org", req);
        }
        assertThrows(ApiException.class, () -> t.checkLogin("new@x.org", req));
        assertDoesNotThrow(() -> t.checkLogin("new@x.org", from("198.51.100.9")));
    }

    @Test
    void neverLimitsByAddressWhenOnlyTheProxyIsVisible() {
        // Without a public client address every visitor would share the proxy's; per-address limits must not apply.
        var t = new LoginThrottle();
        for (int i = 0; i < 50; i++) {
            t.loginFailed("user" + i + "@x.org", from(null));
            t.register(from("10.0.0.2"));
        }
        assertDoesNotThrow(() -> t.checkLogin("someone@x.org", from(null)));
        assertDoesNotThrow(() -> t.register(from("10.0.0.2")));
    }

    @Test
    void limitsSignUpsPerAddress() {
        var t = new LoginThrottle();
        for (int i = 0; i < 10; i++) {
            t.register(from("203.0.113.7"));
        }
        assertThrows(ApiException.class, () -> t.register(from("203.0.113.7")));
    }
}
