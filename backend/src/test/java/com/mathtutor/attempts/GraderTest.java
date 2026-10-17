package com.mathtutor.attempts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import com.mathtutor.common.Rational;

class GraderTest {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final Rational Y = Rational.parse("3.6");

    @Test
    void acceptsEquivalentForms() {
        for (String s : new String[] {"3.6", "3.60", "18/5", "3,6", " 36/10 "}) {
            assertTrue(Grader.isCorrect(Rational.parse(s), Y, ZERO, ZERO, 2, false), s);
        }
        assertFalse(Grader.isCorrect(Rational.parse("3.61"), Y, ZERO, ZERO, 2, false));
    }

    @Test
    void rejectsInvalidSyntax() {
        for (String s : new String[] {"", "abc", "1/0", "3.6.1", "1e5", "--3"}) {
            assertThrows(IllegalArgumentException.class, () -> Rational.parse(s), s);
        }
    }

    @Test
    void toleranceBoundariesAreInclusive() {
        Rational y = Rational.parse("100");
        assertTrue(Grader.isCorrect(Rational.parse("101"), y, new BigDecimal("1"), ZERO, 2, false));
        assertFalse(Grader.isCorrect(Rational.parse("101.01"), y, new BigDecimal("1"), ZERO, 2, false));
        assertTrue(Grader.isCorrect(Rational.parse("100.5"), y, ZERO, new BigDecimal("0.5"), 2, false));
        // zero expected: relative tolerance contributes nothing
        assertFalse(Grader.isCorrect(Rational.parse("0.001"), Rational.parse("0"), new BigDecimal("50"), ZERO, 2, false));
    }

    @Test
    void roundedAnswerBranchUsesHalfUp() {
        Rational third = Rational.parse("1/3");
        assertTrue(Grader.isCorrect(Rational.parse("0.33"), third, ZERO, ZERO, 2, true));
        assertFalse(Grader.isCorrect(Rational.parse("0.33"), third, ZERO, ZERO, 2, false));
        assertEquals(Rational.parse("2.35"), Rational.parse("2.345").roundHalfUp(2));
        assertEquals(Rational.parse("-2.35"), Rational.parse("-2.345").roundHalfUp(2));
    }

    @Test
    void displaysExactValues() {
        assertEquals("3.6", Y.display());
        assertEquals("36", Rational.parse("36").display());
        assertEquals("7/6", Rational.parse("7/6").display());
        assertEquals("0.125", Rational.parse("1/8").display());
        assertEquals("-0.5", Rational.parse("-1/2").display());
    }
}
