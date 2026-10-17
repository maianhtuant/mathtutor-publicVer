"""Exact-number helpers built on SymPy rationals."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

import sympy as sp

MAX_RESULT_DIGITS = 40  # numerator/denominator size limit for results


class NumberError(ValueError):
    pass


def to_rational(value) -> sp.Rational:
    """Convert int/str/Decimal/float (via its shortest repr) to an exact Rational."""
    if isinstance(value, sp.Rational):
        return value
    if isinstance(value, bool):
        raise NumberError("boolean is not a number")
    if isinstance(value, int):
        return sp.Integer(value)
    if isinstance(value, float):
        value = repr(value)
    try:
        text = str(Decimal(str(value).strip()))
    except (InvalidOperation, ValueError) as exc:
        raise NumberError(f"invalid number: {value!r}") from exc
    return sp.Rational(text)


def check_size(value: sp.Rational) -> sp.Rational:
    if len(str(abs(value.p))) > MAX_RESULT_DIGITS or len(str(value.q)) > MAX_RESULT_DIGITS:
        raise NumberError("result is too large")
    return value


def is_terminating(value: sp.Rational) -> bool:
    q = int(value.q)
    for f in (2, 5):
        while q % f == 0:
            q //= f
    return q == 1


def round_half_up(value: sp.Rational, places: int) -> sp.Rational:
    """ROUND_HALF_UP with negative midpoints rounded away from zero."""
    factor = sp.Integer(10) ** places
    scaled = abs(value) * factor
    rounded = sp.floor(scaled + sp.Rational(1, 2))
    result = sp.Rational(rounded, factor)
    return -result if value < 0 else result


def format_plain(value: sp.Rational) -> str:
    """Decimal string when terminating (trailing zeros stripped), else p/q."""
    value = sp.Rational(value)
    if value.q == 1:
        return str(value.p)
    if is_terminating(value):
        d = Decimal(int(value.p)) / Decimal(int(value.q))
        text = format(d.normalize(), "f")
        return text
    return f"{value.p}/{value.q}"


def format_fixed(value: sp.Rational, places: int) -> str:
    """Round half up and print with exactly `places` decimals."""
    r = round_half_up(sp.Rational(value), places)
    d = Decimal(int(r.p)) / Decimal(int(r.q))
    return format(d.quantize(Decimal(1).scaleb(-places)), "f")


def to_latex(value: sp.Rational, fractions: bool = False) -> str:
    """Integers and terminating decimals print as decimals unless fractions=True (then e.g. 4/5, not 0.8)."""
    value = sp.Rational(value)
    if value.q == 1 or (is_terminating(value) and not fractions):
        return format_plain(value)
    sign = "-" if value < 0 else ""
    return f"{sign}\\frac{{{abs(value.p)}}}{{{value.q}}}"


def is_correct(response: sp.Rational, expected: sp.Rational, *, relative_tolerance_percent,
               absolute_tolerance, decimal_places: int, accept_rounded_decimal: bool) -> bool:
    """Same grading rule the backend applies (design §6.2)."""
    rel = to_rational(relative_tolerance_percent)
    absolute = to_rational(absolute_tolerance)
    limit = max(absolute, abs(expected) * rel / 100)
    if abs(response - expected) <= limit:
        return True
    return bool(accept_rounded_decimal) and response == round_half_up(expected, decimal_places)
