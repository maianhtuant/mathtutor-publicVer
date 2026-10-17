"""Safe formula parsing and exact evaluation.

Formulas are parsed with Python's `ast` module and walked against an allowlist;
nothing is ever passed to `eval`. Evaluation uses SymPy rationals so decimal
arithmetic such as 2.4 * 1.5 is exact.
"""
from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Callable, Mapping

import sympy as sp

from .numbers import NumberError, check_size, round_half_up

MAX_FORMULA_LENGTH = 500
MAX_DEPTH = 30
MAX_EXPONENT = 12


class FormulaError(ValueError):
    pass


class EvalError(ValueError):
    pass


def _require_int(name: str, v) -> int:
    if not getattr(v, "is_Rational", False) or v.q != 1:
        raise EvalError(f"{name}() requires integers")
    return int(v.p)


def _gcd(*args):
    if len(args) < 2:
        raise EvalError("gcd() needs at least two arguments")
    return sp.Integer(sp.igcd(*[_require_int("gcd", a) for a in args]))


def _lcm(*args):
    if len(args) < 2:
        raise EvalError("lcm() needs at least two arguments")
    ints = [_require_int("lcm", a) for a in args]
    if any(i <= 0 for i in ints):
        raise EvalError("lcm() requires positive integers")
    return sp.Integer(sp.ilcm(*ints))


def _round(x, places=sp.Integer(0)):
    return round_half_up(x, _require_int("round", places))


def _sqrt(x):
    if x < 0:
        raise EvalError("sqrt() of a negative number")
    # May be irrational (e.g. sqrt(2)); the generator decides whether a rounded answer is acceptable.
    return sp.sqrt(x)


def _pow(base, exponent):
    n = _require_int("pow", exponent)
    if abs(n) > MAX_EXPONENT:
        raise EvalError(f"pow() exponent must be between -{MAX_EXPONENT} and {MAX_EXPONENT}")
    if base == 0 and n < 0:
        raise EvalError("division by zero")
    return base ** n


def _mean(*args):
    if not args:
        raise EvalError("mean() needs at least one value")
    return sp.Add(*args) / len(args)


def _median(*args):
    if not args:
        raise EvalError("median() needs at least one value")
    vals = sorted(args)
    mid = len(vals) // 2
    return vals[mid] if len(vals) % 2 else (vals[mid - 1] + vals[mid]) / 2


def _choose(name, n, r):
    n, r = _require_int(name, n), _require_int(name, r)
    if n < 0 or r < 0 or r > n or n > 200:
        raise EvalError(f"{name}() needs 0 <= r <= n <= 200")
    return sp.Integer(sp.binomial(n, r) if name == "nCr" else sp.factorial(n) / sp.factorial(n - r))


def _one(fn):
    def wrapper(*args):
        if len(args) != 1:
            raise EvalError("function expects one argument")
        return fn(args[0])
    return wrapper


def _many(fn):
    def wrapper(*args):
        if not args:
            raise EvalError("function expects arguments")
        return fn(*args)
    return wrapper


FUNCTIONS: dict[str, Callable] = {
    "gcd": _gcd,
    "lcm": _lcm,
    "abs": _one(lambda x: abs(x)),
    "min": _many(lambda *a: min(a)),
    "max": _many(lambda *a: max(a)),
    "round": _round,
    "floor": _one(lambda x: sp.Integer(sp.floor(x))),
    "ceil": _one(lambda x: sp.Integer(sp.ceiling(x))),
    "sqrt": _one(_sqrt),
    "pow": _pow,
    "mean": _mean,
    "median": _median,
    "nCr": lambda n, r: _choose("nCr", n, r),
    "nPr": lambda n, r: _choose("nPr", n, r),
}

_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod)
_CMPOPS = (ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE)


