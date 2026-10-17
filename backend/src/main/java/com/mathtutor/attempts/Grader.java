package com.mathtutor.attempts;

import java.math.BigDecimal;

import com.mathtutor.common.Rational;

/** Numeric grading rule from design §6.2, using exact rationals. */
public final class Grader {
    private Grader() {}

    public static boolean isCorrect(Rational response, Rational expected, BigDecimal relativeTolerancePercent,
                                    BigDecimal absoluteTolerance, int decimalPlaces, boolean acceptRoundedDecimal) {
        Rational abs = Rational.of(absoluteTolerance);
        Rational relative = expected.abs().multiply(Rational.of(relativeTolerancePercent))
                .multiply(Rational.of(new BigDecimal("0.01")));
        Rational limit = abs.compareTo(relative) >= 0 ? abs : relative;
        if (response.subtract(expected).abs().compareTo(limit) <= 0) {
            return true;
        }
        return acceptRoundedDecimal && response.compareTo(expected.roundHalfUp(decimalPlaces)) == 0;
    }
}
