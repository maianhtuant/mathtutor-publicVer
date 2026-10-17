"""Question-template tokenizer.

Grammar (scanned left to right, so LaTeX braces are never confused with
placeholders by plain string replacement):

    {{name}}            -> LaTeX group containing the value:  {12}
    {name}              -> the value itself:                   12
    {name:min-max}      -> integer range declaration + value (accepts '-' or en dash,
                           negative bounds allowed, e.g. {a:-5–5})
    {+-}                -> '+' or '-'; exposes s (then s2, s3, ...) = 1 or -1

A brace token counts as a placeholder only when it carries an inline range or
its name is a declared variable or appears in the answer formula/constraints.
Everything else is copied through untouched as LaTeX.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal

NAME = r"[A-Za-z_][A-Za-z0-9_]*"
NUM = r"-?\d+(?:\.\d+)?"
RE_DOUBLE = re.compile(r"\{\{(" + NAME + r")\}\}")
RE_SIGN = re.compile(r"\{\+-\}|\{\+−\}|\{±\}")
RE_SINGLE = re.compile(r"\{(" + NAME + r")(?::\s*(" + NUM + r")\s*(?:-|–|\.\.)\s*(" + NUM + r")\s*)?\}")

MAX_TEMPLATE_LENGTH = 4000


class TemplateError(ValueError):
    pass


@dataclass
class Token:
    kind: str  # text | var | group | sign
    text: str = ""
    name: str = ""


@dataclass
class ParsedTemplate:
    tokens: list[Token]
    placeholders: list[str]  # variables in order of first appearance
    inline_ranges: dict[str, tuple[Decimal, Decimal]] = field(default_factory=dict)
    sign_names: list[str] = field(default_factory=list)


def parse_template(source: str, known_names: set[str]) -> ParsedTemplate:
    if not source or not source.strip():
        raise TemplateError("template is empty")
    if len(source) > MAX_TEMPLATE_LENGTH:
        raise TemplateError(f"template is longer than {MAX_TEMPLATE_LENGTH} characters")

    # Pass 1: names with inline ranges are always placeholders.
    inline: dict[str, tuple[Decimal, Decimal]] = {}
    for m in RE_SINGLE.finditer(source):
        if m.group(2) is not None:
            lo, hi = Decimal(m.group(2)), Decimal(m.group(3))
            if lo != lo.to_integral_value() or hi != hi.to_integral_value():
                raise TemplateError(f"inline range for '{m.group(1)}' must use integers")
            if lo > hi:
                raise TemplateError(f"inline range for '{m.group(1)}' has min > max")
            prev = inline.get(m.group(1))
            if prev and prev != (lo, hi):
                raise TemplateError(f"variable '{m.group(1)}' has conflicting inline ranges")
            inline[m.group(1)] = (lo, hi)
    names = set(known_names) | set(inline)

    tokens: list[Token] = []
    order: list[str] = []
    signs: list[str] = []
    buf: list[str] = []
    i = 0

    def flush():
        if buf:
            tokens.append(Token("text", "".join(buf)))
            buf.clear()

    def note(name: str):
        if name not in order:
            order.append(name)

    while i < len(source):
        ch = source[i]
        if ch == "{":
            m = RE_DOUBLE.match(source, i)
            if m and m.group(1) in names:
                flush()
                tokens.append(Token("group", name=m.group(1)))
                note(m.group(1))
                i = m.end()
                continue
            m = RE_SIGN.match(source, i)
            if m:
                flush()
                sname = "s" if not signs else f"s{len(signs) + 1}"
                signs.append(sname)
                tokens.append(Token("sign", name=sname))
                i = m.end()
                continue
            m = RE_SINGLE.match(source, i)
            if m and m.group(1) in names:
                flush()
                tokens.append(Token("var", name=m.group(1)))
                note(m.group(1))
                i = m.end()
                continue
        buf.append(ch)
        i += 1
    flush()
    return ParsedTemplate(tokens, order, inline, signs)


# Operators after which a negative value needs parentheses: 4 \times (-3), not 4 \times -3.
_PAREN_AFTER = ("\\times", "\\cdot", "\\div", "*", "/", "^")


def _place_negative(out: list[str], value: str) -> str:
    """Write a negative value naturally after a binary + or - (x + -3 -> x - 3, x - -3 -> x + 3)."""
    text = "".join(out)
    stripped = text.rstrip()
    if stripped.endswith(("+", "-")):
        before = stripped[:-1].rstrip()
        # Only a binary operator (an operand before it), not a sign at the start or after "(", "=", etc.
        if before and (before[-1].isalnum() or before[-1] in ")}]"):
            flipped = "-" if stripped[-1] == "+" else "+"
            out[:] = [stripped[:-1] + flipped + text[len(stripped):]]  # keep the original spacing
            return value[1:]
    if stripped.endswith(_PAREN_AFTER):
        return "(" + value + ")"
    return value


def render(parsed: ParsedTemplate, display: dict[str, str]) -> str:
    out: list[str] = []
    for t in parsed.tokens:
        if t.kind == "text":
            out.append(t.text)
        elif t.kind == "var":
            value = display[t.name]
            out.append(_place_negative(out, value) if value.startswith("-") else value)
        elif t.kind == "group":
            out.append("{" + display[t.name] + "}")
        else:
            out.append("+" if display[t.name] == "1" else "-")
    return "".join(out)