@dataclass(frozen=True)
class Formula:
    source: str
    tree: ast.Expression
    names: frozenset[str]

    def evaluate(self, values: Mapping[str, sp.Rational]):
        return _Evaluator(self.source, values).visit(self.tree.body)

    def to_latex(self) -> str:
        return sp.latex(_Symbolic(self.source).visit(self.tree.body))


def parse(source: str, *, kind: str = "formula") -> Formula:
    if source is None or not source.strip():
        raise FormulaError(f"{kind} is empty")
    if len(source) > MAX_FORMULA_LENGTH:
        raise FormulaError(f"{kind} is longer than {MAX_FORMULA_LENGTH} characters")
    text = source.strip().replace("^", "**").replace("−", "-").replace("×", "*")
    try:
        tree = ast.parse(text, mode="eval")
    except SyntaxError as exc:
        raise FormulaError(f"{kind} has invalid syntax: {exc.msg}") from exc
    names: set[str] = set()
    _validate(tree.body, 1, names, kind)
    return Formula(text, tree, frozenset(names))


def _validate(node: ast.AST, depth: int, names: set[str], kind: str) -> None:
    if depth > MAX_DEPTH:
        raise FormulaError(f"{kind} is nested too deeply")
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise FormulaError(f"{kind}: only numeric literals are allowed")
        return
    if isinstance(node, ast.Name):
        if node.id in FUNCTIONS:
            raise FormulaError(f"{kind}: '{node.id}' is a function")
        names.add(node.id)
        return
    if isinstance(node, ast.BinOp) and isinstance(node.op, _BINOPS):
        _validate(node.left, depth + 1, names, kind)
        _validate(node.right, depth + 1, names, kind)
        return
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd, ast.Not)):
        _validate(node.operand, depth + 1, names, kind)
        return
    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in FUNCTIONS:
            raise FormulaError(f"{kind}: function not allowed")
        if node.keywords:
            raise FormulaError(f"{kind}: keyword arguments are not allowed")
        for a in node.args:
            if isinstance(a, ast.Starred):
                raise FormulaError(f"{kind}: unpacking is not allowed")
            _validate(a, depth + 1, names, kind)
        return
    if isinstance(node, ast.Compare) and all(isinstance(o, _CMPOPS) for o in node.ops):
        _validate(node.left, depth + 1, names, kind)
        for c in node.comparators:
            _validate(c, depth + 1, names, kind)
        return
    if isinstance(node, ast.BoolOp):
        for v in node.values:
            _validate(v, depth + 1, names, kind)
        return
    if isinstance(node, ast.IfExp):
        for v in (node.test, node.body, node.orelse):
            _validate(v, depth + 1, names, kind)
        return
    raise FormulaError(f"{kind}: unsupported syntax '{type(node).__name__}'")


def _literal(source: str, node: ast.Constant) -> sp.Rational:
    segment = ast.get_source_segment(source, node) or repr(node.value)
    return sp.Rational(segment)


