package com.mathtutor.common;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.regex.Pattern;

/** Exact rational number used for answers and grading (no binary floating point). */
public record Rational(BigInteger numerator, BigInteger denominator) implements Comparable<Rational> {

    private static final Pattern DECIMAL = Pattern.compile("[+-]?(\\d+\\.?\\d*|\\.\\d+)");
    private static final Pattern FRACTION = Pattern.compile("([+-]?\\d+)\\s*/\\s*([+-]?\\d+)");
    public static final int MAX_INPUT_LENGTH = 60;

    public Rational {
        if (denominator.signum() == 0) {
            throw new ArithmeticException("zero denominator");
        }
        if (denominator.signum() < 0) {
            numerator = numerator.negate();
            denominator = denominator.negate();
        }
        BigInteger g = numerator.gcd(denominator);
        if (!g.equals(BigInteger.ONE) && g.signum() != 0) {
            numerator = numerator.divide(g);
            denominator = denominator.divide(g);
        }
        if (numerator.signum() == 0) {
            denominator = BigInteger.ONE;
        }
    }

    public static Rational of(BigDecimal d) {
        BigDecimal s = d.stripTrailingZeros();
        if (s.scale() <= 0) {
            return new Rational(s.toBigIntegerExact(), BigInteger.ONE);
        }
        return new Rational(s.unscaledValue(), BigInteger.TEN.pow(s.scale()));
    }

    public static Rational of(BigDecimal numerator, BigDecimal denominator) {
        return new Rational(numerator.toBigIntegerExact(), denominator.toBigIntegerExact());
    }

    /**
     * Parses a student answer: integers, decimals (3.6, 3.60, decimal comma 3,6) and fractions (18/5).
     *
     * @throws IllegalArgumentException when the input is not a valid number
     */
    public static Rational parse(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("empty answer");
        }
        String s = raw.strip().replace('−', '-');
        if (s.isEmpty() || s.length() > MAX_INPUT_LENGTH) {
            throw new IllegalArgumentException("answer must be 1-" + MAX_INPUT_LENGTH + " characters");
        }
        if (s.indexOf(',') >= 0 && s.indexOf('.') < 0 && s.chars().filter(c -> c == ',').count() == 1) {
            s = s.replace(',', '.');
        }
        var f = FRACTION.matcher(s);
        if (f.matches()) {
            BigInteger den = new BigInteger(f.group(2));
            if (den.signum() == 0) {
                throw new IllegalArgumentException("denominator must not be zero");
            }
            return new Rational(new BigInteger(f.group(1)), den);
        }
        if (DECIMAL.matcher(s).matches()) {
            return of(new BigDecimal(s));
        }
        throw new IllegalArgumentException("enter an integer, a decimal or a fraction such as 18/5");
    }

    public Rational subtract(Rational o) {
        return new Rational(numerator.multiply(o.denominator).subtract(o.numerator.multiply(denominator)),
                denominator.multiply(o.denominator));
    }

    public Rational multiply(Rational o) {
        return new Rational(numerator.multiply(o.numerator), denominator.multiply(o.denominator));
    }

    public Rational abs() {
        return new Rational(numerator.abs(), denominator);
    }

    /** ROUND_HALF_UP: negative midpoints round away from zero. */
    public Rational roundHalfUp(int places) {
        BigDecimal r = new BigDecimal(numerator).divide(new BigDecimal(denominator), places, RoundingMode.HALF_UP);
        return of(r);
    }

    public boolean isTerminating() {
        BigInteger q = denominator;
        for (BigInteger f : new BigInteger[] {BigInteger.TWO, BigInteger.valueOf(5)}) {
            while (q.mod(f).signum() == 0) {
                q = q.divide(f);
            }
        }
        return q.equals(BigInteger.ONE);
    }

    /** "36", "3.6" or "7/6". */
    public String display() {
        if (denominator.equals(BigInteger.ONE)) {
            return numerator.toString();
        }
        if (isTerminating()) {
            int scale = Math.max(denominator.getLowestSetBit(), countFactor(denominator, 5));
            return new BigDecimal(numerator).divide(new BigDecimal(denominator), scale, RoundingMode.UNNECESSARY)
                    .stripTrailingZeros().toPlainString();
        }
        return numerator + "/" + denominator;
    }

    public String fixed(int places) {
        return new BigDecimal(numerator).divide(new BigDecimal(denominator), places, RoundingMode.HALF_UP).toPlainString();
    }

    private static int countFactor(BigInteger n, int f) {
        BigInteger bf = BigInteger.valueOf(f);
        int c = 0;
        while (n.mod(bf).signum() == 0) {
            n = n.divide(bf);
            c++;
        }
        return c;
    }

    @Override
    public int compareTo(Rational o) {
        return numerator.multiply(o.denominator).compareTo(o.numerator.multiply(denominator));
    }
}