class _Evaluator(ast.NodeVisitor):
    def __init__(self, source: str, values: Mapping[str, sp.Rational]):
        self.source = source
        self.values = values

    def visit_Constant(self, node):
        return _literal(self.source, node)

    def visit_Name(self, node):
        if node.id not in self.values:
            raise EvalError(f"unknown variable '{node.id}'")
        return self.values[node.id]

    def visit_BinOp(self, node):
        left, right = self.visit(node.left), self.visit(node.right)
        op = node.op
        try:
            if isinstance(op, ast.Add):
                r = left + right
            elif isinstance(op, ast.Sub):
                r = left - right
            elif isinstance(op, ast.Mult):
                r = left * right
            elif isinstance(op, ast.Div):
                if right == 0:
                    raise EvalError("division by zero")
                r = left / right
            elif isinstance(op, ast.Mod):
                if right == 0:
                    raise EvalError("division by zero")
                r = left % right
            else:
                if not getattr(right, "is_Rational", False) or right.q != 1 or abs(right) > MAX_EXPONENT:
                    raise EvalError(f"exponent must be an integer between -{MAX_EXPONENT} and {MAX_EXPONENT}")
                if left == 0 and right < 0:
                    raise EvalError("division by zero")
                r = left ** right
            return _checked(r)
        except NumberError as exc:
            raise EvalError(str(exc)) from exc

    def visit_UnaryOp(self, node):
        v = self.visit(node.operand)
        if isinstance(node.op, ast.USub):
            return -v
        if isinstance(node.op, ast.Not):
            return not _truthy(v)
        return v

    def visit_Call(self, node):
        args = [self.visit(a) for a in node.args]
        try:
            return _checked(sp.sympify(FUNCTIONS[node.func.id](*args)))
        except NumberError as exc:
            raise EvalError(str(exc)) from exc
        except TypeError as exc:
            raise EvalError(f"{node.func.id}(): wrong number of arguments") from exc

    def visit_Compare(self, node):
        left = self.visit(node.left)
        for op, comp in zip(node.ops, node.comparators):
            right = self.visit(comp)
            ok = {
                ast.Eq: left == right, ast.NotEq: left != right,
                ast.Lt: left < right, ast.LtE: left <= right,
                ast.Gt: left > right, ast.GtE: left >= right,
            }[type(op)]
            if not ok:
                return False
            left = right
        return True

    def visit_BoolOp(self, node):
        if isinstance(node.op, ast.And):
            return all(_truthy(self.visit(v)) for v in node.values)
        return any(_truthy(self.visit(v)) for v in node.values)

    def visit_IfExp(self, node):
        return self.visit(node.body) if _truthy(self.visit(node.test)) else self.visit(node.orelse)

    def generic_visit(self, node):
        raise EvalError(f"unsupported syntax '{type(node).__name__}'")


def _checked(r):
    """Rationals are kept exact (size-limited); real irrationals such as sqrt(2) pass through symbolically."""
    if getattr(r, "is_Rational", False):
        return check_size(sp.Rational(r))
    if r.is_real is not True or r.is_finite is False:
        raise EvalError("result is not a real number")
    return r


def _truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    return v != 0


class _Symbolic(ast.NodeVisitor):
    """Builds a SymPy expression only to render the formula as LaTeX."""

    def __init__(self, source: str):
        self.source = source

    def visit_Constant(self, node):
        return _literal(self.source, node)

    def visit_Name(self, node):
        return sp.Symbol(node.id)

    def visit_BinOp(self, node):
        l, r = self.visit(node.left), self.visit(node.right)
        op = node.op
        if isinstance(op, ast.Add):
            return sp.Add(l, r, evaluate=False)
        if isinstance(op, ast.Sub):
            return sp.Add(l, sp.Mul(-1, r, evaluate=False), evaluate=False)
        if isinstance(op, ast.Mult):
            return sp.Mul(l, r, evaluate=False)
        if isinstance(op, ast.Div):
            return sp.Mul(l, sp.Pow(r, -1, evaluate=False), evaluate=False)
        if isinstance(op, ast.Mod):
            return sp.Function("mod")(l, r)
        return sp.Pow(l, r, evaluate=False)

    def visit_UnaryOp(self, node):
        v = self.visit(node.operand)
        return sp.Mul(-1, v, evaluate=False) if isinstance(node.op, ast.USub) else v

    def visit_Call(self, node):
        args = [self.visit(a) for a in node.args]
        name = node.func.id
        if name == "abs" and len(args) == 1:
            return sp.Abs(args[0], evaluate=False)
        if name == "floor" and len(args) == 1:
            return sp.floor(args[0], evaluate=False)
        if name == "ceil" and len(args) == 1:
            return sp.ceiling(args[0], evaluate=False)
        if name == "sqrt" and len(args) == 1:
            return sp.sqrt(args[0], evaluate=False)
        return sp.Function(name)(*args)

    def visit_IfExp(self, node):
        return sp.Piecewise((self.visit(node.body), True))

    def generic_visit(self, node):
        return sp.Symbol("?")
